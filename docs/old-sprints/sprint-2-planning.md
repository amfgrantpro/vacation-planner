# Sprint 2 Plan: Improve the Agent

## **1. Executive Alignment**
> **Goal**: To verify I understand the mission.

**V0 is a proof-of-concept.** It proves the infrastructure works (Message -> API -> Agent -> Response), but the *intelligence* is missing. The current agent is just a "Chatbot with a scratchpad", not a "Decision Helper".

**The Goal**: Move from "A buddy to chat about travel" → "A structured consultant that narrows down endless vacation possibilities to 3 feasible options for specific vacations the user can go and book."

**The Positioning**:
- **User**: "I want to go on vacation but I have so many options. All locations sound good but I cannot go to all of them."
- **Agent**: "I will guide you through a decision funnel (e.g. Knowns -> Unknowns (what do I need to figure out?) -> Constraints (e.g. budget, timing) -> Preferences (e.g. Region, Vibe, etc.)) to get you to a bookable state."
- **Not**: "Tell me about your dream vacation!" (Too open-ended).

**The Meta-Goal**: Test "Real-World AI Engineering".
- **Real-World Engineering** means: We don't guess. We measure. We structure. We iterate.
- We stop relying on "Vibes" and start relying on **Evals** (Tests).

---

## **2. Feedback on the demo Agent**

Overall, it is surprisingly good already. At a task-alignment level, the Agent successfully tries to get the user to explore various criteria before narrowing down options.

One preliminary note: I like having the State Object shown for debugging, however the UI has 2 main problems that interrupt user-testing.  
  * Firstly, the container gets wider and wider with every turn - squeezing the user input into a tall vertical column.  
  * Secondly, the container stays locked to the top of the page whilst the user input goes down, forcing you to scroll up to check if the state object has been updated correctly.

### **Structured Observations**

| Category | Observation | Impact |
| :--- | :--- | :--- |
| **Conversational Intelligence** | Agent follows guidelines too rigidly (prescriptive); doesn't match natural human behavior. | User feels "interrogated" rather than helped. Leads to friction. |
| | Lacks adaptability to user intent or sentiment (converging/diverging naturally). | Conversation feels like a series of disjointed questions. Some questions are not relevant to the user's decision but keep getting asked (e.g. budget, suburb) |
| **State Depth** | Missing critical variables: Origin, Trip Duration (days vs dates), and "Knowns/Unknowns". | Agent creates plans that are physically or financially impossible. |
| | Model is restricted by the flat V0 state object. | Agent can't "think" beyond what we've hard-coded. |
| **Process & Focus** | No clear plan or structure to the discussion; doesn't feel like moves toward a "bookable endpoint". | User loses confidence that the Agent is actually solving their problem. |
| | Destination concept is too broad (Country vs Region vs Suburb). | "Go to Tokyo" isn't granular enough to be a final decision. |
| **Vibe & Experience** | "Vibe" is too limiting. Needs "Type of Vacation," "Style," and emotional outcomes (Relaxing vs Active). | Recommendations miss the nuance of the user's actual desire. |
| | Placeholder text doesn't prime the user to share the "Why". | Users start with vague prompts, leading to poor initial results. |
| **Infrastructure & UI** | Container widening and sticky state behavior blocks testing. | Poor UX distracts from evaluating the agent's logic. |

---

## **3. Diagnosis: Where the Agent can be improved**
Identifying the specific areas where the current `VacationPlan` + Prompt setup can be improved to bring us closer to our ideal vacation planning Agent. 

| Feature | Current V0 State | Why it fails IRL | Real-World Fix |
| :--- | :--- | :--- | :--- |
| **State Object** | `destinations`, `budget`, `dates` | Too flat. Doesn't capture "Why" (purpose), "Origin", or "Duration" (days vs dates). Missing "Knowns/Unknowns". | **Rich Context State**: `TripShape` (Origin, Duration, Pax), `Context` (Why/Sentiment), `MentalModel` (Knowns/Unknowns). |
| **Reasoning** | "Update plan if user says so." | Reactive & Prescriptive. Feels like a tax form, not a conversation. Doesn't adapt to user intent. | **Adaptive Discovery**: Agent identifies which "Unknowns" are critical for *this* user and prioritizes them naturally. |
| **Prompt** | One giant System Prompt. | The model follows instructions too rigidly, ignoring human flow. | **Dynamic Persona**: Prompts that emphasize "Listening" and "Guiding" rather than "Extracting". |
| **Knowledge** | Hallucinated. | It suggests "Japan for $500" because it doesn't know flight prices or regional nuances. | **Tools, APIs & RAG**: Access to regional data (City vs Suburb) and relative cost indexes. |
| **Destination** | Generic Country/City. | "Japan" is not a bookable decision. Users need Suburb/Area level guidance. | **Hierarchy Mapping**: Support for "Region -> City -> Suburb" to get the user to a "Bookable State". |
| **Testing** | "I chatted with it and it seemed okay." | Unscalable. We don't measure "Alignment", "Adaptability", or "Helpfulness". | **Alignment Evals**: Grades based on how well the agent narrowed down options based on *user intent*. |

---

## **4. The Strategy: "The Adaptive Funnel"**
We are not building a Chatbot. We are building a **Guide**. The funnel must be fluid, allowing users to jump between stages as they share "Knowns".

**The Funnel Stages (New State Field: `phase`)**:
1.  **Contextualization**: Understand the "Why" and the "Knowns". (e.g., "I'm celebrating an anniversary, I know I want Europe, but I don't know where is romantic in June"). The Agent maps the user's initial state of mind.
2.  **Exploration (Divergence)**: Help the user explore styles of vacation (Styles/Sentiments) and solve for their specific "Unknowns". (Output: 5-8 Candidate Regions/Cities).
3.  **Refinement (Convergence)**: Narrow down from Country -> Region -> City/Suburb. Address constraints (Budget, Duration, Origin) in context. (Output: 2-3 specific options).
4.  **Finalization**: Help the user feel confident in a single "Bookable Choice" with a clear rationale, and a clear understanding of the next steps to book the trip.

---

## **5. Items selected for next sprint (Sprint 2)**

### **Sprint 2: Improving the Agent Core**
*Focus: Fixing the UI, and capturing the more of the information the agent needs to be helpful.*

**Phase 1: Quick Demo UI fixes (Execution starts here)**
1.  **UI Layout Fix**: Fix the widening container and sticky state object. This is the #1 blocker for user-testing.
2.  **Primer & Placeholder**: Update the UI placeholder and initial prompt to better prime the user (Who, Why, For How Long, etc.).

**Phase 2: Intelligent Adaptation**
1.  **Refactor State**: Define `TripShape` (Origin, Duration, Pax), `Context` (Why/Sentiment), and the `MentalModel` (Knowns/Unknowns).
2.  **Adaptive Prompting**: Rewrite system prompts to stop interrogating and start conversing. Align the prompt with the new state object and the funnel stages.
3.  **The Testing Workbench**: Create `learning-notebooks/4_agent_evals.ipynb`. This is a tool to A/B test different Prompts, LLMs, and Tools. It must allow the user to select a component to change manually, and then see the impact of changes immediately.

**Deliverable**: A stable UI, a functional testing Workbench, and an Agent that can map "Where I am" to "What I need to solve".

## **6. Proposed Roadmap for the following sprints (Sprints 3-4)**

### **Sprint 3: Grounded Advice & Better Tools**
*Focus: Bringing real-world data and hierarchical narrowing into the conversation.*

**Goals**:
1.  **Location Hierarchy**: Implement the ability to narrow from "Country -> Region -> City -> Suburb".
2.  **Mock Data Tool**: A `get_travel_insights()` tool that provides relative costs and weather to stop price hallucinations.
3.  **Vibe Refinement**: Move from generic vibes to "Vacation Styles" and "Emotional Outcomes".
4.  **Grounding Evals**: Use the **Workbench** to verify the agent uses data tool correctly.

### **Sprint 4: The Decision-Support UX**
*Focus: Visualizing the options and solidifying the "Bookable State".*

**Goals**:
1.  **UI Upgrade**: Start to make the interface interact a little bit more like a real-world website (Name, colours, instructions, personality).
2.  **UI Improvement**: Show "Destination Cards" (Title, Image, Cost estimate) instead of just text.
3.  **Finalization Logic**: Explicit "Rationale" generation for the final choice to give the user booking confidence.
4.  **UX/Agent Sync**: Ensure the Agent can reference display cards naturally ("As you can see in the card for Kyoto...").

---

## **7. The Notebook Strategy: The Workbench**
The existing `learning-notebooks/3_agent_loop.ipynb` is a simple tutorial. It's not serving its purpose as an A/B testing tool.

**Priority Deliverable: `learning-notebooks/4_agent_evals.ipynb`**
This is the **Workbench**—a functional tool for "Real-World AI Engineering".

**Capabilities**:
- **A/B Testing**: Side-by-side comparison of different Prompts, Models, and Toolsets.
- **Scenario Management**: Ability to run the agent against a library of multi-turn test cases (e.g., "Budget Traveler", "Honeymooners", "Adventurous Mother & Daughter").
- **Quality of Service Metrics**:
    -   **Context Capture**: Did the agent identify the user's "Why"?
    -   **Adaptability**: Did the agent pivot when the user shared a "Known"?
    -   **Extraction Accuracy**: Did it correctly identify constraints?

This would change the Agent from a "Program" into a "Product" that we can optimize scientifically. e.g. We can see if changing the prompt makes "Task completion" more efficient or slower. We can see if changing the LLM to GPT-5.1 makes "Adaptability" worse. We can see if adding a new tool makes "Object extraction" better or worse.

---

## **8. Next steps**

**Proposal**:
1.  **Spec-Next**: Planning is complete. We are ready for the agent to write a `Sprint 2 Spec` (e.g. State Schema & Prompt Structure, all implementation details).

**Decisions still open between PM & Code-Agent**:
1.  Are you okay with manually creating some "Mock Data" (e.g., a JSON list of 20 destinations with costs) so the agent has something to "search" in Sprint 2/3? Or do you want to rely on LLM knowledge? (Recommendation: Mock Data is better for "Real World" simulation). Answer: I guess it's fine but I don't know if this is just busy-work at this point in time with so many open issues to solve first.
