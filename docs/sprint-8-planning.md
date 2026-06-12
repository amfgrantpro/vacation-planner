# **Sprint 8 Planning (WIP)**

## **1\. Executive Alignment**

**Purpose**: Sprint 8 closes the gap between “a product that mostly works” and “a product that reliably works”, and makes targeted prompt improvements to agent behaviour as a foundation for the UX work that follows.

**Context**: Sprints 4-7 have brought the product a long way forward.

Sprint 4 implemented a full UI, which brought the product to life as a “chat \+ visual reference” product. Further improvements:

1. UX: Users can reject candidates (Sprint 5\) and edit profile directly (Sprint 7), which improves the user’s control over discussion and focuses on real candidates without wasting LLM turns.  
2. Agent: Prompts improved to generate more candidates, spend less time parroting needless information and reducing the context window to enable longer chats (all Sprint 6).  
3. Sprint 7 resolved the mismatch between `apps/web` and `apps/lovable-ui` — meaning future Lovable components port without translation.

Sprint 8 feels like a bit of a new phase. We have a good product but need to establish a reliability floor. A \~50% session failure rate undermines every other improvement — users can’t experience a better product if the session crashes before they get there. 

**Sprint Goal**: A session should be able to reach and complete the Decision phase without a fatal tool error. The agent should use tools proactively without needing to be prompted \- it should keep the suggested candidates at 3 or more and not spend 1-2 turns with a single card in there.

**The Meta-Goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

\[\!IMPORTANT\] **Constraints to preserve (from prior sprints)**:

1. Keep the **Client-Authoritative State Sync** (frontend owns `mode`, backend owns content).  
2. Preserve the **Conditional Dual-Call ReAct Loop** in the backend orchestrator.  
3. Use **flat JSON tool schemas only** — no Pydantic schema generation for Groq tools; `additionalProperties` not used (Groq silently drops tools that include it in nested schemas).  
4. The agent fails every time you give it a tool name in the system prompt. **Do not re-insert tool names into instructions**.  
5. Candidate upsert is by `name.lower()` — never replace the full array; shortlisted names are skipped.  
6. **Lovable is a visual reference, not a working application.** When porting a Lovable component, copy its CSS classes and layout. Never adopt its prop types or data model — those use hardcoded demo data. The web app's existing prop interfaces are authoritative.

---

## **2\. Issues raised during user testing**

### Agent tool call failures are still very common

Two distinct failure modes have been observed:

**Format mismatch errors (400 `tool_use_failed`)**: The model generates the correct tool name and correct content — but outputs it in the wrong syntax. Groq’s API receives `<function=name>{...}</function>` markup instead of a structured tool call, rejects it with a 400 error, and the frontend shows “Error connecting to agent.” The `failed_generation` field in the Groq error payload contains the actual model output, confirming the intent was right and only the format was wrong. This failure is context-length sensitive: more likely to occur later in a session when the message history is long, and particularly on mode transitions (e.g. returning to Explore from Comparison). It can also occur during the Explore phase before any mode switch. There is currently no retry path — the 400 is treated as fatal and the whole turn fails.

**Silent prose fallbacks**: The agent less-often writes a tool invocation as natural language in the chat response rather than calling the tool (e.g. describing candidates in text instead of calling `suggest_candidates`). No error is raised; the tool simply never executes and the UI receives no update.

I would estimate \~50% of sessions are affected by at least one failure of either type.

### The agent is passive and over-confirms

Two related patterns persist despite prompt work in Sprint 6:

* **Mirroring and confirmation**: The agent frequently paraphrases what the user just said before responding (e.g. "Avoiding crowded areas will definitely help you achieve a more relaxed atmosphere" immediately after the user said they avoid crowds). Sprint 6 produced a definite reduction in this, but the pattern still appears regularly.  
* **Passivity on tool use**: The agent treats conversation as its primary output and uses tools reactively rather than proactively. In testing, the agent had to be prompted explicitly for candidates more than once before it acted — even after gathering sufficient profile information to justify suggestions. The agent fills conversational turns rather than moving towards action. Sprint 6 targeted this but the underlying tendency persists.

### Being able to continue where you left-off would be appreciated

Hitting refresh manually, or having the browser auto-refresh, killed the session.

It was noted that a method of picking up a session to continue later would be a good improvement.

### Points of friction in UX & UI

1. Landing:  
   1. It’s unclear why the two bonus options are down after the CTA’s. They feel too similar to the main questions, or it’s just not clear that they’re extra things you can add.  
   2. Vacation type intake dropdowns lack some options for exploring a variety of possible vacation styles. Combinations are not possible.  
   3. Missed opportunity: The landing page doesn’t explain the product journey. Users arrive without knowing what they’re about to experience — how the chat and destination cards work together, or what the end goal looks like. The "aha moment" (seeing personalised destination cards appear and update in real time) only happens once you’re already in the Explore phase. Users who don’t understand the product spend more time trying to work out whether to chat or interact with the visual space \- it’s not a comfortable experience. A brief visual or textual explanation of the flow on the landing page could meaningfully improve the share of users who get hooked.  
2. Explore:  
   1. “I already have ideas” doesn’t seem to alter the conversation. The agent rarely asks what the ideas are, and the conversation doesn’t revolve around that point.  
   2. The agent never asks about previous trips or vacations that might be an experience the user might want to use as a model for the new one.  
   3. The agent’s questions rarely force a trade-off. “Do you like any of mountains, forests or coastlines?” invites a “yes to all” answer that reveals nothing useful. Good questions make the user prioritise one thing over another (e.g. “Would you rather somewhere peaceful and remote, or somewhere with good infrastructure and restaurants?”). This is also connected to the passivity issue — the agent is often filling conversational turns rather than actively narrowing towards a recommendation.  
   4. The candidate cards show a region (usually the continent, i.e. Europe), but often lack a country. Sometimes an unknown destination (e.g. High Tatras) requires a press of “Tell me more” in order to find out where they actually are. It’s better used when you’re finding out more about the location out of definite interest. Perhaps “Tell me more” could be better as an options button like “Tell me more about…” with options “where it is”, “what people do there”, “what the food is like” etc.  
   5. The product is centred around destinations as a place to go \- but not so much for people who know where to go but don’t know what to do (e.g. I’m going to New York, which parts of the city should I go and see?).  
2. Comparison:  
   1. Comparison phase lacks a bit of focus and structure to really make a decision.  
   2. The agent doesn’t seem to care much about the trip profile anymore \+ rarely updates the profile (see above: the phase lacks structure so new profile points rarely come up).  
   3. Vacation Vibe & Best For are lacking precision. It’s not quite clear what they’re explaining.  
   4. People often like to plan/compare with a light itinerary or a feel for what the activities would be like.  
2. Decision:  
   1. This phase is the natural end-point but is under-utilised at the moment.

### The backup model behaves a bit differently to the primary model

2. **Backup agent uses markdown**: The fallback model produces markdown-formatted responses (headers, bold, bullet lists). The web app renders these as unstyled inline text. The backup agent's prompt does not currently include a markdown suppression instruction.  
3. **Backup agent comparison matrix overwrite**: When the backup agent adds a row to the comparison matrix, it **sometimes** sends only the new row rather than the complete matrix — discarding previously generated rows. The `generate_comparison_matrix` tool description instructs the model to read current values from state and always send the complete matrix, but the backup agent is not following this instruction reliably. The history filtering introduced in Sprint 6 (which removed tool call history from the context window) was identified as a known risk for exactly this pattern.  
4. **Backup agent exposes internal reasoning**: The backup agent occasionally writes its chain-of-thought or instruction text into the chat response, visible to the user.

### Debugging what’s going wrong when live-testing can be pretty difficult

Visibility into the Trip Profile and the Candidate suggestions has become *significantly* easier since Sprint 4\.

There are still frequent issues with tool calling and I cannot determine if the cause is always the same or not. It’s clear that a real product wouldn’t have a failure rate this high \- but I don’t know what to suggest to fix it because I don’t know what causes it.

During live testing, developer visibility into session state (the full `VacationPlan` JSON, the current `messages` array, active tool calls) requires manually inspecting network responses.

---

## **3\. Ideation**

### Problem: Agent frequently has tool failures (\~50% of sessions affected)

* **Retry logic on `tool_use_failed`**: The format-mismatch failure (see Section 2\) is recoverable — the model had the right content, just wrong syntax. A single automatic retry on a 400 `tool_use_failed` error would likely succeed and would require minimal code changes in the orchestrator's `_call_llm` method. This is the cheapest available improvement to visible reliability.  
* **Better error logging**: The orchestrator currently surfaces a generic 500 to the frontend. Catching `tool_use_failed` specifically and logging the `failed_generation` content in a readable format (e.g. `[TOOL FORMAT ERROR] Model used <function=...> syntax. Content was valid.`) would make future diagnosis much faster without requiring a full debug panel.  
* **Multi-agent architecture**: Split the single agent into specialised agents — at minimum one for Exploration and one for Comparison/Decision. Each agent would have a shorter, more focused system prompt covering only the tools and instructions relevant to its phase. The hypothesis is that a narrower prompt reduces the likelihood of format drift and wrong-tool usage, in addition to reducing context length per agent turn. A second Groq API key could be assigned to the second agent, effectively doubling the primary model usage before the backup kicks in. This is the most significant architectural change proposed and carries real learning value — orchestrating multiple agents, dividing responsibilities, and managing shared state between them is a new pattern not yet used in this project.

### Problem: Agent passivity and conversation quality

* **Prompt redesign for proactivity**: Despite Sprint 6 changes, the agent still treats conversation as its default mode and requires prompting to use tools. A more directive prompt framing — establishing that suggesting candidates and updating the profile *is* the job, with conversation serving that goal rather than being the goal — may shift the balance. This could also address the weak questioning pattern (filling turns with low-information questions rather than narrowing towards a recommendation).

### Problem: Backup model behaviour

* **Try a different backup model**: The current backup model (Qwen) has three known behavioural issues (markdown output, comparison matrix overwrite, exposes internal reasoning). Adding further prompt instructions to compensate risks degrading the primary model's performance. An alternative is to test a different Groq-available model as the backup (e.g. `openai/gpt-oss-120b` or similar) to see if the issues can be negated without further prompt fixes.

### Problem: Session loss on browser refresh & ability to continue later on

These are two distinct problems with different solutions:

* **Restore on refresh** (same browser/device, short-term): The client-side app stores the session payload (`messages`, `plan`, `uiState`) in `localStorage` keyed by `session_id`. On page load, the frontend checks for existing session data and restores it instantly. Low complexity, no backend required, covers the “accidentally refreshed” case.  
* **Come back later / continue across sessions** (the more valuable feature): Stores Trip Profile, rejected candidates, and shortlisted candidates under a shareable Chat ID. The user can enter the ID to resume planning — the agent is initialised with the saved state and starts a new conversation from that point. This requires some form of persistence (backend database, or encoded state in a URL) and is meaningfully more complex than localStorage. This is the version that maps to real-product behaviour — most travel planning happens across multiple sessions.

---

## **4\. The Strategy**

The roadmap for Sprints 8-11 follows a deliberate sequence: fix reliability, improve the architecture, then improve the product experience.

**Sprint 8** establishes the reliability floor. A high session failure rate makes product quality improvements hard to evaluate and hard for users to experience. Sprint 8 also makes limited prompt improvements — intentionally limited, because Sprint 9 restructures the prompts anyway. Over-investing in the single-agent prompt before that split would be partially wasted effort.

**Sprint 9** addresses the underlying architectural cause of many reliability issues. A single agent handling Exploration, Comparison, and Decision carries a long, broad system prompt and is responsible for many different tools across many different contexts. Splitting into specialised agents — each with a focused prompt and only the tools relevant to its phase — reduces the conditions under which format drift and wrong-tool usage occur.

**Sprints 10 and 11** improve the product experience and would benefit by having 2 agents with more focused characters/goals. Sprint 10 (landing page and intake) is largely independent of agent behaviour and could in principle move earlier or later. Sprint 11 (Explore and Comparison UX) is better done after Sprint 9, since the per-agent prompts created in that sprint are the right place to embed the improved conversation behaviour.

---

## **5\. Items selected for Sprint 8**

### Sprint 8: Improve tool call reliability & improve agent conversations

*Focus: Retry on tool-use failures & improve error logging. Improve agent conversational performance & usage of tools.*

**Phase 1: Errors during tool usage**

* **Retry logic on `tool_use_failed`**: Add automatic retry in the orchestrator's `_call_llm` method when Groq returns a 400 `tool_use_failed` error. The model had the right content — a single retry is likely to succeed and would meaningfully reduce visible failure rate. Single retry only — if it also fails, that's a logging case (below), not a fallback-model case.  
* **Targeted error logging for tool failures**: Catch `tool_use_failed` errors specifically in the orchestrator and log the `failed_generation` content in a readable format. Distinct from the debug panel — this is a backend logging improvement, not a UI feature.

**Phase 2: Improve prompts and backup model**

* **Prompt redesign for agent proactivity**: Reframe the agent's top-level job description and the EXPLORE mode job description around two equal, linked halves — understanding the traveler through conversation, and keeping candidates/profile current with that understanding — so the agent acts on what it learns the same turn rather than letting its understanding get ahead of the screen. Address the questioning pattern — replace low-information "do you like X or Y or Z?" questions with questions that force genuine trade-offs.  
* **Change backup model**: Switch the backup model to `openai/gpt-oss-120b` to see whether the current issues (markdown output, comparison matrix overwrite, exposed reasoning) are model-specific. Its role stays the same — it only activates once the primary model's rate limit (429) is exhausted. No dedicated comparison test plan; observe its behaviour organically when it triggers during normal testing.

---

## **6\. Proposed Roadmap for upcoming sprints (Sprints 9-11)**

### Sprint 9: Multi-agent & context sharding

*Focus: Create a second Agent to improve task execution.*

* **Simple multi-agent architecture**: Split the single agent into at minimum two specialised agents — one for Exploration, one for Comparison/Decision — each with a focused system prompt and only the tools relevant to its phase.  
* **Parallel API Keys**: Separate agent contexts & Use a second Groq API key for the second agent to extend primary model usage before fallback. Requires an orchestrator that routes requests to the correct agent based on current mode and manages shared state between them.

### Sprint 10: UI \- Improve the landing page and initial profile intake

*Focus: Improve the first impression and interactions between users and the produce.*

* **Landing page: explain the product journey**: Add a brief visual or textual explanation of the product flow before the intake form — what the chat does, how destination cards work, what the user is working towards, even how to add comparison criteria. Goal is to get more users to the aha moment rather than dropping off before they understand the product.  
* **Landing page: fix intake form order and options**: The two optional fields feel too similar to the required questions and their placement after the CTA is confusing. Vacation type dropdown also lacks options. Rethink the form order and expand the dropdown.  
* **UI: Show country/region on candidate cards (Explore)**: Cards currently show region (often just the continent). Unknown destinations like the High Tatras require a "Tell me more" to find out where they actually are. Country should be visible on the card itself.

### Sprint 11: Improve Explore & Comparison phase UX

*Focus: Update the Comparison agent to improve the journey during the Comparison phase.*

* **Improve the “Tell me more” button**: It’s better used when you’re finding out more about a location out of definite interest. Perhaps it would be better as an options button like “Tell me more about…” with options “where it is”, “possible activities”, “food & drink” etc.  
* **Ask about previous trips**: The agent never asks about past trips that went well (or badly) as a reference point for the new one. This is a natural and high-signal question that real travel advisors always ask. Comparing options against similar trips they’ve done would be interesting in the Compare table.  
* **Comparison: add structure and focus**: The comparison phase currently lacks a clear progression towards a decision. The agent disengages from the trip profile and rarely updates it during this phase. Needs a more structured approach — possibly a guided set of comparison dimensions — to help users actually make a call.  
* **Improve Vacation Vibe (Explore) and Best For labels (Comparison)**: These fields on the comparison cards lack precision. Users aren't always clear on what they're describing or how they differ from each other.  
* **Increase prominence of custom Comparison criteria**: Encourage users (in the UI) and the agent to add custom comparison rows (e.g., "Add a row for kid-friendliness" or "Compare them on vegetarian food options"). The agent dynamically updates the matrix criteria.

### Backlog of items not yet selected for any Sprint

* **Restore on refresh (localStorage)**: Store `messages`, `plan`, and `uiState` in `localStorage` keyed by `session_id`. On page load, restore from existing session data if present. Covers the accidental-refresh case with no backend required.  
* **Better journey for "I already have destinations"**: Currently this path doesn't meaningfully change the conversation. Should skip broad exploration and move directly into profile-building and candidate evaluation for the destinations the user already has in mind.  
* **Chat ID / session continuation**: Store Trip Profile, rejected candidates, and shortlisted candidates under a generated Chat ID. Allow users to enter the ID on the landing screen to resume planning in a new session, with the agent initialised from saved state. Requires persistent storage (backend or URL-encoded state). Would be good to learn backends.  
* **Improve Comparison with a light itinerary or activity preview**: Users want a feel for what the trip would actually look like before committing. A rough sense of activities or a light day-by-day sketch during comparison would help. As a second version, a structured 3-day or 7-day daily timeline draft with activity recommendations could be shown during the Decision phase.  
* **Better journey for suburb/region-level planning**: The product is destination-focused but doesn't serve users who know where they're going and want to know what to do or where to stay within a destination (e.g. which neighbourhood in New York, which part of the Algarve).  
* **Developer Debug Panel**: Wire `DebugPanel.tsx` behind a visible toggle and extend it to display the pruned messages array and approximate token count alongside the existing plan JSON view. Investigate surfacing tool call failure logs from the orchestrator.  
* **Mobile UX**: Rethink the artifact UX — move candidates inline like ChatGPT/Claude and think about how mobile interactions work to build and evaluate a trip.  
* **Interactive Map Component**: Add a map overlay/view in the Candidate Area showing pins for current candidate destinations and rough routes.  
* **Real-World Travel API Integration**: Learn about the various Travel APIs out there. Potential: Integrate mock flight duration, weather history, and cost indices to ground the candidate details in realistic travel metrics.  
* **Shareable / Exportable Trip Brief**: Generate a formatted PDF or Markdown document summarising the Trip Profile, the Comparison matrix (why this destination won), and the draft itinerary.

---

## **7\. Next steps**

**Current status**:

1. Planning is in progress (WIP). Awaiting PM review and approval.

2. Once approved, the `Sprint 8 Spec` will be written.

3. The sprint is not yet ready for implementation.

**Decisions aligned between PM & Code-Agent**:

1. **Retry on `tool_use_failed`**: Single retry only — no escalation to the fallback model. The retry may resend the same request or include a corrective "fix the format" nudge (implementation detail for the spec). If the retry also fails, that's what the Phase 1 "targeted error logging" item is for.

2. **Backup model**: `openai/gpt-oss-120b` confirmed as the new backup. Its role is unchanged from before — it only activates once the primary model's rate limit is exhausted (429), not as part of `tool_use_failed` retry handling. No dedicated test plan; observe organically whenever it triggers during testing.

3. **Forced `tool_choice="required"` for candidate refilling**: Deferred and conditional — not part of the initial Phase 1 build. Revisit only after item 1's retry has been validated in testing. If pursued later: threshold is `active_count < 2` (i.e. 0 or 1 active suggestions, not <3), and the change must be trivial to remove — if it destabilises tool-calling further, it gets pulled immediately.

**Decisions still open between PM & Code-Agent**:

* None (yet) 