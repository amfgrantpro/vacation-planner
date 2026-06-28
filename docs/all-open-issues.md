# **Open issues & ideation (Always WIP)**

## **1\. Executive Alignment**

**Purpose**: A place to record all open issues, as well as working space to sharpen solutions until they are ready for development.

**Latest update**: 26th June 2026\.

**Project meta-goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

\[\!IMPORTANT\!\]

* **This document DOES NOT convey importance or build-order.**  
* Once issues are selected for development, they will be REMOVED from this document and dealt with in the relevant planning document. This document contains OPEN issues \- NOT prioritised issues.  
* Issues in this document are collected over time and carry NO sprint attribution. Do not infer sprint attribution \- do not even attempt it.  
* It is NOT important WHEN the feedback was collected. Some items are okay to leave open for longer.

---

## **2\. Known issues collected over multiple sprints**

*Any/all open issues. This section DOES NOT represent importance or build-order.* *The information in this section is collated over time \- NOT from any specific testing session unless specified.*

*Issues are recorded in a random order and you cannot infer priority from position within the document.*

### Points of friction observed in user journey, UX & UI

**Overall product experience:**

* Users consistently prefer to act in the visual space rather than in the chat — the chat feels dense and the large visual area feels underused.  
* Users are capable of managing their own profile, refreshing the candidates and adding their own comparison criteria. Users feel like the agents are only really needed for content generation, but they are constantly being forced into chat conversation to move the process forward and trigger change in the visual space.  
* The product's own landing copy creates a scope mismatch. Some of the copy and sentence building implies that the product is for full vacation planning. The product is actually a destination finding and comparison tool. Users who arrive expecting the former take longer to understand what the product is actually doing — and when things like long-haul suggestions appear for a short trip, it reads as the product failing its own promise.  
* There is too much inconsistent LLM behaviour. The LLM performs every task most of the time \- however it can be observed to fail at every task sometimes (i.e. conversing like a real travel agent, updating trip profile, updating destinations, updating comparison). Sometimes it’s more technical tool-call failures, but other times they’re softer performance failures like forgetting to do something or recording bad values or overwriting data.

**Explore**:

* Overall, users feel that the visual space is very static \- they want "more movement and updates". “When I do something here {point to trip profile, or the agent chat}, I want to see change here {points to candidates section}”  
* The agent doesn't consistently factor Trip profile constraints into candidate suggestions (e.g. A user travelling from Berlin for 2 weeks felt that long-haul destinations like New Zealand weren't realistic: not enough time to properly explore them). The first-row trip profile fields are usually core constraints that don’t seem to be used when exploring potential destinations.  
* Editing the trip profile via the edit buttons doesn’t trigger a candidate update — the user has to send a chat message to get new suggestions. Users found this confusing. They wanted a manual control — a "refresh" button — to trigger a new round of suggestions on demand.  
* Early candidate cards don’t age or get deprioritised as the session progresses. The first suggestions (generated before the profile was built out) sit at the top of the list indefinitely unless the user actively dismisses them. Users assume the agent is still standing behind those suggestions, when in fact they predate most of the profile information. The lack of some kind of ranking of the candidates also speaks to the "lack of movement and updates" above.  
* “Tell me more” produces a chat response when users want the information in the visual space, in a card format similar to the comparison cards.  
* “Tell me more” produces a good answer about each destination, however users are not given the opportunity to specify what they wanted to know before the message is submitted to the LLM.  
* The product doesn’t serve users who know where they’re going but don’t know what to do there (e.g. I’m going to New York, which parts of the city should I go and see?).

**Comparison**:

* Users like the comparison cards — users find the side-by-side criteria cards useful and the criteria the agent picks are often well-chosen and relevant.  
* The comparison matrix is not seeded from the trip profile. Initial criteria tend to be generic (e.g. Weather, Getting Around, Top Attractions) rather than grounded in what the user has already told the agent. Even when a user explicitly asks to "compare by the factors in my trip profile", the agent inconsistently adds new criteria using all Trip profile fields. Users end up having to manually coax profile-relevant criteria in over multiple turns.  
* Comparison card content can change (and worsen) when navigating back and forward between phases, or prompting an update of the comparison matrix. Users find it frustrating and negative.  
* The agent sometimes ignores direct questions (e.g. "which one would be best for a 2 week trip?") in favour of following its own objective.  
* The quality of the generated criteria is inconsistent: The order of card items is arbitrary. Sometimes, related ideas are sometimes spread across multiple granular rows (e.g. three separate rows covering aspects of driving) where a single consolidated criterion would be clearer.  
* Users want a light itinerary or activity preview to help compare destinations. They want to know what the day-to-day might look like, and how a vacation would feel to them.  
* `trip_feel` content does differentiate from `vibe`, but the field doesn't earn its prominence on the comparison card. Early in a session it's too generic; later it becomes wordy as it tries to distil a richer profile into one sentence. Neither state is compelling. The underlying concept — what this trip would feel like for you specifically — may have value later in the decision journey or in a different form, but is not a near-term priority.

**Decision**: Under-utilised as a phase.

### Problem: Users don’t like chat as the primary interaction mechanism

Users prefer to use the visual space over the chatbot for information purposes (i.e. “tell me the details”) AND interaction (i.e. “let me do/ask something”). They want to use the chat on their own terms – if at all – not be led by a chatbot all the time.

The problem is that chat started as the primary interaction point with the product, and so has many responsibilities (both visible and hidden). As long as we continue to prioritise these functionalities, we will need to consider how to achieve these *without* forcing users into the chat conversation.

Chat is used for information sharing (increase context \- build profile, ask agent for more information).

* The current agent asks questions of the user during Explore and Compare. By answering the questions, the user’s information is turned (by the LLM) into an updated Trip Profile and comparison matrix. Users also voluntarily add more relevant information as it comes to them (e.g. “Maybe somewhere we can hire a car and drive around? We went to Seychelles a few years ago and that was really good to drive around a whole island to explore it yourself.”)  
* Users use the chat to give feedback on the suggestions (e.g. “I think the maldives and barbados would be too small”).  
* When users click on “tell me more {about X}”, a pre-formed chat message is sent and the agent responds in chat.  
* Users may ask the chat for the agent’s opinion on something during the compare phase.

The current chat isn’t used much for interaction; we designed the UX with the idea that the USER decides what to do, whilst the agent is responsible for updating the visual space (trip profile, candidates, comparison). Nevertheless, chat is still used for some interaction (do something \- select, add, remove, move phase):

* In order for new candidates to be added, the user must interact with the chatbot. Even if the user adds their own trip profile information, new candidates won’t be suggested unless the chatbot is prompted, or is forced to by the system (when \<3 candidates are active).  
* Users can use the chat to ask for new candidates (e.g. “Can you suggest some more?”).  
* In order to add a new comparison row, the user must interact with the agent \- either by answering a question during Compare, asking what each destination is like (e.g. “Which one is better for snorkelling?”) or asking explicitly to add a row.  
* The UI already enables users to Update trip profile (add, remove), Reject candidates (and remove rejected candidates), Manage shortlist (add, remove), Move to Compare (Preformed message “I'd like to compare my shortlist now”), Move to Decision, Move back to Explore (Preformed message “Find others”).

One other aspect of the chat is the role that it serves in Journey guidance (What to do & when).

* Chat is used in the “I already have destinations” path to ask for the candidates and add them to the candidates list so that they can be shortlisted by the user.  
* Chat is used to drive the exploration forward. It asks questions related to the trip or the traveller \- it builds up a more detailed trip profile and records user preferences for comparison later.  
* Chat is used to drive the comparison forward. It asks questions about what matters to the user in order to determine what should go into the comparison cards. A card with more comparisons should help users decide more easily.  
* Chat is NOT responsible for telling the user when to explore, compare or decide. That decision is entirely up to the user and is not prompted by the agent.  
* Users often ignore the chatbot’s line of questioning. They interject, ask their own questions, or add information outside of the direct question being asked.

### Being able to continue where you left-off would be appreciated

It was noted that a method of picking up a session to continue later would be a good improvement.

* Hitting refresh manually (or having the browser auto-refresh) kills the session and forces a restart with effort going back into intake and profile building, and not having the same chat history.  
* Sometimes you want to have another discussion about the same vacation to see what other options the LLM will provide in a different chat (i.e. same Trip Profile, new session).

### Bugs carried over from previous improvements

1. **BUG — Comparison matrix UI drops criteria between turns**: The frontend replaces the displayed comparison matrix wholesale with whatever the LLM returns each turn. If the LLM returns fewer criteria than it did previously, the user sees criteria disappear — even though those rows still exist in the DB. The UI must accumulate criteria across turns (matching DB behaviour) rather than replace them.

---

## **3\. Ideation**

*Any/all open issues. This section DOES NOT represent importance or build-order.*

### Problem: Visual interactivity

Users consistently prefer acting in the visual space over the chat strip. Reducing round-trips back to chat for key information is the guiding principle of the “visual interactivity” space.

* Users would prefer the response to the “Tell me more” button to be in the visual space (it currently produces a chat response). Users suggested a comparison card would be good (even if it had fewer, pre-defined fields).  
* Encourage users (in the UI) and the agent to add custom comparison rows (e.g., “Add a row for…” \+ accommodation style, kid-friendliness, vegetarian food options etc.). The agent then fills in the matrix table. The agent could also proactively propose relevant criteria based on the trip profile rather than waiting for the user to ask. User testing confirms the agent often picks good criteria — this gives confidence that surfacing the ability to suggest or add rows is worthwhile.  
* “Tell me more” may work better as a contextual options button — “Tell me more about…” with choices like “where it is”, “possible activities”, “food & drink” — so users can be more specific without returning to free-text chat.

More research into other travel products (e.g. Layla, Mindtrip & others) is needed.

### Ideation: Users don’t love chat as an interaction mechanism (long-term)

*This problem cannot be resolved in one go. This section contains potential mid-term strategies that might move us to where chat is no longer the primary interaction surface of the product.*

Users want to use the chat on their own terms – if at all – not be led by a chatbot all the time. They prefer to use the visual space over the chatbot for information purposes (i.e. “tell me the details”) AND interaction (i.e. “let me do/ask something”).

The idea: “**Chatless” UI**. Effectively, we remove the chatbot. This requires a more robust visual space so that the UX is built around the user managing their OWN exploration/decision journey.

This is a shift in how we use AI as a product. The mental model is less “chat to a travel agent” and more “find your next destination and get help from our travel workspace assistant”.

* When users update profile → agent generates new candidates.  
* When user shortlists/rejects candidates and wants more → agent generates new candidates.  
* When users add new comparison rows → agent generates comparison content.

Some kind of chat input/output *can* remain (e.g. using a small chat box where the agent asks relevant prompting questions, or a box where users can just ask/say what’s on their mind).

* When users have a question → they can ask it → agent answers their question.

Under the hood, the chat history might remain the same as it is today – a coherent transcript of turns with questions and answers interspersed with UX actions (e.g. tell me more, I’d like to compare, find more). However, it probably won’t read as a conversation, because it wasn’t perceived as such from actions taken across the various spaces in the UI.

Ways to reduce the use-cases for the chat component:

* Show the answer to “tell me more” in the visual space, not as a chat response.  
* Add a button for users to generate new candidate suggestions.  
* Enable users to give feedback on the candidates, then generate new suggestions.  
* Enable users to add custom comparison criteria to the compare matrix.  
* Enable users who “already have destinations in mind” to enter them on intake so that they are already candidates on arrival into the flow.  
* Explore/Compare agents currently use questions as a means of driving the journey forwards (ask question → add response info into profile → give better suggestions → shortlist takes shape → comparison criteria grows → decision is made). Replace the chatbot entirely with targeted boxes: “Answer a question / Ask a question / Say something”.  
  * (Answer a question) Agent places its next question into the box. Users can choose to answer (in natural language) in the field provided. Their answers should help us to build up their trip profile/comparison criteria.  
  * (Ask a question / Say something) Open field for users to ask their own question of the agent.  
  * User inputs are submitted to the agent as the next turn.  
  * Optional: Users can see old questions/answers (i.e. the chat transcript) by clicking on something.

### Problem: Users feel that their trip constraints aren’t being used to make better suggestions

The trip profile has two rows: hard facts (origin, travelers, when, duration, budget) and softer preferences (things we like, let's avoid). The hard facts are a natural prompt for the kind of profiling questions that produce richer second-row data.

The agent could use the first row to ask targeted questions that build out the second — e.g. asking about duration to understand how the user likes to pace a trip, or asking about traveling as a couple to uncover preferences to add as likes/avoids.

### Problem: Session loss on browser refresh & ability to continue later on

These are two distinct problems with different solutions:

1. **Restore on refresh** (same browser/device, short-term): The client-side app stores the session payload (`messages`, `plan`, `uiState`) in `localStorage` keyed by `session_id`. On page load, the frontend checks for existing session data and restores it instantly. Low complexity, no backend required, covers the “accidentally refreshed” case.  
2. **Come back later / continue across sessions** (the more valuable feature): Stores Trip Profile, rejected candidates, and shortlisted candidates under a shareable Chat ID. The user can enter the ID to resume planning — the agent is initialised with the saved state and starts a new conversation from that point. This requires some form of persistence (backend database, or encoded state in a URL) and is meaningfully more complex than localStorage. This is the version that maps to real-product behaviour — most travel planning happens across multiple sessions.

---

## **4\. Delivery history (as of Sprint 13\)**

| Sprint | Major focus | Other important changes | Release date |
| :---- | :---- | :---- | :---- |
| 1 | First working agent — a chat loop where the LLM updates a mutable plan state each turn. | — | 13 Feb 2026 |
| 2 | Agent becomes adaptive. Instead of asking preset questions, it identifies what it doesn't know and pursues it. | — | 15 Feb 2026 |
| 3 | The product gets structure. A 4-phase funnel (Intake → Explore → Shortlist → Compare) replaces the open conversation, with a persistent candidate list and a comparison matrix at the end. | Took three iterative builds to get the agentic loop right — the architecture that came out of it has been the foundation ever since. | 2 Mar 2026 |
| 4 | The product gets its visual form. Split-panel UI with Trip Profile, destination cards, shortlist, and Compare view. Lovable adopted as the visual reference. | Client-authoritative state introduced: frontend owns mode, backend fills content. | 29 May 2026 |
| 5 | Users can reject candidates and remove them from the session permanently. | UI brought into superficial Lovable visual alignment but still messy due to incorrect initial implementation. | 6 Jun 2026 |
| 6 | Long sessions stop breaking. History pruning and a turn-1 bypass introduced. | — | 9 Jun 2026 |
| 7 | Trip Profile becomes editable by the user directly in the UI, not just via chat. | Tailwind/Lovable component mismatch resolved — Lovable components can now be ported directly without translation. | 10 Jun 2026 |
| 8 | Agent reframed to act on new information the same turn rather than deferring. Tool-call retries introduced. | — | 12 Jun 2026 |
| 9 | Single agent split into two: a dedicated Explore agent and a dedicated Compare agent, each with its own prompt and tools. | — | 13 Jun 2026 |
| 10 | Both agents substantially improved. Profile updates stop silently dropping data. "Already have destinations" path added. | vibe and trip\_feel redefined as distinct fields for the first time. | 16 Jun 2026 |
| 11 | Landing page redesigned. | Single CTA, multi-select vacation type, right panel becomes a journey preview rather than empty space. | 20 Jun 2026 |
| 12 | Database setup (Supabase). | Five-table schema (`sessions`, `trip_profile`, `candidates`, `comparison_criteria`, `conversation_history`) committed to `supabase/schema.sql`. | 25 Jun 2026 |
| 13 | Session persistence migration to external DB (Supabase). | `SessionManager` replaced by `SupabaseSessionManager`. All session state reads/writes from Supabase. `POST /sessions` endpoint added. `/chat` behaviour unchanged from user's perspective. | 26 Jun 2026 |

---

## **5\. Strategy**

**Direction**: The product is moving from a chat-driven architecture to a visual workspace with intentional AI. Users control their destination discovery and comparison journey directly in the visual space. AI is invoked for specific generation tasks — not used as the single orchestrator of all state changes.

**Why the current UX model is a dead end**: We built the product around a chat-with-a-consultant approach. Users don’t like interacting with chatbots and want to control their own user journey. Their ability to own the visual space (as a user) and our ability to build a popular UX (as a designer and builder) is being *actively harmed* by the continued existence of the chatbot. The longer we persist with that unpopular and ineffective UI component, the harder it becomes for us to make good product decisions. It is a cancer on this project. We need to simplify the product & do more with less. We will focus the product around the visual space and aim to give users the ability to run end-to-end without needing to engage with any chatbot.

**Why the current architecture is a dead end**: Every user action — profile edits, candidate refresh, comparison generation, "Tell me more", mode transitions — routes through a single `/chat` endpoint and is processed by the conversational agent. The agent serialises the full session state into its system prompt every turn and is simultaneously responsible for conversation, profile extraction, candidate suggestion, and comparison matrix generation. It performs all of these tasks unreliably because it is doing too many jobs at once, against a growing context. Prompt iteration has reached the limit of what it can guard against.

**Architectural destination**:

* State lives in a database. Sessions, trip profile, candidates, comparison criteria, and conversation history persist across requests and across sessions. Nothing lives in server-side memory.  
* Dedicated generation endpoints handle AI tasks: suggest candidates given a profile, generate comparison content given a shortlist, produce rich card detail on demand. Each endpoint does one job. Each is a focused, single-purpose LLM call — read what it needs from DB, call LLM, write result to DB, return. (Note that the endpoints could be given more than just Profile for useable context).
* The conversational agent's role is reduced to two things: extract trip profile information from what the user says in natural language, and answer questions. It no longer manages the visual space and no longer needs candidates or comparison data in its context.
* The frontend calls generation endpoints directly from UI actions. Profile changes, candidate refresh, comparison generation, and card detail are all triggered by the user in the visual space — not by sending a message to chat.  
* Chat is an optional input layer for questions and natural-language context. It is not required to move the product forward.

**Selection principle**: Incremental improvements to the current chat-driven architecture are not candidates for development.

**On the role of agentic AI**: User testing separated two things that were bundled together: the intelligence (quality of suggestions, travel knowledge, personalisation, ability to feel like a single consultant) and the chat interface. Users were impressed by the former and consistently preferred not to use the latter.

* "Agent as product" (a chatbot that leads the user through their journey) has been disproven by testing \- it turns out the product is better served by using AI for direct generation rather than full agentic orchestration.  
* "Agent as assistant" (something you consult when you want it, ignorable when you don't) still has value in another role: expressing complex preferences in natural language that a form can't capture, asking questions that require travel knowledge applied to a specific profile, and thinking something through.  
* An interesting potential future for agentic AI in this product sits inside the generation pipeline, not at the interaction layer. A `/generate/candidates` call that reasons in steps — identify binding constraints, generate a broader set, score against the profile, return the best — is multi-agent agentic AI. Multi-step reasoning produces better output than a single LLM call. That intelligence is invisible to the user and shows up in result quality. A possible direction for agentic AI takes in this product: better thinking under the hood, not more conversation on the surface.

---

## **6\. Proposed Roadmap for upcoming sprints (Sprints 14-16)**

### Items planned for development

Sprint 14: **Generation endpoints**

* Add two focused generation endpoints, each a single-purpose LLM call:  
  * `POST /generate/candidates` — given a trip profile, current candidates, rejected candidates, and chat history, return 3 candidates. Writes to candidates table.  
  * `POST /generate/comparison` — given shortlisted candidates and a trip profile, return matrix rows and card details. Writes to comparison table.  
* Bug fix: Comparison matrix UI drops criteria between turns.

Sprint 15: **Frontend wired to generation endpoints**

* Refresh candidates button → calls `/generate/candidates` directly from the frontend. No chat message sent.  
* Compare CTA → calls `/generate/comparison` directly. No chat message sent.  
* Mode transitions (Explore → Compare → Decision) become pure UI state changes and call endpoints rather than sending a preformed `/chat` message.

Sprint 16: **Agent simplified**

* Chat becomes a secondary input layer: available for the user to ask questions or add context, but not the mechanism that drives the visual space.  
  * Tools and scope reduced based on what is learned in Sprint 15\. What stays and what goes is a decision for that sprint, not now.  
* Rewrite agent prompts for the reduced role: probably Q\&A, plus profile extraction from conversation.  
  * (Maybe) Remove `TOOL_SUGGEST_CANDIDATES` and `TOOL_GENERATE_COMPARISON_MATRIX` from both agents.  
  * (Maybe) Strip candidates and comparison matrix from the agent's system prompt — it no longer needs them. Context becomes lean by design.  
  * (Probably) The agent's only remaining tool is `update_trip_profile`.

### Backlog of items not yet selected for development

* **`/generate/card` endpoint**: Single-purpose LLM call — given a candidate and trip profile, return rich card content for “Tell me more”. Writes to candidates table. “Tell me more” calls this endpoint and renders the result in the visual space, not as a chat response.  
* **Improve the “Tell me more” button (Explore)**: It’s better used when you’re finding out more about a location out of definite interest. Perhaps it would be better as an options button like “Tell me more about…” with options “where it is”, “possible activities”, “food & drink” etc. Perhaps is better if we bring up a more detailed candidate card with more info. Not sure.  
* **Increase prominence of custom Comparison criteria**: Encourage users (in the UI) and the agent to add custom comparison rows (e.g., "Add a row for…” \+ accommodation style, kid-friendliness, vegetarian food options etc.). The agent dynamically updates the matrix criteria.  
* **Backend: Trip profile as a persisted entity**: The trip profile is the richest output the product creates. Persisting it as the root entity — with candidates and criteria hanging off it — is the most natural data model for the product and opens up future multi-session scenarios.  
* **Backend: Durable comparison criteria**: Persist the criteria list server-side so the agent can append to it but never overwrite it. Protects explicitly-added criteria from being dropped when the matrix is regenerated.  
* **Rich candidate infocards (needs backend)**: When a user requests more detail on a candidate ("Tell me more") or enters Compare, trigger a separate generation call producing a richer card personalised to the trip profile. Store it in a backend keyed by session and candidate. The agent's working state stays lean; the frontend fetches rich content independently and displays it in the visual space. Content generated during Explore is reused in Compare without regenerating.  
* **Backend: Photo URL cache**: Store destination → Unsplash URL in a backend, built up over time to reduce live API calls for destinations that have been looked up before.  
* **Restore on refresh (localStorage)**: Store `messages`, `plan`, and `uiState` in `localStorage` keyed by `session_id`. On page load, restore from existing session data if present. Covers the accidental-refresh case with no backend required.  
* **Chat ID / session continuation**: Store Trip Profile, rejected candidates, and shortlisted candidates under a generated Chat ID. Allow users to enter the ID on the landing screen to resume planning in a new session, with the agent initialised from saved state. Requires persistent storage (backend or URL-encoded state). Would be a useful experience to learn backends.  
* **Improve Comparison with a light itinerary or activity preview**: Users want a feel for what the trip would actually look like before committing. A rough sense of activities or a light day-by-day sketch during comparison would help. As a second version, a structured 3-day or 7-day daily timeline draft with activity recommendations could be shown during the Decision phase.  
* **Better journey for suburb/region-level planning**: The product is destination-focused but doesn't serve users who know where they're going and want to know what to do or where to stay within a destination (e.g. which neighbourhood in New York, which part of the Algarve).  
* **UI pagination**: Separate Landing, Explore & Compare as different screens so that users can switch between tasks within a single “journey”, updating and adding/removing as they go. This could also be collapse/expand sections instead.  
* **Mobile UX**: Rethink the artifact UX — move candidates inline like ChatGPT/Claude and think about how mobile interactions work to build and evaluate a trip.  
* **Chatless UI**: Effectively “hide the chat under the hood”. Requires a more robust visual space so that the UX is built around the user managing their own journey.  
* **Interactive Map Component**: Add a map overlay/view in the Candidate Area showing pins for current candidate destinations and rough routes.  
* **Real-World Travel API Integration**: Learn about the various Travel APIs out there. Potential: Integrate mock flight duration, weather history, and cost indices to ground the candidate details in realistic travel metrics.  
* **Backend: Destination knowledge base**: Cache generic destination facts (geography, climate, activities) that aren't profile-specific and could be reused across sessions rather than regenerated each time.  
* **Backend: Analytics / product intelligence**: Record what destinations are suggested, shortlisted, and rejected — queryable over time to inform product decisions.  
* **Shareable / Exportable Trip Brief**: Generate a formatted PDF or Markdown document summarising the Trip Profile, the Comparison matrix (why this destination won), and the draft itinerary.  
* **Developer Debug Panel**: Wire `DebugPanel.tsx` behind a visible toggle and extend it to display the pruned messages array and approximate token count alongside the existing plan JSON view. Investigate surfacing tool call failure logs from the orchestrator.

---
