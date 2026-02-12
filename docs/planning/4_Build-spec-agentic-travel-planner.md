# **Build Spec: Agentic Travel planning tool**

## **Sprint 1 (Raw Agent Loop \+ State)**

Objective:  
Build a single-user web chat that calls an LLM and behaves like a destination-decision assistant across 10–20 turns. The system must persist (a) full conversation history and (b) a mutable state object that the model updates every turn.

Non-goals:  
No database. No auth. No deployment polish.

## **System Components:**

1. Chat UI (web)  
   1. Minimal UI is fine (Gradio (or similar) is acceptable for Sprint 1).  
   2. Must show a conversation transcript.  
   3. Must allow user to send messages repeatedly.  
2. Backend “agent loop”. On every user message:  
   1. Append user message to conversation history.  
   2. Call LLM with:  
      1. System prompt (fixed)  
      2. Conversation history (full for now)  
      3. Current state object (serialized and included in the prompt OR via tool call context)  
   3. Receive model output.  
   4. Update state object:  
      1. Either via tool/function calling (preferred) OR   
      2. via a second “extract/update state” model call.  
   5. Append assistant message to conversation history.  
   6. Return assistant message to UI.  
   7. Log (print) state object after each turn.  
3. State object:  
   1. Persist in server memory (single-user).  
   2. Initialize on new session to:  
      `state = {`  
      `"notes": "",`  
      `"constraints": {},`  
      `"preferences": {},`  
      `"candidates": [],`  
      `"open_questions": [],`  
      `"decision": {`  
      `"status": "in_progress",`  
      `"selected_destination": null,`  
      `"rationale": ""`  
      `}`  
      `}`

## **State requirements:**

* The model must update state on every turn (even if only “notes” changes).  
* The backend must store the updated state and use it on the next call.  
* State must be visible for debugging (console log or UI debug panel).

State Update Mechanism:

Approach A (preferred) \- Tool/function calling:

* Define a tool, e.g. update\_state(patch: object) \-\> void  
* Model calls update\_state with a JSON patch.  
* Backend merges patch into state (deterministic merge rules).  
* Then the model produces its user-facing reply.

Approach B (if required) \- Two-call loop:

* Call 1: Generate assistant reply (user-facing).  
* Call 2: Extract updated state as JSON strictly matching the state keys.  
* Backend overwrites state with the returned JSON (validated).

Validation (minimum):

* Backend must reject non-JSON state updates (retry once).  
* Log any failures clearly.

Logging (after each turn):

* Print:  
  * Raw model response  
  * Tool call payload (if any)  
  * Current state dict

## **LLM Behavior Contract (System Prompt Requirements):**

The assistant must:

* Ask clarifying questions when constraints are missing.  
* Propose candidate destinations when enough info exists.  
* Revise recommendations if the user changes constraints.  
* Keep candidates list small (e.g., 3–5).  
* Never “finalize” unless user explicitly agrees.

## **Deliverable:** 

A working local app where:

* You can chat 10–20 turns.  
* Conversation persists across turns in-session.  
* State persists across turns in-session.  
* State visibly evolves (constraints/preferences/candidates/open\_questions).

## **The coding agent should offer assistance in the following areas:**

* Which LLM provider \+ model name?  
  * I’ve used Langchain & Groq API.  
  * Considering my Project Brief, I’d like to ask for suggestions for real-world products in 2026\.  
* Tool calling supported?  
  * If this is what defines the product as being Agentic \- Yes please.  
* Backend choice?  
  * I’ve used Gradio before.   
  * Is there anything more relevant for real-world products in 2026?  
* Tech stack?  
  * I don’t know the best choices for any of these.   
  * Backend: Python (FastAPI or simple Flask)  
  * Frontend: Gradio or minimal React  
  * LLM Provider: OpenAI / Anthropic / etc.  
  * Model: Don’t know which are fit-for-purpose at this stage  
* File structure that helps me assess, learn and test.  
  * Possibly worth creating a python workbook to help me play around with the agent loop?  
* agent\_loop pseudocode  
  * Whether to use a framework (LangChain/LlamaIndex) vs raw SDK calls for learning clarity.  
* System prompt (v1 draft)  
  * How to structure prompts, and how to prevent token waste in later sprints  
* Tool signature  
* Object merge rules  
* Observability/logging (what prints where; optional debug panel plan)

---
