# Sprint 11 Final State: Landing Redesign & Explore Tweaks

**Status**: Complete  
**Date**: 20th June 2026

This document describes the end of Sprint 11 code state.

---

## 1. Summary

Sprint 11 implements both phases from `docs/sprint-11-spec.md`, plus several small fixes agreed during the testing session. Phase 1 completes the `best_for` → `trip_feel` rename begun in Sprint 10 (labels, field names, and tool schema across the full stack), and adds a prompt instruction to guide the `region` field toward country-level values for city destinations. Phase 2 rewrites `LandingScreen.tsx` from the Sprint 4 design to the Lovable reference: vacation type becomes a multi-select pill, the form reads top-to-bottom without interruption, the two CTA buttons are replaced by a single "Let's get going!" button with an inline entry-path selector, and the right panel becomes a three-step journey preview showing a live trip profile, a destination photo grid, and a comparison table. The `initialMessage` construction is also rewritten to discrete sentences that omit fields at their defaults. Post-testing fixes: `name` field description added to prevent "City, Country" formatting; "Vacation type & vibe" label corrected to "Vacation type" in both apps; chip text wrapping fixed with `whitespace-nowrap`; and the Explore first-turn instruction tightened by the PM to suppress a redundant `update_trip_profile` call on turn 1.

---

## 2. Sprint 10 → Sprint 11: Before vs. After

| Dimension | Sprint 10 (Before) | Sprint 11 (After) |
|---|---|---|
| **`best_for` field name** | `best_for` in `DestinationCandidate`, tool schema, `types.ts`, and UI | Renamed `trip_feel` across `models.py`, `orchestrator.py`, `types.ts`, `ShortlistCard.tsx`, `CandidateArea.tsx`, and all lovable-ui files |
| **ShortlistCard labels** | "Vacation vibe" (vibe box) / "Best for ·" (personalised box) | "Destination vibe" / "Trip feel ·" — matching the Sprint 10 content redefinition |
| **`TOOL_SUGGEST_CANDIDATES.region` description** | No description — model frequently output continent-level strings ("Western Europe", "East Asia") for city destinations | Added verbatim instruction: city/area destinations use the country; country destinations use a broader geographic grouping |
| **`TOOL_SUGGEST_CANDIDATES.name` description** | No description — model sometimes formatted names as "City, Country" causing redundant display with the region badge | Added "The destination name only." — country suffix removed from the name field |
| **Vacation type input** | Single `<select>` dropdown with 6 options | Multi-select `VacationTypePill` popover with 9 agreed types; pill shows "anything" / "A + B" / "A + B +N" |
| **Vacation type options** | beach & relaxation, hiking & outdoors, city & culture, roadtripping, good food & drink (6 total, inconsistent naming) | Beaches, City break, Nature & outdoors, Roadtripping, Cultural, Food & wine, Romantic getaway, Sports & recreation, Wellness & relaxation (9 total) |
| **Budget options** | on the cheap, mid-range, let's get fancy | shoestring, mid-range, comfortable, no limit (matching lovable-ui; default "not important for now" unchanged) |
| **Form structure** | Required fields → two CTA buttons → optional fields below a dashed border separator | Required fields → optional fields (muted, no separator) → single "Let's get going!" CTA |
| **Entry path choice** | Two equal-weight CTA buttons ("I already have destinations" / "Inspire me") | Inline `SelectPill` in the optional block, defaults to "inspire me where to go" |
| **Travelers / When / Duration inputs** | Native `<select>` dropdowns with `<ChevronDown>` overlay | `SelectPill` Popover-based selectors — consistent with lovable-ui pill interaction style |
| **Right panel (landing)** | TripProfileComponent + a placeholder card grid with a tagline | Three-step journey preview: (1) live TripProfileComponent, (2) Explore photo grid illustration, (3) Compare table illustration — no outer border, `space-y-10` between sections |
| **`initialMessage` construction** | Single comma-joined sentence including all fields at any value ("I'm a couple, travelling from Berlin, in whenever, for however long.") | Discrete sentences, defaults omitted; entry path always the final sentence; Oxford-comma join for multiple vacation types |
| **"Vacation type & vibe" label** | Shown in TripProfileComponent (web) and TripProfile (lovable-ui) | Corrected to "Vacation type" in both |
| **Chip text wrapping** | Long vacation type chip text (e.g. "Romantic getaway", "Sports & recreation") wrapped within the chip pill | `whitespace-nowrap` added to chip spans — text stays on one line per chip |
| **Explore first-turn instruction** | "Do NOT restate or re-record them." | Tightened: "Do NOT restate or re-record them **with a tool**. **DO** Suggest 3 destinations…" — suppresses the redundant `update_trip_profile` call on turn 1 |
| **lovable-ui `VACATION_TYPES`** | 16 types, inconsistent with web app | Replaced with the agreed 9 types, matching the web app |

---

## 3. Phase 1: Explore Tweaks

### 3.1 `best_for` → `trip_feel` Full-Stack Rename

Sprint 10 redefined the content of `best_for` (personalised trip feel) and `vibe` (destination-descriptive) but deferred the field rename and label alignment to Sprint 11.

**Backend:**
- `models.py`: `DestinationCandidate.best_for` → `trip_feel`
- `orchestrator.py`: `TOOL_GENERATE_COMPARISON_MATRIX.candidates_details` schema key and `required` array updated; `_apply_tool_call` local variable (`existing_trip_feel`) and attribute assignment updated; description text updated; comment updated
- `prompt.py`: Compare mode instruction reference `\`best_for\`` → `\`trip_feel\``; comment in `_clean_candidates_for_prompt` updated

**Frontend (web app):**
- `types.ts`: `best_for?: string | null` → `trip_feel?: string | null`
- `ShortlistCard.tsx`: label "Vacation vibe" → "Destination vibe"; label "Best for ·" → "Trip feel ·"; `candidate.best_for` → `candidate.trip_feel`
- `CandidateArea.tsx`: fallback object `best_for: null` → `trip_feel: null`

**lovable-ui:**
- `ShortlistCard.tsx`: `Shortlist` type `bestFor` → `tripFeel`; labels updated; `s.bestFor` → `s.tripFeel`
- `routes/shortlist-a.tsx`, `shortlist-b.tsx`, `decision.tsx`: `bestFor:` → `tripFeel:` in demo data objects

All changes were made atomically — no intermediate state where the model schema and the Pydantic model diverged.

### 3.2 Region Prompt Instruction

`TOOL_SUGGEST_CANDIDATES.candidates.region` now has a `"description"` key with the agreed verbatim instruction:

> "If the destination is a city or area, use its country (e.g. 'Spain' for Basque Country). If the destination is a country, use a broader geographic grouping (e.g. 'Mediterranean' for Malta, 'South Asia' for Sri Lanka)."

No schema changes — prompt-only fix.

---

## 4. Phase 2: Landing Redesign

### 4.1 Pre-requisite: lovable-ui `VACATION_TYPES`

`apps/lovable-ui/src/routes/index.tsx` — `VACATION_TYPES` constant replaced with the agreed 9 types before porting any components to the web app.

### 4.2 `LandingScreen.tsx` — Full Rewrite

`LandingScreen.tsx` is a complete replacement of the Sprint 4 design. All new components are local to the file (not shared components), per the Sprint 11 constraint.

**Local components ported from lovable-ui:**

`SelectPill` — Popover-based single-select pill. Props: `value`, `options`, `filled`, `tone` ("default" | "muted"), `palette` ("ocean" | "sun"), `onChange`. Muted/sun variant used for the optional block fields.

`VacationTypePill` — Popover multi-select pill. Shows "anything" when empty; "A + B" for 1–2 selections; "A + B +N" for 3+. Each type toggles independently; selections persist across popover open/close cycles.

`PanelSection` — wraps Sections 2 and 3 of the right panel. Props: `eyebrow`, `title`, `step` (number), `children`. Step badge colour: ocean (1), sun (2), coral (3).

`ExploreIllustration` — three portrait photo cards in a 3-column grid (Lisbon, Amalfi, San Sebastián). Cards 0 and 2 have a dismiss X badge; card 1 (Amalfi) has a "✓ shortlisted" badge. Photos are Unsplash CDN URLs defined as inline constants.

`CompareIllustration` — mini comparison table with header images (Maasai Mara, Serengeti) and four hardcoded data rows (best time to go, where to stay, animals, visa). Layout: `grid-cols-[1.1fr_1fr_1fr]`.

**State changes:**
- `vacationType: string` (single, default `'anything'`) removed
- `vacationTypes: string[]` (multi-select, default `[]`) added
- `startMode: string` (default `START_OPTS[0]` = `"inspire me where to go"`) added

**Form structure:**
- Required block (`space-y-5`): travelers (`SelectPill`, always filled), origin (existing free-text input), when + duration (`SelectPill`, filled when non-default)
- Optional block (`mt-14`, no separator, `text-[12.5px] text-foreground/65`): vacation type (`VacationTypePill`), budget (`SelectPill` muted/sun), entry path (`SelectPill` muted/sun, always filled)
- CTA (`mt-16`): single "Let's get going!" button — coral/salmon gradient pill, `w-[80%] min-w-[320px]`, arrow in semi-transparent circle badge; calls `handleStartSession()` with no arguments

**Right panel:**
- Section 1: step badge (1, ocean/10), title "Say what you want.", `TripProfileComponent profile={currentProfile}` — no `onProfileChange` prop (right-panel edits not surfaced back to the form)
- Section 2: `PanelSection step={2} eyebrow="Explore"` wrapping `ExploreIllustration`
- Section 3: `PanelSection step={3} eyebrow="Compare"` wrapping `CompareIllustration`

**`currentProfile`:** `vacation_type: vacationTypes` (the full array, not a wrapped single value).

### 4.3 `initialMessage` Construction

`handleStartSession` now takes no argument and derives the path from `startMode`. The message is assembled as `parts: string[]` joined with a single space — each item is a complete sentence.

1. **Travelers + origin** — always present. Origin clause included only when the field is non-empty: `"I want to plan a trip for {travelers}, travelling from {origin}."` / `"I want to plan a trip for {travelers}."`
2. **Timing** — omitted entirely if both when and duration are at their defaults. Each clause is dropped independently if at default: `"I want to travel in {when} for {duration}."` / `"I want to travel in {when}."` / `"I want to travel for {duration}."`
3. **Vacation type** — omitted if nothing selected. Multiple types joined with Oxford comma: `"We're looking for {type1}, {type2}, and {typeN}."`
4. **Budget** — omitted if at default (`"not important for now"`): `"The budget is {budget}."`
5. **Entry path** — always present: `"To start with, I have destinations in mind."` or `"Inspire me where to go."`

---

## 5. Post-Testing Fixes

Four small adjustments made during the live test session:

1. **`name` field description** (`orchestrator.py`): `TOOL_SUGGEST_CANDIDATES.candidates.name` gains `"description": "The destination name only."` — prevents the model from appending the country to the destination name (e.g. "Santorini, Greece" instead of "Santorini"), which caused redundant display alongside the `region` badge.

2. **"Vacation type & vibe" label** (`TripProfileComponent.tsx`, `TripProfile.tsx`): Label corrected to "Vacation type" in both the web app and lovable-ui. The "& vibe" suffix was an oversight carried forward from an earlier Lovable design iteration.

3. **Chip text wrapping** (`TripProfileComponent.tsx`): `whitespace-nowrap` added to chip `<span>` elements in the display view of `EditableField`. Prevents long vacation type names ("Romantic getaway", "Sports & recreation") from splitting across lines within the pill shape.

4. **Explore first-turn instruction** (`prompt.py`): PM tightened the first-turn rule from "Do NOT restate or re-record them" to "Do NOT restate or re-record them **with a tool**. **DO** Suggest 3 destinations…" — the original wording was ambiguous enough that the model was still issuing an `update_trip_profile` call on turn 1 to re-record intake data already in state.

---

## 6. Constraints Carried Forward

All constraints from Sprint 10 are preserved. Additions this sprint:

1. `VacationTypePill` and `SelectPill` are local components inside `LandingScreen.tsx` — not shared components.
2. Photo URLs for the right-panel illustrations are inline constants in `LandingScreen.tsx` — no new `photos.ts` lib file in the web app.
3. The `onStartSession` prop signature on `LandingScreenProps` is unchanged: `(path: 'inspire' | 'destinations') => void`.
4. No changes to `App.tsx`, `useAgent.ts`, or any Explore/Compare/Decision phase components beyond the label and field rename.
5. Lovable component ports: CSS classes and layout ported verbatim; prop interfaces, data models, and routing logic (e.g. `<Link>` tags, the `Shortlist` type) not adopted — web app's existing types remain authoritative.

---

## 7. Directory Map (Post-Sprint 11)

```
vacation-planner/
├── docs/
│   ├── sprint-11-planning.md
│   ├── sprint-11-spec.md
│   └── sprint-11-result.md              ← THIS FILE
│
├── services/api/agent/
│   ├── models.py                        best_for → trip_feel
│   ├── orchestrator.py                  TOOL_SUGGEST_CANDIDATES: name description, region description;
│   │                                    TOOL_GENERATE_COMPARISON_MATRIX: best_for → trip_feel
│   │                                    throughout schema and _apply_tool_call
│   └── prompt.py                        trip_feel reference in Compare mode instruction;
│                                        Explore first-turn instruction tightened (PM edit)
│
├── apps/web/src/
│   ├── types.ts                         best_for → trip_feel
│   └── components/
│       ├── ShortlistCard.tsx            Labels: "Destination vibe", "Trip feel ·";
│       │                                field: best_for → trip_feel
│       ├── CandidateArea.tsx            Fallback object: best_for → trip_feel
│       ├── TripProfileComponent.tsx     Label: "Vacation type" (was "Vacation type & vibe");
│       │                                whitespace-nowrap on chip spans
│       └── LandingScreen.tsx            Full rewrite: SelectPill, VacationTypePill, PanelSection,
│                                        ExploreIllustration, CompareIllustration (all local);
│                                        form restructure; single CTA; right-panel journey preview;
│                                        initialMessage discrete-sentence construction
│
└── apps/lovable-ui/src/
    ├── routes/index.tsx                 VACATION_TYPES: 9 agreed types
    ├── components/ShortlistCard.tsx     Labels: "Destination vibe", "Trip feel ·";
    │                                    Shortlist type: bestFor → tripFeel
    ├── components/TripProfile.tsx       Label: "Vacation type" (was "Vacation type & vibe")
    └── routes/
        ├── shortlist-a.tsx             bestFor → tripFeel in demo data
        ├── shortlist-b.tsx             bestFor → tripFeel in demo data
        └── decision.tsx                bestFor → tripFeel in demo data
```

---

## 8. Testing Results

**`best_for` → `trip_feel` rename**: Field rename and label alignment confirmed working across Explore and Compare. "Destination vibe" and "Trip feel ·" display correctly on ShortlistCards.

**Region prompt**: Works correctly most of the time. Prompting for country-level destinations (Sri Lanka, Chile) produces appropriate geographic groupings. City-level destinations are inconsistent — the instruction is followed in the majority of cases but the model occasionally reverts to continent-level strings ("Western Europe", "Southern Europe").

**`name` field description**: Confirmed working — destination names no longer include country suffixes in tested sessions.

**Landing — minimum entry**: Travelers only, all other fields at default, inspire path — produces the correct two-sentence minimum message. Agent launched correctly from minimal input.

**Landing — maximum entry**: All fields filled, multiple vacation types selected, destinations path — full multi-sentence message produced correctly with Oxford comma join. Agent launched and entered destinations mode correctly.

**Multi-select vacation type**: Selection, deselection, and pill display (0 / 1–2 / 3+) all working. State persists correctly across multiple open/close cycles of the popover.

**Both CTA paths**: "Inspire me where to go" and "I have destinations in mind" — both paths launch correctly and place the agent in the expected mode.

**Right panel**: Live TripProfileComponent updates as the user fills the left form. Explore and Compare illustrations render correctly (photos, badges, comparison table).

**"Already have destinations" — turn 2**: Improved over Sprint 10. Agent correctly asked for destination names on turn 1, then included user-named destinations as candidates on turn 2. Behaviour confirmed better than the Sprint 10 post-testing tweak.

**First-turn `update_trip_profile` call**: Agent was issuing a redundant profile update tool call on turn 1 despite intake data already being in state. Fixed by PM prompt edit during testing.

**`trip_feel` content quality**: The model treats `trip_feel` largely as a rephrasing of `vibe` rather than a genuinely personalised "trip feel" grounded in the traveler's profile. In the worst case the content is near-identical to `vibe` with minor word substitutions; in better cases it constructs a sentence around the same adjectives with profile context added superficially. 
PM iteration: 
* Suggested direction: the instruction should anchor `trip_feel` to specific profile facts (who they're travelling with, what they like, when they're going) rather than restating destination character.
* I altered the tool description of `vibe` to "1-sentence description of what this destination is like and famous for — its character and atmosphere (e.g. 'a laid-back island with whitewashed villages and volcanic beaches')."
* I altered the prompt to "2. **Make the Cards Personal**: `trip_feel` must be personalised for this traveler — given what you know about them, what would THEIR experience here actually feel like? (DO NOT repeat the information contained in `vibe`.) `seasonal_note` is what the destination is like during the time of year they're planning to travel."
* Testing after these 2 changes still resulted in the trip feel being almost word-for-word the same as destination vibe. 
* Fix applied. `_clean_candidates_for_prompt` now strips `vibe` from candidates when in compare/decision mode. The model still has destination name, region, and the full trip profile, but can no longer anchor on the existing vibe text when generating `trip_feel`. Vibe is stored on the candidate and returned to the frontend unaffected.
* After further testing: The trip feel is now noticeably different than destination vibe.

---

## 9. Known Gaps

1. **Region inconsistency**: The `region` field instruction is followed reliably for country-level and some city-level destinations but the model occasionally outputs continent-level strings for well-known European cities. No further prompt changes were made after testing; behaviour is acceptable for now but not fully reliable.

2. **Text-embedded tool calls (existing)**: When the model receives a message that causes it to produce many tool arguments, it occasionally emits the tool call as inline function syntax in the `content` field rather than as a structured tool call. The retry-with-nudge mechanism only fires on `tool_use_failed` 400 errors; this failure mode returns HTTP 200 and is not currently caught.