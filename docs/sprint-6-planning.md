# **Sprint 6 Planning (WIP)**

## **1\. Executive Alignment**

**Purpose**: To improve agent reliability and quality.

**Context**: Sprint 5 was a success. Candidate rejection works end-to-end, the UI is visually aligned with the Lovable reference design, and the agent is now properly aware of what has been removed. However, testing exposed a recurring reliability problem: long sessions hit the Groq TPM (tokens-per-minute) limit and the agent stops responding.

**Sprint Goal**: Make sessions reliable at scale and cut wasted token usage.

**The Meta-Goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

\[\!IMPORTANT\] **Architectural constraints to preserve (from prior sprints)**:

1. Keep the **Client-Authoritative State Sync** (frontend owns `mode`, backend owns content).  
2. Preserve the **Conditional Dual-Call ReAct Loop** in the backend orchestrator.  
3. Use **flat JSON tool schemas only** — no Pydantic schema generation for Groq tools; `additionalProperties` not used (Groq silently drops tools that include it in nested schemas).  
4. The agent fails every time you give it a tool name in the system prompt. Do not re-insert tool names into instructions.

---

## **2\. Issues found during user testing**

### Sessions fail on long conversations due to token limits

On many-turn tests, the fallback agent reaches a point where it can no longer respond due to token limits.

`RuntimeError: Failed to get output from the LLM: Error code: 413 - {'error':{'message':'Request too large for model qwen/qwen3-32b ... Limit 6000, Requested 6081...'`

The accumulated `messages` array grows unboundedly. Since `VacationPlan` already holds structured state as the source of truth, historical messages only serve as conversational context — they do not need to be passed in full.

### The Agent gives a lot of information in its chat that is already given in the UI

The Travel Agent really loves to tell the user what it’s adding into the trip profile and the candidates. I understand that this is a balance:

* it’s natural and human to repeat what you hear to acknowledge what you’re hearing  
* it’s helpful to ground the chat by using the candidates because it leads more naturally into follow-up questions

… but it takes up a lot of the chat and has an impact on UX as well as the issue above with long conversations and token limits.

### Landing screen data is re-parsed by the agent on Turn 1

The sentence-builder on the landing screen captures origin, traveler count, travel window, duration, and budget before the session starts. This data is sent to the backend in the first chat payload, but the backend ignores it for state initialisation — instead the agent reads the opening message text and calls `update_trip_profile` to re-extract the same values. This wastes an entire LLM turn and a tool call on data the client already owns.

Additionally, the ability for the agent to produce suggested candidates right from the opening message is about a 50:50, at best. Reducing the focus on trip-profile on the first call might make it more consistently populate the 3 candidates to get the ball rolling.

### Users cannot correct the Trip Profile without typing

If the agent populates "Budget" as "Mid-range" but the user meant "Luxury", the only current path to correction is to type a chat message and wait for an agent turn. Directly clicking a chip to edit it is a standard interaction pattern (see: linear.app, Notion labels) that would reduce friction significantly.

### Debugging what’s going wrong when live-testing can be pretty difficult

Understanding what goes into the Trip Profile and the Candidate suggestions has become *significantly* easier since Sprint 4 with much better UI visibility.

The most common problem now is tool-call failure (which leads to failure to update the UI \- either Profile or Candidate cards). The most common failure is in producing an updated list of the “best 3” candidates. Sometimes I’m not sure if the Agent even tried to produce a top 3, or if the tool call failed. In Sprint 5 testing, it appears that the “top 3” includes the shortlist, which leaves the candidate list with only 1 candidate if 2 have been shortlisted.

In Sprint 5, we fixed the null calls, but there are still issues and I cannot determine what causes them. It’s clear that a real product wouldn’t have a failure rate this high \- but I don’t know what to suggest to fix it because I don’t know what causes it.

`DebugPanel.tsx` exists in `apps/web/src/components/` but is not connected to any route or toggle. During live testing, developer visibility into session state (the full `VacationPlan` JSON, the current `messages` array, active tool calls) requires manually inspecting network responses.

---

## **3\. Ideation**

The following ideas are for solution discussion purposes. This section does NOT represent a selection of items for this Sprint. 

### Problem: Token limit failures on long sessions

* **Bad option**: *Increase the model context window or switch to a paid tier* — doesn't fix the root cause and increases cost.  
* **Bad option**: *Summarise all history into one large message* — loses the natural conversational flow; the summary itself can be large.  
* **Better option**: **Rolling history pruner in the orchestrator**. Keep only the last N messages (proposed: 10\) in the `messages` array that is sent to the LLM. The full history can still be held in the session object (in memory) for the tray, but the pruned window is what gets passed to Groq. Since `VacationPlan` is the durable source of truth, pruning history does not lose structured state.  
* **Edge case**: The first message (the onboarding summary from the user) is high-signal. Consider always retaining message index 0 in the pruned window, even if it falls outside the rolling N.

### Problem: Wasted Turn 1 parsing the landing screen form

* **Option**: **Direct intake bypass**. When the client sends the first `POST /chat` request, it already includes the onboarding payload (origin, travelers, when, duration, budget). The backend can parse these directly into `session.plan.trip_profile` before calling the orchestrator, so Turn 1 starts with a pre-populated profile. The agent's first turn can immediately begin exploration rather than re-extracting form data.

### Problem: Correcting the Trip Profile requires dialogue

* **Option A**: Double-click a chip to open an inline text field. User edits the value and presses Enter. Validated client-side and sent with the next `POST /chat` payload as a direct `ui_state.profile_override` field.  
* **Option B**: Click a chip to open a small popover with a text input (same pattern as the rejection reason popover from Sprint 5).  
* **Option C**: Add an "Edit Profile" mode button that makes all chip fields editable simultaneously.  
* **Recommendation**: Option B (popover per chip). Consistent with Sprint 5's established interaction pattern. Lower engineering surface than Option C and more discoverable than a double-click.  
* **Scope limit**: Arrays (`likes`, `avoid`) are harder to edit in-place than scalar fields. For Sprint 6, limit direct editing to scalar fields only (Origin, Travelers, When, Duration, Budget). Array chips can remain read-only this sprint.

### Problem: Agent is overly-verbose in chat

The agent frequently summarises what it has just done ("I've added Paris, Lisbon, and Rome to your candidates...") or repeats trip profile values it has just written. This is information the UI already surfaces. The verbosity hurts UX and meaningfully increases message length, compounding the token-limit problem.

* **Option**: Add a targeted instruction to the system prompt suppressing redundant summaries. The agent should acknowledge what it's doing in a single brief sentence (or not at all), not enumerate every field it wrote.  
* **Scope**: System prompt change only — no backend or frontend code change required.

### Problem: "Best 3" candidates incorrectly includes shortlisted destinations

When 2 candidates are shortlisted, the agent's `suggest_candidates` call still treats them as part of the active pool, leaving only 1 `suggested` candidate in the grid. Sprint 5 fixed the active count guard (so it won't trigger re-suggestion too early), but the agent still nominates shortlisted names into the top 3\.

* **Fix**: Add a clarifying instruction to the system prompt (and/or the tool description) that the "best 3" for `suggest_candidates` means the 3 best `status == "suggested"` destinations — shortlisted candidates are already confirmed and should not occupy candidate slots.

### Problem: No developer observability during live testing

* `DebugPanel.tsx` already exists. It renders only the full `VacationPlan` JSON — trip profile, candidates (with statuses), shortlist, mode, etc. It does NOT yet show the messages array, token count, or tool call logs. So: you CAN see which candidates are in the top 3 and their statuses. You CANNOT see why a tool call failed.  
* **Option**: Wire it behind a visible toggle button. Extend the panel to also display the pruned messages array last sent to the LLM and an approximate token count. Tool call failure tracing is a stretch goal — the orchestrator would need to capture and surface those logs.

---

## **4\. The Strategy: Reliability and token reduction**

Two threads run in parallel this sprint:

**Thread 1 — Backend reliability**: Prune the message history sent to the LLM to prevent TPM failures, keeping the last 10 messages total (\~5 each side) and always retaining index 0\. Bypass the Turn 1 profile-parsing waste by initialising `TripProfile` directly from the onboarding payload; the first-turn system prompt instruction is also updated to tell the agent the profile is pre-populated and to move straight to candidate recommendations. The user's pre-formed opening message stays unchanged — Turn 1 behaviour will be monitored during testing.

**Thread 2 — Agent prompt improvements**: Fix two prompt-level bugs that testing exposed — the top-3-includes-shortlist error and the agent over-summarising in chat. Both are system prompt changes only, no backend/frontend code needed.

---

## **5\. Items selected for Sprint 6**

### Sprint 6: Reduce the tokens being sent to the LLM

*Focus: Agent reliability & intake efficiency.*

**Phase 1: Backend Reliability**

* **Conversational history pruning**: Implement a `_prune_history()` function in `orchestrator.py`. Prune at complete conversational-turn boundaries — never mid-message — so a `tool_calls`/`tool` message pair is never split (which would throw a Groq 400 in place of the 413 we're fixing). A "turn" \= one user message plus every assistant/tool message that follows it, up to the next user message. Target roughly the last 10 messages' worth of turns, always preserving index 0\. Apply to both the primary and fallback LLM calls.  
* **Initial intake bypass**: In `main.py`, on the first turn of a session (when `plan.trip_profile` is unpopulated), read the onboarding fields sent in the request payload and directly initialise `TripProfile` fields before calling the orchestrator. The agent starts Turn 1 with a pre-populated profile. **Also update the first-turn instruction in `prompt.py`** to tell the agent the trip profile is already populated and to move directly into candidate recommendations. The user's pre-formed opening message stays unchanged — monitor Turn 1 behaviour during testing.

**Phase 2: Agent Prompt Fixes**

* **Fix top-3-includes-shortlist**: Fix this where it occurs — in candidate-pool construction, not the prompt. Filter shortlisted candidates out of the candidate list the LLM is shown (e.g. in `_clean_candidates_for_prompt()` / wherever the active pool is assembled), so the model cannot nominate an already-confirmed destination into the "best 3" because it never sees it as an option. The goal is simply 3 active candidates — that's guaranteed deterministically in code, not left to model compliance.  
* **Reduce agent verbosity**: Add a system prompt instruction telling the agent not to summarise what it has written to the trip profile or candidate list — that information is already visible in the UI. A single brief acknowledgement per turn is acceptable; enumeration of every field written is not.

---

## **6\. Proposed Roadmap for upcoming sprints (Sprints 7-10)**

### Sprint 7: Align UI properly with Lovable & Direct profile editing

*Focus: Unify UI with the Lovable-UI so that we can add Direct profile editing*

* **Unify Web UI with Lovable UI**: Finally fix the differences caused by the initial incorrect implementation. Set the correct Tailwind version and all components correctly so we don’t keep patching and translating unnecessarily.  
* **Direct profile editing**: Add a click-to-edit popover on each field chip in `TripProfileComponent.tsx` (Scalar and Array fields). Clicking a chip opens a popover with a pre-filled text input. Submitting updates local state immediately; the value is included in the next `POST /chat` payload.

### Sprint 8: Multi-agent & context sharding

*Focus: Create a second Agent to share the load and improve task execution.*

* **Simple Multi-Agent Architecture**: Split the Discovery Agent from the Comparison Agent to reduce the token count per agent configuration.  
* **Parallel API Keys**: Allow setting secondary keys or separating agent contexts.

### Sprint 9: Chat ID Continuation

*Focus: Implement session saving/continuation, persistent storage.*

* **ChatID to continue later**: Store the Trip Profile, Rejected Candidates, Shortlisted Candidates to allow users to return to their planning session later. Support random Chat ID generation and an input widget on the Landing Screen.  
* **Serialization & Persistence**: Decide whether to store state in cookies / browser local storage (lightweight continuation) or migrate to SQLite / Redis database storage.

### Sprint 10: Improve Agent performance for how people want to plan trips

*Focus: Improve conversation robustness and ability to debug why tool-calling fails more often when conversations are a bit different.*

* **Better entry for "I already have destinations"**: Pre-populate candidates from the user's opening message, skip broad exploration, move directly into profile-building alongside the known candidates.  
* **Improve solutions for Region- and Suburb-Level Analysis**: Implement the ability to narrow and compare at different levels of granularity (e.g., Country → Region → City → Suburb/Base). Current testing of NYC suburb recommendations sometimes results in tool-call failures.  
* **Developer Debug Panel**: Wire `DebugPanel.tsx` behind a visible toggle and extend it to display the pruned messages array and approximate token count alongside the existing plan JSON view. Investigate surfacing tool call failure logs from the orchestrator. Deferred here because debugging will be more relevant once more complex conversation types are under test. Decisions already made: visual toggle (no URL flag), show messages \+ token count, tool call tracing as stretch.

### Backlog of items not yet selected for any Sprint

* **Mobile UX**: Rethink the artifact UX — move candidates inline like ChatGPT/Claude and think about how mobile interactions work to build and evaluate a trip.  
* **Shareable / Exportable Trip Brief**: Generate a formatted PDF or Markdown document summarising the Trip Profile, the Comparison matrix (why this destination won), and the draft itinerary.  
* **Real-World Travel API Integration**: Learn about the various Travel APIs out there. Potential: Integrate mock flight duration, weather history, and cost indices to ground the candidate details in realistic travel metrics.  
* **Custom Comparison Criteria**: Allow users to inject custom comparison rows (e.g., "Add a row for kid-friendliness" or "Compare them by vegetarian food options"). The agent dynamically updates the matrix criteria.  
* **Itinerary Builder**: Once a destination is decided (Decision state), transition the Candidate Area to a structured 3-day or 7-day daily timeline draft with activity recommendations.  
* **Interactive Map Component**: Add a map overlay/view in the Candidate Area showing pins for current candidate destinations and rough routes.

---

## **7\. Next steps**

**Current status**:

1. Planning is in progress (WIP). Awaiting PM review and approval.  
2. Once approved, the `Sprint 6 Spec` will be written.  
3. The sprint is not yet ready for implementation.

**Decisions aligned between PM & Code-Agent**:

1. **Pruning boundary**: Pruning slices at complete conversational-turn boundaries, never mid-message — preventing orphaned `tool_calls`/`tool` message pairs.  
2. **Top-3-includes-shortlist fix location**: Fixed wherever it actually occurs in code — investigate the source(s) of the leak first; if it turns out to leak in more than one place, fix all of them. Not a prompt-only fix either way.  
3. **No history summarisation**: Truncation only, this sprint. The agent is already inconsistent, and adding a summarisation step would add work for it to do — directly against this sprint's goal of reducing tokens. Can be revisited later if truncation proves lossy.  
4. **No formal eval harness**: PM continues to do their own live testing. Token budget is the exact constraint this sprint exists to solve; building a testing apparatus would spend the thing we're trying to save.  
5. **Turn-1 framing for the pre-filled profile**: No further prompt redesign beyond what's already planned. The first-turn instruction tells the agent the profile is pre-populated; how it actually responds (acknowledges vs. jumps straight to suggestions) gets observed in live testing and adjusted from there.  
6. **Pruning window size**: No precise target. The original "10" was arbitrary, and any replacement number would be just as arbitrary — pick a sensible window that doesn't cut too aggressively or too little, and move on.  
7. **Onboarding field mapping for the intake bypass**: No special handling. The agent doesn't get told which `TripProfile` fields are pre-filled vs. open today, and there's no reason to introduce that distinction now.

**Decisions still open between PM & Code-Agent**:

None.
