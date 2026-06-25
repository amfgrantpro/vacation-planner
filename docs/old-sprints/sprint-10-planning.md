# **Sprint 10 Planning**

## **1\. Executive Alignment**

**Purpose**: The Explore prompt has accumulated patches across multiple sprints without a holistic review; the Compare prompt was written once in Sprint 9 and has never been iterated. Both agents are being rewritten with clear missions and sharper instructions built for their specific phase.

**Context**: Sprint 9 introduced a multi-agent architecture — one for Exploration, one for Comparison/Decision. We also improved message history pruning so that the full record of what the user has expressed is preserved across turns and across agent handoffs.

Splitting into specialised agents — each with a focused prompt and only the tools relevant to its phase — reduces the conditions under which format drift and wrong-tool usage occur, and enables us to give more specific instructions for each phase to improve task success without weakening performance in the other phases.

**Sprint Goal**: Both agents have prompts that are purpose-built for their phase — the Explore agent diagnoses and matches, and the Compare agent drives toward a decision rather than comparing indefinitely.

**The Meta-Goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

\[\!IMPORTANT\] **Constraints to preserve (from prior sprints)**:

1. Keep the **Client-Authoritative State Sync** (frontend owns `mode`, backend owns content).  
2. Preserve the **Conditional Dual-Call ReAct Loop** in the backend orchestrator.  
3. Use **flat JSON tool schemas only** — no Pydantic schema generation for Groq tools; `additionalProperties` not used (Groq silently drops tools that include it in nested schemas).  
4. The agent fails every time you give it a tool name in the system prompt. **Do not re-insert tool names into instructions**.  
5. Candidate upsert is by `name.lower()` — never replace the full array; shortlisted names are skipped.

---

## **2\. Issues raised during user testing**

### Points of friction in user journey, UX & UI

**General product experience:**

* The agent frequently paraphrases what the user just said before responding. Sprint 6 reduced this, but the pattern still appears regularly.  
* Users consistently prefer to act in the visual space rather than in the chat — the chat feels dense and the large visual area feels underused. This applies to both Explore and Comparison. PM remark: Worth considering what it would look like to move some of the interaction — questions, input, key information — into the visual space rather than keeping everything in the chat strip. More research into other travel products (e.g. Layla, Mindtrip & others) is needed.

**Landing**:

* Vacation type dropdown lacks options and doesn’t support combinations.  
* The two optional fields feel too similar to the required questions; their placement after the CTAs is confusing.  
* The landing page doesn’t explain the product journey — users arrive without knowing what they’re about to experience or how the chat and visual space work together.

**Explore**:

* “I already have ideas” doesn’t alter the conversation — the agent rarely asks what the ideas are.  
* The agent never asks about previous trips as a reference point for the new one.  
* Cards often show only a continent-level region with no country. Unknown destinations require “Tell me more” to find out where they actually are.  
* “Tell me more” produces a chat response when users want the information in the visual space, in a card format similar to the comparison cards.  
* Perhaps “Tell me more” would be better as an options button like “Tell me more about…” with options “where it is”, “what people do there”, “what the food is like” etc.  
* The product doesn’t serve users who know where they’re going but don’t know what to do there (e.g. I’m going to New York, which parts of the city should I go and see?).

**Comparison**:

* The phase lacks the focus and structure to drive toward a decision.  
  * Questions are generic trade-offs rather than specific to the shortlisted destinations or what the user actually needs to decide.  
  * It starts the mode by restating points from the destination vibe in order to compare conversationally.  
  * The agent doesn’t care much about the trip profile anymore \+ rarely updates the profile.  
  * It doesn’t seem to ask anything about what I really want to compare them by, or what I want to experience, or must-have things for a location to really win the final decision.  
* Vacation Vibe and Best For are imprecise — vibe reads as a destination description rather than a personal trip feel, and Best For is too similar to vibe to add value.  
* Good agent reasoning is often buried in the chat when users would rather see it in the visual space.  
* Users want a light itinerary or activity preview to help compare destinations. They want to know what the day-to-day might look like, and how a vacation would feel to them.  
* Comparison card content can change (and worsen) when navigating back and forward between phases, which users find disorienting.

**Decision**: Under-utilised as a phase.

### Being able to continue where you left-off would be appreciated

It was noted that a method of picking up a session to continue later would be a good improvement.

* Hitting refresh manually (or having the browser auto-refresh) kills the session and forces a restart with effort going back into intake and profile building, and not having the same chat history.  
* Sometimes you want to have another discussion about the same vacation to see what other options the LLM will provide in a different chat (i.e. same Trip Profile, new session).

### Architectural limitations of in-memory session state

All candidate, comparison, and trip profile data lives in server-side session memory and is passed to the LLM on every turn. Two specific problems have emerged from this:

* **Comparison criteria are fragile**: because the agent regenerates the full matrix on each call, explicitly-added criteria can be silently dropped or overwritten without the user having removed them.  
* **Candidate cards are limited in richness by agent context**: making cards significantly more detailed requires passing more data to the LLM every turn — expensive and unbounded as the session grows. There is no way to store richer content separately from what the agent needs to reason about.

More broadly, the product has no persistence layer. Everything is ephemeral within a single server process.

### Bugs carried over from previous improvements

1. **Trip profile silently drops array items on update**: during the live session, the Explore agent's `update_trip_profile` call overwrote `likes`/`avoid` with a shorter list than before — some previously recorded items were dropped rather than carried forward, even though the tool description instructs the model to always send the complete current list.   
2. **Comparison agent calls both its tools every turn**: in Compare mode, the agent was observed calling both `update_trip_profile` and `generate_comparison_matrix` on every turn, even when there was nothing new to add to the trip profile. Not currently causing visible problems (the upsert/full-resend patterns mean redundant calls are harmless), but it's an extra LLM-driven tool call every turn with no benefit — worth tightening the Compare-mode prompt guidance on when each tool is actually needed.  
3. **Explore agent re-records intake data on first turn**: on session start, the Explore agent calls `update_trip_profile` with the values already present from the intake form — origin, travelers, when, duration, vacation type — writing them back unchanged. The intake form pre-populates these fields in the trip profile before the first turn, so the call is redundant. The agent should be guided to skip profiling steps when the intake data is already reflected in state.

---

## **3\. Ideation**

### Ideation: Explore agent prompt rewrite

**Proposed solutions:**

* **Mirroring**: Two changes to `SHARED_GUIDELINES`. (1) Remove “warm” from item 1 — tone should come from the quality of recommendations, not from persona framing. (2) Extend item 4 (“Don’t Narrate Your Writes”) to explicitly cover echoing user input, not just tool narration. Something like: “Do not paraphrase or validate what the user just said before responding — act on it. The candidate panel updating IS the acknowledgment.”  
* **Destinations in mind**: First turn still calls `suggest_candidates` as normal (3 best-guess candidates, keeping the panel populated per the "keep it full" guideline) — but the chat message asks the user to name the destinations they have in mind, instead of describing the 3 shown. Named destinations are added via the normal upsert on the next turn.  
* **Previous trips**: Add a bullet to the explore conversation guidance (not first-turn) instructing the agent to ask about a past trip that went well, as a natural reference point for the current search — prioritised for an early turn (e.g. turn 2-3) rather than left fully opportunistic, so it doesn't lose out indefinitely to trade-off questions for the single "Drive Forward" slot. The information stays in conversation context and informs recommendations — no new state field needed. Exact phrasing to manage prompt length is a spec-time concern.  
* **Re-calling trip profile**: Strengthen the first-turn instruction: explicitly say do not call the profile update tool on your first turn — intake data is already reflected in state.

---

### Ideation: Comparison agent prompt rewrite

*The compare prompt is brand new — written in Sprint 9 for the first time and barely tested. Treat this as a holistic rewrite, not a collection of patches.*

**Proposed solutions:**

* **Compare mission**: The agent needs a unifying mission equivalent to Explore’s “two equal halves.” Current instructions are a task list with no goal sentence. Proposed direction: the compare agent’s job is to discover what criteria matter most to this specific person, and show how their shortlist maps against those. The matrix is the tool, not the goal. This needs to be written as a single sentence the rest of the instructions hang off.  
* **Destination vibe & Trip feel**: originally the design distinguished "destination vibe" (explore cards: what is this place) from "vacation vibe" (shortlist cards: what would YOUR trip here feel like). They were merged into a single `vibe` field and neither was refined since — mirrors the "about this place" / "why this fits you" split used by products like Mindtrip/Layla. **Sprint 10 (prompt + tool-schema descriptions only — no field rename)**: `vibe`'s content becomes destination-descriptive ("about this place"); `best_for`'s content is redefined as "trip feel" — given this user's profile, what would their trip here actually feel like (the experiential layer the matrix doesn't cover). Same field names and schema structure throughout — no state-object or frontend change this sprint.  
  **Sprint 11 follow-up** (§6): align the FE labels — Explore's "Destination vibe" and Compare's "Vacation vibe" both describe the same (now-aligned) `vibe` content and should share a label; the `best_for` card section is relabelled to reflect "Trip Feel", with a possible `best_for` → `trip_feel` rename in the schema/state at that point.  
  PM remark: We can also encourage the agent to add a "Best For" row to the comparison matrix as an example criterion — distinct from the `best_for`/"Trip Feel" card field above, this is a general comparative "what's this destination best suited for" axis, not a set UI requirement but often still given.  
* **Both tools every turn**: Addressed as part of the holistic prompt rewrite — add explicit conditions for when each tool should and shouldn’t be called.  
* **Bugs**: Documented with solutions in Section 5, Phases 1 \& 2\.

---

### Problem: First impressions, intake and initial Exploration experience

Improve the first impression and interactions between users and the product.

* Add a brief visual or textual explanation of the product flow before the intake form — what the chat does, how destination cards work, what the user is working towards, even how to add comparison criteria. Goal is to get more users to the aha moment rather than dropping off before they understand the product.  
* The two optional intake fields feel too similar to the required questions and their placement after the CTA is confusing. Vacation type dropdown also lacks options. Rethink the form order and expand the dropdown.  
* Cards currently show region (often just the continent). Unknown destinations like the High Tatras require a "Tell me more" to find out where they actually are. Country should be visible on the card itself.  
* The “Tell me more” button (Explore) is better used when you’re finding out more about a location out of definite interest. Perhaps it would be better as an options button like “Tell me more about…” with options “where it is”, “possible activities”, “food & drink” etc.  
* One user noted that when using the “Tell me more” button, they wanted to see more information in the visual space, not in the chat. They feel like the best information is in the comparison cards, but they felt they had to go forward (to compare) in order to get that information. The user noted that not all of the compare information is required: a shorter card with similar information/layout would also work.

### Ideation: Backend use cases

The product has no persistence layer — a backend store could serve several distinct purposes, not all of which need to be built together. Use cases to consider:

* **Rich candidate content**: generate and store a richer version of candidate cards (lazily, on demand) so the visual surface can show more detail without that data sitting in the LLM's context every turn.  
* **Durable comparison criteria**: a criteria list the agent can append to but never overwrite, so explicitly-added rows survive matrix regeneration.  
* **Photo URL cache**: destination → Unsplash URL, built up over time, reducing live API calls for destinations that have been looked up before.  
* **Destination knowledge base**: generic destination facts (geography, climate, activities) that are not profile-specific and could be reused across sessions rather than regenerated each time.  
* **Trip profile as a persisted entity**: the profile is the richest output the product creates — persisting it as the root entity, with candidates and criteria hanging off it, is the most natural data model for the product.  
* **Analytics / product intelligence**: what destinations are suggested, shortlisted, rejected — queryable over time to inform product decisions.

Not all of these need to be in the same sprint. The question is which use case makes the most sense as the foundation — both for product value and for what it teaches about building and working with a real persistence layer. None of these require the agent to change significantly — the agent stays lean, and the backend handles persistence. But building it introduces a real external data store to the project (e.g. Supabase free tier), a new generation pattern decoupled from the main agent loop, and retrieval endpoints the frontend can call independently. A meaningful step toward a deployed product.

---

### Problem: Session loss on browser refresh & ability to continue later on

These are two distinct problems with different solutions:

1. **Restore on refresh** (same browser/device, short-term): The client-side app stores the session payload (`messages`, `plan`, `uiState`) in `localStorage` keyed by `session_id`. On page load, the frontend checks for existing session data and restores it instantly. Low complexity, no backend required, covers the “accidentally refreshed” case.  
2. **Come back later / continue across sessions** (the more valuable feature): Stores Trip Profile, rejected candidates, and shortlisted candidates under a shareable Chat ID. The user can enter the ID to resume planning — the agent is initialised with the saved state and starts a new conversation from that point. This requires some form of persistence (backend database, or encoded state in a URL) and is meaningfully more complex than localStorage. This is the version that maps to real-product behaviour — most travel planning happens across multiple sessions.

---

## **4\. The Strategy**

Sprints 10, 11 and 12 improve the product experience and benefit by having 2 agents with more focused characters/goals.

* **DONE: Sprint 9**. Splitting into specialised agents enables us to give more specific instructions for each phase to improve task success without weakening performance in the other phases.  
* **Sprint 10** (Agent: Explore & Comparison). The per-agent prompts created in sprint 9 are the right place to embed the improved conversation behaviour.  
* **Sprint 11** (UI: first impressions & intake) is largely independent of agent behaviour and could in principle move earlier or later.  
* **Sprint 12** (UI: Visual surface interactivity). The improved prompts created in sprint 10 can better-respond to more detailed UI requirements.

---

## **5\. Items selected for Sprint 10**

### Sprint 10: Agent \- Improve Explore & Comparison experience

*Focus: Update the Explore & Comparison agents to sharpen the journey during each phase.*

**Phase 1: Explore agent**

1. **BUG: Explore agent re-records intake data on first turn**: Strengthen the first-turn instruction to explicitly say: do not call the profile update tool on your first turn — intake data is already in state. Only use it for new information learned through conversation.  
2. **Better journey for "I already have destinations"**: Currently this path doesn’t meaningfully change the conversation. Add a conditional branch to the first-turn instruction: if state indicates the user already has destinations in mind, the first turn still calls `suggest_candidates` as normal (3 best-guess candidates, keeping the panel populated per the existing "keep it full" guideline) — but the chat message asks the user to name the destinations they have in mind, instead of describing the 3 shown. When the user names them, add those as candidates via the normal upsert on the next turn.  
3. **Ask about previous trips**: Add guidance to the explore conversation flow (not first-turn) to ask about a past trip that went well as a natural reference point — prioritised for an early turn (e.g. turn 2-3) rather than left fully opportunistic, so it doesn’t lose out indefinitely to trade-off questions for the single "Drive Forward" slot. Information lives in conversation context and informs recommendations — no new state field needed. Exact phrasing to manage prompt length is a spec-time concern.  
4. **Update Shared Guidelines to reduce mirroring**: (1) Remove warmth framing from item 1\. (2) Extend item 4 to cover echoing user input, not just tool narration.  
5. **BUG: Trip profile silently drops array items on update**: Add a server-side union merge for `likes` and `avoid` in `_apply_tool_call` — incoming items are added to existing ones, never dropped. Deliberate removal (e.g. user says "I don’t mind crowds anymore") is handled by the existing UI feature (`TripProfileComponent` remove-chip → `profile_override`).  
   * **Related fix, same theme**: `main.py`'s `profile_override` handling currently skips syncing a field when the incoming list is empty (`if len(value) > 0`), so removing the *last* `likes`/`avoid` item via the UI doesn't reach `session.plan.trip_profile`. Fix this alongside the union merge — the merge's "removal handled by UI" framing depends on the UI's removals actually landing in state first. Backend-only (`main.py`), no UI change.  
   * **Sequencing**: implement this item (both fixes) as a distinct, isolated step within Phase 1 — e.g. first, before the prompt-rewrite items — so it's easy for the coding agent to keep separate from the prompt-content changes.

**Phase 2: Comparison agent**

1. **Holistic prompt rewrite with a unified mission**: The compare prompt was written once in Sprint 9 and barely tested. Rewrite it around a clear mission sentence — the agent’s job is to uncover what criteria matter most to this specific person and show how their shortlist maps against those. The matrix is the tool, not the goal. All instructions should serve that sentence. **Opening turn**: keep it brief and action-oriented — kick off the comparison (generate the matrix) and orient the user on how to start the comparison journey. Don't restate destination vibe info or narrate findings in chat; the matrix/UI carries the insight, the chat keeps things moving.  
2. **BUG: both-tools-every-turn**: Add explicit conditions in the rewrite for when each tool should and shouldn’t be called — call `update_trip_profile` when something new is worth recording; call `generate_comparison_matrix` when it doesn’t yet exist or a new criterion needs adding.  
3. **Vibe and best_for fields — content redefinition (no schema/FE change this sprint)**: Redefine `vibe`'s content as destination-descriptive ("about this place" — mirrors Explore's "Destination vibe"). Redefine `best_for`'s content as "trip feel" — given this user's profile, what would their trip here actually feel like (the experiential layer the matrix doesn't cover). Both are prompt + tool-schema description edits only — field names and structure are unchanged. The agent can also be encouraged to surface "Best For" as a matrix row example. **Follow-up in Sprint 11** (§6): align the FE labels for `vibe` (Explore "Destination vibe" / Compare label) and `best_for` ("Trip Feel"), and consider the `best_for` → `trip_feel` field rename at that point.  
4. **Update Shared Guidelines to reduce mirroring**: Same changes as Explore — remove warmth framing from item 1, extend item 4 to cover echoing user input.  
5. **Decision-mode handoff consistency pass**: Light review of `MODE_INSTRUCTIONS["decision"]` so its opening connects naturally to how Compare concludes (e.g. referencing the chosen destination's strengths from the matrix/profile) — a handoff-smoothing pass, not a new "are you ready to decide?" prompt. The user decides when they're done; Compare should not develop a habit of asking.

---

## **6\. Proposed Roadmap for upcoming sprints (Sprints 11-13)**

### Sprint 11: UI \- Improve the first impression, intake and initial exploration experience

*Focus: Improve the first impression and interactions between users and the product.*

1. **Landing page: explain the product journey**: Add a brief visual or textual explanation of the product flow before the intake form — what the chat does, how destination cards work, what the user is working towards, even how to add comparison criteria. Goal is to get more users to the aha moment rather than dropping off before they understand the product.  
2. **Landing page: increase intake form options**: Vacation type dropdown lacks options and the ability to select multiple types.  
3. **Landing page: fix intake form order**: The two optional fields feel too similar to the required questions and their placement after the CTA is confusing. The “I already have destinations” CTA is a bit lost (see above: the path doesn’t meaningfully change the conversation anyway). Rethink the order of the form for a better and more understandable flow.  
4. **Destination vibe / Trip feel — FE label alignment & possible field rename**: Follow-up to Sprint 10's prompt-only `vibe`/`best_for` content redefinition (Sprint 10 §5 Phase 2 item 3). Align the FE labels — Explore's "Destination vibe" and Compare's "Vacation vibe" both describe the same (now-aligned) `vibe` content and should share a label; relabel the `best_for` card section to reflect "Trip Feel". Consider renaming `best_for` → `trip_feel` in the tool schema, state object, and frontend at this point.

### Sprint 12: UI \- Increase interactivity of the visual surface

*Focus: Update the UI to encourage users to make use of the consultative side of the agent.*

1. **UI: Show country/region on candidate cards (Explore)**: Cards currently show region (often just the continent). Unknown destinations like the High Tatras require a "Tell me more" to find out where they actually are. Country should be visible on the card itself.  
2. **Improve the “Tell me more” button (Explore)**: It’s better used when you’re finding out more about a location out of definite interest. Perhaps it would be better as an options button like “Tell me more about…” with options “where it is”, “possible activities”, “food & drink” etc. Perhaps is better if we bring up a more detailed candidate card with more info. Not sure.  
3. **Increase prominence of custom Comparison criteria**: Encourage users (in the UI) and the agent to add custom comparison rows (e.g., "Add a row for…” \+ accommodation style, kid-friendliness, vegetarian food options etc.). The agent dynamically updates the matrix criteria.

### Sprint 13: Backend — Persistence layer

*Focus: Introduce a real persistence layer to the project. The specific use cases will be selected from the backlog based on what makes the most sense as a foundation — both for product value and as a learning exercise in building with an external data store.*

1. **Backend: Trip profile as a persisted entity**: The trip profile is the richest output the product creates. Persisting it as the root entity — with candidates and criteria hanging off it — is the most natural data model for the product and opens up future multi-session scenarios.

### Backlog of items not yet selected for any Sprint

* **Backend: Rich candidate infocards**: When a user requests more detail on a candidate ("Tell me more") or enters Compare, trigger a separate generation call producing a richer card personalised to the trip profile. Store it in a backend keyed by session and candidate. The agent's working state stays lean; the frontend fetches rich content independently and displays it in the visual space. Content generated during Explore is reused in Compare without regenerating.  
* **Backend: Durable comparison criteria**: Persist the criteria list server-side so the agent can append to it but never overwrite it. Protects explicitly-added criteria from being dropped when the matrix is regenerated.  
* **Backend: Photo URL cache**: Store destination → Unsplash URL in a backend, built up over time to reduce live API calls for destinations that have been looked up before.  
* **Backend: Destination knowledge base**: Cache generic destination facts (geography, climate, activities) that aren't profile-specific and could be reused across sessions rather than regenerated each time.  
* **Backend: Analytics / product intelligence**: Record what destinations are suggested, shortlisted, and rejected — queryable over time to inform product decisions.  
* **Restore on refresh (localStorage)**: Store `messages`, `plan`, and `uiState` in `localStorage` keyed by `session_id`. On page load, restore from existing session data if present. Covers the accidental-refresh case with no backend required.  
* **Chat ID / session continuation**: Store Trip Profile, rejected candidates, and shortlisted candidates under a generated Chat ID. Allow users to enter the ID on the landing screen to resume planning in a new session, with the agent initialised from saved state. Requires persistent storage (backend or URL-encoded state). Would be a useful experience to learn backends.  
* **Improve Comparison with a light itinerary or activity preview**: Users want a feel for what the trip would actually look like before committing. A rough sense of activities or a light day-by-day sketch during comparison would help. As a second version, a structured 3-day or 7-day daily timeline draft with activity recommendations could be shown during the Decision phase.  
* **Better journey for suburb/region-level planning**: The product is destination-focused but doesn't serve users who know where they're going and want to know what to do or where to stay within a destination (e.g. which neighbourhood in New York, which part of the Algarve).  
* **Mobile UX**: Rethink the artifact UX — move candidates inline like ChatGPT/Claude and think about how mobile interactions work to build and evaluate a trip.  
* **Interactive Map Component**: Add a map overlay/view in the Candidate Area showing pins for current candidate destinations and rough routes.  
* **Real-World Travel API Integration**: Learn about the various Travel APIs out there. Potential: Integrate mock flight duration, weather history, and cost indices to ground the candidate details in realistic travel metrics.  
* **Shareable / Exportable Trip Brief**: Generate a formatted PDF or Markdown document summarising the Trip Profile, the Comparison matrix (why this destination won), and the draft itinerary.  
* **Developer Debug Panel**: Wire `DebugPanel.tsx` behind a visible toggle and extend it to display the pruned messages array and approximate token count alongside the existing plan JSON view. Investigate surfacing tool call failure logs from the orchestrator.

---

## **7\. Next steps**

**Current status**:

1. Planning is complete. The PM has approved the Sprint 10 Spec.  
2. The `Sprint 10 Spec` has been written and approved: `sprint-10-spec.md`.  
3. The sprint is ready for implementation.

**Decisions aligned between PM & Code-Agent**:

1. **`vibe` / `best_for` content redefinition now, FE alignment in Sprint 11**: `vibe` → destination-descriptive ("about this place"); `best_for` → "trip feel" (personalised — "why this fits you"). Prompt + tool-schema-description changes only this sprint, no field rename, no FE change (§5 Phase 2 item 3). FE label alignment and a possible `best_for` → `trip_feel` rename added to Sprint 11 (§6 item 4).
2. **Decision-mode handoff pass**: a light consistency pass on `MODE_INSTRUCTIONS["decision"]` so its opening connects naturally to how Compare concludes — a handoff-smoothing pass, not a new "ready to decide?" prompt. The user decides when they're done (§5 Phase 2 item 5).
3. **Compare's opening turn**: brief and action-oriented — kick off the comparison and orient the user. No restating of destination vibe info or narrating findings in chat; insight lives in the matrix/UI (§5 Phase 2 item 1).
4. **"I already have destinations" first turn**: still calls `suggest_candidates` (3 best-guess candidates, panel stays populated), but the chat message asks the user to name their destinations instead of describing the 3 shown. Named destinations are added via the normal upsert on the next turn (§5 Phase 1 item 2).
5. **"Ask about previous trips" — early-turn priority**: guidance prioritises this question for an early turn (e.g. turn 2-3) rather than leaving it fully opportunistic. Exact phrasing TBD at spec to manage prompt length (§5 Phase 1 item 3).
6. **Array-merge fix — sequencing**: stays in Phase 1, implemented as a distinct, isolated step (e.g. first) so it's separable from the prompt-rewrite items (§5 Phase 1 item 5).
7. **"Both tools every turn" — best-effort**: the rewritten prompt is expected to help; no code-side fallback planned for this sprint. PM will observe during live testing (§5 Phase 2 item 2).
8. **Verification approach**: the spec will include a short list of scenarios to check during live testing — not formal test scripts.
9. **`profile_override` empty-list bug (`main.py`)**: in scope for Sprint 10, bundled with the Phase 1 array-merge fix as part of the same `likes`/`avoid` correctness work. Backend-only, no UI change (§5 Phase 1 item 5).

**Decisions still open between PM & Code-Agent**:

* **None** (Yet).