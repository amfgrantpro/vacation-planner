# Sprint 11 Design Brief

**Status**: Draft — awaiting PM review
**Date**: 20th June 2026

This brief describes the UX and visual design for Sprint 11's landing page redesign and minor Explore tweaks. It is written for the coding agent and references the Lovable design files (`apps/lovable-ui/src/routes/index.tsx`, `apps/lovable-ui/src/components/TripProfile.tsx`) and the provided screenshots. It is a UX/UI description — not a spec, not code.

**Status of the lovable-ui folder**: Up-to-date. The folder should reflect the work as it is to be used for implementation in this sprint.

---

## 1. Context

The current landing page (`LandingScreen.tsx`) was designed in Sprint 4. The problems it has are well-documented in the Sprint 11 planning doc. In short:

- The form's read order is broken — the two CTAs interrupt the form before the optional fields.
- The two CTAs ("I already have destinations in mind" / "Inspire me where to go") are visually prominent but represent a relatively minor choice; they're given more weight than they deserve.
- The right panel is dead space — an empty placeholder that does nothing to show the user what the product actually does.

The redesign fixes all three. The form is restructured so it reads naturally from top to bottom: required fields, then optional fields, then launch. The entry path choice is demoted to an optional field inline in the form. The right panel becomes a three-section journey preview — showing the product's shape before the user starts.

---

## 2. Left Panel — Intake Form

### 2.1 Overall structure

The form reads top to bottom in three blocks:

1. **Required fields** — the essentials: who's travelling, from where, when, for how long.
2. **Optional fields** — visually quieter: vacation type, budget, and entry path.
3. **Launch** — a single CTA at the bottom.

The visual weight steps down through these blocks. Required fields are the most prominent. Optional fields are smaller and more muted. The CTA is a clear terminus — there's no ambiguity about where the form ends.

### 2.2 Required fields

These are presented as sentence fragments with interactive pill inputs inline — the existing pattern from the current landing. No change to this structure.

The three sentences are:
- "I want to plan a trip for [travelers]"
- "travelling from [origin]"
- "I want to travel in [when] for [duration]"

**Travelers** is a dropdown pill (options: just me, a couple, a family, a group of friends). It renders in a filled/coloured style when set.

**Origin** is a free-text input styled to look like a pill. When the user types into it, it is styled as filled/coloured. When empty, it renders as a bordered outline pill with placeholder text.

**When** and **Duration** are dropdown pills. They render as filled/coloured when set to anything other than their defaults ("whenever" / "however long").

### 2.3 Optional fields

The optional block sits below the required fields with no divider label or section header — the reduced visual weight of the text is the only signal that these are secondary. The text is smaller and more muted than the required sentence block.

Three sentences:
- "We're looking for [vacation type]"
- "The budget is [budget]"
- "To start my journey, [entry path]"

**Vacation type** (see §2.4 below).

**Budget** is a dropdown pill with options: not important for now, shoestring, mid-range, comfortable, no limit.

**Entry path** is a dropdown pill with two options: "inspire me where to go" and "I have destinations in mind". This replaces the two CTA buttons from the current design. It defaults to "inspire me where to go". The choice remains meaningful — it determines the agent's opening behaviour — but it no longer interrupts the form or competes with the launch action.

### 2.4 Vacation type — multi-select

The vacation type field is a multi-select pill. When clicked, it opens a popover containing all available vacation type options displayed as a grid of toggleable chips.

**Options**: Beaches, City break, Nature & outdoors, Roadtripping, Cultural, Food & wine, Romantic getaway, Sports & recreation, Wellness & relaxation.

Note: the Lovable file (`apps/lovable-ui/src/routes/index.tsx`) currently has a different set of options. The `VACATION_TYPES` array in that file will need to be updated to match this agreed list before porting.

**Interaction**: Each chip toggles on/off independently. Selected chips are visually distinct from unselected ones — filled/coloured vs. plain. There is no confirm button; the user closes the popover when done.

**Pill display**: When nothing is selected, the pill reads "anything". When one or two types are selected, they are displayed joined with " + " (e.g. "Hiking + Wildlife"). When three or more are selected, only the first two are shown with an overflow count (e.g. "Hiking + Wildlife +2"). The pill renders as filled/coloured when any selection is made.

### 2.5 Launch CTA

A single wide button at the bottom of the left panel: **"Let's get going!"**

The button is a coral/salmon gradient pill that spans most of the column width. It has an arrow icon on the right side, inside a semi-transparent circular badge. On hover, the button lifts slightly and the shadow deepens.

This is the only launch action on the page. There are no competing buttons.

---

## 3. Right Panel — Journey Preview

The right panel is replaced with a three-section explainer. Each section is numbered, has a short title, and a phase eyebrow label. The sections are stacked vertically with space between them. There is no card border wrapping the whole panel — each section stands on its own.

The intent is to show the user what the product does before they start. Showing beats explaining — real destination photos and a comparison table communicate the two-phase journey faster than copy.

### 3.1 Section 1 — "Say what you want."

Step number: **1** · Eyebrow: *(none — this section has no phase label)*

This section contains the Trip Profile card — the same card that already exists in the app and is used during Explore. On the landing page, it mirrors the form on the left: as the user fills in their trip details, the Trip Profile card updates to reflect their inputs. This is purely visual — the card is driven by the same local state as the form fields and is just for show. On submit, the form builds a natural-language message and writes the structured profile to session storage; the card itself is not what gets sent.

Fields that haven't been set show as "not set" in the muted/italic style. The "things we like" and "let's avoid" fields will always show as "not set" on the landing page since the form doesn't capture them — this is expected.

The Trip Profile card layout is unchanged: five scalar fields in the top row (origin, travelers, when, duration, budget), three chip-array fields below (vacation type, things we like, let's avoid).

### 3.2 Section 2 — "Find destinations that fit."

Step number: **2** · Eyebrow: **Explore**

A static illustration of what the Explore phase looks like. Three destination photo cards in a row, portrait orientation.

Each card has:
- A full-bleed destination photo
- A location label in the bottom-left corner — a small pill with the destination name and country (e.g. "Lisbon, Portugal"), sitting over the image
- A dismiss button in the top-right corner — a small circular badge with an X icon

The middle card additionally has a **"✓ shortlisted"** badge in its top-right corner instead of the dismiss button — illustrating the shortlisting mechanic.

The photos are hardcoded to Lisbon, Amalfi, and San Sebastián. This is a static illustration, not connected to any live data.

### 3.3 Section 3 — "Work out which one's really for you."

Step number: **3** · Eyebrow: **Compare**

A static illustration of what the Compare phase looks like. A mini comparison table showing two destinations side by side.

The table has:
- A header row with two destination columns, each showing a photo of the destination with the name and country overlaid on a dark gradient at the bottom of the image (e.g. "MAASAI MARA / Kenya", "SERENGETI / Tanzania")
- Four data rows below: Best time to go, Where to stay, Animals you might see, Visa for EU citizens — each row showing a value for each destination
- Each data cell has a subtle background, making the grid readable

The destinations and content are hardcoded. This is a static illustration.

---

## 4. Phase 1 — Minor Explore Tweaks

These are small changes to the existing Explore experience, independent of the landing redesign.

### 4.1 Label alignment: Destination Vibe and Trip Feel

Following Sprint 10's content redefinition of `vibe` and `best_for`, the frontend labels need updating to match what the content now actually contains:

- In Explore, the candidate card label currently reads **"Destination Vibe"**. It should stay as "Destination Vibe" — the content redefinition aligned with this label.
- In Compare, the card label currently reads **"Vacation Vibe"**. This should be updated to **"Destination Vibe"** to match Explore.
- In Compare, the card label currently reads **"Best For"**. This should be updated to **"Trip Feel"** to reflect the personalised trip-feel content that `best_for` now contains.

The field rename from `best_for` → `trip_feel` in the tool schema, state object, and frontend should be done at the same time as the label changes.

### 4.2 Country on candidate cards

The agent should be prompted to include the country in the `region` field when a destination is a city or specific area — so "Kyoto, Japan" rather than "East Asia" or just "Japan." This is a prompt-only change; no schema changes are needed.

The goal is that the country is visible on the card itself, without the user needing to ask "Tell me more" just to find out where a destination is.

---

## 5. What Is Not In This Brief

The following are explicitly out of scope for Sprint 11 and should not be built:

- Any changes to the Explore or Compare visual surfaces beyond the label fixes above
- The "Tell me more" options button
- Persistence / session restoration
- Any backend changes
