# Sprint 2 Plan: Escaping V0 Hell

## **1. Executive Alignment**
> **Goal**: To verify I understand the mission.

You are correct: **V0 is a toy.** It proves the infrastructure works (Message -> API -> Agent -> Response), but the *intelligence* is missing. The current agent is just a "Chatbot with a scratchpad", not a "Decision Helper".

**The Goal**: Move from "A buddy to chat about travel" → "A structured consultant that narrows down 195 countries to 3 feasible options."

**The Positioning**:
- **User**: "I want to go on vacation but I'm overwhelmed."
- **Agent**: "I will guide you through a decision funnel (Budget -> Region -> Vibe -> Specifics) to get you to a bookable state."
- **Not**: "Tell me about your dreams!" (Too open-ended).

**The Meta-Goal**: Test "Real-World AI Engineering".
- **Real-World Engineering** means: We don't guess. We measure. We structure. We iterate.
- We stop relying on "Vibes" and start relying on **Evals** (Tests).

---

## **2. Diagnose: Why V0 Sucks**
Identifying the specific failures of the current `VacationPlan` + Prompt setup.

| Feature | Current V0 State (Bad) | Why it fails IRL | Real-World Fix |
| :--- | :--- | :--- | :--- |
| **State Object** | `destinations`, `budget`, `dates` | Too flat. Doesn't capture "Why" or "Constraints". No concept of "Origin" (crucial for flight cost). | **Hierarchical State**: `Constraints` (Hard), `Preferences` (Soft), `TripShape` (Origin, Duration). |
| **Reasoning** | "Update plan if user says so." | Reactive. The user has to lead. The agent is passive. | **Proactive State Machine**: The Agent has a `Strategy` (e.g. "I need to know Budget before I suggest Japan"). |
| **Prompt** | One giant System Prompt. | The model gets confused between "Brainstorming" and "Finalizing". | **Stage-Based Prompts**: Different instructions for `Discovery`, `Narrowing`, and `Planning` phases. |
| **Knowledge** | Hallucinated. | It suggests "Japan for $500" because it doesn't know flight prices. | **RAG / Tools**: Access to average flight costs/weather (even if static JSON for now). |
| **Testing** | "I chatted with it and it seemed okay." | Unscalable. We break things without knowing. | **Eval-Driven Development**: A notebook that runs 20 scenarios and *grades* the agent. |

---

## **3. The Strategy: "The Decision Funnel"**
We are not building a Chatbot. We are building a **Funnel**.

**The Funnel Stages (New State Field: `phase`)**:
1.  **Discovery**: Broad questions. "Beach or City?", "Relax or Adventure?". (Output: 10 candidates).
2.  **Constraints**: "What is your budget?", "Where are you flying from?", "Dates?". (Output: Filter to 5 candidates).
3.  **Narrowing**: "Japan is humid in July, but Bali is perfect. Thoughts?". (Output: 2-3 candidates).
4.  **Selection**: "Here is the plan for Bali." (Output: 1 Final Choice).

---

## **4. Proposed Roadmap (Sprints 2-4)**

### **Sprint 2: The Brain Upgrade (Intelligence & Structure)**
*Focus: Smart State, Structured Reasoning, and Evals.*

**Goals**:
1.  **Refactor State**: Add `TripShape` (Origin, Pax, Duration), `Preferences` (Vibes), and `Phase`.
2.  **Implement Stages**: The Agent prompt changes based on the `Phase`.
3.  **Eval-Driven Notebook**: Create `tests/scenarios.ipynb`. We write the test cases *first*.
    -   *Test*: "I have $1000 and 2 kids." -> *Expect*: `budget`=$1000, `pax`=3+, `candidates` excludes "Maldives" (Too expensive).
4.  **Constraint Logic**: Hard-code some "Rules of Thumb" (e.g., flight cost from [Origin] to [Region]).

**Deliverable**: A console-based agent (or simple UI) that feels *smart* and successfully narrows down a vague request to a specific region.

### **Sprint 3: The Eyes (Tools & Data)**
*Focus: Grounding the Agent in reality.*

**Goals**:
1.  **Mocked Search Tool**: `search_destinations(query="cheap beach july")`. Returns structured JSON data (not LLM hallucinations).
2.  **Rejection Tool**: User says "No to Asia". Agent calls `reject_region("Asia")`.
3.  **UI Upgrade**: Show "Destination Cards" (Title, Image, Cost estimate) instead of just text.

### **Sprint 4: The Memory (Persistence & Users)**
*Focus: A real product experience.*

**Goals**:
1.  **Database**: Move from In-Memory `dict` to SQLite/Postgres.
2.  **Sessions**: User can leave and come back.
3.  **User Profiles**: "Alastair always flies from Berlin."

---

## **5. The Notebook Strategy: From "Demo" to "Test Runner"**
You are right. `learning-notebooks/3_agent_loop.ipynb` is a tutorial, not a tool.

**New Concept: `learning-notebooks/4_agent_evals.ipynb`**
This notebook becomes our **Workbench**.

**Workflow**:
1.  **Define a Scenario**:
    ```python
    scenario = {
        "user_input": "I want a cheap beach trip in July.",
        "expected_state": {
            "budget": "low",
            "type": "beach",
            "candidates": ["Turkey", "Greece", "Albania"] # Should include these
        }
    }
    ```
2.  **Run Agent**: We treat the `AgentOrchestrator` as a function.
3.  **Assert**: We check if the Output State matches Expectation.
4.  **Iterate**: We tweak the Prompt or State Model in code, re-run list of 10 scenarios, and see if score improves.

**This allows us to "Tweak" the model scientifically.** We can see if changing the prompt makes "Budget extraction" better or worse.

---

## **6. How we work together (RFC)**
I cannot just "build this". We need a feedback loop.

**Proposal**:
1.  **Spec-First**: I write a `Sprint 2 Spec` (State Schema & Prompt Structure).
2.  **You Review**: You comment on the specific fields (e.g., "You forgot 'Visa Requirements'").
3.  **Code-Second**: I implement the State & Evals.
4.  **Tweak-Together**: We use the **New Notebook** together. I run a test, it fails. You say "Ah, the prompt is too polite." I fix the prompt. We re-run.

**Decisions Needed from You**:
1.  Does "The Decision Funnel" (Discovery -> Constraints -> Narrowing -> Selection) align with your product vision?
2.  Are you okay with manually creating some "Mock Data" (e.g., a JSON list of 20 destinations with costs) so the agent has something to "search" in Sprint 2/3? Or do you want to rely on LLM knowledge? (Recommendation: Mock Data is better for "Real World" simulation).
3.  Do you agree with the `Eval-Driven Notebook` approach?
