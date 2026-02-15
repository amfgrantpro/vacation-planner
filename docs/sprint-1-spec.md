# Sprint 1 Implementation Spec: Real-World Agent Foundation

## **Scope & Non-Goals**
**Objective**: Build a production-grade, "headless" agent loop and a minimal web interface. The goal is to establish the *correct* architecture for a scalable AI product, even if the feature set is small (destination selection only).

**Scope**:
-   **Architecture**: Client-Server (React Frontend + FastAPI Backend)
-   **Agent**: A stateless "State Machine" loop using Pydantic for rigid validation.
-   **Interaction**: Text-based chat where the agent updates a structured `VacationPlan` object.
-   **Duration**: 10-20 turns of conversation.

**Non-Goals**:
-   **Database**: No Postgres/Redis yet. State is in-memory (simulating Redis).
-   **Authentication**: Single-user, local only.
-   **Complex UI**: No rich "Destination Cards" or Maps yet (Sprint 3).
-   **Deployment**: Localhost only.

---

## **Proposed Architecture**
We are adopting a standard "Modern AI Stack" to mirror real-world products.

### **Components**
1.  **Frontend (React + Vite + Tailwind)**:
    -   Single Page App (SPA).
    -   Components: `ChatInterface` (History), `DebugPanel` (State Visualization).
    -   Logic: `useAgent` hook to manage API polling/streaming.
2.  **Backend (FastAPI)**:
    -   **API Layer**: `POST /chat` (Stateless request/response).
    -   **Service Layer**: `AgentOrchestrator` (Manages the loop).
    -   **Model Layer**: `VacationPlan` (Pydantic schema).
    -   **LLM Integration**: `GroqClient` (wrapping `llama-3.3-70b` for speed/cost).

### **Data Flow**
1.  **User Input** -> Frontend -> `POST /chat` -> Backend.
2.  Backend retrieves `Session` (History + Current Plan) from Memory.
3.  **Agent Loop** runs (See below).
4.  Backend saves updated `Session`.
5.  Backend returns `{ response: str, plan: dict }` -> Frontend.
6.  Frontend updates Chat and Debug Panel.

---

## **Agent Loop Design**
We will use a **Tool-Driven State Machine** pattern. This is how products like LangGraph work under the hood.

### **Sequence**
1.  **Initialize**: Load `SystemPrompt` + `VacationPlan` (JSON) + `ConversationHistory`.
2.  **Think (LLM Call 1)**:
    -   Input: "User said X. Current Plan is Y."
    -   Tools Available: `update_plan(patch)`.
    -   *Decision*: Does the user's input require updating the plan?
3.  **Act (Tool Execution)** *[Conditional]*:
    -   If LLM calls `update_plan`:
        -   Validate `patch` against `VacationPlan` schema.
        -   Merge `patch` into `VacationPlan`.
        -   Log result: "Plan updated."
4.  **Respond (LLM Call 2)**:
    -   Input: "Plan updated. Now answer the user."
    -   Output: Natural language response ("I've set your budget to $2k...").
5.  **Return**: Final text + New State.

---

## **State Schema & Merge Rules**

### **Schema (`VacationPlan`)**
```python
class VacationPlan(BaseModel):
    # Core Constraints
    destination_candidates: List[str] = [] # e.g. ["Italy", "Spain"]
    budget_range: Optional[str] = None     # e.g. "$2k-$3k"
    travelers: int = 1
    dates: Optional[str] = None
    
    # Preferences & Meta
    requirements: List[str] = []           # e.g. ["beach", "pet-friendly"]
    notes: str = ""                        # Free text for things that don't fit schema
    status: str = "exploring"              # [exploring, narrowing, finalized]
```

### **Merge Rules (The "Smart Merge")**
We use a **Patch Strategy** with Pydantic validation:
-   **Dictionary Fields**: Recursive update (merge keys).
-   **List Fields (e.g., `candidates`)**: **REPLACE**. 
    -   *Reason*: It is safer for the LLM to provide the *full new list* than to try `append`/`remove` operations which can get out of sync.
-   **Validation**: If the LLM sends a string for `travelers` (int), the update is rejected, and we (optionally) ask the LLM to fix it.

---

## **Tool Calling Approach**
We define a single, powerful tool for Sprint 1.

**`update_plan(patch: partial(VacationPlan))`**
-   **Trigger**: Whenever the user provides factual information or changes preferences.
-   **Payload**: A JSON object reflecting the *changes* or *current truth* for specific fields.
-   **Example**: `update_plan(budget_range="$5000", candidates=["Japan", "Korea"])`

---

## **Task Breakdown**

### **Phase 1: Project Skeleton (NOT YET EXECUTED)**
- [ ] **Task 1.1**: Initialize `backend/` (FastAPI + Pydantic) and `frontend/` (React + Vite + Tailwind).
- [ ] **Task 1.2**: Configure `groq` client and `.env`.

### **Phase 2: The Logic (Backend) (NOT YET EXECUTED)**
- [ ] **Task 2.1**: Implement `VacationPlan` Pydantic model.
- [ ] **Task 2.2**: Implement `SessionManager` (In-memory dict).
- [ ] **Task 2.3**: Implement `AgentOrchestrator` (The Loop: Chat -> LLM -> Tool -> State).
- [ ] **Task 2.4**: Create `POST /api/chat` endpoint.

### **Phase 3: The UI (Frontend) (NOT YET EXECUTED)**
- [ ] **Task 3.1**: Create `ChatLayout` (Sidebar + Main).
- [ ] **Task 3.2**: Build `MessageBubble` and `InputArea` components.
- [ ] **Task 3.3**: Build `StateVisualizer` (JSON Tree View) for the sidebar.
- [ ] **Task 3.4**: Connect `useAgent` hook to Backend.

---

## **Questions to Resolve Before Coding**
1.  **Strictness of List Updates**: If the user says "Add Paris", and the list is `["London"]`, the LLM *must* output `["London", "Paris"]`. Is this acceptable redundancy? (Assumption: Yes, for reliability).
2.  **Error Handling**: If `update_plan` fails validation, do we crash or tell the model to retry? (Decision: Log usage error to console, ignore update for now, keep chatting).
3.  **Tailwind Config**: Default configuration? (Assumption: Yes, standard utility classes).

---

## **How this is done for Real-World AI Products**
-   **State Machines**: Real products use frameworks like **LangGraph** or **Burr** to define explicit "nodes" (e.g., `collect_info` -> `search_flights` -> `book`). We are simulating a single-node state machine here.
-   **Observability**: Real products log every token and tool call to **LangSmith** or **Arize Phoenix**. We will log to `stdout` for learning.
-   **Evals**: Real products run regression tests ("User said X, did State becomes Y?"). We will do this manually in Sprint 1.

---

## **Assumptions**
-   **Assumption**: You have a valid `GROQ_API_KEY` (confirmed in `.env`).
-   **Assumption**: You are okay with "Lossy" sessions (server restart = lost chat) for Sprint 1.
-   **Assumption**: We are building this *without* LangChain in the main app code (using raw Groq/Pydantic) to maintain full control and transparency, despite the notebooks using LangChain.
