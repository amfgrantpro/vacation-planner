# **Sprint 4 Planning (WIP)**

## **1\. Executive Alignment**

**Purpose**: To sharpen the product's mission and redesign the agent experience around it.

**Context**: Sprint 3 was a good agent prototype and proved the core agent behaviors work — constraint extraction, candidate management, and structured comparison are all viable. User testing revealed that users don’t understand how or why to interact with the agent. The UI, the agent and the conversation structure don’t signal what the product is for.

**Sprint Goal**: Build the full UI and redesign the agent around it. The product should feel like a purposeful decision-making tool from the first interaction — not a chatbot with a side panel.

**The product mission**: Where to? \- “We help you decide where to go next. You tell us your constraints and travel style, we work together to identify 2-3 real candidates, then compare them against what matters to you — so you can commit with confidence.”

Sprint 4 aims to make that mission feel clear from the first interaction.

**The Meta-Goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

---

## **2\. Feedback on the Sprint 3 Agent**

### General feedback

What's working:

* Constraint extraction before exploration produces noticeably better suggestions.  
* The agent reads travel history well and uses it to contextualise recommendations.  
* Structuring the conversation around 3 candidates gave the exploration a useful shape.  
* A flexible MCDM that adapts its criteria to the user is useful at the comparison stage.

Where it’s weak:

* **The product doesn't have a visible mission.** The phases feel like separate tasks rather than steps toward a shared goal. Users don't know what they're working toward.  
* **The agent is doing two jobs at once.** It's gathering basic data (origin, dates, travelers) AND being a travel consultant. The data-gathering job makes the agent feel like a form and burns the user's early prompts on the least interesting part of the conversation.  
* **The candidate cards are passive.** They exist as labels, not as working artifacts. Users can't see why something is a candidate, what's been discarded, or what's still unresolved.   
* **The Shortlist phase is redundant.** By the time users reach it, they've already built the shortlist through conversation. It feels like a waiting room.  
* **The MCDM is a big reveal instead of a shared workspace.** When it appears it feels disconnected from the conversation that produced it.

### Structured Observations

| Category | Observation | Impact |
| :---- | :---- | :---- |
| Agent behavior | Agent decides when to compare (often forcing the user to ask for it) | Premature comparison, delayed comparison. |
| Agent behavior | Candidate cards updated infrequently during exploration | User loses track of where things stand |
| Agent behavior | Eliminated candidates and their reasons are invisible | No sense of how the shortlist was formed |
| UX/Flow | Intake phase is a barrier for users who arrive with candidates already in mind | Friction before value, wrong first impression |
| UX/Flow | Shortlist phase adds a gate between exploration and comparison that users want to skip | Obstructs the user's momentum |
| UX/Flow | The phases don't signal that they're building toward a shared goal | User disorientation, unclear product purpose |
| Data model | Some fields (dates, travellers, origin) are easier to collect via widgets; others (travel history, vibe, priorities) need conversation | Forced conversational collection of things that don't need to be conversational |
| UI | Trip profile is invisible to the user | Users can't see what the agent knows or correct it. Users cannot use it as mental assessment criteria during candidate discussions |
| UI | MCDM appears as a one-time output rather than a living artifact | Comparison feels final rather than workable |

### Learnings from user testing

**"Where to?" is not just a location — it's a trip.** It's the destination, duration, and type of vacation combined. ChatGPT reinforces this naturally by describing "what the trip feels like" alongside each suggestion. Our product should do the same.

**The trip profile has value for the user, not just the agent.** Seeing what's been captured helps the user develop their own mental model of what's possible given their constraints. It's not just data collection — it's a thinking surface. 

**Candidate identification and comparison is the core product loop** — not a phase at the end of a funnel. Everything else (intake, profile building, exploration, evaluation criteria discussions) exists to serve that loop. The product should be designed around it. 

**The trip profile and candidate list are two distinct artifacts.** The profile is about the traveller. The candidates are about the options. Conflating them makes the agent unfocused and the UI cluttered.

**The data the agent collects serves three different purposes:** some fields drive suggestions (travel history, vibe), some drive comparisons (priorities, criteria), some are functional constraints (dates, origin, travellers). They probably shouldn't all be collected the same way or at the same time.

**The transition from exploration to comparison should be decided by the user, not the agent.** The product is a decision-support tool. The user chooses when they're ready to compare.

**The outcome is significantly better when the agent focuses on building the trip profile.** When the agent jumps into suggesting candidates and the chat revolves around “How about this location?”, the conversation is weak and the results are poor. When the agent focuses on what the user likes to do, where they’ve been and what they want for this trip, the eventual suggestions are much better.

---

## **3\. Ideation**

The primary obstacle observed during user testing was that **the product doesn't have a visible mission**. Most tension was due to:

* Users didn’t know how to interact with the agent to get the best results. The UI, the agent and the conversation structure don’t signal what the product is actually for.  
* The agent was very strong at performing phase-specific tasks, but weak at communicating how each phase gets us to our goal, and weak at adapting when a user tried to discuss items that required the agent to use later-phase instructions. 

### 3.1. Potential improvements 

The following ideas are for discussion purposes. None of these are decisions yet.

**Idea 1: Offload structured data collection to a UI widget before the conversation starts**

Some trip profile fields are boring to collect conversationally — origin, dates, number of travellers. A lightweight intake widget at the start could handle these in seconds, freeing the agent to open with something useful instead of something administrative. Fields should be mostly optional or pre-filled with "flexible/not important" so the user doesn't feel locked in before the conversation has begun. It is important to signal the product's purpose immediately — the user arrives already oriented around the mission.

Fields that are easier through conversation — travel history, vibe, priorities, concerns — stay with the agent.

**Idea 2: Make the Trip Profile visible as a persistent UI artifact**

Rather than the agent holding the trip profile invisibly in state, it should be visible to the user alongside the chat. This shows the user what the agent knows (and lets them spot gaps or errors), and it gives the user a mental model of what's being built toward. 

**Idea 3: Make the Candidate List a working artifact, not a passive label list**

Building candidate cards is the purpose of the product and should be visible from an early stage. Each candidate card should show why it's in the running for this specific user — not generic destination facts, but the reasons that matter given their profile. The list should update continuously during exploration, not just at transition points. Maybe eliminated candidates and their reasons could also be visible.

**Idea 4: Collapse or remove the Shortlist phase**

The shortlist forms naturally during exploration. A dedicated phase that asks the user to formally confirm what they've already decided adds friction without adding value. The transition from exploration to comparison should be determined by the user, not the agent.

**Idea 5: The MCDM doesn’t need to be its own artifact. It could be part of the candidate cards.**

Rather than appearing as a finished output at the end, destination detail should initialise as soon as a candidate is shortlisted and fill in progressively as the conversation develops. This makes the goal visible earlier and makes the conversation feel like it's building toward something concrete.

**Idea 6: Eliminated Candidate Visibility ("Considered & Removed" panel)**

To make the decision trail auditable and interesting for the user, we could show a collapsible panel at the bottom of the Candidate Area displaying destinations that were discussed but rejected, along with the agent-recorded reason they were eliminated. This prevents the "out of sight, out of mind" issue with past recommendations.

### 3.2 Real-world implementations worth copying for the UI & Agent code

* **Easy input collection:**  
  * **Kayak** does this with a simple modal at onboarding — a few clear options to get started that personalise the experience without feeling like a form.  
  * **Skyscanner's** calendar widget handles date flexibility (known dates vs. open to cheapest) without asking the user to type anything.  
  * **Google Flights** takes it further by delaying certain choices entirely — it doesn't ask hotel vs. flight until after you've picked a destination  
* **Chat with live visual output:**  
  * **Mindtrip** and **Layla** are effectively the idea I’ve been trying to build from the start \- Chat with an Agent to plan a trip and show visuals alongside. This is the kind of product we should be copying. It puts chat on the left and a live itinerary on the right that updates as the conversation progresses. The itinerary isn't a summary at the end, it's present throughout.   
* **Surfacing candidates with reasons**: **Perplexity** shows its reasoning alongside answers so you can see why something was surfaced. **Klarna's** shopping comparison shows criteria that matter to *you*, not generic specs.  
* **Pinning and comparing candidates**: **Google Flights** and **Skyscanner** let users save favourite options and compare them side by side.  
* **Overall:** Layla and Mindtrip should serve as primary “copy this” products for this project.

---

## **4\. The Strategy: Shape the UX around a Living Document**

**Proposal**: Build a UX as a product called “Where to?”. The value proposition of this product is “We help you decide where to go next. You tell us your constraints and travel style, we work together to identify 2-3 real candidates, then compare them against what matters to you — so you can commit with confidence.” 

Users are presented with a UI that clearly signals its purpose. The product is built around two persistent visible artifacts:

1. **The Trip Profile** — a compact, read-only card at the top of the right panel. Shows what the agent knows about the traveller and their constraints. Fills automatically as the conversation progresses. Never hidden.  
2. **The Candidate Area** — the main output surface below the Trip Profile. Shows destination cards during exploration and shortlist cards during comparison. This is what the product is building toward, and it's visible throughout.

The **user** drives all major state changes through UI actions, not through conversation:

* The user decides which candidates to add to their shortlist (via "Add to shortlist" on a candidate card)  
* The user decides when to move to comparison (via "Compare shortlist" in the shortlist bar, active when ≥2 candidates are shortlisted)  
* The user decides when they've found their destination (via "I want to go to there\!" on a shortlist card)  
* The user can return from comparison to exploration ("Find others") or from the decision view back to their shortlist ("Back to my shortlist")

The agent's job is to populate these artifacts with useful content and keep the conversation moving toward a decision.

* Users can enter core trip constraints (e.g. dates/range, travellers (type), origin, budget, preferred vacation type) without having to chat to the agent.   
* The agent does not gate transitions.  
* The agent prompt should be simpler (i.e. fewer, defined phases) and better (i.e. specifically oriented to achieving the mission).

### 4.1 The UI: Interaction Logic & Flow

The product is a split-panel interface. The left panel is a chat conversation. The right panel is the living document. The right panel is the primary output surface; chat is the input mechanism. 

**User-driven transitions**

The user drives all major state changes through UI actions, not through conversation.

The agent does not trigger any of these transitions. It responds to the current state and populates the right panel accordingly.

**Candidate area states**

The candidate area has three distinct states, all driven by user actions:

1. **Exploration** — candidate cards, shortlist bar at the bottom. Agent surfaces destinations; user decides what to shortlist.  
2. **Comparison** — shortlist cards side by side, "Not quite right?" bar at the bottom. Agent populates card detail rows progressively.  
3. **Decision** — single shortlist card, "Not quite right?" bar with both escape options. Card is fully populated.

**"Tell me more"** on a candidate card sends a pre-formed message to the chat. The agent responds conversationally. The card is not updated as a direct result of this action.

**The shortlist bar** is always visible during exploration. It shows up to 3 slots; empty slots display as placeholders. "Compare shortlist" is inactive until 2 slots are filled.

### 4.2 Agent Responsibilities 

The agent's job changes from Sprint 3 in one fundamental way: **the agent populates artifacts, the user drives transitions.**

In Sprint 3, the agent controlled phase transitions. In Sprint 4, phase transitions are triggered by user UI actions. The agent's responsibility is to produce good content at each stage — not to decide when the user is ready to move on.

**During exploration**, the agent: extracts profile fields and outputs them as structured data for the Trip Profile; surfaces destination candidates with a destination vibe written for this specific user; updates candidates as the conversation develops. The conversation is focused on understanding the user's interests and constraints — not on asking "is this destination right for you?" The user sees the candidate cards and decides that for themselves.

**During comparison**, the agent: populates shortlist card rows across turns; keeps the conversation focused on meaningful differences between the shortlisted destinations.

The specific implementation — tools, state schema, prompt structure, API response contracts — is for the spec. The Sprint 3 constraints that must carry forward into the spec: flat hand-written JSON tool schemas (no auto-generation from Pydantic models), and the conditional dual-call ReAct loop (do not remove the second LLM call).

### 4.3 Architectural Guardrails & State Syncing

To ensure we build a premium, reliable product and prevent the "reactive hacking" that occurred in Sprint 3, the following technical guidelines are locked into our planning process:

* **State Synchronization Protocol**: The frontend is the single source of truth for the UI state (the active mode and which candidates are in the Shortlist Bar). The backend is the source of truth for generated content (candidate details, trip profile extraction). Every POST `/chat` payload must sync this state:
  ```json
  {
    "message": "string",
    "session_id": "string",
    "ui_state": {
      "mode": "explore | compare | decision",
      "shortlist": ["Destination A", "Destination B"],
      "selected_winner": "Destination A (optional)"
    }
  }
  ```
  The backend orchestrator will ingest this `ui_state` and reconcile the session `VacationPlan` (e.g. setting candidate statuses, updating the phase) before initiating the agent loop.
* **Strict ReAct Loop Guardrail**: The agent's reasoning loop must always execute in two conditional steps when tools are used (Reason & Call Tools → Observe Results → Respond). We must not bypass the second call in tool-use cases.
* **Deterministic Candidate Management**: The agent must upsert candidate cards by name key, ensuring partial updates do not wipe out existing candidate data or rationales.
* **Separation of Concerns**: The agent is responsible for generating contents for the active mode. The frontend controls the state transitions between screens (Exploration → Comparison → Decision).

### 4.4 Outcome-Driven Agent Design (Avoiding Reactive/Brittle Loops)

Based on Sprint 3 learnings, we reject the pattern where the agent acts as an active gatekeeper of user phases. This led to a brittle loop where the agent meandered or got stuck trying to force transitions. 
In Sprint 4:
- **Mode-Gated Behavior**: The agent's prompt instructions are strictly aligned to the current *UI Mode* (passed in `ui_state.mode`).
  - **Explore Mode**: The agent functions as a **Diagnostic Profiler & Matchmaker**. It asks high-leverage questions about travel style, history, and preferences, and suggests/updates the 3 candidate slots. It does not ask "Do you want to compare?" or transition phases.
  - **Compare Mode**: The agent functions as an **Analytical Consultant**. It compares the 2-3 shortlisted options against the trip profile, populates the comparison table rows, and highlights the relative trade-offs (e.g., cost vs travel time, seasonal suitability). It stops suggesting new destinations unless the user explicitly requests new options.
  - **Decision Mode**: The agent functions as a **Celebrator & Facilitator**. It provides a closing summary of why the selected winner matches the profile, and pivots the conversation to logistics or itinerary planning.
- **Outcome-Focused Prompts**: Prompts tell the LLM *what content state to achieve* (e.g., "Ensure you write a tailored vibe statement for each suggested destination") rather than *how to execute tools*. The system translates LLM intent to tool executions.

---

## **5\. Items selected for next sprint (Sprint 4\)**

### **Sprint 4:** 

*Focus: Build the full UI and realign the agent to work with it.*

**Phase 1: UI**

* **Landing screen** — structured sentence entry point with inline pill selectors (travellers, origin, when, duration) and two optional fields (vacation type, budget). Two CTA chips: "I already have destinations in mind" and "Inspire me where to go." Right panel visible in empty state.  
* **Trip Profile component** — persistent, read-only, always visible. Populates automatically from agent output. Fields: Origin, Travelers, When, Duration, Budget, Vacation Type & Vibe, Things We Like, Let's Avoid.  
* **Candidate cards** — destination photo, region label, destination vibe, two CTAs: "Tell me more" and "Add to shortlist."  
* **Shortlist bar** — always visible at bottom of candidate area during exploration. Up to 3 slots with thumbnails, names, and remove buttons. "Compare shortlist" CTA activates at 2 items.  
* **Shortlist cards** — destination photo, vacation vibe, Best For, seasonal note, comparison table rows (Weather, Activities, Getting Around, Accommodation, Travel Style, Peak Season) populated progressively by the agent. CTA: "I want to go to there\!"  
* **Decision view** — single shortlist card with "DECIDED" / "YOUR PICK" treatment, fully populated. "Not quite right?" bar with "Find others" and "Back to my shortlist."

**Phase 2: Agent**

* **Revised agent prompt** — agent populates the right panel; chat is for conversation. Remove phase-gating logic that controlled Shortlist and Compare transitions. Agent operates in two modes: Explore (surface candidates, build profile) and Compare (populate shortlist card rows). Mode is set by the frontend based on user actions, not determined by the agent.  
* **"I already have destinations in mind" path** — implement basic end-to-end functionality: if the user clicks this CTA, the frontend starts the exploration phase. The agent's first response must conversationally ask the user which destinations they have in mind (e.g. "Great! Let's work together to compare the places you have in mind. What destinations are on your list, and what is drawing you to them?"), skipping broad recommendation guessing and going straight to profile-building and analyzing those destinations once the user replies.

## **6\. Proposed Roadmap for the following sprints (Sprints 5-6)**

### **Sprint 5: Rich Interactive Artifacts, Location Hierarchy & Observability**

*Focus: Deeper personalization, location hierarchy, user-driven comparison criteria, and system observability.*

* **Location Hierarchy & Suburb-Level Analysis**: Implement the ability to narrow and compare at different levels of granularity (e.g., Country -> Region -> City -> Suburb/Base). For example, comparing "Mallorca: staying in Sóller vs. Palma" to help the user make a precise, bookable choice.
* **Dynamic Custom Comparison Criteria (MCDM Polish)**: Fix any leftover layout issues in `ComparisonMatrix` and allow users to verbally inject custom comparison rows (e.g., "Add a row for kid-friendliness" or "Compare them by vegetarian food options"). The agent dynamically updates the matrix criteria.
* **Observability & Testing Harness**: Build an offline script (`scripts/debug_harness.py`) to run conversation transcripts through various prompts/tool definitions to measure extraction accuracy, speed, and candidate relevance, simulating a production CI/CD evaluation step (similar to Promptfoo).

### **Sprint 6: Itinerary Construction, Maps & Local Storage Persistence**

*Focus: Transitioning from destination selection to initial scheduling, spatial representation, and persistence.*

* **Interactive Map Component**: Add a map overlay/view in the Candidate Area showing pins for current candidate destinations and rough routes.
* **Initial Itinerary Builder (Stretch Goal)**: Once a destination is decided (Decision state), transition the Candidate Area to a structured 3-day or 7-day daily timeline draft with activity recommendations.
* **Shareable / Exportable Trip Brief**: Generate a formatted PDF or Markdown document summarizing the Trip Profile, the Comparison matrix (why this destination won), and the draft itinerary.
* **Local Database Persistence**: Replace the in-memory `SessionManager` with an SQLite or Redis database to allow users to refresh the browser or return to their planning session later.
* **Mock Real-World API Integration**: Integrate mock flight duration, weather history, and cost indices to ground the candidate details in realistic travel metrics.

---

## **7\. Next steps**

**Current status**:

1. Planning is complete. The PM is satisfied that the coding agent understands what is desired.  
2. We are ready for the agent to write a `Sprint 4 Spec` (e.g. State Schema, API response contracts, component specifications, prompt structure, tool definitions, all implementation details).

**Decisions aligned between PM & Code-Agent**:

1. **"Tell me more" message text**: Pre-formed chat message should be exactly "Tell me more about \[destination\]" (the simple button text).
2. **Shortlist card row set**: Rows in the comparison table will be dynamically decided by the agent based on what matters to the user (MCDM style) rather than fixed.
3. **Maximum candidates in explore view**: Hard cap of 3. Users can keep exploring new ones but cannot add to the shortlist once it has 3 items until they remove one.
4. **First-turn agent behavior for "Inspire me" vs. "I already have destinations in mind"**:
   * **"Inspire me"**: On the very first turn, the agent will immediately surface 3 baseline candidate recommendations in the Candidate Area (to serve as an early visual anchor). However, the agent's chat response will focus on high-leverage profile-building questions (style, vibe, travel history) rather than asking about or obsessing over the suggested candidates.
   * **"I already have destinations in mind"**: On the first turn, the agent surfaces 3 baseline placeholder candidates in the right panel, but its chat response explicitly asks the user which destinations they have in mind to compare and what draws them to those choices.
5. **State & Shortlist Syncing**:
   * User interactions with the UI (like adding or removing items in the Shortlist Bar) occur instantly on the client side without calling the backend. When the user sends their next chat message, the updated shortlist is sent as metadata in the request.
   * When the user clicks the "Compare shortlist" button, the frontend transitions the Candidate Area to Comparison mode and automatically sends a visible, pre-formed chat message (e.g. `"I'd like to compare my shortlist now"`) to notify the agent, which responds conversationally in context and returns the populated comparison matrix.
6. **Comparison Matrix Generation**:
   * Drop the progressive `exploring...` loading row concept. When Comparison mode is triggered, the LLM will generate comparison data for all shortlisted candidates in a single turn. The backend will return a fully populated comparison matrix in one shot. Card rows can be updated or added in future turns if requested, but there will be no intermediate loading states.
7. **Destination photo sourcing**:
   * Use a curated local dictionary mapping common destinations to high-quality Unsplash image URLs, falling back to a curated generic travel photo for unknown destinations. This avoids API keys/rate-limits while keeping the look premium.
8. **Fallback LLM Model Choice**:
   * We will replace the inadequate `llama-3.1-8b-instant` fallback model.
   * **Final Resolution**: To avoid the complexity of setting up external OpenAI API keys, we will stick to the existing Groq setup and configure **`mixtral-8x7b-32768`** (Mixtral 8x7B) as our fallback model. It is a highly capable mixture-of-experts model that handles tool calling and reasoning much more reliably than the 8B Llama model. We will run a quick verification check on both the primary and secondary models during the spec phase.
9. **Decision State Transition - Conversational Trigger**: When the user clicks `I want to go to there!` on a comparison card, the UI transitions to the Decision state. To keep the agent in sync, the frontend will automatically send a simple pre-formed chat message (similar to the shortlist transition) notifying the agent.
10. **Handling of Removed Candidates**: We will not establish strict rules or complex tracking code for when a user removes a candidate from the Shortlist Bar. To avoid code and prompt clutter, the frontend simply updates the local cart state and syncs it.