# Sprint 3 Implementation Spec: The Structured Funnel & Decision Consultant

## **1. Executive Alignment**
Sprint 3 focuses on transforming the Agent's open-ended conversational approach into a **structured, guided decision funnel**. The Agent must stop treating options transiently and start deliberately moving the user through a defined set of phases (Intake → Explore → Shortlist → Compare) using an explicit "Cart" of vacation candidates. The end result acts as a precursor to robust Generative UI.

## **2. Scope & Non-Goals**

### **Scope**
- **Phase-Gated State Machine**: Replace open-ended chat logic with a rigid 4-phase state machine (`Intake`, `Explore`, `Shortlist`, `Compare`).
- **Active Candidate Tracking (The Cart)**: Introduce explicit array-based tracking of destinations mapped to statuses (`active` vs `eliminated`).
- **Basic MCDM (Multi-Criteria Decision Making)**: Implement simple agent logic native evaluation of candidates against user constraints before the final decision.
- **Structured JSON Interface**: Transition the Agent from returning Markdown text blocks to structured JSON payloads using strict JSON mode (or structured outputs via Langchain) to guarantee the schema.
- **Active Cart Sidebar (UI)**: Add a read-only visual side-panel to the frontend to render the top 3 Active Candidates (eliminated candidates vanish). It will also visualize fixed constraints (e.g. Budget, Duration) for debugging.

### **Non-Goals**
- **Real-World APIs**: No integrations with Skyscanner, Google Maps, etc. (Deferred to Sprint 5).
- **Rich Interactive Generative UI**: We are building the data backbone, not rich interactive Destination Cards or checkout dashboards (Deferred to Sprint 4).
- **Multi-Agent Architecture**: The system remains a monolithic orchestrated agent for now (Deferred to Sprint 5).
- **Interactive UI Elements for the Cart**: The UI cart will display the agent's state, but users won't click "remove" on a UI element yet (chat is the sole control surface).

---

## **3. Proposed Architecture**

The existing Client-Server (React + FastAPI) architecture remains, but the payload contract and state mechanism are strictly enhanced.

### **Components & Data Flow**
1. **Frontend**: The `ChatInterface` is joined by an `ActiveCart` UI panel. The frontend hook `useAgent` now parses structured JSON from the backend (separating text from data).
2. **Backend / Orchestrator**: The Orchestrator adopts a strict phase-gate validator before executing tools.
3. **Data Flow**:
   - `User Input -> POST /chat -> Orchestrator`
   - Orchestrator validates `current_phase`.
   - LLM decides on action (updates constraints, upserts candidates, evaluates comparison, or changes phase).
   - Tool executed -> State mutations applied.
   - LLM formats final structured JSON: `{ "text_reply": "Let's compare...", "comparison_data": { ... } }`
   - `JSON Payload -> Frontend` (Frontend updates Chat and the ActiveCart UI).

---

## **4. Agent Loop Design**

The loop evolves to force convergence and validate phase transitions:

1. **Analyze (Input & State)**: LLM reads History + Rich State (including current active candidates and `phase`).
2. **Systemic Unknowns**: Instead of tracking superficial conversational tangents, the agent must specifically extract *decision-blocking unknowns* into `mental_model.unknowns` to ensure we solve key uncertainties.
3. **Phase Check & Gap Assessment**: Does the State satisfy the requirements to exit the current Phase? (e.g., Do we have 3 candidates to move from `Explore` to `Compare`?).
4. **Tool Call**: 
   - `update_plan(patch)`: Modify constraints or systemic unknowns.
   - `manage_candidates(action, destinations)`: Explicitly `add`, `eliminate`, or `evaluate` candidates in the cart.
   - `transition_phase(new_phase)`: Move the funnel forward.
4. **Structured Response Formatting**: The LLM outputs the final result as a strict JSON schema containing the conversational reply and any structured multi-criteria data needed by the UI.

---

## **5. State Schema & Merge Rules**

### **Schema (`VacationPlan` enhancements)**
```python
from enum import Enum
from pydantic import BaseModel, Field

class Phase(str, Enum):
    INTAKE = "intake"
    EXPLORE = "explore"
    SHORTLIST = "shortlist"
    COMPARE = "compare"

class DestinationCandidate(BaseModel):
    name: str
    status: str  # "active" or "eliminated"
    rationale: str  # Why it was kept or removed
    pros_cons: Optional[dict] = None  # Populated in Compare phase

class VacationPlan(BaseModel):
    phase: Phase = Phase.INTAKE
    trip_shape: TripShape # (from Sprint 2)
    mental_model: MentalModel # (from Sprint 2)
    candidates: List[DestinationCandidate] = Field(default_factory=list)
    comparison_matrix: Optional[List[dict]] = None # List of rows mapping candidate trade-offs
```

### **Merge Rules**
- **Candidates (Upsert Strategy)**: Rather than replacing the whole array, the agent tool will supply a sub-list of candidates to `upsert`. If a candidate exists, its status/rationale is updated. If new, it is appended.
- **Phase Transition**: Only the agent tool `transition_phase` can update the `phase`. The Orchestrator will implement programmatic guardrails (e.g., cannot enter `Compare` without at least 2 `active` candidates).

---

## **6. Tool Calling Approach**

1. **`update_plan(patch: dict)`**: Maintained for updating `trip_shape` and `mental_model`.
2. **`manage_candidates(action: str, data: list)`**: 
   - Operations: `add`, `eliminate`, `update_rationale`.
   - **Crucial Rule**: In the `Explore` phase, the agent must *explicitly ask the user* before adding a location to the cart.
3. **`transition_phase(target_phase: str)`**: 
   - Triggers the State Machine to move up the funnel. Backward movement (e.g., `Compare` -> `Explore`) is permitted if the user wants to reconsider options.
4. **`generate_mcdm_matrix(criteria: list)`**: 
   - Used in the `Compare` phase. The agent defines the criteria (Cost, Travel Time, Vibe) and populates trade-offs for the active candidates (no single "score" needed), storing it as rows in `comparison_matrix`.

---

## **7. Phase-Gated Task Breakdown**

### **Phase 1: State Machine & Funnel Logic (Backend) - [NOT YET EXECUTED]**
- [ ] **Task 1.1**: Update `models.py` with `DestinationCandidate`, `Phase` enum, and modify `VacationPlan`.
- [ ] **Task 1.2**: Implement `manage_candidates` and `transition_phase` tools in `orchestrator.py`. Ensure backward phase movement is supported.
- [ ] **Task 1.3**: Update `prompt.py` to: strictly enforce 4 phases, enforce explicit permission before adding candidates, and fix the extraction of *systemic decision blockers* for `unknowns`. Ensure LLM uses strict JSON mode.

### **Phase 2: Structured Outputs & UI Foundation - [NOT YET EXECUTED]**
- [ ] **Task 2.1**: Refactor Orchestrator LLM return type to output strictly formatted JSON (`text_reply`, `comparison_matrix` as list of rows) using Groq JSON mode/Langchain structured output.
- [ ] **Task 2.2**: Update FastAPI route (`main.py`) to serve the new JSON payload structure cleanly to the frontend.
- [ ] **Task 2.3**: Build `ActiveCartSidebar.tsx` in React to render the top 3 `candidates` where `status == 'active'` (eliminated items vanish from UI). Also display fixed constraints (Budget, Duration) above the candidates.
- [ ] **Task 2.4**: Build a simple `ComparisonMatrix.tsx` component to render the MCDM trade-off rows when the state reaches the `Compare` phase. The funnel ends here.

### **Phase 3: Testing & Workbench - [NOT YET EXECUTED]**
- [ ] **Task 3.1**: Update `4_agent_evals.ipynb` to simulate conversations that require phase gating and explicitly check if candidates are tracked accurately.
- [ ] **Task 3.2**: Run manual evaluation to verify that the agent doesn't prematurely drop explicit user suggestions from the cart.

---

## **8. Resolved Questions**

1. **Cart Interactivity**: Should the UI cart sidebar be purely read-only (visualizing agent state) or allow the user to click "remove/add" (modifying state directly)? Answer: Read-only.
2. **Eliminated Candidates Handling**: Should eliminated candidates still be visible in the UI cart (e.g., grayed out) to prove we "remembered but removed" them, or vanish entirely? Answer: Vanish. I'd like the UI cart to show the top 3 candidates.
3. **MCDM Data Generation**: For Sprint 3, should the agent generate mock evaluation data (costs/weather/travel time) based on its LLM weights, since we aren't using real APIs yet? Answer: No. 
4. **Backward Movement in the Funnel**: Can the agent explicitly jump back from `Compare` to `Explore` if the user rejects all candidates, or do we reset the list and stay in the same phase? Answer: Yes. The tactics for each stage are different, but the user might want to add things after passing a stage.
5. **JSON Formatting for Frontend**: Does the frontend expect the comparison matrix to be a list of rows, columns, or a normalized relational mapping? Answer: A list of rows? I don't know - I thought you'd propose something rational.
6. **MCDM Single Score**: Should the comparison matrix yield one final "Recommendation Score" (1-10) or just present the trade-offs (Cost vs Travel Time)? Answer: Trade-offs. At this stage, I just want to see that it considers them.
7. **Implicit vs Explicit Addition**: In the `Explore` phase, should the agent auto-add every location it mentions to the Cart, or explicitly ask the user "Should I add this?" first? Answer: Explicitly ask the user.
8. **Finalization Action**: How does Sprint 3 handle the very end of the funnel? Does it just stop at comparing, or is there a simulated "Select Winner" state? Answer: Stop at comparing. Having a (ranked) top 3 is enough.
9. **Displaying Constraints in UI**: Since the Cart is a sidebar, should we also visualize the fixed constraints (Budget, Duration) above the candidates so the user can see *why* candidates are there? Answer: Yes. We need it for debugging.
10. **LLM Output Constraints**: Are we okay using strict JSON Mode on Groq to guarantee the output schema of the final response, replacing the markdown stream? Answer: I don't know - I thought you'd propose something rational.

---

## **9. How this is done for Real-World AI Products**
- **State Machines**: Products like **Expedia's Romi** use explicit, hardcoded transition pipelines where an NLP router determines if intent requires switching from "Discovery Search" to "Logistical Compare".
- **Cart Metaphor**: In modern e-commerce conversational bots, the LLM almost never holds candidates in memory. Candidates are passed directly to a traditional backend cart microservice (active cart tracking). The UI reads the cart database, not the chat text.
- **Server-Driven UI (SDUI)**: Instead of generating text tables, platforms output JSON payloads (like our proposed `comparison_matrix`) that tell the frontend exactly which React components to render and with what data. This prevents HTML/Markdown hallucination issues.

## **10. Assumptions**
- **Assumption 1**: The UI sidebar will be read-only for Sprint 3. The conversational chat will remain the sole interaction surface to change state.
- **Assumption 2**: We will rely on the LLM's internal knowledge to generate mock data for the MCDM Matrix since external APIs are excluded.
- **Assumption 3**: We will use Groq JSON mode (or strict pydantic output structures via Langchain wrappers on Groq) to ensure reliable frontend parsing.
- **Assumption 4**: Eliminating a candidate does not delete it from the array, but mutates its status. This preserves decision-history.
