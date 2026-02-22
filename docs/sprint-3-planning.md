# **Sprint 3 Planning**

## **1\. Executive Alignment**

**Purpose**: To verify the agent understands the mission.

Sprint 2 **significantly improved the Agent**, but **conversations lack structure**.

**The Goal**: Move from "A chatbot who tries to make you pick something" to "A structured consultant that helps a user narrow to 2 or 3 feasible vacation candidates which the user would be confident to go and book.” The final decision is then made between the candidates.

**The Meta-Goal**: Test "Real-World AI Engineering".

- **Real-World Engineering** means that it’s built in the way that real B2B or B2C products are built. It’s not a meta-coding project, it’s a meta-product project.

---

## **2\. Feedback on the demo Agent**

### General feedback

The agent successfully:

* demonstrates conversational fluency  
* gathers relevant user preferences through natural dialogue  
* creates an approachable planning experience.

It correctly:

* identifies some key constraints (timeframe, travel style, accommodation preferences)  
* shows flexibility by pivoting when users express concerns.

The ability to track user state and maintain context across the conversation indicates the foundation for a more sophisticated decision-support system is present.

The Agent struggles mostly due to a lack of structure in how to reach its goal \- to help a user narrow to 2 or 3 feasible vacation candidates which the user would be confident to go and book.

The Agent currently treats all options as a single funnel, narrowing it down to one single choice.

* This results in the Agent following a conversation along question-by-question instead of evaluating and comparing the best 2-3 options.

Part of the core principle is that users decide on vacations between multiple “good options” and want to know which one is going to be best.

* The final decision is made between the primary candidates \- not a “narrowed to a single best option”.  
* Comparison and option retention are core parts of this principle.

### List of observations made during user-testing

1\. Unstructured conversation and lack of decision methodology

* Failure to build towards making a recommendation:  
  * Conversations explore endlessly without converging on actionable choices.  
  * Agent responds to each user input individually rather than maintaining a cohesive planning structure.  
* No logic explained:  
  * User doesn't understand why certain options were excluded or included.  
  * No clear tactical differences when exploring, shortlisting, comparing, and recommending.  
  * Doesn't provide a decision log or recap of what's been eliminated and why.  
* Absence of explicit narrowing processes:  
  * If the user shows interest in many suggestions, the Agent continues to be positive about all destinations without elimination (8+ countries in Conv 1, 15+ in Conv 2\)  
  * Agent locks onto specific regions (e.g., Brazil) before understanding the full list of vacation options the client wanted to discuss.  
  * Agent either stays too broad or dives too deep without an intermediate shortlisting step.  
* Missing commitment points – Never asks "Should I start building a detailed itinerary for X?" to transition from exploration to planning.

2\. Poor recommendations

* Ignores user-raised vacation options:  
  * e.g. 2 options mentioned, but Sri Lanka was completely ignored to discuss the other option until the user asked again.  
  * Multiple destinations mentioned (Peru, Chile, Ecuador, Maldives, Mauritius) are never explored.  
* Fails to track travel history or identify traveler type:  
  * Doesn't use past trips (Singapore, Australia, India, Japan, Argentina, Seychelles, Costa Rica, South Africa) to inform future recommendations.  
  * Suggests already-visited destinations (e.g. Costa Rica) despite the user having already been there.  
  * Doesn't recognize "experienced bookers who want comprehensive options" vs. "decision-fatigued users who want hand-holding".  
* Superficial handling of safety concerns:  
  * Responds to legitimate safety worries (Colombia, Brazil, Mauritius) with generic reassurance (or removal of the candidate) rather than providing data or a safety comparison against known locations.  
  * It does not attempt to determine “what is safe” for this user.  
  * Doesn't offer practical advice for traveling safely in concerning areas.  
* The user was asked "Do you want to explore places **like** X, Y or Z".  
  * The user understood that they would get given **additional, similar** locations.  
  * The agent took their positive response to mean “I want X, Y or Z specifically”.  
  * This felt like the agent wasn’t interested in what the user was.  
* Ignores many preferences:  
  * "Clean, spacious, prefer luxury but limited budget" mentioned but never quantified or used as filter.  
  * User says "enjoys good food" but this never becomes a selection criterion.  
  * User explicitly doesn't want public transport dependency; agent suggests destinations without confirming self-drive feasibility.

4\. Inability to adequately compare candidates

* No decision framework established:  
  * Agent never creates a structured comparison methodology or criteria weighting system for evaluating destinations. No multi-criteria decision making (MCDM).  
  * Gathers criteria (warm, nature, independence, activities) but doesn't use them later as assessment criteria.  
  * Never clarifies the user’s critical decision information (e.g. budget).  
* No trade-off analysis presented:  
  * Destination options are given sequentially without contrasting them (safety vs. adventure, travel time vs. depth, cost vs. luxury).  
* Doesn't explain what makes each destination unique for this user's specific interests.  
  * Doesn't explain how (e.g.) Maldives differs from Seychelles for this specific user.

5\. Poor Comparison & lack of visuals

* Sequential list of options – Lists options one after another forcing user to mentally organize.  
* No visual aids or structured outputs – No comparison tables, maps, itinerary sketches, or decision matrices  
* Missing pros/cons analysis – Doesn't provide balanced trade-offs for each destination  
* No "finalist" presentation – Could show 3-5 top options with key differentiators before user chooses.

6\. Lack of domain expertise

* No timing/seasonality questions:  
  * Doesn't ask when the user wants to travel, missing weather patterns, peak seasons.  
  * Missing tips like "May is shoulder season in Sri Lanka—fewer crowds, better prices"  
* No travel style confirmation:  
  * Doesn't clarify one destination vs. multi-country before making suggestions.  
  * Doesn't show pattern recognition from "tourists like you typically choose X". Never says "Based on your profile, I recommend X because...".  
* Ignores geographic origin:  
  * Recommends Australia for 2-week trip from Europe despite 30+ hour travel time.  
  * Says 700km distances in Brazil are "relatively close" and "easily managed".  
  * Based in Berlin but doesn't optimize for European departure logistics, visa-free travel, or convenient flight hubs.  
* Lacks authoritative data or logistical knowledge:  
  * No flight costs, visa complexity, safety indices, or typical budget ranges  
  * Doesn't confirm car rental feasibility or driving comfort level. Merely states that it’s possible rather than answering whether it’s feasible for a tourist.

8\. Technical observations

* I notice that the ‘unknowns’ value just changes from one question to the next (e.g. "where Paraty, Costa Verde, and Florianópolis are located" to "what is the typical mode of transportation in Costa Verde").  
  * This seems like a pointless datapoint recording “the last question asked”.  
  * It doesn’t match the concept it’s supposed to capture \- that certain unknowns are preventing a decision.  
  * In this case, I had mentioned a lot of things I was unsure about before deciding my next vacation. Random tangent questions were not important.  
* The agent is not collecting the primary unknowns and working out which are the most important ones to maintain and address in a structured manner.  
  * The agent should be trying to work out what is going on in my head that’s blocking a decision between these options.

### Structured Observations

| Category | Observation | Impact |
| :---- | :---- | :---- |
| **Conversational Funnel** | Agent endlessly explores lateral paths without narrowing, synthesizing, or establishing commitment points. | User feels adrift. Without forced convergence, the agent behaves as a search engine rather than a consultant. |
| **Context & Memory** | Ignores explicitly stated potential options (e.g., destinations they’ve considered before) and negative constraints (e.g., places already visited). | Recommendations lack personalization; agent appears incompetent or "deaf" to the user's actual travel profile. |
| **Comparison & Trade-offs** | Presents candidates sequentially in plain text; no side-by-side Multi-Criteria Decision Making (MCDM). | High cognitive load. Impossible for a user to mentally juggle pros and cons (cost vs. safety vs. distance) across multiple locales. |
| **Generative UI / Visuals** | All outputs are unstructured text blocks. Complex geographic and logistical data is explained via lengthy prose. | Modern B2C travel products rely on rich visuals (maps, price cards) to quickly convey data; text alone fails this. |
| **Domain Logistics** | Lacks authoritative grounding for seasonality, geographic proximity (e.g., 30h flights), and visa/safety viability. | Recommendations are functionally useless if they aren't feasible for a normal tourist from the user's origin. |
| **State Misalignment** | `unknowns` array tracks superficial recent conversational tangents instead of systemic blockers. | The system fails to identify what the user *actually* needs to learn to make a multi-thousand dollar commitment. |

## **3\. Diagnosis: Where the Agent can be improved**

To solve the issues above, we map the failures to standard patterns used by production conversational commerce and travel AI products. We explicitly split the fixes into "Agent Logic" (Backend/State) and "UX/UI" (Frontend representation).

| Feature | Current State | Why it fails IRL | Real-World Fix: Agent | Real-World Fix: UX/UI |
| :---- | :---- | :---- | :---- | :---- |
| **Funnel Flow** | Infinite looped Q\&A without phase transitions. | Users need an explicit "Discovery" phase that transitions into a "Selection" phase. | **Phase-Gated State Machine**: Explicit pipeline (`Intake` \-\> `Explore` \-\> `Shortlist` \-\> `Compare`). | **Progress Wizard**: Visual breadcrumbs showing the user where they are in the decision funnel. |
| **Candidate Curation** | LLM mentions places transiently and forgets them. | If the agent drops places a user explicitly liked, the system feels broken. | **Active Candidate Array**: Strict state variable tracking `shortlisted` vs `eliminated` destinations. | **Dynamic "Cart"**: Persistent sidebar or panel showing the current 2-3 active candidates being considered. |
| **Evaluating Options** | Just text descriptions of destinations. | Humans cannot reliably hold 5 variables across 3 destinations in short-term memory. | **MCDM Matrix Generation**: Agent computes structured scores/trade-offs based on user constraints. | **Comparison Matrix**: Generative UI table (Server-Driven) highlighting Cost, Weather, Vibe, and Flight Time side-by-side. |
| **Domain Knowledge** | Hallucinates cost and logistics; treats Earth as distance-free. | "Fly to Sydney for a 4-day trip from Europe" is an immediate trust-killer. | **Origin \+ RAG / Tools**: Mandatory capture of Origin. Agent strictly uses tools for flight duration & weather checks. | **Data Badges**: UI tags on candidates for `Distance: 14h`, `Season: Peak`, `Safety: Moderate`. |
| **Internal Logic** | `unknowns` simply reflects the last question asked. | Fails to prioritize what actually prevents the user from deciding. | **Decision Blocker Extraction**: Dedicated model logic to infer the *core* psychological or logistical blockers. | **Actionable Prompts**: E.g., Generative UI buttons offering "Estimate costs for these 3?" |

## **4\. The Strategy: "The Adaptive Funnel" (Revised)**

Real-world B2C travel AI (like Expedia's Romi or Airbnb's search dynamics) shifts user behavior from broad divergence to strict convergence. We are replacing the sequential filter with a **multi-candidate evaluation funnel**. The Agent will guide the user through narrowing down the world to a final, confident choice between 2-3 heavily compared options.

**The Functional Pipeline (`phase` state):**

1. **Intake & Profiling**: Gather hard constraints (Budget, Dates, Origin) and soft constraints (Vacation style, Travel history). *Analog: The initial search bar and filter toggles on [Booking.com](http://Booking.com), even if our UX will not use such filters and toggles.*  
2. **Exploration (Divergence)**: Brainstorm broadly. Track all user-suggested and LLM-suggested locations in a persistent candidate pool, avoiding premature lock-in. Start ranking options during discovery.  
3. **Shortlisting (Convergence)**: Agent forces commitment ("Should we focus on just these 3?"). Candidates are formally flagged as `active` or `eliminated`. *Analog: "Liking" or "Hearting" properties to save them to a trip board.*  
4. **Comparison & Trade-off (Evaluation)**: Present a structured comparison. Contrast the 2-3 active options directly against the user's constraints (logistics, budget, weather). *Analog: SaaS pricing tier matrices or side-by-side spec comparisons.*  
5. **Finalization**: User picks a winner. Agent provides strong rationale explaining *why* it's the optimal choice, setting the stage for the next agent (Itinerary Planner).

## **5\. Items selected for next sprint (Sprint 3\)**

### **Sprint 3: The State Machine & Structured Funnel**

*Focus: Ripping out the "open-ended chatbot" logic and replacing it with a strict, phase-gated state machine. This is the mandatory backend foundation before we can build a proper Generative UI.*

**Phase 1: The Engine (Agent Logic)**

1. **Phase-Gated State Machine**: Replace the generic conversational prompt with a strict 4-phase state machine (`Intake` \-\> `Explore` \-\> `Shortlist` \-\> `Compare`). The agent must strictly control the flow to force convergence, abandoning the meandering open-ended chatbot model.  
2. **Active Candidate Tracking (The "Cart")**: Upgrade the Pydantic state to maintain an explicit, array-based ledger of destinations. The agent cannot randomly "forget" user preferences; it must explicitly `add` or `remove` from this cart, treating it like a persistent e-commerce cart. Start ranking options during discovery.  
3. **Structured Evaluation Rules**: Introduce a very basic Multi-Criteria Decision Making (MCDM) into the agent's logic. Before asking the user for a final decision, the agent must evaluate the surviving candidates against their hard constraints (budget, distance) natively in its state. This is a simple evaluate-against-stated-criteria feature and is not a full scoring model. 

**Phase 2: Foundation for Generative UI (UX/UI)**

1. **Structured JSON Responses**: Shift the backend away from returning unstructured Markdown prose. The Agent must return heavily-structured JSON payloads separating `conversational_text` from `comparison_data` so the UI can ingest it programmatically.  
2. **The Active Cart Sidebar**: Implement a basic UI panel that continuously visualizes the explicit "Candidate Array" from the backend state. This proves to the user that the system is actively managing a narrow shortlist instead of just talking.

## **6\. Proposed Roadmap for the following sprints (Sprints 4-5)**

To transition this from a toy chatbot to a "best-in-class" B2C travel product, we must focus on high-impact structural and UX changes that fundamentally alter how the user makes their decision. We will ignore minor optimizations (like tone tweaking or minute weather checks) in favor of solving massive product maturity gaps.

### **Sprint 4: Generative UI & Visual Decision Support**

*Focus: Upgrading the UX to match modern B2C products. A chat interface is insufficient for building a mental model to make a $5,000 purchase decision.*

1. **Rich Destination Cards**: Implement dynamic, server-driven React components containing images, high-level cost bands, and map placements. The Agent should output structured JSON to render these cards, not just text.  
2. **Interactive Selection Board**: Users should be able to click UI elements (e.g., "Dismiss" or "Keep") on the cards, which immediately update the Agent's backend state without requiring a typed message.  
3. **The "Checkout" Screen**: Once a final destination is selected, the UI should transition out of the chat interface entirely into a dedicated "Trip Dashboard" finalizing the decision.

### **Sprint 5: Multi-Agent Handoff & Deep Tooling**

*Focus: Moving beyond single-prompt monolithic agents into a robust, scalable architecture.*

1. **Improved Evaluation System**: Improve MCDM within the agent's logic. This is a more complex score-against-stated-criteria feature.  
2. **The Multi-Agent Router**: Split the monolithic agent into specialized sub-agents (e.g., `Discovery Agent` \-\> `Flight/Pricing Agent` \-\> `Itinerary Planner Agent`). Implement state-handoff between them when the user transitions phases.  
3. **Real-World API Integration**: Integrate basic real-world API mockups (e.g., Skyscanner for flight duration/cost baselines, Google Maps for distances) to ground the comparisons in reality.

*Note: Generative UI (GenUI) is a paradigm shift in software design where AI, specifically Large Language Models (LLMs), creates or adapts user interface elements in real-time based on user context, intent, and behavior. Instead of rigid, pre-designed, "one-size-fits-all" screens, GenUI dynamically assembles components on the fly, tailoring the experience to the individual user.*

---

## **7\. Next steps**

**Proposal**:

1. **Spec-Next**: Planning is complete. We are ready for the agent to write a `Sprint 3 Spec` (e.g. State Schema & Prompt Structure, all implementation details).

**Decisions still open between PM & Code-Agent**:

1. I am still concerned about users not understanding the process and/or not being able to add items to their shortlist. I don’t want the chatbot to be inflexible, even if it has a structure to fulfil.   
   