# **Sprint 9 Planning**

## **1\. Executive Alignment**

**Purpose**: Sprint 9 introduces a multi-agent architecture, splitting the single travel agent into two specialised agents — one for Exploration, one for Comparison/Decision. Each agent gets a focused system prompt and only the tools relevant to its phase. Sprint 9 also improves message history pruning so that the full record of what the user has expressed is preserved across turns and across agent handoffs.

**Context**: By the end of Sprint 8, we’ve closed the gap towards being a product that reliably works. During testing, tool-call errors are now harder to reproduce, owing to small pieces of prompt and orchestrator work over a number of sprints targeting tool-call frequency, syntax and purpose. Additionally, longer conversations with long state objects still manage to survive without tool-failures until the fallback model is pushed intentionally to the limit of its context. If/when Call 1 turns fail, we have a retry system in place (pending to see this works in a live case).

It is still evident that the travel agent is a single agent handling Exploration, Comparison, and Decision, carrying a long, broad system prompt and is responsible for many different tools across many different contexts. Splitting into specialised agents — each with a focused prompt and only the tools relevant to its phase — reduces the conditions under which format drift and wrong-tool usage occur, and enables us to give more specific instructions for each phase to improve task success without weakening performance in the other phases.

**Sprint Goal**: Two specialised agents — Explore and Comparison/Decision — routing correctly based on mode, each with a focused prompt and scoped tool list. Message history preserves all user messages across the full session and across agent handoffs.

**The Meta-Goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

\[\!IMPORTANT\] **Constraints to preserve (from prior sprints)**:

1. Keep the **Client-Authoritative State Sync** (frontend owns `mode`, backend owns content).  
2. Preserve the **Conditional Dual-Call ReAct Loop** in the backend orchestrator.  
3. Use **flat JSON tool schemas only** — no Pydantic schema generation for Groq tools; `additionalProperties` not used (Groq silently drops tools that include it in nested schemas).  
4. The agent fails every time you give it a tool name in the system prompt. **Do not re-insert tool names into instructions**.  
5. Candidate upsert is by `name.lower()` — never replace the full array; shortlisted names are skipped.

---

## **2\. Issues raised during user testing**

### The agent mirrors and over-confirms

One pattern persists despite prompt work in Sprint 6: **Mirroring and confirmation**: 

* The agent frequently paraphrases what the user just said before responding (e.g. "Avoiding crowded areas will definitely help you achieve a more relaxed atmosphere" immediately after the user said they avoid crowds).   
* Sprint 6 produced a definite reduction in this, but the pattern still appears regularly.

### Being able to continue where you left-off would be appreciated

It was noted that a method of picking up a session to continue later would be a good improvement.

* Hitting refresh manually (or having the browser auto-refresh) kills the session and forces a restart with effort going back into intake and profile building, and not having the same chat history.  
* Sometimes you want to have another discussion about the same vacation to see what other options the LLM will provide in a different chat (i.e. same Trip Profile, new session).

### Points of friction in UX & UI

**Landing**:

1. Vacation type intake dropdowns lack some options for exploring a variety of possible vacation styles. Combinations are not possible.  
2. It’s unclear why the two bonus options are down after the CTA’s. They feel too similar to the main questions, or it’s just not clear that they’re extra things you can add.  
3. Missed opportunity: The landing page doesn’t explain the product journey. Users arrive without knowing what they’re about to experience — how the chat and destination cards work together, or what the end goal looks like. The "aha moment" (seeing personalised destination cards appear and update in real time) only happens once you’re already in the Explore phase. Users who don’t understand the product spend more time trying to work out whether to chat or interact with the visual space \- it’s not a comfortable experience. A brief visual or textual explanation of the flow on the landing page could meaningfully improve the share of users who get hooked.

**Explore**:

1. “I already have ideas” doesn’t seem to alter the conversation. The agent rarely asks what the ideas are, and the conversation doesn’t revolve around that point.  
2. The agent never asks about previous trips or vacations that might be an experience the user might want to use as a model for the new one.  
3. The candidate cards show a region (usually the continent, i.e. Europe), but often lack a country. Sometimes an unknown destination (e.g. High Tatras) requires a press of “Tell me more” in order to find out where they actually are.   
4. “Tell me more” is better used when you’re curious about the location out of genuine interest about whether you want to go there. Perhaps “Tell me more” would be better as an options button like “Tell me more about…” with options “where it is”, “what people do there”, “what the food is like” etc.  
5. The product is centred around destinations as a place to go \- but not so much for people who know where to go but don’t know what to do (e.g. I’m going to New York, which parts of the city should I go and see?).

**Comparison**:

1. The Comparison phase lacks a bit of focus and structure to really make a decision.  
2. Vacation Vibe & Best For are lacking precision. It’s not quite clear what they’re explaining.  
3. The agent doesn’t care much about the trip profile anymore \+ rarely updates the profile (see above: lacking structure so new profile questions rarely occur).  
4. People often like to plan/compare with a light itinerary or a feel for what the activities would be like.

**Decision**: This phase serves as the end-point but is under-utilised at the moment.

### Bug carried over from tool-retry implementation

One `tool_use_failed` was eventually observed, unfortunately it fired on Call 2 (`tool_choice="none"`). The agent almost always knows to call tools within a single turn (Call 1\) \- it had not been observed before that a model tried one tool on Call 1 and then a second on Call 2\.

So we learned that the retry fired and logged correctly, but it couldn't fix the turn because the nudge message just made the model produce the same wrong output again. The retry only helps when the format is wrong on Call 1; it can't help at all if the agent is trying to use a tool on Call 2\. The retry on Call 2 should be removed — it's dead code in that path and adds a redundant LLM call that still results in a 500\.

### Bug found during Sprint 9 planning review: duplicate assistant message in history

For turns where the agent doesn't call any tools, `run_turn`'s no-tool-call branch (`orchestrator.py:417-422`) appends the assistant's reply to `new_messages`, which `main.py` extends into `session.history` (`main.py:134-135`). `main.py` then appends the *same* reply again as a separate `{"role": "assistant", "content": text_reply}` message (`main.py:140`) — correct for the tool-call branch (where `new_messages` excludes the Call-2 reply, so this final append is its only appearance), but a duplicate for the no-tool-call branch. `_filter_history` doesn't deduplicate plain assistant messages, so both copies reach the LLM.

---

## **3\. Ideation**

### Problem: Agent frequently has tool failures

**Multi-agent architecture**:

* Split the single agent into specialised agents — at minimum one for Exploration and one for Comparison/Decision. Each agent would have a shorter, more focused system prompt covering only the tools and instructions relevant to its phase.  
* The hypothesis is that a narrower prompt reduces the likelihood of format drift and wrong-tool usage, in addition to reducing context length per agent turn.  
* A second Groq API key could be assigned to the second agent, effectively doubling the primary model usage before the backup kicks in.  
* This is the most significant architectural change proposed and carries real learning value — orchestrating multiple agents, dividing responsibilities, and managing shared state between them is a new pattern not yet used in this project.

### Multi-agent architecture patterns considered

There are several common patterns for orchestrating multiple agents. Understanding why one was chosen over the others is useful context for future architectural decisions.

1. **Parameterised single orchestrator** *(chosen)* One orchestrator class; agent config (system prompt, tool list, API key) is passed in at call time. A thin router above it selects the config based on `mode`. The orchestrator has no awareness that it's one of several agents — it just runs with the config it receives. Minimal new code; the existing ReAct loop is unchanged. The right choice when agents are structurally identical and differ only in their instructions and tools.  
2. **Separate orchestrator instances** `ExploreOrchestrator` and `ComparisonOrchestrator` as distinct classes, each managing its own state, history, and tools. A coordinator instantiates the right one and delegates to it. Each agent is fully self-contained — useful if agents need meaningfully different infrastructure (different retry logic, different fallback behaviour). In this project the agents don't differ structurally. The meaningful benefits could be:  
   1. the Explore-specific candidate count injection logic becomes first-class rather than a conditional inside a shared `run_turn`;  
   2. `_apply_tool_call` becomes leaner per orchestrator with no irrelevant tool branches;   
   3. a Decision orchestrator with no tools at all is simpler than the current empty-tools path. The shared `_call_llm`, `_filter_history`, and `_prune_history` logic would need extracting to a utility module either way.  
3. **Supervisor pattern** The router is itself an LLM. A supervisor agent reads the conversation and decides which sub-agent to invoke, what to pass it, and what to do with the result. Sub-agents are fully autonomous — they receive a task, complete it, and return an answer to the supervisor. Used when routing logic is complex or can't be reduced to a deterministic rule. The cost is an extra LLM call on every turn just for routing, plus the supervisor can make wrong routing decisions. Overkill here since routing is already deterministic via `mode`. This is the pattern most agentic frameworks (LangGraph, CrewAI) are built around.  
4. **Pipeline / DAG** Agents are nodes in a directed graph; the output of one feeds the input of the next. Not conversational — more like a batch processing chain. Example: Agent 1 extracts preferences → Agent 2 searches for matching destinations → Agent 3 ranks and formats results. The right pattern for structured enrichment pipelines, not for a multi-turn chat product.  
5. **Peer agents with message passing** Agents communicate directly with each other with no central orchestrator. Fully distributed coordination. Complex to reason about and debug. Rarely appropriate outside of research or highly parallelised workloads.

---

### Problem: Explore & Comparison phase UX

Update the Explore & Comparison agents to sharpen the journey during each phase.

* The agent never asks about past trips that went well (or badly) as a reference point for the new one. This is a natural and high-signal question that real travel advisors always ask. Comparing each shortlisted candidate against similar trips they’ve done would be a good addition to the Compare table.  
* Improve Vacation Vibe (Explore) and Best For labels (Comparison)  
* The comparison phase needs a more structured approach — possibly a guided set of comparison dimensions — to help users actually make a call.  
* Encourage users (in the UI) and the agent to add custom comparison rows.

### Problem: First impressions, intake and initial Exploration experience

Improve the first impression and interactions between users and the product.

* Add a brief visual or textual explanation of the product flow before the intake form — what the chat does, how destination cards work, what the user is working towards, even how to add comparison criteria. Goal is to get more users to the aha moment rather than dropping off before they understand the product.  
* The two optional intake fields feel too similar to the required questions and their placement after the CTA is confusing. Vacation type dropdown also lacks options. Rethink the form order and expand the dropdown.  
* Cards currently show region (often just the continent). Unknown destinations like the High Tatras require a "Tell me more" to find out where they actually are. Country should be visible on the card itself.  
* The “Tell me more” button (Explore) is better used when you’re finding out more about a location out of definite interest. Perhaps it would be better as an options button like “Tell me more about…” with options “where it is”, “possible activities”, “food & drink” etc.

### Problem: Session loss on browser refresh & ability to continue later on

These are two distinct problems with different solutions:

1. **Restore on refresh** (same browser/device, short-term): The client-side app stores the session payload (`messages`, `plan`, `uiState`) in `localStorage` keyed by `session_id`. On page load, the frontend checks for existing session data and restores it instantly. Low complexity, no backend required, covers the “accidentally refreshed” case.  
2. **Come back later / continue across sessions** (the more valuable feature): Stores Trip Profile, rejected candidates, and shortlisted candidates under a shareable Chat ID. The user can enter the ID to resume planning — the agent is initialised with the saved state and starts a new conversation from that point. This requires some form of persistence (backend database, or encoded state in a URL) and is meaningfully more complex than localStorage. This is the version that maps to real-product behaviour — most travel planning happens across multiple sessions.

---

## **4\. The Strategy**

The roadmap for Sprints 9-12 follows a deliberate sequence: improve the architecture, then improve the product experience. Sprints 10, 11 and 12 improve the product experience and would benefit by having 2 agents with more focused characters/goals.

* **Sprint 9** addresses the underlying architectural cause of many reliability issues. A single agent handling Exploration, Comparison, and Decision carries a long, broad system prompt and is responsible for many different tools across many different contexts. Splitting into specialised agents — each with a focused prompt and only the tools relevant to its phase — reduces the conditions under which format drift and wrong-tool usage occur, and enables us to give more specific instructions for each phase to improve task success without weakening performance in the other phases.  
* **Sprint 10** (Agent: Explore & Comparison) is better done after Sprint 9, since the per-agent prompts created in that sprint are the right place to embed the improved conversation behaviour.  
* **Sprint 11** (UI: first impressions & intake) is largely independent of agent behaviour and could in principle move earlier or later.  
* **Sprint 12** (UI: Visual surface interactivity) is better done after Sprint 10, since the per-agent prompts created in that sprint can better-respond to more detailed requests.

---

## **5\. Items selected for Sprint 9**

### Sprint 9: Multi-agent architecture & context sharding

*Focus: Split the single agent into two specialised agents, each with a focused prompt and relevant tools only. Improve message history to preserve user preferences across turns.*

**Phase 1: Orchestrator & routing**

1. **Remove Call 2 retry**: The retry on Call 2 (`tool_choice="none"`) is dead code — it cannot fix a tool call attempted on the wrong call, and adds a redundant LLM call that still results in a 500\. Remove it.  
2. **Parameterise the orchestrator for agent configs**: Refactor the existing orchestrator so that system prompt, tool list, and API key are passed in as configuration rather than hardcoded. The ReAct loop logic itself does not change.  
3. **Add a routing layer**: Add a thin router above the orchestrator that selects the correct agent config based on the current `mode` from the frontend state. Explore mode routes to the Explore agent; Comparison and Decision modes route to the Comparison/Decision agent.  
4. **Second Groq API key, via a second Groq account**: Create a second Groq account and assign its API key to the Comparison/Decision agent via a new `.env` variable. Because the key lives on a separate account, it has its own independent rate-limit pool — each agent genuinely exhausts its own quota before falling back to the backup model.

**Phase 2: Message history**

1. **Fix duplicate assistant message on no-tool-call turns**: `run_turn`'s no-tool-call branch should leave `new_messages` empty — `main.py`'s final `session.history.append(...)` already writes the reply, matching how the tool-call branch works. Prerequisite for pruning update: the "last N full turns" redefinition below only makes sense once each turn is clean (user, assistant).  
2. **Update pruning to preserve full user message history**: Replace the current last-N-messages pruning with a two-pass approach: include all user messages in chronological order, then append the last N full turns (user \+ agent). Agent responses from older turns are pruned; user messages are never pruned. This ensures the agent always has the user's full expressed preferences in context, and provides the correct handoff history when switching agents on a mode change. `_filter_history` already strips tool/assistant-infrastructure messages, so retaining all user messages should stay small even over a long session.

**Phase 3: Agent prompt splits**

1. **Write the Explore agent prompt**: Extract and rewrite the Explore-phase instructions and tool list from the existing single prompt into a dedicated Explore agent prompt. Scope it to Explore-phase tools only.  
2. **Write the Comparison/Decision agent prompt**: Extract and rewrite the Comparison and Decision-phase instructions and tool list into a dedicated prompt. Scope it to Comparison/Decision tools only.

---

## **6\. Proposed Roadmap for upcoming sprints (Sprints 10-12)**

### Sprint 10: Agent \- Improve Explore & Comparison experience

*Focus: Update the Explore & Comparison agents to sharpen the journey during each phase.*

1. **Better journey for "I already have destinations"**: Currently this path doesn't meaningfully change the conversation. Should skip broad exploration and move directly into profile-building and candidate evaluation for the destinations the user already has in mind.  
2. **Explore: Ask about previous trips**: The agent never asks about past trips that went well (or badly) as a reference point for the new one. This is a natural and high-signal question that real travel advisors always ask. Comparing each shortlisted candidate against similar trips they’ve done would be a good addition to the Compare table.  
3. **Improve Vacation Vibe (Explore) and Best For labels (Comparison)**: These fields on the comparison cards lack precision. Users aren't always clear on what they're describing or how they differ from each other.  
4. **Comparison: Add structure and focus**: The comparison phase currently lacks a clear progression towards a decision. The agent disengages from the trip profile and rarely updates it during this phase. Needs a more structured approach — possibly a guided set of comparison dimensions — to help users actually make a call.

### Sprint 11: UI \- Improve the first impression, intake and initial exploration experience

*Focus: Improve the first impression and interactions between users and the product.*

1. **Landing page: explain the product journey**: Add a brief visual or textual explanation of the product flow before the intake form — what the chat does, how destination cards work, what the user is working towards, even how to add comparison criteria. Goal is to get more users to the aha moment rather than dropping off before they understand the product.  
2. **Landing page: increase intake form options**: Vacation type dropdown lacks options and the ability to select multiple types.   
3. **Landing page: fix intake form order**: The two optional fields feel too similar to the required questions and their placement after the CTA is confusing. The “I already have destinations” CTA is a bit lost (see above: the path doesn’t meaningfully change the conversation anyway). Rethink the order of the form for a better and more understandable flow.

### Sprint 12: UI \- Increase interactivity of the visual surface

*Focus: Update the UI to encourage users to make use of the consultative side of the agent.*

1. **UI: Show country/region on candidate cards (Explore)**: Cards currently show region (often just the continent). Unknown destinations like the High Tatras require a "Tell me more" to find out where they actually are. Country should be visible on the card itself.  
2. **Improve the “Tell me more” button (Explore)**: It’s better used when you’re finding out more about a location out of definite interest. Perhaps it would be better as an options button like “Tell me more about…” with options “where it is”, “possible activities”, “food & drink” etc.  
3. **Increase prominence of custom Comparison criteria**: Encourage users (in the UI) and the agent to add custom comparison rows (e.g., "Add a row for…” \+ accommodation style, kid-friendliness, vegetarian food options etc.). The agent dynamically updates the matrix criteria.

### Backlog of items not yet selected for any Sprint

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

1. Planning is in progress (WIP). Awaiting PM review and approval.  
2. Once approved, the `Sprint 9 Spec` will be written.  
3. The sprint is not yet ready for implementation.

**Decisions aligned between PM & Code-Agent**:

1. **Remove Call 2 retry**: Dead code — cannot recover a tool call attempted on the wrong call. Adds a redundant LLM call that still results in a 500\.  
2. **Multi-agent with a routing layer**: Two agents (Explore & Comparison/Decision), one orchestrator parameterised by agent config (system prompt, tool list, API key). A thin router selects the config based on `mode`. Not mode-based prompt switching — each agent has its own context window. Separate dedicated orchestrators were considered but not chosen.  
3. **Second Groq API key, via a second Groq account**: Groq's rate limits are organisation-level, not per-key — a second key on the *same* account would share the same RPM/TPM/RPD pool as the first.   
   1. **Resolved**: create a second Groq account/org and assign its key to the Comparison/Decision agent via a new `.env` variable. Each agent exhausts its own quota.  
4. **Shared message history**: One canonical conversation history will be given to both agents. Pruning is applied at call time when constructing each LLM request. No separate message store.  
5. **Modified pruning — all user messages \+ last N full turns**: Replace the current last-N-messages pruning with a two-pass approach: all user messages in chronological order, followed by the last N full turns (user \+ agent). Agent responses from older turns are pruned; user messages are never pruned. This also serves as the handoff context when switching agents on a mode change — no additional handoff mechanism required.  
   1. **Confirmed**: `MAX_HISTORY_TURNS = 4` (`orchestrator.py:104`) is a cutoff on user-message boundaries — at prune time (before the current turn's reply exists), it retains the last 4 user messages plus the already-generated replies to the first 3\. After decision 6's fix, that's 7 messages for N=4 (3 complete turns \+ 1 pending user message).   
   2. **Confirmed:** Unbounded retention should be fine: `_filter_history` already strips tool/assistant-infrastructure messages, so retained volume should stay small even over a long session.  
6. **Fix duplicate assistant message in history (no-tool-call turns)**: Found during Sprint 9 planning review (Section 2). `run_turn`'s no-tool-call branch appends the reply to `new_messages` *and* `main.py` appends it again as `text_reply` — `_filter_history` doesn't deduplicate plain assistant messages, so both land in history.   
   1. Fix: leave `new_messages` empty in the no-tool-call branch, matching the tool-call branch's existing pattern where `main.py`'s final append is the sole writer.  
   2. The "last N full turns" redefinition only makes sense once each turn is cleanly (user, assistant), so this fix is a prerequisite for that work.  
7. **No handoff marker needed in shared history**: Raw shared history is sufficient for Sprint 9 — no marker distinguishing which agent authored a given turn. The one `tool_use_failed` observed in Sprint 8 (Section 2\) is attributed to context size at the time, not to the mode transition itself; revisit only if evidence of handoff-specific failures emerges.

**Decisions still open between PM & Code-Agent**:

* None.
