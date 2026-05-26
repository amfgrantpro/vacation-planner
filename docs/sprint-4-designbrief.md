# **Sprint 4 Design brief**

**Purpose of this document**: This brief describes the UI design for Sprint 4\. It exists to give the coding agent a precise understanding of how the Loveable-generated screens should be interpreted and implemented as a single, stateful React application. The Loveable files contain correct visual components — this document explains how those components relate to each other, what triggers their appearance, and what the user is doing at each moment.

The Lovable-generated screens can be found under: lovable-ui

---

## **1\. What the Loveable screens are**

The six Loveable screens are **state snapshots**, not separate pages or routes. There is one URL, one layout, one application. The screens illustrate what the right panel looks like at different moments during a single user session. The coding agent should treat them as design specifications for distinct UI states within one continuous experience — not as a multi-page app or a wizard with steps.

The application has no page navigation. There is no router switching between screens. State changes are driven by user actions in the UI.

---

## **2\. Overall Layout**

Every screen after the landing state uses a persistent split-panel layout:

- **Left panel** (\~35% width, fixed): Chat interface. Message history scrolls above a fixed text input at the bottom. User messages are right-aligned; agent messages are left-aligned. This panel never changes structure.  
- **Right panel** (\~65% width, remaining space): The living document. This is the primary output surface. It is divided into two vertical sections:  
  - **Trip Profile** (top, compact fixed height): Always visible once the session starts. Read-only. Populates automatically from agent output.  
  - **Candidate Area** (below Trip Profile, scrollable): The main working surface. Its content changes based on user actions.

Design target: **1440px desktop width**.

---

## **3\. The Landing Screen (Screen 1\)**

The landing screen is the only state where the split-panel layout does not apply.

It is a full-width two-column layout. The left side contains the entry point; the right side shows the Trip Profile and Candidate Area in their empty states (all fields showing "not set", candidate area showing the "Your top options will appear here" placeholder with ghost card outlines).

**Purpose**: Orient the user immediately. The product's mission — "we help you decide where to go, together, right here as we talk" — should be legible from the first glance. The right panel's empty state is intentional: it shows the user what will be built during the conversation before they begin.

**The sentence builder** is the primary input mechanism. It is a structured sentence broken into 2–3 lines. Each editable item is rendered as a pill (rounded, light border, dropdown chevron). The origin field is a plain inline text input styled consistently with the pills.

Fields and their defaults:

- Travellers: dropdown — `solo traveller / couple / family / group of friends`. Default: `a couple`  
- Travelling from: text input. Pre-filled: `Berlin`  
- Travel in: month selector. Default: `whenever`  
- For: dropdown — `a few days / a week / 2+ weeks`. Default: `however long`

Selected pills fill with soft teal/blue.

Below the sentence, two CTA chip buttons:

- `I already have destinations in mind` (outlined pill, with an icon signalling "submit and start")  
- `Inspire me where to go` (filled pill, with icon)

These are the submit actions. Both send the constructed sentence to the agent and begin the session. If the user chooses “I already have destinations in mind”, this text is added to the constructed sentence.

Below the CTAs, an **optional section** (labelled "OPTIONAL · ADD MORE IF YOU LIKE") with two more pill fields:

- We're looking for: multi-select dropdown — `beach & relaxation / hiking & outdoors / city & culture / roadtripping / good food & drink`. Default: `anything`  
- The budget is: dropdown — `on the cheap / mid-range / let's get fancy`. Default: `not important for now`

If the optional fields are set, then they are added to the constructed sentence. If they are left as default, they are not added. 

---

## **4\. The Trip Profile Component**

The Trip Profile is a compact, read-only card at the top of the right panel. It is **always visible** once the session has started. It never scrolls out of view. It has no edit controls — no pencil icons, no inline editing. It updates automatically as the agent extracts information from the conversation.

Fields are displayed in two rows:

**Top row** (single values):

- Origin (plane icon)  
- Travelers (people icon)  
- When (calendar icon)  
- Duration (clock icon)  
- Budget (currency icon)

**Second row** (may contain multiple values):

- Vacation Type & Vibe (sun/beach icon) — e.g. "Coastal, slow, food-led"  
- Things We Like (heart icon) — e.g. "Food markets, swimming, stone villages, wine"  
- Let's Avoid (minus/block icon) — e.g. "Greece (been recently), big resort crowds"

When a field has no value yet, show it in muted placeholder style (`not set` or `flexible`). Fields are never hidden — showing them empty signals to the user that the agent is still building the picture.

---

## **5\. The Candidate Area — Three States**

The Candidate Area is the section below the Trip Profile. It has **three distinct display states**. Transitions between these states are triggered exclusively by **user actions**, not by the agent.

### State 1: Exploration

**Triggered by**: The session starting (either CTA from the landing screen).

**What's shown**:

- Section heading: "Destinations to consider" with a subtitle "SUGGESTED BASED ON YOUR PROFILE"  
- Up to 3 Candidate Cards displayed side by side  
- The Shortlist Bar pinned to the bottom of the right panel

**Candidate Cards** contain:

- Destination photo (top portion of card, vivid travel photography)  
- Region/country label (small pill, top-left of photo)  
- Destination name (bold) \+ region/country (muted text below)  
- Destination Vibe box (soft teal highlight): a short sentence written specifically for this user explaining why this destination suits them — not generic destination facts  
- Two CTAs:  
  - `Tell me more` (outlined pill with chat icon): sends the pre-formed message "Tell me more about \[destination\]" to the chat. The card itself does not update as a direct result. The agent responds conversationally in the chat.  
  - `Add to shortlist` (outlined pill with \+ icon): adds the destination to the Shortlist Bar

**Hard cap**: Maximum 3 candidate cards visible at any time. When the shortlist already contains 3 items, "Add to shortlist" is disabled on all cards. The agent can replace cards as the conversation continues (new suggestions replace the current 3), but the shortlist cap prevents adding more until a slot is freed.

**The Shortlist Bar** (pinned to bottom of Candidate Area during Exploration):

- Label: "SHORTLIST" with a count (e.g. "2 of 3")  
- Up to 3 slots. Empty slots show as placeholder boxes (dotted outline or ghost style) labelled "empty slot"  
- Filled slots show: small destination thumbnail, destination name, × remove button  
- CTA: `Compare shortlist` — **inactive (greyed out) until 2 or more slots are filled**. Active state is a solid filled button.

### State 2: Comparison

**Triggered by**: User clicking `Compare shortlist` in the Shortlist Bar (only active when ≥ 2 destinations are shortlisted).

**What's shown**:

- Section heading: "Comparing your shortlist" with a subtitle "COMPARED TO YOUR PROFILE"  
- 2 or 3 Shortlist Cards displayed side by side (tall cards, full-detail layout)  
- The "Not Quite Right?" Bar at the bottom (replacing the Shortlist Bar)

**Shortlist Cards** contain:

- Destination photo (top)  
- Region/country label (pill, top-left of photo)  
- Destination name (bold) \+ region/country (muted)  
- Vacation Vibe box (soft teal): a sentence describing what a vacation here would actually feel like for this user — e.g. "Rent a car and spend the week exploring coastal towns from your base in Sóller"  
- Best For box — e.g. "Best for: couples who want dramatic coastal hiking and warm September swims"  
- Seasonal note box — e.g. "In September: Sea is still 24°C, crowds have thinned, and the Tramuntana trail is at its best light."  
- Comparison table rows — populated progressively by the agent across turns. Example row set: Weather, Activities, Getting Around, Accommodation, Travel Style, Peak Season. Row values are agent-generated and specific to this user's profile (not generic destination facts). Rows that haven't been populated yet show `exploring...` in muted italic.  
- CTA: `I want to go to there!` (full-width, outlined or lightly filled)

**The "Not Quite Right?" Bar** (pinned to bottom):

- Label: "NOT QUITE RIGHT?"  
- One option: `Explore more destinations` with subtitle "Keep the brief, see new options" and a `Find others` button  
- This returns the user to Exploration state *without clearing the shortlist*.

**Note on the same-location comparison variant** (Screen 4b): The design supports comparing two versions of the same destination (e.g. "Mallorca · One base" vs "Mallorca · Base \+ road trip"). This is handled identically by the UI — same card structure, same layout. The distinction is in the content the agent provides, not in any separate component or mode.

### State 3: Decision

**Triggered by**: User clicking `I want to go to there!` on one of the Shortlist Cards.

**What's shown**:

- Section heading: "Your destination"  
- A status badge above the heading: `✓ DECIDED`  
- A single Shortlist Card, fully populated, with a `YOUR PICK` badge in the top-right corner of the photo  
- The card CTA is no longer a button. It changes to: `I'm going to go there!` (warm gradient fill — this is the confirmed, celebratory state). This is informational only.   
- The "Not Quite Right?" Bar at the bottom with **two options**:  
  - `Explore more destinations` — "Keep the brief, see new options" \+ `Find others` button (returns to Exploration)  
  - `Reconsider your options` — "Revisit the trips you compared" \+ `← Back to my shortlist` button (returns to Comparison)

---

## **6\. User Action → UI State Transition Map**

| User Action | Triggered From | Result |
| :---- | :---- | :---- |
| Clicks `Inspire me where to go` or `I already have destinations in mind` | Landing screen | Session starts. Layout switches to split-panel. Exploration state begins. |
| Clicks `Add to shortlist` on a Candidate Card | Exploration | Destination added to Shortlist Bar. Bar count updates. |
| Clicks `×` on a shortlisted item in Shortlist bar | Exploration | Destination removed. Slot becomes empty again. |
| Clicks `Tell me more` on a Candidate Card | Exploration | Pre-formed message sent to chat: "Tell me more about \[destination name\]". Agent responds conversationally. Card unchanged. |
| Clicks `Compare shortlist` (active) in Shortlist bar | Exploration | Transition to Comparison state. Shortlist cards render. |
| Clicks `I want to go to there!` in Shortlist Card | Comparison  | Transition to Decision state. Single card shown with DECIDED treatment. |
| Clicks `Find others` in "Not Quite Right?" Bar | Comparison Decision | Return to Exploration state. Maintain Shortlist. |
| Clicks `← Back to my shortlist` in "Not Quite Right?" Bar | Decision only | Return to Comparison state. Maintain Shortlist. |

The agent does not trigger any of these transitions. It responds to the current state and populates the right panel content accordingly.

---

## **7\. What the Agent Drives (Right Panel Content)**

The agent is responsible for producing structured data that populates the right panel. It does not control which state the right panel is in — that is always driven by the user.

During **Exploration**, the agent outputs:

- Trip Profile field values (origin, travelers, when, duration, budget, vacation type & vibe, things we like, let's avoid) — these populate the Trip Profile component as they are extracted  
- Destination candidates — each with: destination name, region/country, and a destination vibe written for this specific user

During **Comparison**, the agent outputs:

- Shortlist card row values — progressively, across conversation turns. Row labels are agent-chosen to match this user's profile (the fixed set of Weather, Activities, Getting Around, Accommodation, Travel Style, Peak Season serves as the default; the agent can adjust which rows it populates based on what matters to this user). Rows fill in as the conversation develops; unfilled rows show `exploring...`.

---

## **8\. Visual & Interaction Notes for Implementation**

- **Photography**: All destination photos should be real, vivid travel photography. No placeholder grey boxes in the final implementation.  
- **Teal highlight boxes**: The Destination Vibe and Vacation Vibe labels use a soft teal/cyan background box. This is a distinct visual treatment — not a standard body copy style.  
- **`exploring...` state**: Shown in muted italic. This is a deliberate progressive disclosure pattern — it signals the card is live and filling in, not broken or empty.  
- **Shortlist Bar position**: Pinned to the bottom of the right panel (not the browser viewport). It scrolls with the panel on very long candidate lists but stays anchored during normal use.  
- **Compare shortlist CTA**: Greyed out / disabled state is important. It must be visually inactive until ≥ 2 shortlist slots are filled. Clicking it in the disabled state should do nothing.  
- **The `I already have destinations in mind` path**: Should produce a functional response in Sprint 4\. When this CTA is used, the agent should acknowledge the user's intent and begin building the trip profile around them, rather than starting with broad exploration.   
- **Colour palette**: Warm sandy yellows, ocean blues, coastal teals, soft greens. White backgrounds with colour for accents, labels, and interactive elements. Light, optimistic, warm — travel magazine aesthetic, not SaaS dashboard. Not dark mode.  
- **Typography**: One clean relaxed serif throughout. The "Where to?" logotype should feel bold and confident.