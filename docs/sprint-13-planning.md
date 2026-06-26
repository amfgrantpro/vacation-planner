# **Sprint 13 Planning**

## **1\. Executive Alignment**

**Purpose**: Migrate all session state from server-side Python memory to Supabase. After this sprint, the application reads and writes sessions, trip profile, candidates, comparison criteria, and conversation history from the database. The `/chat` endpoint behaviour is unchanged from the user's perspective — this is a backend-only change.

**Context**: All session state — trip profile, candidates, comparison criteria, and conversation history — currently lives in server-side Python memory and is serialised into the LLM's context on every turn. This architecture has reached the limit of what prompt iteration can fix. Sprint 12 laid the database foundation: Supabase is provisioned with a five-table schema designed for the full five-sprint arc (Sprints 12–16). Sprint 13 is the first application-code sprint in that arc: replace the in-memory `SessionManager` with database reads and writes, without changing any user-facing behaviour.

**Sprint Goal**: `SessionManager` migrated to Supabase; app reads and writes all session data from the database; `/chat` behaviour unchanged from the user's perspective. Ready for Sprint 14 to add generation endpoints.

**The Meta-Goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

\[\!IMPORTANT\] **Constraints to preserve (from prior sprints)**:

1. Keep the **Client-Authoritative State Sync** (frontend owns `mode`, backend owns content).  
2. Preserve the **Conditional Dual-Call ReAct Loop** in the backend orchestrator.  
3. The agent fails every time you give it a tool name in the system prompt. **Do not re-insert tool names into instructions**.  
4. Use **flat JSON tool schemas only** — no Pydantic schema generation for Groq tools; `additionalProperties` not used (Groq silently drops tools that include it in nested schemas).  
5. Candidate upsert key is `(session_id, lower(name))` — never replace the full array; shortlisted candidates are skipped.  
6. **Lovable is a visual reference, not a working application.** When porting a Lovable component, copy its CSS classes and layout. Never adopt its prop types or data model — those use hardcoded demo data. The web app's existing prop interfaces are authoritative.

---

## **2\. Problems in focus**

### Points of friction observed in user journey, UX & UI

Some of the problems observed during testing:

* There is too much inconsistent LLM behaviour. The LLM performs every task most of the time \- however it can be observed to fail at every task sometimes (i.e. conversing like a real travel agent, updating trip profile, updating destinations, updating comparison). Sometimes it’s more technical tool-call failures, but other times they’re softer performance failures like forgetting to do something or recording bad values or overwriting data.  
* Editing the trip profile via the edit buttons doesn’t trigger a candidate update — the user has to send a chat message to get new suggestions. Users found this confusing. They wanted a manual control — a "refresh" button — to trigger a new round of suggestions on demand.  
* Comparison card content can change (and worsen) when navigating back and forward between phases, or prompting an update of the comparison matrix. Users find it frustrating and negative.  
* Users feel like the agents are only really needed for content generation, but they are constantly being forced into chat conversation to move the process forward and trigger change in the visual space.

### Problem: Limitations of in-memory session state

All session state — trip profile, candidates, comparison criteria, and conversation history — lives in server-side Python memory and is passed to the LLM on every turn. This has created compounding problems:

* **Each agent is too stretched**: Each agent is simultaneously responsible for conversation, profile extraction, and candidate suggestion (or comparison matrix generation) — all while serialising the full session state into its context every turn. Small errors compound as context grows. The result is an agent that performs all tasks unreliably because it is doing too many jobs at once. "Jack of all trades but master of none." Test users are amazed at the scope and abilities of the agent(s), but each task still runs the risk of failing due to LLM model limitations.  
* **Comparison criteria are fragile**: the agent regenerates the full matrix on each call, so the entire criteria set can shift between turns — not just explicitly-added rows, but all of them. Criteria the user never removed disappear wholesale. Users feel the comparison is shifting moment-to-moment rather than growing and sharpening over time.  
* **Candidate richness is capped by context**: making cards significantly more detailed requires passing more data to the LLM every turn — expensive and unbounded as the session grows. There is no way to store richer content separately from what the agent needs to reason about.  
* **No persistence across sessions**: refreshing the browser kills the session entirely. There is no way to resume a planning session later.

### Bugs carried over from previous improvements

1. None.

---

## **3\. Ideation**

### Architectural destination (five-sprint arc)

The problems above share a root cause: a single agent owns all state and all generation. The fix is to separate those responsibilities across a dedicated database and focused generation endpoints.

* **State lives in a database.** Sessions, trip profile, candidates, comparison criteria, and conversation history persist across requests and browser sessions. Nothing lives in server-side memory.  
* **Dedicated generation endpoints handle AI tasks.** Each endpoint does one job: read from DB, call LLM, write result to DB, return. The agent no longer manages the visual space.  
* **The frontend calls generation endpoints directly.** Profile changes, candidate refresh, and comparison generation are triggered by the user in the visual space — not by sending a chat message.  
* **The agent's role is reduced.** It extracts profile information from natural language and answers questions. It may no longer need candidates or comparison data in its context (depending on how we position the agent \- decision won't be made before the relevant sprint planning).

### Schema design: what the full arc needs from the database

The schema was designed in Sprint 12 for the complete five-sprint arc — not just what Sprint 13 immediately uses. Tables built:

* **Sessions**: session ID, creation timestamp, updated timestamp, mode ("explore" / "compare" / "decision"), selected\_winner.  
* **Trip profile**: linked to session; all current profile fields (travelers, origin, when, duration, budget, vacation\_type, likes, avoid). Note: `vacation_type`, `likes`, and `avoid` are string arrays in the current model (`List[str]`).  
* **Candidates**: linked to session; all current candidate fields — name, region, vibe, photo\_url, trip\_feel, seasonal\_note, rejection\_reason — plus status (`suggested` / `shortlisted` / `rejected`).  
* **Comparison criteria**: linked to session; one row per (criterion × candidate) pair — criterion name, candidate name, and value. This allows candidates to leave and re-enter the shortlist while retaining their previously generated values; any missing values for a re-shortlisted candidate are filled on the next generation call. Note: `trip_feel` and `seasonal_note` live on the candidate record (candidates table above), not here.  
* **Conversation history**: linked to session; one row per message turn, with the full Groq API message dict stored as a JSONB blob. Preserves `tool_calls` arrays and `tool_call_id` fields intact for restore-on-load without normalisation.

---

## **4\. The Strategy**

Eleven sprints of testing confirmed that the single-agent, in-memory model is a ceiling. The agent performs every task most of the time, but fails at every task sometimes — and failures compound as sessions grow. Prompt iteration cannot fix a structural problem.

The five-sprint arc delivers the new architecture incrementally, with each sprint producing a working, testable state:

| Sprint | Focus | Outcome |
| :---- | :---- | :---- |
| 12 | Database setup | Schema exists and is correct |
| 13 | Session persistence migration | App reads/writes from DB; `/chat` behaviour unchanged |
| 14 | Generation endpoints | `/generate/candidates` and `/generate/comparison` exist and can be called |
| 15 | Frontend wired to endpoints | Candidate refresh and comparison triggered directly from the visual space |
| 16 | Agent simplified | Tools and scope reduced based on what Sprint 15 reveals |

---

## **5\. Items selected for Sprint 13**

### Sprint 13: Session persistence migration

*Focus: Replace the in-memory `SessionManager` with Supabase reads and writes. Backend-only change — no user-facing behaviour changes this sprint.*

1. **Add Supabase Python client**: Add `supabase-py` to the project and configure it with the existing environment variables.
2. **Migrate `SessionManager` to Supabase**: Replace in-memory session storage with database reads and writes across all five tables. The `/chat` endpoint interface is unchanged.
3. **Session ID migration**: Update session ID generation to use UUIDs from Supabase rather than the current client-side alphanumeric strings.
4. **`travel_when` field mapping**: Handle the mismatch between the app's `TripProfile.when` field and the database column `travel_when`.
5. **End-to-end verification**: Confirm data integrity across all five tables after a full session run.

---

## **6\. Next steps**

**Current status**:

1. Planning is complete. The PM has approved the Sprint 13 plan.
2. The `Sprint 13 Spec` has been written and approved: `sprint-13-spec.md`.  
3. The sprint is ready for implementation.

**Decisions aligned between PM & Code-Agent**:

1. **Session creation protocol** — Session is created at the "Let's get going" click — the user's moment of intent. A new `POST /sessions` endpoint is called by the landing screen at that moment; it returns a UUID which the frontend stores and passes in all subsequent requests. This decouples session creation from `/chat`, so future endpoints (generation calls, etc.) can reference the session ID without a chat turn having happened first.

2. **Comparison matrix reconstruction** — When reading from the DB, the matrix is reconstructed for currently shortlisted candidates only. Previously-generated values for de-shortlisted candidates are preserved in the DB (available if a candidate is re-shortlisted in a future sprint) but are not included in the reconstructed matrix. This is an improvement on current behaviour, where removing a candidate loses its comparison data permanently.

3. **`VacationPlan.notes` field** — Dead code: present in `models.py`, never written to, absent from `schema.sql`. Excluded from the migration. No DB column needed.

4. **Prototype session** — `PrototypeSessionManager` stays in-memory. The `/chat/prototype` endpoint is a locked Sprint 3 demo and is out of scope.

5. **Write strategy** — Full write to all relevant tables on every `save_session` call for Sprint 13. This is a deliberate trade-off: targeted writes add meaningful complexity. Sprint 14's generation endpoints will naturally introduce targeted writes (each endpoint does one job and writes to specific tables), so the architecture moves that direction on its own.

6. **Upsert semantics for comparison criteria** — Upsert means insert-or-update, never delete: rows the LLM omits in a given turn are left untouched in the DB rather than disappearing, which is already an improvement on today's in-memory behaviour. In Sprint 13 the LLM can still overwrite existing cell values when it regenerates the matrix, so value drift is not fully solved yet. The `comparison_criteria` schema is designed so that Sprint 14's `/generate/comparison` endpoint can target only null values, leaving populated cells locked — that's when value stability can be enforced.

**Decisions still open between PM & Code-Agent**:

* None.
