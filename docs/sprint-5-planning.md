# **Sprint 5 Planning (WIP)**

## **1\. Executive Alignment**

**Purpose**: To give users the ability to clean up the candidate suggestions so that the agent can continue populating the “top 3” candidates.

**Context**: Sprint 4 was a big step in the right direction. The “user owns decisions” concept was a big success. However, once 6 candidate cards are shown, the agent continues to make suggestions but the user cannot see them in the UI.

**Sprint Goal**: Build a “reject candidate” feature that is controlled by the user via UI.

**The Meta-Goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

\[\!IMPORTANT\] **Learning from Sprint 3 (Preventing Reactive Hacking)**: In Sprint 3, we fell into a trap of making reactive, short-sighted architectural changes to fix isolated issues (like removing the second LLM call, which broke the ReAct loop). For Sprint 5, we must protect our core architecture:

1. Keep the **Client-Authoritative State Sync** (frontend owns `mode`, backend owns content).  
2. Preserve the **Conditional Dual-Call ReAct Loop** in the backend orchestrator.  
3. Avoid constantly re-inserting tool-names into instructions. The Agent fails every time you give them the tool name in the system prompt.

---

## **2\. Issues found during user testing**

### Agent cannot maintain a “top 3” \- only add continuously, capped at 6

The idea of the explore phase is that the agent will continuously update its suggestions so that the “best 3” candidates will be surfaced at any given moment (based on the Trip profile as the agent finds out more about this user’s preferences).

The UI can display up to 6 destinations, however neither the agent nor the user can remove any suggestions.

* The agent has a tool to “add candidates” but no means to “remove candidates”.  
* The user has a button to “add to shortlist” and “remove from shortlist”, but no equivalent for the candidates.

**Issue**: Once 6 candidate cards are shown, the agent continues to make suggestions but the user cannot see the new ones (i.e. the current “best 3” are not shown, only the first 6 guesses).

### The UI fonts are off

The Lovable design uses a set of fonts that haven’t been imported.

* The font of almost all components is different from the Lovable components.  
* The font colour of almost all components is slightly off from the Lovable components. Greys and whites have been ignored.

### The Trip Profile doesn’t show every entry

When the agent was adding many items to “Things we like”, the UI wasn’t showing the later items. The container in `TripProfileComponent.tsx` uses a fixed-column grid cell and joins the arrays as a single comma-separated text string, causing longer entries to overflow and cut off.

### The fallback model has limited context window

On many-turn tests, the fallback agent reaches a point where it can no longer respond due to token limits.

`File "/Users/alastair/Github/vacation-planner/services/api/agent/orchestrator.py", line 256, in run_turn raise RuntimeError(f"Failed to get output from the LLM: {str(e}") RuntimeError: Failed to get output from the LLM: Error code: 413 - {'error':{'message':'Request too large for model qwen/qwen3-32b ... Limit 6000, Requested 6081...'`

### Being able to continue where you left-off would be appreciated

Hitting refresh or having the FE auto-refresh killed the session. It was noted that a method of picking up a session to continue would be a good improvement.

### Tool calls fail every now and then

Sometimes tool calls fail when the LLM inputs arguments that violate validation schemas. For example:

`File "/Users/alastair/Github/vacation-planner/services/api/agent/orchestrator.py", line 256, in run_turn raise RuntimeError(f"Failed to get output from the LLM: {str(e)}") RuntimeError: Failed to get output from the LLM: Error code: 400 - {'error': {'message': 'tool call validation failed: parameters for tool update_trip_profile did not match schema: errors: [`/budget`: expected string, but got null]' ...`

---

## **3\. Ideation**

The following ideas are for discussion purposes. None of these are decisions yet.

### Problem: Suggested candidates after 6 aren’t displayed

* **Bad options**:  
  * *Continue adding candidate cards infinitely*: Clutters the UI and causes infinite vertical scrolling.  
  * *Allow the agent to autonomously remove/replace candidates*: Unpredictable. The agent might wipe options the user was quietly considering.  
* **Better option**: **Allow the user to remove/reject candidates directly in the UI.**  
  * Add a small "✕" reject button on the top-right corner of each non-shortlisted candidate card.  
  * Clicking it opens a popover displaying 4 reason chips: "Been there", "Too far", "Not my vibe", and "Other". Clicking a chip removes the card immediately.  
  * Rejected candidates fall into a collapsible "Removed (N)" tray below the candidate grid.  
  * **Synchronization Protocol**: The client will NOT trigger a replacement candidate immediately. The backend will sync this state and mark the candidate as `status = "rejected"` in `VacationPlan`, and the agent will be given the updated plan on the next turn.  
* **Industry-Standard Improvement: Recommendation Buffering (Batching)**:  
  * In real-world products (e.g. Airbnb, Tinder-style layouts), when a user rejects a card, they expect an immediate replacement without waiting for an expensive LLM turn.  
  * *Proposal*: The agent suggests a larger pool of candidates (e.g., up to 5-6 candidates) during its turn, but the UI only displays the top 3 active suggested candidates in the grid. When the user rejects a card, the UI instantly slides in the next available candidate from the pool in memory. On the next natural conversational turn, the agent replenishes the pool.  
  * PM Note: We are not going to do this at this stage. Our agent is not very good yet, and we will crash it.

### Problem: Limited context window & Rate limits (6,000 TPM limit)

* **Prune Conversational History (Best Practice)**: Since we accumulate the structured `VacationPlan` state in the payload, the chat history only serves as conversational context. We can prune older messages (e.g., keeping only the last 10 messages of history) when sending to the LLM to stay safely below organization rate limits (TPM: 6000). The true source of truth remains safe in `VacationPlan`.  
* **Direct Landing Onboarding Injection**: Instead of launching a blank canvas and asking the LLM to call `update_trip_profile` on Turn 1 to parse the sentence builder values, we can have the backend directly initialize the `TripProfile` in the session object using the parsed onboarding values sent by the client. The LLM starts Turn 1 with a pre-populated profile, saving an expensive tool execution step and ensuring immediate suggestion accuracy.  
* **Direct Profile Editing**: Give the user the ability to directly edit/add items in the Trip Profile by double-clicking/interacting with the chips. This allows the user to correct the model's mistakes immediately without initiating a round of dialogue.  
* **Multi-agent set-up**: One for exploration, One for comparison/decision. Could we even set-up a second Groq API Key and use each one for each agent?

### Problem: UI style discrepancies & cut-off text

* **Typography & Semantic Colors (Design System Integrity)**: The fonts and colors are off because components in `apps/web/` hardcode generic Tailwind utilities (e.g., `text-white`, `bg-white`, `text-gray-500`) instead of utilizing our custom semantic design tokens (`bg-card`, `bg-cream`, `text-foreground`, `text-muted-foreground`). We must strictly enforce semantic variable usage to match the premium Lovable UI.  
* **Flexible Trip Profile Container**: In `TripProfileComponent.tsx`, render arrays (like "Things we like" or "Let's avoid") as a flex-wrap container of individual visual tags/chips, rather than a single joined string. This prevents line-clipping and naturally aligns with future direct editing capabilities.

### Problem: Session loss on browser refresh & ability to continue later on

* **Create a “chat ID”** that stores the Trip Profile, Rejected Candidates, Shortlisted Candidates. Upon re-initiating a session by entering the “chat ID”, the agent would be given the state objects and start a new session from that point. Not sure if we need a Backend or not. Maybe it could be stored in Cookies?  
* **Local Storage Persistence**: Instead of a complex database or "chat ID" input, the client-side app can store the session payload (`messages`, `plan`, `uiState`) in the browser's `localStorage` (keyed by `session_id`). On page load, the frontend checks for existing session data and restores it instantly, delivering a seamless consumer-grade UX. (Does not enable you to pick up later on if you have multiple chats).

---

## **4\. The Strategy: Allow the user to remove/reject candidates**

**Proposal**: Build a UI feature that enables a user to reject candidates. This functions as a “remove” option, which will clean up the UI and so enable the agent to keep suggesting a top 3 without much of a hassle.

### Rejection Flow:

* **User Action**: The user clicks the top-right "✕" on a suggested candidate, selects a predefined reason chip, and the card immediately hides.  
* **Sync Protocol (No Auto-Trigger)**:  
  * The client updates the candidate list locally (hiding the card and transferring it to the Removed tray) and records the rejection status and reason.  
  * The client will NOT trigger a replacement candidate immediately (no automatic conversational message or background request).  
  * When the user next decides to send a chat message, the updated state is synced with the backend in the payload. The candidate is marked as `status = "rejected"` in `VacationPlan` on the server.  
  * The orchestrator feeds the list of rejected destination names to the LLM system prompt (within a `"Rejected Destinations"` section).  
  * On this next turn, the agent observes that fewer than 3 active suggested candidates remain in the backdrop and proposes new destinations using `suggest_candidates` as part of its normal response.  
* **Collapsible tray**: Displays removed candidates as Name \+ Reason pills with a Rotate/Reset icon ("Un-remove"). Clicking "Un-remove" clears the candidate from the rejected list, making it eligible for the agent to suggest again in future turns. Clicking "Un-remove" from the tray does NOT auto-reinsert.  
* **Undo Toast**: A brief "toast" notification enables instant recovery of accidental clicks, restoring the card immediately to the grid.

---

## **5\. Items selected for next sprint (Sprint 5\)**

### Sprint 5:

*Focus: Enable users to remove/reject candidates, fix UI styling, and enforce robust tool parameter handling.*

**Phase 1: Small UI & Style Fixes**

* Import Google Fonts properly in `index.html` (Fraunces for headers/displays, Inter for body/ui sans).  
* Map css variables (`--font-sans` to `"Inter"`, and headers to `"Fraunces"`).  
* Replace hardcoded generic Tailwind colors in `apps/web/src/components/` with custom semantic tokens (`bg-card`, `bg-cream`, `text-foreground`, `text-muted-foreground`).  
* Refactor `TripProfileComponent.tsx` lists ("Things we like" and "Let's avoid") to render as a list of wrapping tag chips (`flex flex-wrap`) instead of a single comma-separated string, preventing text clipping.  
* Add backend parameter sanitization to filter or coerce `null` arguments in tool calls (e.g., `budget: null` \-\> remove from payload) before Pydantic schema validation.

**Phase 2: Remove / Reject candidates**

* All components have been pre-designed in `apps/lovable-ui`.  
* **Reject popover**: Add hover-visible "✕" button on the top-right corner of each non-shortlisted candidate card, opening a popover with 4 reason chips ("Been there", "Too far", "Not my vibe", "Other"). Clicking one removes the card immediately.  
* **Optimistic Local Hiding**: The card hides instantly on the client side and moves to the tray without triggering a chat message or backend turn.  
* **Payload Synchronization**: Send the candidate statuses (including rejected candidates and reasons) in the next normal user-initiated chat request (`ui_state.rejected_candidates` array).  
* **Backend State Sync**: Reconcile and store candidate status and rejection reasons in `main.py` and `models.py`.  
* **System Prompt Updates**: Pass the list of rejected candidate names to the system prompt in a "Rejected Destinations" section so the agent avoids re-suggesting them.  
* **Removed Tray**: Implement a collapsible "Removed (N)" tray below the grid showing rejected candidates. Clicking "Un-remove" clears the candidate's reject flag from the state, making them eligible for the agent to suggest again in future turns.  
* **Undo Toast**: Connect `sonner` toasts for quick misclick recovery.

---

## **6\. Proposed Roadmap for upcoming sprints (Sprints 6-8)**

### Sprint 6: Agent quality, reliability & direct profile editing

*Focus: Address LLM errors, reduce context size, and give users direct profile controls.*

* **Improve tool call safety**: Fix tool validation errors on the backend (e.g. handling of missing/null values, updating tool schemas in `orchestrator.py` to support nullable types gracefully).  
* **Conversational history pruning**: Implement a rolling history pruner in the backend orchestrator to restrict the message history passed to the Groq API to the last 10 messages, preventing TPM 6000 limits from triggering failure.  
* **Initial intake bypass**: Populate the `TripProfile` in the backend directly using onboarding values from the landing screen sentence builder, skipping the LLM turn 1 parsing loop.  
* **Direct profile editing**: Allow users to directly double-click or edit chips in the Trip Profile sidebar (e.g., origin, duration, budget) to bypass dialogue for routine changes.  
* **Observability**: A debug system that enables better developer visibility over the current state objects during live testing.

### Sprint 7: Multi-agent & context sharding

*Focus: Create a second Agent to share the load and improve task execution.*

* **Simple Multi-Agent Architecture**: Split the Discovery Agent from the Comparison Agent to reduce the token count per agent configuration.  
* **Parallel API Keys**: Allow setting secondary keys or separating agent contexts.

### Sprint 8: Chat ID Continuation

*Focus: Implement session saving/continuation, persistent storage.*

* **ChatID to continue later**: Store the Trip Profile, Rejected Candidates, Shortlisted Candidates to allow users to return to their planning session later. Support random Chat ID generation and an input widget on the Landing Screen.  
* **Serialization & Persistence**: Decide whether to store state in cookies / browser local storage (lightweight continuation) or migrate to SQLite / Redis database storage.

### Backlog of items not yet selected for any Sprint

* **Improve solutions for Region- and Suburb-Level Analysis**: Implement the ability to narrow and compare at different levels of granularity (e.g., Country \-\> Region \-\> City \-\> Suburb/Base). For example, comparing "New York: staying in Manhattan vs. Brooklyn" to help the user make a precise, bookable choice. Current testing of NYC suburb recommendations sometimes results in tool-call failures.  
* **Better entry for "I already have destinations"**: pre-populate candidates from the user's opening message, skip broad exploration, move directly into profile-building alongside the known candidates.  
* **Mobile UX**: Rethink the artifact UX \- move candidates inline like ChatGPT/Claude and think about how mobile interactions work to build and evaluate a trip.  
* **Shareable / Exportable Trip Brief**: Generate a formatted PDF or Markdown document summarizing the Trip Profile, the Comparison matrix (why this destination won), and the draft itinerary.  
* **Real-World Travel API Integration**: Learn about the various Travel APIs out there. Potential: Integrate mock flight duration, weather history, and cost indices to ground the candidate details in realistic travel metrics.  
* **Custom Comparison Criteria**: Allow users to inject custom comparison rows (e.g., "Add a row for kid-friendliness" or "Compare them by vegetarian food options"). The agent dynamically updates the matrix criteria.  
* **Itinerary Builder**: Once a destination is decided (Decision state), transition the Candidate Area to a structured 3-day or 7-day daily timeline draft with activity recommendations.  
* **Interactive Map Component**: Add a map overlay/view in the Candidate Area showing pins for current candidate destinations and rough routes.

---

## **7\. Next steps**

**Current status**:

1. Planning is complete. The PM has approved the Sprint 5 Spec.  
2. The `Sprint 5 Spec` has been written and approved: [`sprint-5-spec.md`](sprint-5-spec.md).  
3. The sprint is ready for implementation.

**Decisions aligned between PM & Code-Agent**:

1. **Rejection List Size & Context Optimization**: Since long lists of rejected destinations with reasons could bloat the system prompt context over time, how should we pass them to the LLM? We propose keeping only the most recent 10 rejected candidates in the LLM prompt context to keep responses fast and rate limits safe, while the state/UI preserves the full list.  
   * **\[RESOLVED\]**: The full list of rejected candidate names will be passed to the LLM system prompt for standard testing simplicity.  
2. **Tray "Un-remove" behavior**: When clicking "Un-remove" in the collapsible Removed tray, does the candidate card jump back into the active grid immediately (which might overflow the 3-card layout), or does it simply clear the rejection flag in state so the agent is *eligible* to suggest it again if context changes? (We currently propose the latter).  
   * **\[RESOLVED\]**: Clicking "Un-remove" does NOT re-insert the card. It only clears the rejection flag in state, making the destination eligible to be suggested by the agent again in future turns if relevant.  
3. **Suggested Candidate Grid Count (Buffer vs. Cap)**:  
   * *Question*: Currently the Explore view slices suggested candidates to 6\. If we implement rejection, should we change the grid layout to show a maximum of **3 active suggestions** (matching the 3-column layout) and keep any additional suggestions (4th and 5th) in an invisible local buffer? If the user rejects one, the next buffer candidate immediately slides in.  
   * PM Answer: No. 6 is fine. The user will clear the ones they don't want. Stop overthinking it.  
4. **"Other" Rejection Chip Popover Behavior**:  
   * *Question*: The rejection popover lists "Been there", "Too far", "Not my vibe", and "Other". When clicking "Other", should it immediately reject the candidate with the label "Other", or should it display a text input field to allow the user to provide a custom rejection reason?  
   * PM Answer: Just reject the candidate with the label "Other". Don't make it complicated. Stop trying to optimize for edge cases that aren't problems.

**Decisions still open between PM & Code-Agent**:

None.
