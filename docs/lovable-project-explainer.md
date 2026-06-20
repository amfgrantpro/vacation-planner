# Lovable Project Explainer: Where To?

**Purpose of this document**: Brief a new Lovable session on what this product is, how users move through it, what the key components are called, and what design decisions have been made so far. Lovable is used here as a design tool — this document provides the product context that the code alone cannot convey.

---

## 1. What This Product Is

**Where To?** is a travel decision-support tool. It helps users decide where to go on their next vacation — specifically the pre-booking, pre-commitment phase where someone knows they want a trip but hasn't settled on a destination.

It is not a booking engine, a price aggregator, or a generic travel chatbot. It stops deliberately before the booking boundary.

The core belief: people already use ChatGPT to talk through vacation options, and they're mostly satisfied with that process. But ChatGPT outputs text. This product does the same reasoning work with a proper UX — visual destination cards, a comparison matrix, a structured profile — so the user can *see and interact with* the decisions they're making, not just read about them.

**The user's starting point**: "I know I want to go on a vacation. I need to decide which one."

---

## 2. The User Journey

The product has three sequential phases. Users move forward and backward through them. The phases are:

### Phase 1: Explore

The user talks to the agent about what they want. As they do, two things happen simultaneously:

1. A **Trip Profile** populates in real time — the agent extracts constraints and preferences from the conversation and fills in a structured card (origin, travel dates, duration, budget, vibe, things they like, things to avoid).
2. Up to three **Candidate Cards** appear, representing destination suggestions. These update as the conversation develops.

The user can ask for more information about any candidate ("Tell me more"), add candidates to a **Shortlist** (max 3 slots), or **reject** candidates they don't want to see. Rejected candidates go into a collapsible **Removed tray** below the grid. Once 2 or more destinations are shortlisted, the user can move to Compare.

The goal of Explore is not to produce an answer — it's to narrow a wide space into a workable shortlist.

### Phase 2: Compare

The user's shortlisted destinations are shown side-by-side as **Shortlist Cards**. Each card includes rich, personalised content:

- **Vacation Vibe**: a description of what a vacation at this destination would actually feel like for this user.
- **Best For**: what this specific traveler's trip here would actually be like, given their profile.
- **Seasonal Note**: what the destination is like during the time of year they're planning to visit.
- **Comparison Matrix**: a grid of rows (e.g. Weather, Getting Around, Activities, Accommodation) where each column is one of their shortlisted destinations. Rows are chosen by the agent to match what matters to this user — not a generic checklist. Unfilled rows show "exploring..." while the agent works.

The user and agent continue talking during Compare, adding criteria and refining the comparison. When a user is ready, they click **"I want to go there!"** on one card to commit.

The design also supports comparing **two versions of the same destination** — for example, "Mallorca · One base" vs "Mallorca · Base + road trip." Same card structure, different content. This is how the product handles itinerary variants, not just destination alternatives.

### Phase 3: Decision

The chosen destination is displayed as a single confirmed card with a **DECIDED** badge and a **YOUR PICK** badge on the photo. The CTA changes to **"I'm going to go there!"** (warm gradient fill, informational only). The agent acknowledges the choice and grounds it in specific reasons drawn from the comparison — not a generic congratulations. Users can return to Compare or restart Exploration from here.

---

## 3. The Layout

Every screen after the landing page uses a persistent **split-panel layout** at 1440px desktop width:

- **Left panel (~35%)**: Chat interface. Fixed structure — message history scrolls above a fixed text input. User messages right-aligned, agent messages left-aligned. Never changes structure across phases.
- **Right panel (~65%)**: The "living document." This is the primary working surface. Always divided into two sections:
  - **Trip Profile** (top, compact, always visible): auto-populates from the agent; users can also edit directly.
  - **Candidate Area** (below, scrollable): changes content based on which phase the user is in.

The chat is an input mechanism. The right panel is the product.

---

## 4. The Landing Screen

The landing screen is the only screen that does *not* use the split-panel layout. It is a full-width two-column experience.

The primary input is a **sentence builder** — a structured sentence the user fills in before starting. It reads like natural language and uses interactive pill-style dropdowns:

> *"I want to plan a trip for [a couple] travelling from [Berlin] in [whenever] for [however long]"*

Fields (left column):
- **Travellers**: dropdown — solo traveller / couple / family / group of friends (default: "a couple")
- **Travelling from**: free text input (pre-filled: "Berlin")
- **Travel in**: month selector (default: "whenever")
- **For**: dropdown — a few days / a week / 2+ weeks (default: "however long")

Selected pills fill with soft teal/blue. Unselected pills show with a light border and a chevron.

Below the sentence, two optional fields (labelled OPTIONAL · ADD MORE IF YOU LIKE):
- **We're looking for**: multi-select — beach & relaxation / hiking & outdoors / city & culture / roadtripping / good food & drink (default: "anything")
- **The budget is**: dropdown — on the cheap / mid-range / let's get fancy (default: "not important for now")

Optional fields that are left at their default are not added to the submitted brief. Set optional fields are included.

At the bottom, two launch CTAs (pill-style buttons):
- **"I already have destinations in mind"** (outlined, MapPin icon)
- **"Inspire me where to go"** (outlined, Lightbulb icon)

Both launch the session. The "already have destinations" path causes the agent to ask the user to name their destinations on the very next turn, then includes those named destinations as the first candidates in the following turn.

The **right column of the landing screen** shows the Trip Profile and Candidate Area in their empty states — "not set" fields and ghost card outlines — to show users what the experience will look like before they begin.

---

## 5. The Trip Profile Component

The Trip Profile is a compact card pinned to the **top of the right panel**. It is always visible once a session is underway. It populates automatically from the conversation; users can also click any field to edit it directly.

**Top row** (5 equal columns, single values):
- **Origin** (plane icon, blue/ocean accent)
- **Travelers** (people icon, teal accent)
- **When** (calendar icon, yellow/sun accent)
- **Duration** (clock icon, sage/green accent)
- **Budget** (currency icon, coral/red-pink accent)

**Bottom row** (3 equal columns, chip/tag values):
- **Vacation type & vibe** (sun icon, yellow accent) — e.g. "Coastal, slow, food-led"
- **Things we like** (heart icon, coral accent) — e.g. "Food markets, swimming, stone villages, wine"
- **Let's avoid** (block icon, ocean accent) — e.g. "Greece (been recently), big resort crowds"

Fields that have no value show "not set" in muted/italic style — they are never hidden, which signals to the user that the profile is still being built.

Each field row has a subtle pencil icon that appears on hover, signalling it's editable. **Inline editing**: clicking any field opens a popover editor anchored to that field:
- Single-value fields (Origin, Travelers, When, Duration, Budget) open a **ScalarEditor**: a text input pre-populated with the current value. Enter saves, Esc cancels, clicking away saves.
- Chip fields (Vacation type & vibe, Things we like, Let's avoid) open an **ArrayEditor**: existing chips are shown with × remove buttons; a text input lets the user add new chips. Enter adds, Backspace on empty input removes the last chip, Esc closes.

Edits made in the Trip Profile are sent to the agent on the next chat message. The agent can also overwrite profile values — last write wins.

---

## 6. The Candidate Area — Three States

The Candidate Area (below the Trip Profile in the right panel) shows different content depending on which phase the user is in. The phase is always controlled by the **user**, never the agent.

### Explore State

Shown when a session starts. Contains:

- Section heading: "Destinations to consider" / "SUGGESTED BASED ON YOUR PROFILE"
- Up to **3 Candidate Cards** side by side
- **Removed tray** (below the grid, collapsible) — only shown when at least one candidate has been rejected
- **Shortlist Bar** at the bottom of the section

**Candidate Cards** show:
- Destination photo (vivid travel photography, full-width top portion)
- Region/country pill (top-left of photo, cream/backdrop-blur style)
- Destination name (bold serif) + region/country (muted)
- **Destination Vibe box** (soft teal background): a one-sentence description of what this destination is actually like — its character and atmosphere
- An **× remove button** (top-right of photo): clicking opens a "Why remove?" popover with four reasons — "Been there", "Too far", "Not my vibe", "Other". Selecting a reason removes the card from the grid.
- Two action buttons:
  - **"Tell me more"** (chat icon): sends "Tell me more about [destination]" to the chat. The card itself doesn't change; the agent responds in chat.
  - **"Add to shortlist"** (plus icon): adds this destination to the Shortlist Bar. Disabled when the shortlist is already full (3 items).

**Removed tray**: when candidates have been rejected, a collapsible "Removed (n)" section appears below the candidate grid. It shows each rejected destination as a pill (name + reason). Each pill has a ↺ restore button — clicking it removes the destination from the tray and makes it eligible to be re-suggested by the agent (it does not re-appear in the grid immediately; the agent must actively re-suggest it). The tray is hidden when there are no removed items.

**Shortlist Bar** (at the bottom of the Candidate Area):
- Label: "SHORTLIST" with count (e.g. "2 of 3")
- 3 slots — empty slots shown as dotted placeholder boxes labelled "empty slot"
- Filled slots show: small circular thumbnail, destination name, × remove button
- **"Compare shortlist"** button — greyed out and non-clickable until 2+ slots are filled; active state is solid ocean-deep fill

### Compare State

Triggered when the user clicks "Compare shortlist" (2+ destinations shortlisted).

Contains:
- Section heading: "Comparing your shortlist" / "COMPARED TO YOUR PROFILE"
- 2–3 **Shortlist Cards** side by side (tall, full-detail layout)
- **"Not Quite Right?" Bar** at the bottom

**Shortlist Cards** show:
- Destination photo (taller than Candidate Cards)
- Region/country pill (top-left of photo)
- Destination name (bold serif, larger) + region/country (muted)
- **Vacation Vibe box** (soft teal): a sentence describing what a vacation here would actually feel like for this user
- **Best For box** (soft sage/green): what this specific traveler's trip here would actually be like, given their profile — distinguished from the general vibe
- **Seasonal Note** (soft yellow/sun): what the destination is like during the time of year they're planning to visit
- **Comparison Matrix**: table rows chosen by the agent to match what matters to this user. Default row set: Weather, Activities, Getting Around, Accommodation, Travel Style, Peak Season. Unfilled rows show "exploring..." in muted italic — this is a progressive disclosure pattern, not an error state. Rows fill in as the conversation develops.
- **"I want to go there!"** CTA (full-width button, ocean-deep fill)

The Compare state supports comparing two versions of the same destination (e.g. "Mallorca · One base" vs "Mallorca · Base + road trip"). The heading in this variant reads "Two ways to do [destination]" rather than "Comparing your shortlist." Same card structure, content-only distinction.

**"Not Quite Right?" Bar** (bottom of Candidate Area in Compare):
- One option: **"Explore more destinations"** — "Keep the brief, see new options" + "Find others" button — returns to Explore state, keeps the shortlist

### Decision State

Triggered when the user clicks "I want to go there!" on a Shortlist Card.

Contains:
- A **✓ DECIDED** status badge above the section heading
- Section heading: "Your destination"
- Single Shortlist Card (fully populated, **YOUR PICK** badge top-right of photo)
- The CTA changes to **"I'm going to go there!"** (warm gradient fill, from sun through coral to teal-soft) — informational only, not a button
- **"Not Quite Right?" Bar** with two options:
  - **"Explore more destinations"** → returns to Explore, keeps shortlist
  - **"Reconsider your options"** (← Back to my shortlist) → returns to Compare

---

## 7. The Agents

There are two agents, each scoped to a phase. The user never sees a handoff — the experience is one continuous conversation.

**Explore Agent**: its job is to understand this specific person's vacation needs. It asks about preferences, listens for constraints, records the trip profile, and suggests destination candidates tailored to what it knows. Within the first few turns it asks about a past trip that went particularly well — that answer becomes a reference point for the current search. It does not pitch destinations or push the user toward a decision — it presents options and lets the user decide what to pursue.

**Comparison Agent**: its job is to help the user decide between their shortlisted options. Its mission is to uncover what matters most to this person and align the comparison matrix against that. It generates the matrix immediately on entering Compare, does not restate destination descriptions in chat (the cards carry those), and opens by asking what matters most to the user in making their choice. On entering Decision, it references specific reasons from the comparison rather than giving generic congratulations.

The agent does **not** control which phase (mode) the UI is in. The user controls phase transitions by clicking CTAs. The agent responds to the current phase and populates the right panel content accordingly.

---

## 8. Visual Design Language

The aesthetic is **travel magazine, not SaaS dashboard**. Specifically:

- **Palette**: warm sandy yellows (sun), ocean blues (ocean / ocean-deep), coastal teals (teal-soft), soft greens (sage), soft pinks (coral). Cream backgrounds. White backgrounds with colour used for accents, labels, and interactive states. Not dark mode.
- **Typography**: one clean, relaxed serif throughout (used for headings, card names, and the sentence builder). Sans-serif for body copy, labels, and buttons. The "Where to?" logotype is bold and confident.
- **Teal highlight boxes**: Destination Vibe (Candidate Cards) and Vacation Vibe (Shortlist Cards) use a soft teal/cyan background box — a distinct visual treatment, not standard body copy.
- **Photography**: all destination photos are vivid, real travel photography. No grey placeholder boxes in finished states.
- **"Exploring..." state**: unfilled comparison rows show in muted italic — a deliberate progressive disclosure signal that the card is live and filling in, not broken.
- **Pill/chip style**: interactive elements (dropdowns, shortlist slots, chip fields, CTAs) use rounded pill or rounded-xl shapes. Selected pills fill with soft teal/blue.
- **Card rounding**: Candidate Cards and Shortlist Cards use `rounded-3xl`. The Trip Profile, Shortlist Bar, and "Not Quite Right?" Bar use `rounded-2xl`.
- **Active vs. inactive states**: the "Compare shortlist" button is visually greyed out until the condition is met — disabled states matter and must be visually clear.
- **Shadow style**: cards use a consistent `shadow-card` elevation — light, warm.

---

## 9. Vocabulary Reference

When working in this project, these are the names that matter:

| What it is | What we call it | Code name |
|---|---|---|
| The structured sentence input on the landing page | Sentence builder | — |
| The two launch actions | CTAs: "Inspire me" / "Already have destinations" | — |
| The structured card showing trip details | Trip Profile | `TripProfile` |
| A single editable field in the Trip Profile | Field / editable field | `TripField` |
| Editor for single-value Trip Profile fields | ScalarEditor | `ScalarEditor` |
| Editor for chip-based Trip Profile fields | ArrayEditor | `ArrayEditor` |
| The phase where destination cards are shown | Explore (state: `explore`) | mode `"explore"` |
| A destination suggestion card in Explore | Candidate Card | `CandidateCard` |
| The one-sentence destination description in a Candidate Card | Destination Vibe | `vibe` |
| The X button / removal flow on a Candidate Card | Reject / Remove | `onReject` |
| The collapsible tray of rejected destinations | Removed tray | `RemovedTray` |
| The row of shortlisted destinations at the bottom of Explore | Shortlist Bar | `ShortlistBar` |
| The phase where shortlisted destinations are compared | Compare (state: `compare`) | mode `"compare"` |
| A destination card in Compare | Shortlist Card | `ShortlistCard` |
| The teal-highlighted vibe sentence on a Shortlist Card | Vacation Vibe | `vibe` |
| The personalised "your trip here would feel like..." content | Best For | `bestFor` |
| The "what's the destination like in your travel month" content | Seasonal Note | `seasonNote` |
| The side-by-side table of destination comparisons | Comparison Matrix | `rows` (array of `DetailRow`) |
| A row in the comparison matrix | Detail row | `DetailRow` |
| The unfilled state of a matrix row | exploring... | `exploring: true` |
| The confirmed destination phase | Decision (state: `decision`) | mode `"decision"` |
| The bottom bar with escape options in Compare and Decision | "Not Quite Right?" Bar | `ShortlistBar` variant `"find-others"` |
| The right panel below the Trip Profile | Candidate Area | — |
| The overall right-side working surface | Living document / right panel | — |
| The agent for Explore phase | Explore Agent | — |
| The agent for Compare + Decision phases | Comparison Agent | — |

---

## 10. Current State (as of Sprint 10, June 2026)

The core loop — landing → explore → compare → decide — works end-to-end. The Trip Profile populates from conversation and is editable inline. Candidate cards update as the conversation develops. The comparison matrix fills progressively. Both agents have distinct, tuned instructions.

**Key behaviour notes grounded in testing:**
- Users consistently prefer acting in the visual space over typing in chat. The candidate grid and comparison matrix are where decisions actually happen.
- The "explore..." progressive disclosure pattern in the comparison matrix is well-received — it signals liveness rather than emptiness.
- The reject/remove flow (X button → reason → Removed tray) is the primary way users prune the candidate list; the ↺ restore button removes from the tray without immediately showing the candidate again — the agent must re-suggest it.
- Array fields in the Trip Profile (vacation type, likes, avoid) are additive via the agent — items accumulate turn-by-turn and can only be removed via the inline editor in the Trip Profile panel.

**What's in progress for Sprint 11:**
- Landing page improvements: form field order, CTA prominence, vacation type options
- A static explainer panel on the right side of the landing screen (so users understand Explore and Compare before they start)
- Label alignment: "Destination vibe" / "Vacation vibe" labels to be harmonised; `bestFor` field rename to `trip_feel` across code and UI labels
- Country/region display on Candidate Cards (currently shows continent-level only)

---

## 11. How This Fits Into the Development Workflow

The Lovable UI files live in `apps/lovable-ui/`. They are visual design references — the actual running application is in `apps/web/`. The workflow is:

1. Design and iterate UI in Lovable (this project)
2. Lovable syncs to a separate GitHub repo
3. Pull changes locally
4. Copy the Lovable components into `apps/lovable-ui/` in the main repo
5. A coding agent implements those components in the working app (`apps/web/`)

**Lovable is the design surface, not the runtime.** Components built here will be adapted into a React + FastAPI backend application. The coding agent receiving these components understands the data model, state logic, and API contract — but needs the visual and UX intent from Lovable to know what to build toward.

When designing in Lovable, think in terms of **states and transitions**, not pages or routes. There is one URL, one layout, one session. The six routes in this project (`/`, `/early`, `/mid`, `/shortlist-a`, `/shortlist-b`, `/decision`) are design snapshots of different moments in a single user session — not separate pages. They exist so the full UI can be seen and iterated on without a live backend.
