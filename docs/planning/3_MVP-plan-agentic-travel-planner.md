# **MVP Plan: Agentic Travel planning tool**

## **Positioning / Framing:**

* Demo positioning: “Spend less time working out where you want to go on vacation, so you can spend more energy planning how to have the best vacation.”  
* MVP positioning: “Spend less time planning your next vacation, so you can spend more energy enjoying your next vacation.”

## **Sprint 1 (Agent demo) — Build the smallest agent loop**

Goal: Make an LLM behave like a travel decision assistant that helps a user choosing a destination over multiple turns.

Agent scope: This agent helps a user decide on their next vacation **destination** by iteratively clarifying constraints and proposing options.

Deliverables: 

1. Have a web UI where:  
   1. You send a message.  
   2. The system maintains conversational context.  
   3. The model can ask follow-up questions.  
2. You can have a 15-turn conversation about choosing a destination and it feels coherent.

To build in Sprint 1:

1. A basic web chat UI  
   1. Gradio or something. It’s simply for learning. The UI does not matter.  
2. Conversation state (Conversation state)  
   1. A conversation memory (not “agent memory”):  
      1. A conversation array  
      2. Appended each turn  
      3. Sent back to the model  
   2. You need to understand:  
      1. How messages are formatted  
      2. How system prompts behave  
      3. How token growth affects performance  
3. A controlled system prompt  
   1. This is where the “agent” should be tested.  
   2. Agent \= System prompt \+ conversation memory \+ LLM  
4. Basic structured state  
   1. Basic state object (very loose \- Not JSON for now)  
   2. Just create a Python dict like:  
      `state = {`  
      `"notes": "",`  
      `"constraints": {},`  
      `"candidates": []`  
      `}`  
5. Tool call for “update\_state”  
   1. Let the model update it via function calling or structured output.  
   2. Manual logging of state after each turn

Sprint 1 is about discovering:

* How an agent takes inputs, calls a tool and determines an action.  
* How brittle or robust the loop feels.  
* What kind of outputs the model naturally gives.  
* How often it forgets constraints.  
* Whether it contradicts itself.  
* How messy state updates become.

---

## **Sprint 2 — Improve state object & agent loop**

Now that we’ve seen how the model behaves:

* Introduce structured extraction of constraints.  
* Force model to output JSON alongside message.  
* Persist structured state cleanly.  
* Start normalizing things (dates, budget bands, etc.)  
* Introduce new tools that improve agent performance (i.e. better recommendations. Maybe a travel API is free-to-use and improves LLM-only outputs?)

Deliverables:

1. You can inspect a stable state object that accumulates over turns.  
2. The agent loop begins to behave more like a more real-world travel agent.

## **Sprint 3 (UX demo) — Add visual artifacts**

Only after state is stable and outputs are decent:

* Render candidate destinations in a simple list or grid.  
* Let user click one and send feedback back to chat.  
* Keep chat as control surface.

Deliverables:

1. A new UI with more modern UX patterns (Can be run locally. Deployment not necessary).  
2. Users can interact with artifacts 

---

## **Sprint 4+ (Towards an MVP)**

Possible epics to reach an MVP:

* Improve agent tools for better recommendations and outputs  
* Improve UX of destination-choice flow & artifacts  
* Support additional use-cases (next: itinerary-choice)

MVP Goal: 

* Premise: Users talk to ChatGPT to narrow-down their next vacation options until they decide.   
* Product: Create a UX that supports a user in their travel-planning with LLM-level advice but with modern UX and visualisations  
* Outcome: Our tool will be better at determining the ideal next vacation than simply chatting with ChatGPT or another LLM.