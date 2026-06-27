# **Sprint 14 Planning (WIP)**

## **1\. Executive Alignment**

**Purpose**: Build two focused generation endpoints — `/generate/candidates` and `/generate/comparison` — on top of the Supabase foundation laid in Sprint 13.

**Context**: The server-side architecture has reached the limit of what prompt iteration can fix. We are working to replace it with a database-backed system and dedicated generation endpoints, progressively reducing the agent's responsibilities until it does one job well.

Sprint 13 migrated all session state to Supabase. The `/chat` endpoint behaviour is unchanged from the user's perspective. Sprint 14 builds the first AI generation endpoints on that foundation. Each endpoint is a focused, stateless LLM call: read from DB, call LLM, write result to DB, return. The existing conversational agent is not changed this sprint — the endpoints exist and are verifiable, but no UI trigger yet calls them. 

Sprint 14's primary focus is backend. It also includes one frontend fix — the comparison matrix UI bug — to prevent a known data display error from compounding into Sprint 15. The generation endpoints themselves are not wired to any UI trigger until Sprint 15.

**Sprint Goal**: `POST /generate/candidates` and `POST /generate/comparison` exist, are callable, and write correctly to their respective DB tables. Ready for Sprint 15 to wire the frontend. 

**The Meta-Goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

\[\!IMPORTANT\] **Constraints to preserve (from prior sprints)**:

1. Keep the **Client-Authoritative State Sync** (frontend owns `mode`, backend owns content).  
2. The agent fails every time you give it a tool name in the system prompt. **Do not re-insert tool names into instructions**.  
3. Use **flat JSON tool schemas only** — no Pydantic schema generation for Groq tools; `additionalProperties` not used (Groq silently drops tools that include it in nested schemas).  
4. **Lovable is a visual reference, not a working application.** When porting a Lovable component, copy its CSS classes and layout. Never adopt its prop types or data model — those use hardcoded demo data. The web app's existing prop interfaces are authoritative.  
5. **Comparison criteria: upsert-never-delete** — rows the LLM omits are left in DB. Cell locking (fill null values only, never overwrite) is introduced this sprint via the `/generate/comparison` endpoint.  

---

## **2\. Problems in focus**

### Points of friction observed in user journey, UX & UI

Some of the problems observed during testing:

* There is too much inconsistent LLM behaviour. The LLM performs every task most of the time \- however it can be observed to fail at every task sometimes (i.e. conversing like a real travel agent, updating trip profile, updating destinations, updating comparison). Sometimes it's more technical tool-call failures, but other times they're softer performance failures like forgetting to do something or recording bad values or overwriting data.  
* Editing the trip profile via the edit buttons doesn't trigger a candidate update — the user has to send a chat message to get new suggestions. Users found this confusing. They wanted a manual control — a "refresh" button — to trigger a new round of suggestions on demand.  
* Comparison card content can change (and worsen) when navigating back and forward between phases, or prompting an update of the comparison matrix. Users find it frustrating and negative.  
* Users feel like the agents are only really needed for content generation, but they are constantly being forced into chat conversation to move the process forward and trigger change in the visual space.

### Problem: Limitations of single-agent generation

All generation — candidate suggestions, comparison matrix, card content — is owned by the conversational agents, which must also handle conversation and profile extraction simultaneously. This has created compounding problems:

* **Each agent is too stretched**: Each agent is simultaneously responsible for conversation, profile extraction, and candidate suggestion (or comparison matrix generation) — all while serialising the full session state into its context every turn. Small errors compound as context grows. The result is an agent that performs all tasks unreliably because it is doing too many jobs at once. "Jack of all trades but master of none." Test users are amazed at the scope and abilities of the agent(s), but each task still runs the risk of failing due to LLM model limitations.  
* **Comparison criteria are fragile**: the agent regenerates the full matrix on each call, so the entire criteria set can shift between turns — not just explicitly-added rows, but all of them. Criteria the user never removed disappear wholesale. Users feel the comparison is shifting moment-to-moment rather than growing and sharpening over time.  
* **Candidate richness is capped by context**: making cards significantly more detailed requires passing more data to the LLM every turn — expensive and unbounded as the session grows. There is no way to store richer content separately from what the agent needs to reason about.  
* **No persistence across sessions**: refreshing the browser kills the session for the user. There is no way to resume a planning session later.

### Bugs carried over from Sprint 13

1. **BUG — Comparison matrix UI drops criteria between turns**: The frontend replaces the displayed comparison matrix wholesale with whatever the LLM returns each turn. If the LLM returns fewer criteria than it did previously, the user sees criteria disappear — even though those rows still exist in the DB. The UI must accumulate criteria across turns (matching DB behaviour) rather than replace them.

---

## **3\. Ideation**

### Note on real-world inspiration

The architectural decisions below are grounded in our own testing and reasoning — not in verified research into what real travel products do. No product-specific inspiration was researched before these decisions were made.

This matters: citing real-world products to justify decisions already made is self-justification, not learning. It produces a feedback loop and degrades the quality of future decisions. If real-world research is done for a future sprint, it must start from "what does this product actually do?" — not "which products confirm what we've already decided?"

### Architectural destination (five-sprint arc)

The problems above share a root cause: a single agent owns all state and all generation. The fix is to separate those responsibilities across a dedicated database and focused generation endpoints.

* **State lives in a database.** Sessions, trip profile, candidates, comparison criteria, and conversation history persist across requests and browser sessions. Nothing lives in server-side memory.  
* **Dedicated generation endpoints handle AI tasks.** Each endpoint does one job: read from DB, call LLM, write result to DB, return. The agent no longer manages the visual space.  
* **The frontend calls generation endpoints directly.** Profile changes, candidate refresh, and comparison generation are triggered by the user in the visual space — not by sending a chat message.  
* **The agent's role is reduced.** It extracts profile information from natural language and answers questions. It may no longer need candidates or comparison data in its context (depending on how we position the agent \- decision won't be made before the relevant sprint planning).

### Schema design: designed for the full arc

The schema was designed in Sprint 12 for the complete five-sprint arc — not just what Sprint 13 immediately used. Tables built:

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

## **5\. Items selected for Sprint 14**

### Sprint 14: Generation endpoints

*Focus: Build two focused generation endpoints. Fix the comparison matrix UI bug.*

1. **Fix comparison matrix UI bug**: The frontend currently replaces the displayed matrix wholesale on each turn, causing criteria to drop from view. Fix so the UI accumulates criteria across turns, matching DB behaviour.

2. **`POST /generate/candidates`**: A focused generation endpoint that produces candidate suggestions given the current session state. Reads from DB; writes results back to DB.

3. **`POST /generate/comparison`**: A focused generation endpoint that generates comparison criteria and fills cell values for shortlisted candidates. Reads from DB; writes results back to DB. Cell locking: existing populated values are never overwritten.

4. **End-to-end verification**: Both endpoints callable and verified against DB state after a full test run.

---

## **6\. Next steps**

**Current status**:

1. Planning is in progress (WIP). Awaiting PM review and approval.  
2. Once approved, the `Sprint 14 Spec` will be written.  
3. The sprint is not yet ready for implementation.

**Decisions aligned between PM & Code-Agent**:

1. **The comparison matrix UI fix is in Sprint 14.** Sprint 13's goal was for the UI to reflect DB state. The comparison matrix still reflects raw LLM output — that is an incomplete migration, not an optional cleanup. It is fixed here. Section 1 updated accordingly.

2. **`/generate/candidates` — LLM context.** The endpoint passes to the LLM: the structured trip profile (from DB), rejected candidates with their rejection reasons (from DB, so they are never re-suggested), the names of currently suggested and shortlisted candidates (from DB, to avoid re-filling slots with already-seen destinations), and the pruned conversation history (same depth as today — preserves nuance not yet formally extracted into the profile). The comparison matrix, mode field, and session envelope are excluded as irrelevant to candidate generation. The prompt covers one job only. This makes the endpoint strictly leaner than the current all-in-one agent even with history included.

3. **`/generate/candidates` — write behavior.** The endpoint upserts new suggestions by name — it does not replace or clear the existing candidate list. New candidates are added; existing ones are updated in place; shortlisted and rejected candidates are never touched. This matches current agent behavior and preserves the full candidate history, which is consistent with future ranking or ordering features (down-rank rather than delete).

4. **`/generate/comparison` — cell-locking mechanism.** The endpoint reads the DB before calling the LLM, identifies which criterion × candidate cells have no value (null), and asks the LLM to fill only those specific cells. The LLM receives a targeted list of what is missing — it does not see already-populated values and does not need to know about locking. Complexity sits in the DB read and list-construction logic, not in the prompt. This is more token-efficient than generating the full matrix and filtering. It also naturally supports future cell editing: clear a cell in the DB, call the endpoint, only that cell gets regenerated.

5. **`/generate/comparison` — `trip_feel` and `seasonal_note`.** This endpoint generates and writes both fields for each shortlisted candidate, in addition to the comparison criteria rows. These fields live on the candidates table (not in comparison_criteria) but are part of the comparison experience — the current agent generates them at the same moment it generates the matrix. They are not generated at the candidate suggestion stage: only 2–4 of up to 15 suggested candidates typically get shortlisted, so generating them early would produce content for destinations the user never compares.

6. **Comparison matrix bug fix — approach.** Fixed in Sprint 14 via a frontend merge: the client accumulates comparison criteria across turns rather than replacing its displayed state with whatever the LLM returns each turn. Criteria already on screen are never dropped, even if the LLM returns a shorter list. In Sprint 15, when the comparison display is driven by `/generate/comparison` directly rather than by `/chat` responses, this accumulation logic becomes unreachable and is deleted — not left as dead code.

7. **Cell-locking integrity under `/chat` — deferred to Sprint 16.** After Sprint 14, `save_session` still upserts to `comparison_criteria` whenever the conversational agent fires `TOOL_GENERATE_COMPARISON_MATRIX` via chat. This can overwrite a previously generated cell value with a worse one. It cannot delete rows — upsert-never-delete means the DB never loses rows via this path. The clean resolution is Sprint 16: remove `TOOL_GENERATE_COMPARISON_MATRIX` from the comparison agent (or replace it with a call to `/generate/comparison`), making the generation endpoint the sole writer. Until then, this is a known carry-forward constraint.

**Decisions still open between PM & Code-Agent**:

* None.

---

