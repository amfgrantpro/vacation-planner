# Sprint 11 Implementation Spec

**Status**: Draft — awaiting PM review
**Date**: 20th June 2026

This spec covers Sprint 11 as scoped in `docs/sprint-11-planning.md` and designed in `docs/sprint-11-design-brief.md`. It is written for the coding agent and is the authoritative implementation reference once approved.

---

## 1. Overview

Two phases, implemented in order.

**Phase 1** (minor Explore tweaks): two independent changes that can be done before the landing is touched. The `best_for` → `trip_feel` rename threads through the full stack; the region prompt fix is a single-line change in `orchestrator.py`.

**Phase 2** (landing redesign): the larger piece. Rewrite `LandingScreen.tsx` from the Sprint 4 design to the Lovable reference in `apps/lovable-ui/src/routes/index.tsx`. This includes the vacation type multi-select, form restructure, single CTA, right-panel journey preview, and rewritten `initialMessage` construction.

All changes are frontend and backend-prompt only. No new routes, no backend schema changes beyond field renaming, no new dependencies.

---

## 2. Phase 1: Minor Explore Tweaks

### 2.1 Label Alignment + `best_for` → `trip_feel` Field Rename

#### What's changing and why

Following Sprint 10's content redefinition, `best_for` now contains personalised "trip feel" content, not a generic "what this destination is best for" summary. The field name and all frontend labels need to catch up.

**Label changes (web app):**
- `ShortlistCard.tsx` — "Vacation vibe" → **"Destination vibe"** (the `vibe` box, to match Explore)
- `ShortlistCard.tsx` — "Best for ·" → **"Trip feel ·"** (the sage-background box)

**Label changes (lovable-ui):**
- `apps/lovable-ui/src/components/ShortlistCard.tsx` — "Vacation vibe" → **"Destination vibe"**
- `apps/lovable-ui/src/components/ShortlistCard.tsx` — "Best for ·" → **"Trip feel ·"**

**Field rename (backend → frontend chain):**

| File | Change |
|---|---|
| `services/api/agent/models.py` | `best_for: Optional[str] = None` → `trip_feel: Optional[str] = None` |
| `services/api/agent/orchestrator.py` | `TOOL_GENERATE_COMPARISON_MATRIX`: rename key `"best_for"` → `"trip_feel"` in the schema; update `description` to match |
| `services/api/agent/orchestrator.py` | `_apply_tool_call`: `existing.best_for` → `existing.trip_feel`; `detail.get("best_for")` → `detail.get("trip_feel")`; `best_for=existing_best_for` → `trip_feel=existing_trip_feel`; rename local variable `existing_best_for` → `existing_trip_feel` |
| `services/api/agent/prompt.py` | Any reference to `best_for` in the Compare prompt description — update to `trip_feel` |
| `apps/web/src/types.ts` | `DestinationCandidate`: `best_for?: string \| null` → `trip_feel?: string \| null` |
| `apps/web/src/components/ShortlistCard.tsx` | `candidate.best_for` → `candidate.trip_feel` |
| `apps/lovable-ui/src/components/ShortlistCard.tsx` | `Shortlist` type: `bestFor: string` → `tripFeel: string`; usage: `s.bestFor` → `s.tripFeel` |

**Tool schema description for `trip_feel` (in `TOOL_GENERATE_COMPARISON_MATRIX`):** keep the Sprint 10 meaning — personalised trip feel, what would THIS traveler's trip here actually be like — the field description does not need to change in substance, only the key name changes.

**Note on `TOOL_SUGGEST_CANDIDATES`:** the `vibe` field is not renamed or changed. The Sprint 10 redefinition of its content (destination-descriptive) is already in place. The `best_for` field does not appear in `TOOL_SUGGEST_CANDIDATES`, only in `TOOL_GENERATE_COMPARISON_MATRIX`, so no change is needed there.

**Implementation sequencing:** do the rename as a single isolated step. There should be no intermediate state where `best_for` exists on the model but the tool schema sends `trip_feel` (or vice versa). All changes in this item are committed together.

---

### 2.2 Region Prompt Instruction

#### What's changing and why

The Explore agent frequently fills `region` with a continent-level descriptor (e.g. "East Asia", "Southern Europe") when a city-specific destination is being shown. Users need to see the country on the card without asking "Tell me more". This is a prompt-only fix — no schema changes.

#### File changed

`services/api/agent/orchestrator.py` — `TOOL_SUGGEST_CANDIDATES`, `candidates` array, `region` field description.

**Current:** `"region": {"type": "string"}` (no description)

**New:** add a `"description"` key to the `region` property:

```
"description": "If the destination is a city or area, use its country (e.g. 'Spain' for Basque Country). If the destination is a country, use a broader geographic grouping (e.g. 'Mediterranean' for Malta, 'South Asia' for Sri Lanka)."
```

This is the verbatim instruction agreed during planning (§7, decision 5).

---

## 3. Phase 2: Landing Redesign

### Pre-requisite: Update `VACATION_TYPES` in lovable-ui

Before porting any lovable-ui code, update the `VACATION_TYPES` constant in `apps/lovable-ui/src/routes/index.tsx`.

**Current list** (16 types, wrong set): Beach, City break, Hiking, Wildlife, Food & wine, Cultural, Ski & snow, Road trip, Wellness, Adventure, Island-hopping, Family-friendly, Nightlife, Nature & outdoors, Off the beaten path, Romantic

**Replace with the agreed 9 types** (exact strings, case-sensitive):
```
Beaches, City break, Nature & outdoors, Roadtripping, Cultural, Food & wine, Romantic getaway, Sports & recreation, Wellness & relaxation
```

This must be done in lovable-ui before porting the `VacationTypePill` component to the web app.

---

### 3.1 Vacation Type Multi-Select

#### What's changing and why

Replace the single-select `<select>` dropdown for vacation type with the `VacationTypePill` multi-select component from lovable-ui. The agreed 9 vacation types are now the option set, and users can select multiple.

#### State changes in `LandingScreen.tsx`

- Remove: `const [vacationType, setVacationType] = useState('anything');`
- Add: `const [vacationTypes, setVacationTypes] = useState<string[]>([]);`

#### Component: `VacationTypePill`

Port the `VacationTypePill` component from `apps/lovable-ui/src/routes/index.tsx` into the web app `LandingScreen.tsx` (as a local component, not a separate file — same pattern as the rest of the landing). The component and its logic are ported verbatim, with one adjustment:

- The `VACATION_TYPES` array used inside `VacationTypePill` must be the agreed 9-type list (not the lovable-ui list before the pre-requisite update above).

**Pill display logic (ported verbatim from lovable-ui):**

| Selection state | Pill text |
|---|---|
| Nothing selected | "anything" |
| 1–2 selected | Joined with " + " (e.g. "Beaches + Cultural") |
| 3+ selected | First two with overflow count (e.g. "Beaches + Cultural +2") |

Pill styling: unfilled (bordered outline) when nothing selected; filled/coloured (`bg-sun/30` style) when any selection is made.

#### `currentProfile` update

- Change `vacation_type: vacationType !== 'anything' ? [vacationType] : []` → `vacation_type: vacationTypes`

---

### 3.2 Form Restructure, Entry Path Field, and Single CTA

#### What's changing and why

The current form interrupts itself with two CTAs before the optional fields, and the optional block has an explicit "optional" header that separates it too starkly. The redesign reads naturally top to bottom: required fields → optional fields (visually muted) → single launch CTA.

The entry path choice ("inspire me" vs "I have destinations in mind") is demoted from two prominent CTA buttons to an optional dropdown pill in the optional block.

#### Required fields (no change to content)

Keep the three sentences and their existing pill/input style. The only differences from the current implementation:
- **Travelers dropdown** — the current web app uses a native `<select>`. Port to the `SelectPill` Popover-based component from lovable-ui (matching the existing lovable-ui pill interaction style). Options: "just me", "a couple", "a family", "a group of friends".
- **When / Duration dropdowns** — same: port from native `<select>` to `SelectPill`. Options are unchanged (months + "whenever"; durations + "however long").
- The `origin` free-text input is already inline pill-style and does not change.

The `SelectPill` component in lovable-ui (`apps/lovable-ui/src/routes/index.tsx`) is self-contained and should be ported verbatim into `LandingScreen.tsx` as a local component.

#### Optional fields (restructured)

Remove: the dashed-border `border-t` separator and the "optional · add more if you like" section label. Visual weight reduction alone signals optionality.

The optional block contains three sentences rendered in smaller, more muted text than the required block (`text-foreground/65`, `text-[12.5px]`, per the lovable-ui design):

1. "We're looking for [vacation type]" — `VacationTypePill` (§3.1)
2. "The budget is [budget]" — `SelectPill` with `tone="muted"` and `palette="sun"`. Options: "not important for now", "shoestring", "mid-range", "comfortable", "no limit"
3. "To start my journey, [entry path]" — `SelectPill` with `tone="muted"` and `palette="sun"`, always rendered as filled. Options: "inspire me where to go", "I have destinations in mind". Default: "inspire me where to go".

**State addition:** `const [startMode, setStartMode] = useState(START_OPTS[0]);` where `START_OPTS = ["inspire me where to go", "I have destinations in mind"]`.

#### Single CTA

Remove: the two existing CTA buttons ("I already have destinations in mind" / "Inspire me where to go").

Add: a single "Let's get going!" button, placed below the optional block. Style: coral/salmon gradient pill (matching lovable-ui), full-width within the left column (80% or `min-w-[320px]`), arrow icon in a semi-transparent circular badge on the right. On hover: slight lift and deeper shadow.

The button calls `handleStartSession(startMode === "I have destinations in mind" ? 'destinations' : 'inspire')`.

The `onStartSession` prop interface on `LandingScreenProps` is unchanged: `(path: 'inspire' | 'destinations') => void`.

---

### 3.3 Right Panel — Journey Preview

#### What's changing and why

Replace the current right panel (TripProfileComponent + empty placeholder card grid) with the three-section journey preview from lovable-ui.

#### Structure

Three sections stacked vertically with `space-y-10` between them. No outer card border wrapping the whole panel.

**Section 1 — "Say what you want."**

- Step badge: numbered circle with `1` (ocean/10 background)
- Title: "Say what you want."
- No eyebrow label
- Content: `TripProfileComponent` (web app's existing component, accepts `profile` prop)
  - Pass `profile={currentProfile}` — mirrors the left form in real time as the user types
  - No `onProfileChange` prop — edits from the right panel card are not surfaced back to the left form; this is acceptable for the landing context

**Section 2 — "Find destinations that fit."**

- Step badge: numbered circle with `2` (sun/20 background)
- Eyebrow: "Explore"
- Title: "Find destinations that fit."
- Content: `ExploreIllustration` (static)

**Section 3 — "Work out which one's really for you."**

- Step badge: numbered circle with `3` (coral/15 background)
- Eyebrow: "Compare"
- Title: "Work out which one's really for you."
- Content: `CompareIllustration` (static)

#### Components to port from lovable-ui

Port the following from `apps/lovable-ui/src/routes/index.tsx` into `LandingScreen.tsx` as local components:

**`PanelSection`** — wraps Sections 2 and 3. Props: `eyebrow`, `title`, `step` (number), `children`. Ported verbatim. Section 1 is not wrapped in `PanelSection` — it uses the same inline structure as in lovable-ui.

**`ExploreIllustration`** — three portrait photo cards in a grid. Content:
- Card 0: Lisbon, Portugal — dismiss button (X badge) in top-right
- Card 1: Amalfi, Italy — "✓ shortlisted" badge in top-right (no dismiss button)
- Card 2: San Sebastián, Spain — dismiss button in top-right

Photo URLs — use directly from `apps/lovable-ui/src/lib/photos.ts`. The web app does not have a `photos.ts` lib file; copy only the three URLs needed as constants inline in `LandingScreen.tsx` (no new file):
```ts
const PHOTO_LISBON = "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=900&h=700&q=80";
const PHOTO_AMALFI = "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=900&h=700&q=80";
const PHOTO_SAN_SEBASTIAN = "https://images.unsplash.com/photo-1558642084-fd07fae5282e?auto=format&fit=crop&w=900&h=700&q=80";
const PHOTO_MAASAI_MARA = "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&h=700&q=80";
const PHOTO_SERENGETI = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&h=700&q=80";
```

**`CompareIllustration`** — mini comparison table with two columns. Header images: Maasai Mara (Kenya) and Serengeti (Tanzania). Four data rows (hardcoded):

| Row label | Maasai Mara | Serengeti |
|---|---|---|
| Best time to go | Jul–Oct (river crossings) | Jan–Feb (calving), Jun–Oct |
| Where to stay | Tented camps to luxury lodges | Mobile camps following the migration |
| Animals you might see | Big Five, cheetah, river crossings | Big Five, wild dogs, calving herds |
| Visa for EU citizens | e-visa required (~$50) | e-visa required (~$50) |

Port both components verbatim from lovable-ui. The only change: replace `src={photos.X}` with the inline constant references above.

#### Import changes in `LandingScreen.tsx`

- lucide-react: remove `Compass`, `MapPin`, `Lightbulb` (no longer used); add `X`, `Check`, `ArrowRight` (needed for `ExploreIllustration`, `VacationTypePill`, and the CTA button).
- `TripProfileComponent` import is unchanged — still used in Section 1.

---

### 3.4 Opening Sentence Construction (`initialMessage`)

#### What's changing and why

The current `handleStartSession` produces a single comma-joined sentence like "I'm a couple, travelling from Berlin, in whenever, for however long." This includes default values and always includes all fields, which sends unnecessary noise to the agent. The new construction follows the agreed template: discrete sentences, defaults omitted, entry path always present.

#### New construction logic

Replace the entire `handleStartSession` body with the following logic. The result is assembled into `parts: string[]` then joined with `" "` (space) — each item is a complete sentence ending with a period.

**Sentence 1 — always present:**
```
If origin is non-empty:
  "I want to plan a trip for {travelers}, travelling from {origin}."
Else:
  "I want to plan a trip for {travelers}."
```

**Sentence 2 — when and/or duration (omit if both are at default):**
```
when !== "whenever" AND duration !== "however long":
  "I want to travel in {when} for {duration}."
when !== "whenever" only:
  "I want to travel in {when}."
duration !== "however long" only:
  "I want to travel for {duration}."
both at default: omit entirely
```

**Sentence 3 — vacation type (omit if nothing selected):**
```
vacationTypes.length > 0:
  Oxford-comma join:
    1 type: "We're looking for {type}."
    2 types: "We're looking for {type1} and {type2}."
    3+ types: "We're looking for {type1}, {type2}, and {typeN}."
```

**Sentence 4 — budget (omit if at default):**
```
budget !== "not important for now":
  "The budget is {budget}."
```

**Sentence 5 — entry path (always present):**
```
startMode === "I have destinations in mind":
  "To start with, I have destinations in mind."
else:
  "Inspire me where to go."
```

**Confirmed examples (from planning doc §3):**

- MIN (travelers = "a couple", all defaults, inspire path):
  `"I want to plan a trip for a couple. Inspire me where to go."`

- MAX (all fields filled):
  `"I want to plan a trip for a couple, travelling from Berlin. I want to travel in January for two weeks. We're looking for Beaches, City break, and Nature & outdoors. The budget is mid-range. To start with, I have destinations in mind."`

#### `onboardingProfile` sessionStorage

The structured profile written to `sessionStorage.setItem('onboardingProfile', ...)` remains. `currentProfile` is the same object as today, now with `vacation_type: vacationTypes` (the array, not a wrapped single value). The `vacation_type` field is already `string[]` in `TripProfile` since Sprint 7, so no type change is needed.

#### Path mapping

The `path` argument passed to `onStartSession` is derived from `startMode`:
```ts
const path = startMode === "I have destinations in mind" ? 'destinations' : 'inspire';
```

The `onStartSession` prop interface is unchanged.

---

## 4. Constraints Carried Forward

All constraints from Sprint 10 are preserved. Additions this sprint:

1. Lovable component ports: CSS classes and layout are ported verbatim. Prop interfaces, data models, and routing from lovable-ui (e.g. `<Link>` tags, the `Shortlist` type in ShortlistCard) are **not** adopted — the web app's existing types remain authoritative.
2. `VacationTypePill` and `SelectPill` are local components inside `LandingScreen.tsx`, not shared components.
3. Photo URLs are inline constants, not a new `photos.ts` lib file.
4. The `onStartSession` prop signature on `LandingScreenProps` is unchanged.
5. No changes to `App.tsx`, `useAgent.ts`, or any Explore/Compare/Decision phase components beyond the label and field rename in Phase 1.

---

## 5. Testing Scenarios

These are the scenarios to verify during a live test session, not formal test scripts.

### Phase 1

**Label alignment:**
- Enter Compare — confirm the `vibe` box reads "Destination Vibe" (not "Vacation Vibe")
- Confirm the `trip_feel` box reads "Trip Feel" (not "Best For")
- Enter Explore — confirm the `vibe` box still reads "Destination Vibe" (unchanged)

**Region prompt:**
- Start a session — prompt the agent for a city-level destination (e.g. Kyoto) and confirm `region` shows "Japan" not "East Asia"
- Prompt for a country-level destination (e.g. Sri Lanka) and confirm `region` shows "South Asia" not "Sri Lanka" itself
- Prompt for Basque Country and confirm `region` shows "Spain"

**Field rename end-to-end:**
- Enter Compare and confirm the comparison matrix generates correctly (no schema mismatch error)
- Confirm `trip_feel` content appears on Compare cards

### Phase 2

**Vacation type:**
- Select no types — pill shows "anything"
- Select two types — pill shows "TypeA + TypeB"
- Select four types — pill shows "TypeA + TypeB +2"
- Multi-select persists across popover open/close cycles

**Form + CTA:**
- Only the "Let's get going!" button is present — no other launch buttons
- Entry path dropdown defaults to "inspire me where to go"
- Switching to "I have destinations in mind" and launching puts the agent in destinations mode (agent asks for names, not describes 3 candidates)

**Right panel:**
- Trip Profile card updates in real time as the user fills the left form
- Explore illustration shows three photo cards (Lisbon, Amalfi, San Sebastián) with correct badges
- Compare illustration shows Maasai Mara / Serengeti table with correct rows

**`initialMessage` construction (spot-check each sentence omission rule):**
- MIN: only travelers set, all others at default, inspire path → "I want to plan a trip for a couple. Inspire me where to go."
- Origin omitted: travelers set, no origin → sentence 1 has no "travelling from"
- When only: set when, leave duration at default → "I want to travel in January."
- Duration only: set duration, leave when at default → "I want to travel for two weeks."
- Vacation types: select 3 types → Oxford comma format in sentence
- Budget at default → no budget sentence
- Destinations path → "To start with, I have destinations in mind."

**"Already have destinations" turn 2 robustness:**
- As noted in Sprint 10's known gaps, this post-testing tweak has not been re-tested. Verify during the first test session after landing is live: after the agent asks for destination names on turn 1, confirm turn 2 includes those exact names as candidates.

---

## 6. Files Changed

```
vacation-planner/
├── services/api/agent/
│   ├── models.py                        best_for → trip_feel
│   ├── orchestrator.py                  TOOL_SUGGEST_CANDIDATES region description;
│   │                                    TOOL_GENERATE_COMPARISON_MATRIX best_for → trip_feel;
│   │                                    _apply_tool_call best_for → trip_feel references
│   └── prompt.py                        best_for → trip_feel references in Compare prompt
│
├── apps/web/src/
│   ├── types.ts                         DestinationCandidate: best_for → trip_feel
│   └── components/
│       ├── ShortlistCard.tsx            Labels: "Vacation Vibe" → "Destination Vibe",
│       │                                "Best For" → "Trip Feel"; field: best_for → trip_feel
│       └── LandingScreen.tsx            Full rewrite: VacationTypePill, SelectPill,
│                                        form restructure, single CTA, right-panel sections,
│                                        initialMessage construction
│
└── apps/lovable-ui/src/
    ├── routes/index.tsx                  VACATION_TYPES updated to agreed 9 types
    └── components/ShortlistCard.tsx      Labels: "Vacation vibe" → "Destination vibe",
                                          "Best for ·" → "Trip feel ·";
                                          Shortlist type: bestFor → tripFeel
```
