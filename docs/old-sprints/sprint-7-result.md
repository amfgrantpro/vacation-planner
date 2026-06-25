# Sprint 7 Final State: Stack Unification, Bug Fixes & Trip Profile Inline Editing

**Status**: Complete  
**Date**: 10th June 2026

This document describes the end of Sprint 7 code state.

---

## 1. Summary

Sprint 7 closes three structural issues that had been accumulating across prior sprints. The Tailwind v3/v4 mismatch between `apps/web` and `apps/lovable-ui` is resolved — all components now use v4 opacity modifier syntax and import from `@/components/ui/` — meaning future Lovable components port without translation. The un-reject bug (candidate reappearing in the grid without agent re-suggestion) is fixed by deleting the candidate from state rather than flipping its status. The stale `uiState` closure bug is fixed with a `useRef` pattern. The Trip Profile is now directly editable: scalar fields open popovers, array fields manage chips, and edited values reach the agent on the next send via a new `profile_override` POST field. `vacation_type` is migrated from a scalar to a list type across the full stack.

Testing passed. Remaining issues are all prompt/behaviour rather than code, and are carried forward as known gaps.

---

## 2. Sprint 6 → Sprint 7: Before vs. After

| Dimension | Sprint 6 (Before) | Sprint 7 (After) |
|---|---|---|
| **Tailwind version** | `apps/web` ran Tailwind v3 (`tailwind.config.js`, `@tailwind` directives, pre-baked alpha tokens) while `apps/lovable-ui` ran v4 — every Lovable port required manual token translation | `apps/web` migrated to Tailwind v4; `tailwind.config.js` and `postcss.config.js` deleted; `index.css` rewritten to match `apps/lovable-ui/src/styles.css` structure; pre-baked alpha tokens removed |
| **Radix imports** | Some components imported Radix UI primitives directly (`@radix-ui/react-popover`) | All Radix direct imports replaced with `@/components/ui/` wrappers copied from `apps/lovable-ui`; `grep -r "@radix-ui" apps/web/src/` returns no results |
| **Component CSS** | `CandidateCard`, `ShortlistCard`, `RemovedTray`, `CandidateArea` sub-components used pre-baked alpha tokens (`bg-cream-overlay`, `bg-sage-bg`, etc.) | All replaced with Lovable visual design using v4 opacity modifier syntax (`bg-cream/90`, `bg-sage/25`, etc.) |
| **Un-reject behaviour** | Removing a candidate from the Removed tray restored it to `suggested` status — it reappeared in the candidate grid immediately without agent involvement | Un-rejected candidates are deleted from `session.plan.candidates` entirely; they can only return if the agent actively re-suggests them |
| **Stale `uiState` on send** | `sendMessage` captured `uiState` by closure — when `updateUiState` and `sendMessage` were called in the same handler (e.g. `handleTellMeMore`), the POST body reflected the previous turn's state | `uiStateRef` added to `useAgent.ts`; updated synchronously on every render; `sendMessage` reads from ref, not closure |
| **Trip Profile editing** | Fields were read-only chips; users had to type a chat message to correct any profile value | All fields are click-to-edit: scalar fields (Origin, Travelers, When, Duration, Budget) open single-value popovers; array fields (Vacation type & vibe, Things we like, Let's avoid) manage chip arrays |
| **Profile edits reaching the agent** | No mechanism — profile could only change via agent tool calls | Edited profile is held in `pendingProfileOverride` state in `App.tsx`; included as `profile_override` in the next `POST /chat` body; applied to `session.plan.trip_profile` before the orchestrator runs |
| **`vacation_type` type** | `Optional[str]` / `string \| null` scalar — incompatible with the Lovable chip-array design | `List[str]` / `string[]` across `models.py`, `types.ts`, `update_trip_profile` tool schema, and `prompt.py`; landing screen wraps its single-entry value in a one-item array on submit |
| **`TripProfileComponent.tsx`** | Custom read-only component showing profile fields as static chips | Replaced with Lovable `TripProfile.tsx` design: `buildProfile`, `EditableField`, `ScalarEditor`, `ArrayEditor`, `toChips`, `accentBg` map; `opts.vibe` / key `"vibe"` renamed to `opts.vacation_type` / `"vacation_type"` |

---

## 3. Tailwind v4 Migration

`apps/web/vite.config.ts` now uses the native `@tailwindcss/vite` plugin rather than the PostCSS-based integration. `tailwind.config.js` and `postcss.config.js` are deleted. `apps/web/src/index.css` is rewritten with the v4 `@import "tailwindcss"` / `@theme inline` / CSS custom properties structure that mirrors `apps/lovable-ui/src/styles.css`.

All pre-baked alpha tokens that existed as v3 workarounds are gone. Their v4 equivalents (opacity modifiers) are used directly in component files.

`apps/web/src/components/ui/` and `apps/web/src/lib/utils.ts` are copied verbatim from `apps/lovable-ui`. All components that previously imported Radix primitives directly now import from the `@/components/ui/` wrappers.

---

## 4. Un-reject Fix (`main.py`)

Previous behaviour in the rejection reconciliation block: when a candidate's name was absent from the incoming `rejected_candidates` list but the candidate had `status == "rejected"` in session state, the handler set `status = "suggested"` — immediately re-showing it in the grid.

New behaviour: those candidates are collected and removed from `session.plan.candidates` entirely. The empty-list branch (all rejections cleared) also removes rejected candidates from the plan rather than restoring them. A candidate can only return if the agent calls `suggest_candidates` and actively nominates it.

---

## 5. Stale `uiState` Fix (`useAgent.ts`)

The root cause was a React closure bug: `sendMessage` is a `const` defined inside the hook body and captures `uiState` at render time. Handlers like `handleTellMeMore` called `updateUiState(...)` and `sendMessage(...)` in the same event callback — React queued the state update but hadn't re-rendered, so `sendMessage` still held the previous value.

Fix: a `uiStateRef` is added alongside the `uiState` state variable and assigned `uiStateRef.current = uiState` synchronously on every render. Inside `sendMessage`, `uiStateRef.current` is read instead of the closure-captured `uiState`. The existing `overrideUiState` parameter (used by mode-transition sends in `handleCompareShortlist` and `handleSelectWinner`) is preserved — it still takes precedence over the ref when provided.

---

## 6. Trip Profile Inline Editing

### Frontend

`TripProfileComponent.tsx` is replaced with the Lovable `TripProfile.tsx` implementation. The component accepts `{ profile: TripProfile; onProfileChange?: (updated: TripProfile) => void }`. Internally it calls `buildProfile()` to map `TripProfile` fields into `TripField[]` entries for the Lovable rendering layer, and calls `onProfileChange` (via a `fieldsToProfile` reverse-mapper) whenever any field is edited.

`App.tsx` holds `pendingProfileOverride` state, set by `onProfileChange`. The chat send handler (`handleChatSend`) passes the pending override to `sendMessage` and clears it immediately after.

The `buildProfile(...)` call in `TripProfileComponent` is wrapped in `useMemo` with primitive and JSON-stringified array fields as explicit deps. This ensures the `fields` reference passed to `TripProfileInner` only changes when the server returns a genuinely updated `profile` (after a chat turn) — not on every parent re-render triggered by `pendingProfileOverride` state updates. `TripProfileInner`'s `useEffect(() => setState(fields), [fields])` therefore does not reset local editing state mid-edit.

### Backend

`ChatRequest` gains an optional `profile_override: Optional[TripProfile] = None` field. On every turn (not gated to turn 1), after the first-turn onboarding intake block, the override is applied field-by-field to `session.plan.trip_profile` before `run_turn()` is called. List fields are written only when non-empty; scalar fields when non-null and non-empty. The agent therefore sees the user's edited profile values on the same turn the edit is submitted.

### `vacation_type` migration

`models.py`: `vacation_type: List[str] = Field(default_factory=list)`.  
`types.ts`: `vacation_type: string[]`.  
`App.tsx` `defaultPlan`: `vacation_type: []`.  
`update_trip_profile` tool schema: `"vacation_type": { "type": ["array", "null"], "items": { "type": "string" } }`.  
`_sanitize_args()`: defensive coercion from bare string to single-item array if the model sends a scalar.  
`LandingScreen.tsx`: wraps the single captured value in `[value]` before writing to `onboardingProfile` in sessionStorage.

---

## 7. Known Gaps (Prompt / Behaviour)

The following issues were observed in testing. All are prompt or model behaviour problems — no code changes are required to reproduce or describe them. They are tracked here for Sprint 8 planning.

1. **Primary agent tool call failures**: The agent occasionally fails to emit a valid tool call and instead writes the tool invocation as prose in the chat response (observed during Trip Profile updates and candidate suggestion). This is a model generation failure under the current prompt. Frequency is low but non-zero.

2. **Backup agent uses markdown**: The fallback model produces markdown-formatted responses (headers, bold, bullet lists). The web app renders these as unstyled inline text. The backup agent's prompt does not currently include a markdown suppression instruction.

3. **Backup agent comparison matrix overwrite**: When the backup agent adds a row to the comparison matrix, it **sometimes** sends only the new row rather than the complete matrix — discarding previously generated rows. The `generate_comparison_matrix` tool description instructs the model to read current values from state and always send the complete matrix, but the backup agent is not following this instruction reliably. The history filtering introduced in Sprint 6 (which removed tool call history from the context window) was identified as a known risk for exactly this pattern.

4. **Backup agent exposes internal reasoning**: The backup agent occasionally writes its chain-of-thought or instruction text into the chat response, visible to the user.

---

## 8. Constraints Carried Forward

1. Flat JSON tool schemas only — no Pydantic schema generation for Groq tools; `additionalProperties` not used.
2. Dual-call conditional ReAct loop preserved.
3. Client owns `uiState.mode` — server responses must not override it.
4. Candidate upsert by `name.lower()` — never replace the full array; shortlisted names skipped; un-rejected candidates deleted from `session.plan.candidates`.
5. State JSON to LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`).
6. History is truncated, not summarised — `MAX_HISTORY_TURNS = 4`.
7. Tool names never appear in system prompt instructions.
8. Learning notebooks are not part of the build process.
9. Lovable components are visual references only — prop interfaces, data models, and functional logic are owned by the web app.

---

## 9. Directory Map (Post-Sprint 7)

```
vacation-planner/
├── docs/
│   ├── sprint-7-planning.md
│   ├── sprint-7-spec.md
│   └── sprint-7-result.md              ← THIS FILE
│
├── services/api/
│   └── agent/
│       ├── models.py                   Updated: vacation_type List[str]
│       ├── orchestrator.py             Updated: vacation_type tool schema; _sanitize_args coercion
│       ├── prompt.py                   Updated: vacation_type field description
│       └── session.py                  Unchanged
│
├── services/api/
│   └── main.py                         Updated: ChatRequest.profile_override field;
│                                       profile_override application block;
│                                       un-reject handler deletes candidate
│
└── apps/web/src/
    ├── index.css                       Rewritten: Tailwind v4 structure; @theme inline;
    │                                   CSS custom properties; pre-baked tokens removed
    ├── types.ts                        Updated: vacation_type string[]
    ├── App.tsx                         Updated: pendingProfileOverride state;
    │                                   handleChatSend; TripProfileComponent wired
    ├── lib/
    │   └── utils.ts                    Added: cn() helper (from lovable-ui)
    ├── components/
    │   ├── ui/                         Added: all shadcn/ui primitives from lovable-ui
    │   ├── CandidateCard.tsx           Updated: Lovable visual design; v4 tokens;
    │   │                               popover import via @/components/ui/popover
    │   ├── ShortlistCard.tsx           Updated: Lovable visual design; v4 tokens
    │   ├── RemovedTray.tsx             Updated: Lovable visual design; v4 tokens
    │   ├── CandidateArea.tsx           Updated: ShortlistBar and NotQuiteRightBar
    │   │                               visual design; v4 tokens
    │   ├── ChatInterface.tsx           Verified: no regressions post-migration
    │   ├── TripProfileComponent.tsx    Replaced: Lovable TripProfile.tsx design;
    │   │                               onProfileChange callback; fieldsToProfile helper;
    │   │                               vacation_type (was opts.vibe) corrected
    │   └── LandingScreen.tsx           Updated: vacation_type wrapped as single-item array
    └── hooks/
        └── useAgent.ts                 Updated: uiStateRef pattern; profileOverride
                                        parameter; profile_override in POST body
```
