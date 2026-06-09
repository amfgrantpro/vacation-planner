# Sprint 4 Implementation Spec: Generative UI & User-Driven Decision Workspace

## **1. Executive Alignment**

Sprint 4 transitions the vacation planner from a conversational chatbot with a side-panel debugger into a **user-driven, visual decision workspace**. The agent's role changes from an active phase gatekeeper to a structured content provider and profile-extractor. 

The user drives all major state transitions via direct UI actions (shortlisting, comparing, deciding), and the frontend synchronization protocol coordinates the agent's behavior by passing the current active UI mode in the request payload.

---

## **2. Scope & Non-Goals**

### **Scope**
- **Landing Screen (UI)**: Full-width onboarding interface with a structured sentence builder for travelers, origin, duration, and timing, transitioning to a split-panel view on submission.
- **Trip Profile Component (UI)**: A persistent, read-only card at the top of the right panel, displaying the agent-extracted traveler constraints, likes, and exclusions.
- **Candidate Area States (UI)**: Three distinct states driven strictly by user actions:
  - *Exploration*: Showing 3 suggested candidates side by side with "Tell me more" and "Add to shortlist" CTAs, alongside a Shortlist Bar pinned to the bottom.
  - *Comparison*: Render 2-3 shortlisted cards side by side with custom comparison rows populated by the agent.
  - *Decision*: A single card showing the selected destination with a celebratory status badge (`✓ DECIDED` / `YOUR PICK`).
- **Mode-Gated Agent Loop (Backend)**: The agent operates dynamically in one of two modes (`Explore` or `Compare`), aligning its prompt and available tools to the `ui_state.mode` passed by the frontend.
- **Flat JSON Tool Schemas**: Maintain the flat schema standard for all LLM tools to ensure reliability on the Groq API parser.
- **Fallback LLM Update**: Configure **`mixtral-8x7b-32768`** on Groq as the fallback model for reliable multi-tool turns.

### **Non-Goals**
- **Complex Candidate Tracking**: No grayed-out or eliminated candidate logs. Removed candidates are simply pruned from the UI.
- **Map overlays or Itinerary timelines**: Deferred to Sprints 5 and 6.
- **Real-World APIs**: Skyscanner, Weather APIs, and dynamic image fetching are deferred. Images will fall back to curated generic placeholders for unrecognized locations.

---

## **3. Proposed Architecture**

The Client-Server (React + FastAPI) layout remains. The state communication is updated to include a frontend-driven synchronization payload.

```
┌──────────────────────────────────────────────────────────────┐
│  React Frontend (apps/web/src/)                              │
│                                                              │
│  ┌───────────────────────┐       ┌────────────────────────┐  │
│  │ ChatInterface.tsx     │ ◄───► │ useAgent.ts (hook)     │  │
│  │ (conversational UI)   │       │ - Sends ui_state       │  │
│  └───────────────────────┘       │ - Handles response     │  │
│              ▲                   └────────────────────────┘  │
│              │                               ▲               │
│              ▼                               │               │
│  ┌───────────────────────┐                   │               │
│  │ CandidateArea.tsx     │ ──────────────────┘               │
│  │ (explore/compare/dec) │                                   │
│  └───────────────────────┘                                   │
└──────────────────────────────────────────────────────────────┘
                               │
                       HTTP POST /chat
                       Payload: { message, session_id, ui_state }
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  FastAPI Backend (services/api/)                             │
│                                                              │
│  main.py (reconciles ui_state -> updates session state)      │
│    └─► AgentOrchestrator.run_turn()                          │
│          ├─► Build mode-aware prompt (Explore / Compare)     │
│          └─► Conditional ReAct Loop (Groq Mixtral fallback)  │
└──────────────────────────────────────────────────────────────┘
```
### **The Request/Response Contract**

#### **Request Body**
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

#### **Response Body**
```json
{
  "text_reply": "string",
  "comparison_matrix": [
    {
      "criterion": "Weather",
      "Destination A": "Sunny, 24°C",
      "Destination B": "Warm, 23°C"
    }
  ]
}
```

### **Prototype Preservation & Coexistence**

To preserve the working Sprint 3 proof-of-concept (POC) and prevent breaking the working demo, the codebase will support concurrent execution of both the Sprint 3 Prototype and the new Sprint 4 Application:

1. **Frontend App Duplication**: The current React code in `apps/web/` will be copied to `apps/prototype-web/` and configured to run on port `5174` (via its `vite.config.ts`).
2. **Backend Code Isolation**:
   - The Sprint 3 orchestrator (`services/api/agent/orchestrator.py`) and prompt (`services/api/agent/prompt.py`) will be copied to `services/api/agent/prototype_orchestrator.py` and `services/api/agent/prototype_prompt.py` to lock their logic.
3. **Endpoint Routing**:
   - The new Sprint 4 frontend (`apps/web` running on port `5173`) will communicate with `POST /chat`.
   - The preserved Prototype frontend (`apps/prototype-web` running on port `5174`) will communicate with a new `POST /chat/prototype` endpoint in `main.py` which routes traffic through the preserved Sprint 3 agent loop.

---

## **4. Agent Loop, State Reconciliation & Prompting Guardrails**

The backend orchestrator manages the session context and guides the LLM reasoning loop based on the incoming `ui_state`.

### **4.1 State Reconciliation Logic (Backend-Client Sync)**

Before running the agent loop on the server, the backend reconciles the frontend's synced UI state with the persisted `VacationPlan` session:
1. **Mode Sync**: Sets `VacationPlan.mode` to `ui_state.mode`.
2. **Winner Sync**: Sets `VacationPlan.selected_winner` to `ui_state.selected_winner` (if provided).
3. **Shortlist Sync**: Matches candidate objects in `VacationPlan.candidates` against the `ui_state.shortlist` array (by case-insensitive name match):
   - Candidates in `ui_state.shortlist` are marked with `status = "shortlisted"`.
   - Candidates not in `ui_state.shortlist` but previously marked as `"shortlisted"` are reverted to `status = "suggested"`.
   - This ensures shortlist and winner states are managed deterministically by client actions, freeing the agent from having to transition candidate status via tool calls.

### **4.2 Mode-Gated Focus & Tools**

The orchestrator selects the prompt template and exposed toolset based on the active reconciled mode:

* **Explore Mode**:
  - *Focus*: Extract traveler preferences, build the `TripProfile`, and suggest/manage the 3 candidates visible in the exploration backdrop.
  - *Exposed Tools*: `update_trip_profile`, `suggest_candidates`
* **Compare Mode**:
  - *Focus*: Compare the shortlisted destinations side-by-side and generate row values.
  - *Exposed Tools*: `update_trip_profile`, `generate_comparison_matrix`
* **Decision Mode**:
  - *Focus*: Acknowledge the winner (`selected_winner`) and conversationalize the next steps toward booking.
  - *Exposed Tools*: None.

### **4.3 Profile-First Prompting Rules (No Candidate Obsession)**

To prevent the agent from getting hyper-focused on guessing candidates at the expense of profile discovery, `prompt.py` will enforce the following strict guidelines:

* **Candidates as Backdrop**: Candidate cards on the right are visual inspiration for the traveler. The conversation on the left must focus on the traveler's traits, not on soliciting feedback for suggested destinations.
* **No Interrogation**: The agent must **never** ask the user: *"Do you like [Destination]?"* or *"Should we add [Destination] to your shortlist?"*. The user will make shortlist choices using the UI cards.
* **Focus on Profile Building**: The agent must focus its chat turns on discovering travel history, trip pace, likes, dislikes, vacation styles, and budget details to populate the `TripProfile`.
* **Lazy Candidate Updates**: The agent must call `suggest_candidates` on the first turn to seed the initial visual backdrop. Thereafter, it should only update the candidate cards if:
  - New profile attributes are extracted that make the current suggestions obsolete.
  - Or the user explicitly requests new choices (e.g. *"Show me something different"*).
* **"Destinations in Mind" Handling (Turn 1)**: When initialized with this path, the agent seeds 3 placeholder candidates to make the UI active, but its conversational opening must ask: *"Great! Let's work together to compare the places you have in mind. What destinations are on your list, and what is drawing you to them?"*

---

## **5. State Schema & Hand-written Tool Definitions**

### **State Models (`services/api/agent/models.py`)**

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class TripProfile(BaseModel):
    origin: Optional[str] = None
    travelers: Optional[str] = None  # e.g., solo, couple, family, group
    when: Optional[str] = None       # e.g., September, flexible
    duration: Optional[str] = None   # e.g., 1 week, flexible
    budget: Optional[str] = None     # e.g., budget, mid-range, luxury
    vacation_type: Optional[str] = None
    likes: List[str] = Field(default_factory=list)
    avoid: List[str] = Field(default_factory=list)

class DestinationCandidate(BaseModel):
    name: str
    region: str
    vibe: str              # Written specifically for this user
    photo_url: str
    status: str = "suggested"  # "suggested" | "shortlisted"
    # Detailed info populated during comparison
    best_for: Optional[str] = None
    seasonal_note: Optional[str] = None

class VacationPlan(BaseModel):
    mode: str = "explore"  # "explore" | "compare" | "decision"
    trip_profile: TripProfile
    candidates: List[DestinationCandidate] = Field(default_factory=list)
    selected_winner: Optional[str] = None  # Synced from ui_state.selected_winner
    comparison_matrix: Optional[List[dict]] = None
    notes: str = ""
```

### **Flat JSON Tool Schemas (`services/api/agent/orchestrator.py`)**

To prevent Groq API parsing errors, all tool schemas are defined with flat parameter structures.

#### **1. `update_trip_profile`**
```json
{
  "name": "update_trip_profile",
  "description": "Update variables in the traveler's trip profile based on conversation extraction.",
  "parameters": {
    "type": "object",
    "properties": {
      "origin": {"type": "string"},
      "travelers": {"type": "string"},
      "when": {"type": "string"},
      "duration": {"type": "string"},
      "budget": {"type": "string"},
      "vacation_type": {"type": "string"},
      "likes": {"type": "array", "items": {"type": "string"}},
      "avoid": {"type": "array", "items": {"type": "string"}}
    }
  }
}
```

#### **2. `suggest_candidates`**
```json
{
  "name": "suggest_candidates",
  "description": "Suggest exactly three destination candidates for the user to explore based on their profile.",
  "parameters": {
    "type": "object",
    "properties": {
      "candidates": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "region": {"type": "string"},
            "vibe": {"type": "string", "description": "1-sentence vibe statement explaining why this fits this specific user profile."},
            "photo_url": {"type": "string", "description": "Unsplash destination photo URL if matched locally, otherwise generic fallback."}
          },
          "required": ["name", "region", "vibe", "photo_url"]
        }
      }
    },
    "required": ["candidates"]
  }
}
```

#### **3. `generate_comparison_matrix`**
```json
{
  "name": "generate_comparison_matrix",
  "description": "Generate a comparative matrix for the shortlisted destinations.",
  "parameters": {
    "type": "object",
    "properties": {
      "matrix_rows": {
        "type": "array",
        "description": "List of rows matching criteria to compared values. Example row: {'criterion': 'Weather', 'Mallorca': 'Sunny, 24C', 'Sicily': 'Warm, 23C'}",
        "items": {
          "type": "object",
          "additionalProperties": {"type": "string"}
        }
      },
      "candidates_details": {
        "type": "array",
        "description": "Provides comparison card details (best_for, seasonal_note) for each compared destination.",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "best_for": {"type": "string"},
            "seasonal_note": {"type": "string"}
          },
          "required": ["name", "best_for", "seasonal_note"]
        }
      }
    },
    "required": ["matrix_rows", "candidates_details"]
  }
}
```

---

## **6. Phase-Gated Task Breakdown**

### **Phase 0: Sprint 3 Prototype Preservation (Pre-requisite)**
- [ ] **Task 0.1**: Copy `apps/web/` to `apps/prototype-web/` and update `apps/prototype-web/vite.config.ts` to run on port `5174`.
- [ ] **Task 0.2**: In the prototype frontend, update the API client to point to `/chat/prototype` instead of `/chat`.
- [ ] **Task 0.3**: Copy `services/api/agent/orchestrator.py` to `services/api/agent/prototype_orchestrator.py` and `services/api/agent/prompt.py` to `services/api/agent/prototype_prompt.py`.
- [ ] **Task 0.4**: Add the `POST /chat/prototype` endpoint to `services/api/main.py` which routes requests through the preserved prototype orchestrator, verifying that the prototype app still functions end-to-end on port `5174`.

### **Phase 1: State, Sync & Tool Restructuring (Backend)**
- [ ] **Task 1.1**: Update `models.py` with `TripProfile`, `DestinationCandidate`, and `VacationPlan` (ensuring `selected_winner` is added to track decisions).
- [ ] **Task 1.2**: Implement `suggest_candidates` and `generate_comparison_matrix` flat tools in `orchestrator.py`.
- [ ] **Task 1.3**: Update `main.py` request schemas to include `ui_state` (mode, shortlist, and `selected_winner`), and write the state reconciliation logic in the orchestrator to merge these parameters into the backend plan.
- [ ] **Task 1.4**: Configure `mixtral-8x7b-32768` as the fallback model in `core/llm.py` and run basic tool parsing validations.
- [ ] **Task 1.5**: Update `prompt.py` to support `Explore`, `Compare`, and `Decision` mode instructions, implementing the strict **Profile-First Prompting Rules** (candidates as backdrop, no candidate interrogation, lazy updates, and conversational turn 1 handling).

### **Phase 2: Screen State Layout & Client Sync (Frontend)**
- [ ] **Task 2.1**: Refactor `App.tsx` and `types.ts` to support the new request payload containing `ui_state` (including `selected_winner`) and update the `useAgent` hook.
- [ ] **Task 2.2**: Build the **Landing Screen (Screen 1)** containing the structured sentence builder dropdowns and optional budgets/styles section.
- [ ] **Task 2.3**: Build the persistent **Trip Profile component** at the top of the right panel, displaying extracted fields in two rows.
- [ ] **Task 2.4**: Create the **Candidate Area container** to swap between the three states based on local client state.
- [ ] **Task 2.5**: Implement the **Exploration state UI**: candidate cards with "Tell me more" (sending `"Tell me more about [destination]"`) and "Add to shortlist" CTAs, alongside the Shortlist Bar at the bottom.
- [ ] **Task 2.6**: Implement the **Comparison state UI**: tall side-by-side shortlist cards displaying vibe, best for, seasonal note, and the comparative table rows. Pinned "Not Quite Right?" bar at the bottom.
- [ ] **Task 2.7**: Implement the **Decision state UI**: render a single shortlist card with DECIDED branding and the `YOUR PICK` indicator, celebrating the choice and exposing return CTAs.

---

## **7. Verification Plan**

### **Automated Tests**
- **Tool Parsing Verification**: Execute a local curl command verifying that `POST /chat` resolves with the new payload and returns valid JSON matching the schema.
- **State Reconciliation Run**: Send a request with a mock `ui_state.shortlist` array and verify that candidate model statuses update correctly in the backend session.

### **Manual Verification**
- **End-to-End Walkthrough**:
  1. Complete sentence builder on Landing Screen -> Submit.
  2. Verify right panel changes to split-view and the Trip Profile shows extracted criteria.
  3. Explore suggestions, add 2 candidates to the shortlist, and click "Compare shortlist".
  4. Verify the side-by-side comparison matrix renders and the rows display compared criteria.
  5. Select one destination as the final pick and verify the visual transformation to the Decision card layout.
