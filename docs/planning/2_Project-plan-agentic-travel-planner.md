# **Project Plan: Agentic Travel planning tool**

## **1\. Problem space: Pre‑booking travel decision-making**

The focus is the **pre-booking phase** of **travel planning**, where users are deciding:

* when to travel  
* where to go  
* what kind of trip they want  
* whether an option is viable

The starting point is: “I know I want to go on a vacation, but I need to decide which one I want to go on next.”

This phase has a large variety of possible knowns and unknowns. For example, a weekend getaway might be limited by timing and distance, whilst a 3-week annual vacation can be flexible but limited by potential costs.

People already do this today by talking to ChatGPT. It is an iterative process as users add information and boundaries to begin narrowing down potential vacations. Users may also:

* open many browser tabs  
* jump between maps, lists, docs, and calendars  
* iterate many times as they think of more conditions and factors to consider.

---

## **2\. User personas**

Our ideal users are people who:

* Plan & book their own vacations  
* Like to go to new places  
* Are comfortable using an LLM (e.g. ChatGPT)

---

## **3\. Product pitch**

Core premise: 

* Many people use ChatGPT (and other LLMs) to discuss broad and varied criteria for their upcoming vacation options.   
* Users are happy with how this process works because they get to ask the questions that are specific to their needs, desires and constraints.   
* ChatGPT (and other LLMs) mostly output text. 

Core belief: 

* If we can produce a UX that supports a user in their travel-planning with LLM-level advice but with modern UX and visuals, our tool will be better at determining the ideal next vacation than simply chatting with ChatGPT or another LLM. 

This project aims to build a tool that acts as decision-support. It is:

* Focused on helping users think, compare, and commit  
* Built on top of existing, well-understood UX patterns  
* Explicitly grounded in real user behavior

The project deliberately stops **before** the booking boundary. This project does not aim to build: 

* A booking engine  
* A price-optimization platform  
* A recommendation engine

---

## **4\. Design philosophy**

Many people use LLM chats to ask all of their questions, then use the output to run searches on-the-side. We aim to improve the UX of planning-via-LLM by using the tools and UX models the industry has already come up with. We wish to learn by copying the design patterns of the best-in-class vacation planning solutions. 

Travel planning is a *sequence of decisions*, such as timing (how many days? when?), destination, itinerary. Each vacation-decision requires a different mental model. Users naturally move between reasoning modes. The best tools must be able to maintain context, while helping users reason in *the right way at the right moment.* 

This project follows these principles:

* Iteration over one‑shot output  
* Progressive disclosure of details and constraints  
* Artifact‑centric design

The goal is not to support every possible flow, but to support **the right flow at the right time**.

## ---

## **5\. Role of Chat, Artifacts & Agents**

The product is built around:

* **Chat** as the primary entry point  
* **Artifacts** as the primary thinking surface  
* **Agents** as hidden reasoning components

**Chat** supports the user to communicate with the tool. Chat is not the product \- it is a tool used for input. Chat is:

* the place where initial constraints are iterated and the real picture of the user’s desires becomes clearer  
* the tool to gather signals, trigger transitions and to request revisions  
* the place where intent, constraints, and preferences emerge

Beyond the Chat UX, users might be provided with **artifacts** to help in decisions. Possible artifacts might be:

* destination shortlists  
* routes and itinerary variants  
* daily activity timelines  
* side-by-side comparisons

Artifacts exist to:

* simplify cognitive load  
* make trade-offs visible  
* support comparison  
* enable a user to commit

This project may eventually use **multiple agents**, coordinated by a central orchestrator. We intend to still present a single, coherent interface to the user.

Possible agent responsibilities include:

* destination shortlisting  
* itinerary synthesis  
* comparison and diffing  
* revision reconciliation

Whether this ends up as a single adaptive agent with tools, or multiple specialized agents is a **future design decision**, not a foregone conclusion.

---

## **6\. Build strategy**

The build will proceed incrementally:

* Start with one vacation-decision  
* Support it end‑to‑end  
* Validate the artifact model  
* Expand to adjacent decisions

Example of a possible build order:

1. chatbot for discussing your next vacation destination  
2. agent specialised in providing destination options   
3. UX to display destination comparisons  
4. agent specialised in providing itinerary options  
5. UX to display and alter itineraries

We will address additional vacation-decisions incrementally. With each additional use-case, we can:

* assess the need for additional agent tools  
* assess the need for additional agents or orchestration  
* consider the best-in-class solutions for the use-case to replicate real 2026 products.

---
