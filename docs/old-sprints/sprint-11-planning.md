# **Sprint 11 Planning**

## **1\. Executive Alignment**

**Purpose**: Improve the first impression and interactions between users and the product.

**Context**: Sprints 9 and 10 established and sharpened a two-agent architecture — the Explore agent diagnoses and matches, and the Compare agent uncovers all of the items that matters most for the user to decide. With the agents in good shape, the landing and first-impression experience is the natural next focus.

The landing page was designed for Sprint 4\. Six sprints of usage have clarified what needs fixing in the form and what the right panel should actually be doing.

**Sprint Goal**: Redesign the landing and first product experience to make entry easier and give users a better picture of what the product flow really is. (Also some minor UI fixes brought in from previous sprints).

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

*Any/all open issues. This section DOES NOT represent importance or build-order.*

### Points of friction in user journey, UX & UI

**General product experience:**

* Users consistently prefer to act in the visual space rather than in the chat — the chat feels dense and the large visual area feels underused. This applies to both Explore and Comparison. PM remark: Worth considering what it would look like to move some of the interaction — questions, input, key information — into the visual space rather than keeping everything in the chat strip. More research into other travel products (e.g. Layla, Mindtrip & others) is needed.

**Landing**:

* Vacation type dropdown lacks options and doesn’t support combinations.  
* Form hierarchy is broken: the optional fields sit below the two CTAs, making the CTAs feel like a mid-page interruption rather than the natural terminus of the form. The read order should be required fields → optional fields → launch.  
* The two CTAs ("I already have destinations in mind" / "Inspire me where to go") are visually understated for what they represent — the launch moment and a genuine two-path choice. They currently read as a footnote to the form rather than the primary action.  
* The right panel is wasted space on landing: empty card placeholders with a tagline. It does nothing to explain what the product experience looks like. Users arrive with no map of what they’re about to do, or that Explore and Compare are two distinct phases with different goals.

**Explore**:

* Cards often show only a continent-level region with no country. Unknown destinations require “Tell me more” to find out where they actually are.  
* “Tell me more” produces a chat response when users want the information in the visual space, in a card format similar to the comparison cards.  
* Perhaps “Tell me more” would be better as an options button like “Tell me more about…” with options “where it is”, “what people do there”, “what the food is like” etc.  
* The product doesn’t serve users who know where they’re going but don’t know what to do there (e.g. I’m going to New York, which parts of the city should I go and see?).

**Comparison**:

* Vacation Vibe and Best For are imprecise — vibe reads as a destination description rather than a personal trip feel, and Best For is too similar to vibe to add value.  
* Good agent reasoning is often buried in the chat when users would rather see it in the visual space.  
* Users want a light itinerary or activity preview to help compare destinations. They want to know what the day-to-day might look like, and how a vacation would feel to them.  
* Comparison card content can change (and worsen) when navigating back and forward between phases, which users find disorienting.

**Decision**: Under-utilised as a phase.

### Being able to continue where you left-off would be appreciated

It was noted that a method of picking up a session to continue later would be a good improvement.

* Hitting refresh manually (or having the browser auto-refresh) kills the session and forces a restart with effort going back into intake and profile building, and not having the same chat history.  
* Sometimes you want to have another discussion about the same vacation to see what other options the LLM will provide in a different chat (i.e. same Trip Profile, new session).

### Architectural limitations of in-memory session state

All candidate, comparison, and trip profile data lives in server-side session memory and is passed to the LLM on every turn. Two specific problems have emerged from this:

* **Comparison criteria are fragile**: because the agent regenerates the full matrix on each call, explicitly-added criteria can be silently dropped or overwritten without the user having removed them.  
* **Candidate cards are limited in richness by agent context**: making cards significantly more detailed requires passing more data to the LLM every turn — expensive and unbounded as the session grows. There is no way to store richer content separately from what the agent needs to reason about.

More broadly, the product has no persistence layer. Everything is ephemeral within a single server process.

### Bugs carried over from previous improvements

1. **`vibe` / `best_for` FE label alignment**: `vibe` content is now destination-descriptive but the card label in Explore still reads "Destination Vibe" and in Compare "Vacation Vibe." `best_for` content is now personalised trip feel but the card label reads "Best For." Both labels should be aligned to reflect the Sprint 10 content redefinition; `best_for` → `trip_feel` field rename should be considered at the same time. Already scoped in Sprint 11 (Sprint 10 planning §6 item 4).  
2. **"Already have destinations" path — turn 2 robustness**: the post-testing tweak adds the instruction but has not been re-tested. Worth a verification check at the start of the next test session.

---

## **3\. Ideation**

*Any/all open issues. This section DOES NOT represent importance or build-order.*

### Problem: Landing page — first impressions, intake, and product onboarding

The landing page was designed for Sprint 4\. Six sprints of usage have revealed two distinct problems: the form has friction for users trying to enter trip details, and users arrive with no mental model of what they’re about to do with this product.

The form issues are simple but important to fix. The broken read order and competing CTAs create needless friction just as the user wants to get going.

* Expand the vacation type dropdown (Agreed option list: Beaches, City break, Nature & outdoors, Roadtripping, Cultural, Food & wine, Romantic getaway, Sports & recreation, Wellness & relaxation), and allow multi-select combinations.  
* Consolidating to a single CTA and correcting field order removes that hesitation without adding anything.

Make use of the right panel with an explainer: one section for Trip profile (dynamic), one for Explore (static), one for Compare (static).

* The core design philosophy is that showing beats explaining. Descriptive copy about the product is slower and less convincing than letting users see what the product actually looks like.  
* Real destination photos and a comparison matrix preview communicate the two-phase journey faster and more authentically than any amount of onboarding text.  
* A deliberate copy arc across the three steps — declaration, discovery, decision — signals that this is a journey with a shape, not a generic chat interface.

**Clarification: `initialMessage` sentence construction**

The opening message sent to the agent on submit is built as discrete sentences. Only non-default/non-empty fields are included. Sentence templates:

* Travelers (always) + origin if filled: "I want to plan a trip for [travelers], travelling from [origin]." / "I want to plan a trip for [travelers]."
* When and/or duration (if either non-default): "I want to travel in [when] for [duration]." / "I want to travel in [when]." / "I want to travel for [duration]."
* Vacation type (if any selected): "We're looking for [type1, type2, and typeN]." — Oxford comma join.
* Budget (if non-default): "The budget is [budget]."
* Entry path (always, two forms): "Inspire me where to go." or "To start with, I have destinations in mind."

Confirmed examples:
* MIN (only travelers, no other fields set): "I want to plan a trip for a couple. Inspire me where to go."
* MAX (all fields filled): "I want to plan a trip for a couple, travelling from Berlin. I want to travel in January for two weeks. We're looking for Beaches, City break, and Nature & outdoors. The budget is mid-range. To start with, I have destinations in mind."

### Problem: Explore phase — visual interactivity and card detail

Users consistently prefer acting in the visual space over the chat strip. Reducing round-trips back to chat for key information is the guiding principle of the “visual interactivity” space.

* Cards currently show Region only (often just the continent). Unknown destinations like the High Tatras require “Tell me more” just to find out where they are. The country should be visible on the card itself.  
* “Tell me more” currently produces a chat response when users want the information in the visual space — even a shorter card with similar content to the comparison cards.  
* “Tell me more” may work better as a contextual options button — “Tell me more about…” with choices like “where it is”, “possible activities”, “food & drink” — so users can get specific without returning to free-text chat.

### Ideation: Backend use cases

The product has no persistence layer — a backend store could serve several distinct purposes, not all of which need to be built together. Use cases to consider:

* **Rich candidate content**: generate and store a richer version of candidate cards (lazily, on demand) so the visual surface can show more detail without that data sitting in the LLM's context every turn.  
* **Durable comparison criteria**: a criteria list the agent can append to but never overwrite, so explicitly-added rows survive matrix regeneration.  
* **Photo URL cache**: destination → Unsplash URL, built up over time, reducing live API calls for destinations that have been looked up before.  
* **Destination knowledge base**: generic destination facts (geography, climate, activities) that are not profile-specific and could be reused across sessions rather than regenerated each time.  
* **Trip profile as a persisted entity**: the profile is the richest output the product creates — persisting it as the root entity, with candidates and criteria hanging off it, is the most natural data model for the product.  
* **Analytics / product intelligence**: what destinations are suggested, shortlisted, rejected — queryable over time to inform product decisions.

None of these require the agent to change significantly — the agent stays lean, and the backend handles persistence. Building any of these introduces a real external data store to the project (e.g. Supabase free tier), a new generation pattern decoupled from the main agent loop, and retrieval endpoints the frontend can call independently.

Not all of these need to be built. The question is which use case makes the most sense as the foundation — both for product value and for what it teaches about building and working with a real persistence layer. But having a backend is a meaningful step toward a deployed product.

### Problem: Session loss on browser refresh & ability to continue later on

These are two distinct problems with different solutions:

1. **Restore on refresh** (same browser/device, short-term): The client-side app stores the session payload (`messages`, `plan`, `uiState`) in `localStorage` keyed by `session_id`. On page load, the frontend checks for existing session data and restores it instantly. Low complexity, no backend required, covers the “accidentally refreshed” case.  
2. **Come back later / continue across sessions** (the more valuable feature): Stores Trip Profile, rejected candidates, and shortlisted candidates under a shareable Chat ID. The user can enter the ID to resume planning — the agent is initialised with the saved state and starts a new conversation from that point. This requires some form of persistence (backend database, or encoded state in a URL) and is meaningfully more complex than localStorage. This is the version that maps to real-product behaviour — most travel planning happens across multiple sessions.

---

## **4\. The Strategy**

Six sprints of observation confirmed that users arrive at the landing page with no map of what they’re about to do — they spend early turns in Explore working out what the product is rather than using it. They also experience needless friction when completing the intake form.

The hypothesis driving Sprint 11: users who understand the product journey before they start will reach the "aha moment" faster and drop off less during Explore.

The Sprint 11 landing redesign addresses this directly.

* The form is restructured so the entry point is unambiguous: one CTA, correct field order, and an expanded vacation type selector with multi-select.  
* The right panel becomes a three-step journey preview that shows — not explains — what the product does. Real destination photos and a comparison matrix preview communicate more than copy could. Section headers run a deliberate arc: declaration → discovery → decision.

Real-world parallel: Mindtrip and Layla both use their landing pages to signal "this is a journey, not a chat" (PM remark: They both really emphasise the chat, but ok). Landing page previews of the output experience are a known conversion pattern in AI travel products (PM remark: apparently).

---

## **5\. Items selected for Sprint 11**

### Sprint 11: UI \- Improve the first impression, intake and initial exploration experience

*Focus: Improve the first impression and interactions between users and the product.*

**Phase 1: Minor tweaks for Explore**

1. **Destination vibe / Trip feel — FE label alignment & field rename**: Follow-up to Sprint 10’s prompt-only `vibe`/`best_for` content redefinition. Align the FE labels and rename `best_for` → `trip_feel` in the tool schema, state object, and frontend. Remember to ALSO change this in lovable-ui once completed.  
2. **Show country on candidate cards (Explore)**: Country should be visible on the card itself, not requiring “Tell me more” to discover. May require a tool schema update.
    * Discovered during planning: The tool schema captures `name` and `region`. If the session is country-as-destination (e.g. I want to go to Sri Lanka, Mexico), then adding a third `country` field will not work. 
    * Decided during planning: We cannot "introduce" a new field. This will be a prompt-only fix to sharpen the tool definition and ensure the agent fills country when appropriate. Something like "region should be the country when the destination is a city or area; use a macro-region only when the destination itself is a country." - Except better and clearer.

**Phase 2: Redesign of the landing and first product experience**

1. **Vacation type multi-select**: Replace the single-select dropdown with multi-select and update the options.  
2. **Fix form order and consolidate CTA**: Single CTA. Required → optional → launch order. Entry path as a third optional field.  
3. **Right panel as journey preview**: Restructure the right panel to show the product’s three-phase journey before the user starts. Design specifics will be found in the design brief.  
4. **Opening sentence audit**: Audit the agent’s opening message in Explore across all entry-path combinations with the new landing in place.

---

## **6\. Proposed Roadmap for upcoming sprints (Sprints 12-13)**

### Sprint 12: UI \- Increase interactivity of the visual surface

*Focus: Update the UI to encourage users to make use of the consultative side of the agent.*

1. **Improve the “Tell me more” button (Explore)**: It’s better used when you’re finding out more about a location out of definite interest. Perhaps it would be better as an options button like “Tell me more about…” with options “where it is”, “possible activities”, “food & drink” etc. Perhaps is better if we bring up a more detailed candidate card with more info. Not sure.  
2. **Increase prominence of custom Comparison criteria**: Encourage users (in the UI) and the agent to add custom comparison rows (e.g., "Add a row for…” \+ accommodation style, kid-friendliness, vegetarian food options etc.). The agent dynamically updates the matrix criteria.

### Sprint 13: Backend — Persistence layer

*Focus: Introduce a real persistence layer to the project. The specific use cases will be selected from the backlog based on what makes the most sense as a foundation — both for product value and as a learning exercise in building with an external data store.*

1. **Backend: Trip profile as a persisted entity**: The trip profile is the richest output the product creates. Persisting it as the root entity — with candidates and criteria hanging off it — is the most natural data model for the product and opens up future multi-session scenarios.

### Backlog of items not yet selected for development

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

## **7\. Next steps**

**Current status**:

1. Planning is complete. The PM has approved the Sprint 11 Spec.  
2. The `Sprint 11 Spec` has been written and approved: `sprint-11-spec.md`.  
3. The sprint is ready for implementation.

**Decisions aligned between PM & Code-Agent**:

1. **`initialMessage` construction**: Built as discrete sentences (not a comma-joined list), omitting any field that is empty or at its default. Entry path always present — "Inspire me where to go." or "To start with, I have destinations in mind." — triggered by the entry-path dropdown value. Multiple vacation types joined with Oxford comma. See ideation §3 for sentence templates and confirmed examples.
2. **"Trip feel" label**: Use "Trip feel". The UI renders field labels in all-caps so capitalisation doesn't matter at the code level.
3. **`best_for` → `trip_feel` in `lovable-ui`**: Rename in `apps/lovable-ui` at the same time as the web app change. No divergence in field names between the design reference and the running app without a good reason.
4. **Right-panel static photos**: Lovable destinations approved (Lisbon, Amalfi, San Sebastián for Explore; Maasai Mara, Serengeti for Compare). Photos are Unsplash CDN URLs — no local files, no bundle weight. Dimensions in the URL parameters can be kept small for card-sized display.
5. **Region field prompt instruction**: Use verbatim — "if the destination is a city or area, use its country (e.g. 'Spain' for Basque Country). If the destination is a country, use a broader geographic grouping (e.g. 'Mediterranean' for Malta, 'South Asia' for Sri Lanka)."
6. **Update Lovable VACATION_TYPES list**: Update `apps/lovable-ui/src/routes/index.tsx` to the agreed 9 types before porting: Beaches, City break, Nature & outdoors, Roadtripping, Cultural, Food & wine, Romantic getaway, Sports & recreation, Wellness & relaxation.

**Decisions still open between PM & Code-Agent**:

* **None** (Yet).