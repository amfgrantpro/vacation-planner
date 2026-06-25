# **Sprint 12 Planning (WIP)**

## **1\. Executive Alignment**

**Purpose**: Introduce a database as the foundation for a five-sprint architectural shift away from in-memory session state.

**Context**: All session state — trip profile, candidates, comparison criteria, and conversation history — currently lives in server-side Python memory and is serialised into the LLM's context on every turn. This architecture has reached the limit of what prompt iteration can fix. Sprint 12 begins a five-sprint arc (Sprints 12–16) that replaces it with a database-backed system and dedicated generation endpoints, progressively reducing the agent's responsibilities until it does one job well.

Sprint 12 is foundational only: set up Supabase with the correct schema. No application code changes this sprint.

**Sprint Goal**: Supabase project configured; all tables created and verified. Ready for Sprint 13 to migrate the `SessionManager`.

**The Meta-Goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

\[\!IMPORTANT\] **Constraints to preserve (from prior sprints)**:

1. Keep the **Client-Authoritative State Sync** (frontend owns `mode`, backend owns content).
2. Preserve the **Conditional Dual-Call ReAct Loop** in the backend orchestrator.
3. The agent fails every time you give it a tool name in the system prompt. **Do not re-insert tool names into instructions**.
4. Use **flat JSON tool schemas only** — no Pydantic schema generation for Groq tools; `additionalProperties` not used (Groq silently drops tools that include it in nested schemas).
5. Candidate upsert is by `name.lower()` — never replace the full array; shortlisted names are skipped.
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
* **The agent's role is reduced.** It extracts profile information from natural language and answers questions. It may no longer need candidates or comparison data in its context (depending on how we position the agent - decision won't be made before the relevant sprint planning).

### Schema design: what the full arc needs from the database

The schema should be designed for the complete five-sprint arc from the start — not just what Sprint 13 immediately uses. Tables needed:

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
|---|---|---|
| 12 | Database setup | Schema exists and is correct |
| 13 | Session persistence migration | App reads/writes from DB; `/chat` behaviour unchanged |
| 14 | Generation endpoints | `/generate/candidates` and `/generate/comparison` exist and can be called |
| 15 | Frontend wired to endpoints | Candidate refresh and comparison triggered directly from the visual space |
| 16 | Agent simplified | Tools and scope reduced based on what Sprint 15 reveals |

---

## **5\. Items selected for Sprint 12**

### Sprint 12: Database setup

*Focus: Set up Supabase with the correct schema for the full five-sprint arc. No application code changes this sprint.*

1. **Create Supabase project**: Free tier. Configure environment variables for the API URL and anon/service role keys.
2. **Define and create all tables**: `sessions`, `trip_profile`, `candidates`, `comparison_criteria`, `conversation_history`. Schema should reflect the full data model the five-sprint arc will need — not only what Sprint 13 immediately uses.
3. **Verify schema**: Confirm all tables, column types, and relationships are correct before Sprint 13 begins the `SessionManager` migration.

---

## **6\. Next steps**

**Current status**:

1. Planning is complete. The PM has approved the Sprint 11 Spec.  
2. The `Sprint 12 Spec` has been written and approved: `sprint-12-spec.md`.  
3. The sprint is ready for implementation.

**Decisions aligned between PM & Code-Agent**:

1. **`photo_url` persistence**: Include `photo_url` as a regular column in the candidates table — no reason to treat it differently from any other field. Candidates are per-session (each session generates its own set, linked by `session_id`). The URL is resolved at write-time during Sprint 13's migration, same as today. Schema updated to reflect this.
2. **Comparison criteria storage**: One row per (criterion × candidate) pair. Candidates can leave and re-enter the shortlist with their values preserved; missing values for a re-shortlisted candidate are filled on the next generation call.
3. **Conversation history format**: Each message stored as a JSONB blob. Preserves full Groq API message structure (including `tool_calls` / `tool_call_id`) for restore-on-load. No querying of individual turns required.
4. **Schema creation method**: SQL script checked into the repo (`supabase/schema.sql`), run via the Supabase dashboard SQL Editor. No CLI required. The spec will walk through account setup and each step - the PM is a first-time user of Supabase and does not have an account yet. 
5. **Verification method**: Visual check in the Supabase Table Editor — confirm each table exists with the correct columns and relationships. The spec will include a checklist. Full end-to-end verification happens in Sprint 13.
6. **Supabase free tier**: Acceptable. Cold-start delay (a few seconds after a period of inactivity) is not a concern for a two-person dev tool.

**Decisions still open between PM & Code-Agent**:

* None.
