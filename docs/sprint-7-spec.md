# Sprint 7 Implementation Spec: Stack Unification, Bug Fixes & Trip Profile Inline Editing

## 1. Executive Alignment

Sprint 7 delivers three sequential phases:

1. **Stack Unification** — migrate `apps/web` from Tailwind v3 to v4, replace all web component CSS with the Lovable visual design, and establish a single `components/ui/` import pattern.
2. **Bug Fixes** — fix the un-reject bug (candidate reappears immediately) and the stale `uiState` bug (agent receives previous turn's state when UI state changes just before send).
3. **Trip Profile Inline Editing** — migrate `vacation_type` to a list field, port the Lovable `TripProfile.tsx` visual design as the new `TripProfileComponent`, and wire edited profile values into the `POST /chat` payload.

**Critical rule for all component work**: Lovable components are **visual references only**. When porting a Lovable component, copy its CSS classes, layout structure, and JSX shape. Do **not** adopt its prop types or data model — the web app's existing prop types (`DestinationCandidate`, `comparisonMatrix`, etc.) are more mature and must be preserved. The Lovable components use simplified, hardcoded demo data. The web app uses live agent data. Only the visual output should match.

**Architectural constraints inherited from prior sprints — must not be violated:**
- Flat hand-written JSON tool schemas only; no `additionalProperties` in Groq tool schemas.
- Dual-call conditional ReAct loop preserved.
- Client owns `uiState.mode`. Server responses must not override it.
- Candidate upsert by `name.lower()` — never replace the full candidates array; shortlisted names skipped.
- State JSON sent to the LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`).
- Tool names never appear in system prompt instructions.
- Learning notebooks are not part of the build process.

---

## 2. Scope & Non-Goals

### In Scope

**Phase 1: Stack Unification**
- Tailwind v4 migration in `apps/web`
- `components/ui/` and `lib/utils.ts` copied from `lovable-ui`
- CSS in `CandidateCard`, `ShortlistCard`, `RemovedTray`, `CandidateArea` (including its `ShortlistBar` and `NotQuiteRightBar`) replaced with Lovable visual design
- `ChatInterface.tsx` verified and aligned after migration (it is already close to Lovable)

**Phase 2: Bug Fixes**
- Un-reject: delete candidate from `session.plan.candidates` instead of restoring to `suggested`
- Stale `uiState`: fix closure bug in `useAgent.ts` so `POST /chat` always reflects state at send time

**Phase 3: Trip Profile Inline Editing**
- `vacation_type` scalar → list migration across full stack
- `TripProfileComponent.tsx` replaced with Lovable `TripProfile.tsx` visual design
- `profile_override` field in `POST /chat`; backend applies to `session.plan.trip_profile` before orchestrator

### Non-Goals
- Multi-agent architecture (Sprint 8)
- Session persistence / Chat ID (Sprint 9)
- Debug Panel wiring, region-level analysis, "I already have destinations" entry (Sprint 10)
- Any backend changes beyond the un-reject fix, `vacation_type` migration, and `profile_override` field

---

## 3. Phase 1: Stack Unification

### 3.1 Tailwind v4 Migration

**[INSTALL]** In `apps/web`:

```
npm install tailwindcss@next @tailwindcss/vite tw-animate-css
npm uninstall tailwindcss autoprefixer postcss
```

**[MODIFY] `apps/web/vite.config.ts`** — replace the PostCSS-based Tailwind plugin with the native Vite plugin:

```ts
import tailwindcss from '@tailwindcss/vite'
// plugins: [react(), tailwindcss()]
```

**[DELETE]** `apps/web/tailwind.config.js` and `apps/web/postcss.config.js` (or `postcss.config.cjs`) — both files must be removed entirely.

**[REWRITE] `apps/web/src/index.css`**

Replace the full contents with the structure from `apps/lovable-ui/src/styles.css`, adapted for the web app (Google Fonts import added; `source(none)` / `@source` directives are Lovable-specific and must not be included):

```css
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700&display=swap");

@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: "Fraunces", ui-serif, Georgia, serif;
  --font-serif: "Fraunces", ui-serif, Georgia, serif;
  --font-display: "Fraunces", ui-serif, Georgia, serif;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-sand: var(--sand);
  --color-sand-deep: var(--sand-deep);
  --color-sun: var(--sun);
  --color-ocean: var(--ocean);
  --color-ocean-deep: var(--ocean-deep);
  --color-teal: var(--teal);
  --color-teal-soft: var(--teal-soft);
  --color-sage: var(--sage);
  --color-coral: var(--coral);
  --color-cream: var(--cream);
  --color-ink: var(--ink);
}

:root {
  --radius: 0.875rem;

  --cream:      oklch(0.985 0.012 85);
  --sand:       oklch(0.93  0.045 85);
  --sand-deep:  oklch(0.82  0.09  80);
  --sun:        oklch(0.84  0.14  78);
  --ocean:      oklch(0.62  0.12  230);
  --ocean-deep: oklch(0.42  0.11  235);
  --teal:       oklch(0.66  0.09  200);
  --teal-soft:  oklch(0.93  0.035 200);
  --sage:       oklch(0.78  0.06  155);
  --coral:      oklch(0.7   0.16  35);
  --ink:        oklch(0.22  0.025 240);

  --background: oklch(0.99 0.006 85);
  --foreground: var(--ink);
  --card: oklch(1 0 0);
  --card-foreground: var(--ink);
  --popover: oklch(1 0 0);
  --popover-foreground: var(--ink);
  --primary: var(--ocean-deep);
  --primary-foreground: oklch(0.99 0.006 85);
  --secondary: var(--teal-soft);
  --secondary-foreground: var(--ocean-deep);
  --muted: oklch(0.96 0.012 80);
  --muted-foreground: oklch(0.5 0.025 240);
  --accent: var(--sun);
  --accent-foreground: var(--ink);
  --destructive: oklch(0.58 0.2 25);
  --destructive-foreground: oklch(0.99 0 0);
  --border: oklch(0.9 0.018 80);
  --input: oklch(0.9 0.018 80);
  --ring: var(--ocean);

  --shadow-card: 0 1px 2px oklch(0.4 0.05 240 / 0.04), 0 8px 24px oklch(0.4 0.08 240 / 0.06);
  --shadow-soft: 0 1px 2px oklch(0.4 0.05 240 / 0.05), 0 12px 32px oklch(0.4 0.08 240 / 0.08);
}

@layer base {
  * {
    border-color: var(--color-border);
  }
  html, body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    font-feature-settings: "ss01", "ss02";
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3, h4 {
    font-family: var(--font-display);
    letter-spacing: -0.02em;
  }
}

@utility shadow-card {
  box-shadow: var(--shadow-card);
}
@utility shadow-soft {
  box-shadow: var(--shadow-soft);
}
@utility animate-fade-in {
  animation: fade-in 0.35s ease both;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

In Tailwind v4, `bg-cream`, `bg-ocean-deep`, `text-muted-foreground`, etc. are generated automatically from `--color-*` variables in `@theme inline`. The old `@layer utilities` hand-written classes are removed. `shadow-card`, `shadow-soft`, and `animate-fade-in` are re-declared as `@utility` classes (the v4 equivalent).

**Pre-baked alpha token replacement table** — every occurrence of the following classes must be replaced across all component files before this phase is complete. After migration, none of these old names should remain in `apps/web/src/`:

| Old class (v3 workaround) | v4 replacement | Files |
|---|---|---|
| `bg-cream-overlay` | `bg-cream/90` | `CandidateCard.tsx`, `ShortlistCard.tsx` |
| `bg-sage-bg` | `bg-sage/25` | `ShortlistCard.tsx` |
| `bg-sun-bg-soft` | `bg-sun/15` | `ShortlistCard.tsx` |
| `bg-sun-badge` | `bg-sun/25` | `LandingScreen.tsx` |
| `bg-cream-soft` | `bg-cream/50` | `ShortlistCard.tsx` |
| `bg-teal-soft-muted` | `bg-teal-soft/60` | `CandidateArea.tsx` |
| `hover:bg-teal-soft-hover` | `hover:bg-teal-soft/80` | `LandingScreen.tsx` |
| `bg-ocean-deep-bg` | `bg-ocean-deep/10` | `CandidateArea.tsx` |
| `hover:bg-ocean-deep-dim` | `hover:bg-ocean` | `CandidateCard.tsx` |
| `border-ocean-deep-border` | `border-ocean-deep/15` | `CandidateCard.tsx`, `LandingScreen.tsx` |
| `ring-ocean-ring` | `ring-ocean/20` | `LandingScreen.tsx` |
| `from-sun-glow` | `from-sun/30` | `ShortlistCard.tsx` |
| `via-coral-glow` | `via-coral/15` | `ShortlistCard.tsx` |
| `bg-card-wash` | `bg-card/60` | `LandingScreen.tsx` |
| `bg-muted-soft` | `bg-muted/40` | `CandidateArea.tsx`, `LandingScreen.tsx` |
| `bg-destructive-bg` | `bg-destructive/10` | `CandidateArea.tsx` |

### 3.2 Copy `components/ui/` Primitives and `lib/utils.ts`

**[COPY]** All files from `apps/lovable-ui/src/components/ui/` → `apps/web/src/components/ui/` (create the directory if it does not exist).

**[COPY]** `apps/lovable-ui/src/lib/utils.ts` → `apps/web/src/lib/utils.ts` (the `cn()` helper the shadcn primitives depend on).

**[MODIFY] `apps/web/src/components/CandidateCard.tsx`** — update the Radix direct import to use the wrapper:

```ts
// Remove:
import { Popover, PopoverContent, PopoverTrigger } from '@radix-ui/react-popover';
// Add:
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
```

No other Radix direct imports should remain anywhere in `apps/web/src/` after this step. Run a grep to verify: `grep -r "@radix-ui" apps/web/src/` should return no results.

### 3.3 Replace Web Component CSS with Lovable Visual Design

For each component: apply the Lovable component's CSS classes, layout structure, and JSX shape. The web app's prop interfaces, state management, and functional logic are preserved exactly.

#### [MODIFY] `apps/web/src/components/CandidateCard.tsx`

Prop interface unchanged:
```ts
interface CandidateCardProps {
  candidate: DestinationCandidate;
  isInShortlist: boolean;
  shortlistFull: boolean;
  onTellMeMore: () => void;
  onAddToShortlist: () => void;
  onReject: (reason: RejectReason) => void;
}
```

CSS changes to apply from Lovable:
- Article: `rounded-3xl border border-border/70 bg-card shadow-card transition hover:shadow-soft` — already correct; verify class order matches.
- Region badge: `bg-cream/90` (was `bg-cream-overlay`).
- Reject X button: Lovable has no `opacity-0 group-hover:opacity-100` — the button is always visible. Remove the opacity/group-hover hiding. CSS: `absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-cream/90 text-ocean-deep/70 backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground`.
- Popover import: `@/components/ui/popover` (done in §3.2).
- **Shortlist state gap in Lovable** (see §8): Lovable does not design a shortlisted state for this card. Keep the existing web app logic: when `isInShortlist === true`, show the "✓ Shortlisted" badge in place of the reject button and render the shortlist button in its filled state. The button's three visual states use v4 class syntax only:
  - In shortlist: `bg-ocean-deep text-primary-foreground shadow-card hover:bg-ocean`
  - Shortlist full: `border-border bg-muted text-muted-foreground/60 cursor-not-allowed`
  - Default: `border-ocean-deep/15 bg-cream text-ocean-deep hover:bg-ocean-deep hover:text-primary-foreground`

#### [MODIFY] `apps/web/src/components/ShortlistCard.tsx`

See §8 for the full before/after comparison of this component vs the Lovable version. The visual structure is already close — the changes are CSS token names only.

Prop interface unchanged:
```ts
interface ShortlistCardProps {
  candidate: DestinationCandidate;
  comparisonMatrix: Record<string, string>[] | null;
  isEnriching: boolean;
  onSelectWinner: () => void;
  winner?: boolean;
}
```

CSS changes to apply from Lovable:
- Region badge: `bg-cream/90` (was `bg-cream-overlay`).
- Best-for box: `bg-sage/25` (was `bg-sage-bg`).
- Seasonal note box: `bg-sun/15` (was `bg-sun-bg-soft`). Keep the **dynamic** label "In season:" — do not use Lovable's hardcoded `"In September:"`. See §8.
- Comparison rows table: `bg-cream/50` (was `bg-cream-soft`).
- Winner gradient: `from-sun/30 via-coral/15 to-teal-soft` (was `from-sun-glow via-coral-glow to-teal-soft`).
- Keep `getIconForCriterion()` — it dynamically assigns icons to whatever criterion labels the agent generates. Do not replace it with Lovable's `defaultRows()` which requires a fixed set of labels.
- Keep the `isEnriching` skeleton row behaviour — equivalent to Lovable's per-row `exploring?: boolean` pattern.

#### [MODIFY] `apps/web/src/components/RemovedTray.tsx`

The `RemovedTray` exported from `apps/lovable-ui/src/components/CandidateCard.tsx` is the visual reference.

Prop interface unchanged:
```ts
interface RemovedTrayProps {
  items: RejectedCandidate[];
  onUnremove: (name: string) => void;
}
```

Apply Lovable's CSS: `rounded-2xl border border-border/70 bg-card/60 shadow-card` on the container; pill styling `rounded-full border border-border/70 bg-cream` on each item. Functional behaviour (collapsed by default, toggle, RotateCcw un-remove button) is unchanged.

#### [MODIFY] `apps/web/src/components/CandidateArea.tsx` — `ShortlistBar` and `NotQuiteRightBar`

`CandidateArea.tsx` is a web app-specific orchestrator with no Lovable equivalent. Only its two local sub-components need visual updates:

**`ShortlistBar`** — apply Lovable's CSS from `CandidateCard.tsx`'s `ShortlistBar` export:
- Empty slots: `bg-muted/40` (was `bg-muted-soft`).
- Remove button hover: `hover:bg-destructive/10 hover:text-destructive` (was `hover:bg-destructive-bg hover:text-destructive`).
- Prop interface and functional logic unchanged.

**`NotQuiteRightBar`** — apply Lovable's CSS from `CandidateCard.tsx`'s `ShortlistBar variant="find-others"` export:
- Reconsider option background: `bg-teal-soft/60` (was `bg-teal-soft-muted`).
- Prop interface and functional logic unchanged.

**Explore mode DECIDED badge** (in the `decision` branch of `CandidateArea.tsx`):
- Badge background: `bg-ocean-deep/15` (was `bg-ocean-deep-bg`).

#### [VERIFY] `apps/web/src/components/ChatInterface.tsx`

The current `ChatInterface.tsx` is already visually close to the Lovable `ChatPanel.tsx`. After the Tailwind v4 migration, verify it renders correctly. Make only the CSS adjustments necessary to restore parity if the migration breaks anything. Do not restructure or simplify the component — it has live input state and scroll behaviour that Lovable's static mockup does not.

---

## 4. Phase 2: Bug Fixes

### 4.1 Un-reject Removes Candidate from Plan

**Root cause**: `main.py`'s rejection reconciliation loop sets `candidate.status = "suggested"` when a candidate is removed from the incoming `rejected_candidates` list. This immediately makes it visible in the grid.

**[MODIFY] `services/api/main.py`** — in the rejection reconciliation block (after the shortlist sync, runs on every `POST /chat`):

Replace the else-branch that restores `status = "suggested"` with a deletion approach:

```python
if request.ui_state.rejected_candidates:
    rejected_lower = {r.name.lower(): r.reason for r in request.ui_state.rejected_candidates}
    candidates_to_remove = []
    for candidate in session.plan.candidates:
        key = candidate.name.lower().strip()
        if key in rejected_lower and candidate.status != "shortlisted":
            candidate.status = "rejected"
            candidate.rejection_reason = rejected_lower[key]
        elif candidate.status == "rejected" and key not in rejected_lower:
            # Un-rejected: remove from plan entirely so the agent must re-suggest
            candidates_to_remove.append(candidate)
    for c in candidates_to_remove:
        session.plan.candidates.remove(c)
else:
    # Empty list = clear all rejected; remove them from the plan
    session.plan.candidates = [
        c for c in session.plan.candidates if c.status != "rejected"
    ]
```

A removed candidate can only reappear if the agent actively calls `suggest_candidates` and includes it again. The agent, seeing fewer than 3 active suggested candidates, will naturally re-suggest.

### 4.2 Stale `uiState` on Send

**Root cause (confirmed)**: `sendMessage` in `useAgent.ts` is a `const` defined inside the hook body. It captures `uiState` by closure at the time of the last render. When `App.tsx` calls `updateUiState(...)` and then immediately calls `sendMessage(...)` in the same event handler — as happens in `handleTellMeMore`, `handleFindOthers`, `handleBackToShortlist`, and `handleRejectCandidate` — React has queued the state update but not yet re-rendered. `sendMessage`'s closure still holds the previous `uiState`.

The existing workaround (`overrideUiState` parameter in `handleCompareShortlist`, `handleSelectWinner`) was added precisely because this bug was known. The fix makes the workaround unnecessary for most paths.

**[MODIFY] `apps/web/src/hooks/useAgent.ts`**

Add a `useRef` that is kept in sync with `uiState` on every render, then read from the ref inside `sendMessage` rather than from the stale closure:

```ts
import { useState, useRef } from 'react';

// Inside useAgent():
const [uiState, setUiState] = useState<UiState>({
    mode: 'explore',
    shortlist: [],
    selected_winner: null,
    rejected_candidates: [],
});

// Ref always holds the latest committed uiState value — safe to read from async callbacks
const uiStateRef = useRef<UiState>(uiState);
uiStateRef.current = uiState;  // runs synchronously on every render

const sendMessage = async (
    content: string,
    overrideUiState?: UiState,
    rejectedCandidates: RejectedCandidate[] = [],
    onboardingProfile?: TripProfile,
) => {
    const stateToSend = overrideUiState ?? uiStateRef.current;  // ref, not closure
    // ... rest unchanged
```

The explicit `overrideUiState` parameter in `handleCompareShortlist` and `handleSelectWinner` continues to work correctly — it overrides the ref when provided, which is appropriate for mode-transition sends where the caller has already computed the exact intended state.

---

## 5. Phase 3: Trip Profile Inline Editing

### 5.1 Migrate `vacation_type` to `List[str]` / `string[]`

**[MODIFY] `services/api/agent/models.py`**

```python
# Before:
vacation_type: Optional[str] = None

# After:
vacation_type: List[str] = Field(default_factory=list)
```

**[MODIFY] `services/api/agent/orchestrator.py`** — `update_trip_profile` tool schema

```json
// Before:
"vacation_type": { "type": ["string", "null"] }

// After:
"vacation_type": { "type": ["array", "null"], "items": { "type": "string" } }
```

Also update `_sanitize_args()` to handle the case where the model sends `vacation_type` as a bare string (defensive coercion):

```python
# In _sanitize_args, after the existing null-stripping:
if "vacation_type" in args and isinstance(args["vacation_type"], str):
    args["vacation_type"] = [args["vacation_type"]] if args["vacation_type"] else []
```

**[MODIFY] `services/api/agent/prompt.py`**

Update the `vacation_type` field description in the system prompt to reflect list semantics, e.g.: `"vacation_type: list of vacation style descriptors (e.g. ['beach', 'adventure', 'city break'])"`.

**[MODIFY] `apps/web/src/types.ts`**

```ts
// Before:
vacation_type: string | null;

// After:
vacation_type: string[];
```

**[MODIFY] `apps/web/src/App.tsx`** — `defaultPlan`:

```ts
vacation_type: [],  // was: null
```

**[MODIFY] `apps/web/src/components/LandingScreen.tsx`**

The sentence builder captures `vacation_type` as a single text value. The input mechanism does not change. On submit, wrap the value in a single-item array:

```ts
// In the sessionStorage.setItem('onboardingProfile', ...) call:
vacation_type: currentProfile.vacation_type ? [currentProfile.vacation_type] : []
```

Update `currentProfile`'s local type to use `string[]` for `vacation_type`.

### 5.2 Port Lovable `TripProfile.tsx` Visual Design

**[REPLACE] `apps/web/src/components/TripProfileComponent.tsx`**

Copy the full implementation from `apps/lovable-ui/src/components/TripProfile.tsx` — `buildProfile`, `TripProfile`, `EditableField`, `ScalarEditor`, `ArrayEditor`, `toChips`, and the `accentBg` map. These are all correct and complete; do not simplify or omit any part.

**Prop interface**: Keep the existing call site in `App.tsx` (`<TripProfileComponent profile={currentPlan.trip_profile} />`). The new component should accept `{ profile: TripProfile; onProfileChange?: (updated: TripProfile) => void }` and compute `fields` internally:

```tsx
export function TripProfileComponent({
  profile,
  onProfileChange,
}: {
  profile: TripProfile;
  onProfileChange?: (updated: TripProfile) => void;
}) {
  const fields = buildProfile({
    origin: profile.origin ?? undefined,
    travelers: profile.travelers ?? undefined,
    when: profile.when ?? undefined,
    duration: profile.duration ?? undefined,
    budget: profile.budget ?? undefined,
    vacation_type: profile.vacation_type,   // string[] — toChips handles arrays directly
    likes: profile.likes,
    avoid: profile.avoid,
  });

  // Pass fields into TripProfile (Lovable component, renamed internally):
  return <TripProfileInner fields={fields} onFieldChange={...} />;
}
```

The internal Lovable component (`TripProfile` in the Lovable source) can be renamed `TripProfileInner` or kept as `TripProfile` — whichever avoids a name collision with the `TripProfile` Pydantic model name that only exists on the backend. The export from this file remains `TripProfileComponent`.

**`opts.vibe` naming fix**: In `buildProfile`, rename the Lovable error:

```ts
// Change from (Lovable source):
arr("vibe", <Sun className="size-3.5" />, "Vacation type & vibe", toChips(opts.vibe), "sun"),

// To (correct):
arr("vacation_type", <Sun className="size-3.5" />, "Vacation type & vibe", toChips(opts.vacation_type), "sun"),
```

**`onProfileChange` callback**: When a field is edited, call `onProfileChange` with the full updated profile. Add a `fieldsToProfile` helper:

```ts
function fieldsToProfile(fields: TripField[]): TripProfile {
  const get = (key: string) => fields.find((f) => f.key === key);
  const scalar = (key: string): string | null => {
    const f = get(key);
    return f?.set && f.value && f.value !== 'not set' ? f.value : null;
  };
  const arr = (key: string): string[] => get(key)?.chips ?? [];
  return {
    origin: scalar('origin'),
    travelers: scalar('travelers'),
    when: scalar('when'),
    duration: scalar('duration'),
    budget: scalar('budget'),
    vacation_type: arr('vacation_type'),
    likes: arr('likes'),
    avoid: arr('avoid'),
  };
}
```

Call it inside the `update` function whenever a field changes:

```ts
const update = (key: string, patch: Partial<TripField>) => {
  setState((prev) => {
    const next = prev.map((f) => { /* existing logic */ });
    onProfileChange?.(fieldsToProfile(next));
    return next;
  });
};
```

### 5.3 Wire Profile Edits into `POST /chat` Payload

**[MODIFY] `apps/web/src/App.tsx`**

Add state to hold pending profile edits:

```tsx
const [pendingProfileOverride, setPendingProfileOverride] = useState<TripProfile | null>(null);
```

Wire into `TripProfileComponent`:

```tsx
<TripProfileComponent
  profile={currentPlan.trip_profile}
  onProfileChange={setPendingProfileOverride}
/>
```

Update the chat send call site. Currently `App.tsx` passes `onSendMessage={(msg) => sendMessage(msg, undefined, rejectedCandidates)}` to `ChatInterface`. Replace with a handler that includes the pending override and clears it:

```tsx
const handleChatSend = (msg: string) => {
  sendMessage(msg, undefined, rejectedCandidates, undefined, pendingProfileOverride);
  setPendingProfileOverride(null);
};
```

Pass `handleChatSend` to `ChatInterface` as `onSendMessage`. Mode-transition sends (`handleCompareShortlist`, `handleSelectWinner`, `handleFindOthers`, `handleBackToShortlist`) may optionally include `pendingProfileOverride` — include it where it is safe to do so, and clear it afterward.

**[MODIFY] `apps/web/src/hooks/useAgent.ts`**

Add a fifth optional parameter and include `profile_override` in the POST body:

```ts
const sendMessage = async (
    content: string,
    overrideUiState?: UiState,
    rejectedCandidates: RejectedCandidate[] = [],
    onboardingProfile?: TripProfile,
    profileOverride?: TripProfile | null,
) => {
    // ...
    body: JSON.stringify({
        message: content,
        session_id: sessionId,
        ui_state: { ...stateToSend, rejected_candidates: rejectedCandidates },
        onboarding_profile: onboardingProfile ?? null,
        profile_override: profileOverride ?? null,
    }),
```

**[MODIFY] `services/api/main.py`**

Add `profile_override` to `ChatRequest`:

```python
class ChatRequest(BaseModel):
    message: str
    session_id: str
    ui_state: Optional[UiState] = None
    onboarding_profile: Optional[TripProfile] = None
    profile_override: Optional[TripProfile] = None  # NEW
```

Apply `profile_override` on every turn (not gated to turn 1 — unlike `onboarding_profile`), immediately after the turn-1 intake bypass block:

```python
if request.profile_override:
    incoming = request.profile_override.model_dump(exclude_none=True)
    for field, value in incoming.items():
        if isinstance(value, list):
            if len(value) > 0:
                setattr(session.plan.trip_profile, field, value)
        elif value not in (None, ""):
            setattr(session.plan.trip_profile, field, value)
```

List fields (`vacation_type`, `likes`, `avoid`) are only overwritten when non-empty, preserving the pattern established by `_sanitize_args`. Scalar fields are overwritten when non-null and non-empty. This runs before `run_turn()`, so the agent sees the user's edited values on the same turn the edit is submitted.

---

## 6. Task Breakdown

### Phase 1: Stack Unification
- [ ] **1.1** — Install Tailwind v4 packages; update `vite.config.ts`; delete `tailwind.config.js` and `postcss.config.js`
- [ ] **1.2** — Rewrite `index.css` with v4 structure (matching Lovable `styles.css` template)
- [ ] **1.3** — Copy all `components/ui/` files and `lib/utils.ts` from `lovable-ui`; update `CandidateCard.tsx` popover import
- [ ] **1.4** — Replace `CandidateCard.tsx` CSS with Lovable design; remove opacity-hide from reject button; update all pre-baked token references; keep `isInShortlist` logic
- [ ] **1.5** — Replace `ShortlistCard.tsx` CSS with Lovable design; update pre-baked token references; keep dynamic season label and `getIconForCriterion`
- [ ] **1.6** — Replace `RemovedTray.tsx` CSS with Lovable design
- [ ] **1.7** — Update `ShortlistBar` and `NotQuiteRightBar` CSS in `CandidateArea.tsx`; update DECIDED badge token
- [ ] **1.8** — Verify `ChatInterface.tsx` renders correctly after migration; fix any regressions
- [ ] **1.9** — Visual smoke-test of all four views (Landing, Explore, Compare, Decision)

### Phase 2: Bug Fixes
- [ ] **2.1** — `main.py`: un-reject handler deletes candidate from `session.plan.candidates`
- [ ] **2.2** — `useAgent.ts`: add `uiStateRef`; replace closure-captured `uiState` with ref read in `sendMessage`

### Phase 3: Trip Profile Inline Editing
- [ ] **3.1** — `models.py`: `vacation_type: List[str]`; `orchestrator.py`: tool schema + `_sanitize_args` coercion; `prompt.py`: field description
- [ ] **3.2** — `types.ts`: `vacation_type: string[]`; `App.tsx` `defaultPlan`; `LandingScreen.tsx` single-value → array wrap
- [ ] **3.3** — Replace `TripProfileComponent.tsx` with Lovable visual design; fix `opts.vibe` → `opts.vacation_type`; add `onProfileChange` callback and `fieldsToProfile` helper
- [ ] **3.4** — `App.tsx`: add `pendingProfileOverride` state; wire `onProfileChange`; update `handleChatSend`; clear override after send
- [ ] **3.5** — `useAgent.ts`: add `profileOverride` parameter; include `profile_override` in POST body
- [ ] **3.6** — `main.py`: add `profile_override` to `ChatRequest`; apply to `session.plan.trip_profile` before orchestrator

---

## 7. Verification Plan

### Phase 1
1. Run `npm run dev` in `apps/web`. Confirm no build errors.
2. Landing screen renders correctly. Start a session.
3. Explore mode: hover a candidate — confirm the reject X button is visible (not hidden until hover). Reject a card — confirm popover opens. Add to shortlist — confirm "In shortlist" button state and "✓ Shortlisted" badge appear. Confirm no console CSS errors.
4. Compare mode: shortlist 2+ cards and trigger compare. Confirm ShortlistCards render with comparison matrix rows and correct icons. Confirm skeleton rows appear while `isEnriching`.
5. Decision mode: confirm winner card renders with gradient banner and correct CSS.
6. Confirm `grep -r "@radix-ui" apps/web/src/` returns no results.
7. Confirm the following grep returns no results — if it does, a pre-baked token was missed: `grep -r "bg-cream-overlay\|bg-sage-bg\|bg-sun-bg-soft\|bg-sun-badge\|bg-cream-soft\|bg-teal-soft-muted\|teal-soft-hover\|bg-ocean-deep-bg\|bg-muted-soft\|bg-destructive-bg\|sun-glow\|coral-glow\|ocean-deep-dim\|ocean-deep-border\|ocean-ring\|bg-card-wash" apps/web/src/`

### Phase 2
8. Un-reject: reject a candidate. Un-reject it from the Removed tray. Confirm it disappears from the tray and does NOT reappear in the candidate grid. Send a message. Confirm the agent re-suggests it if it fits the profile (verify via server logs: `suggest_candidates` is called and the candidate may be nominated).
9. Stale state: shortlist Westfjords and immediately send "compare my shortlist". Confirm the agent's response includes Westfjords. (Reproduces the Sprint 6 symptom from the planning doc — should no longer occur.)

### Phase 3
10. Open Trip Profile panel. Click any scalar chip (e.g., Budget). Confirm popover opens with pre-filled value. Edit and press Enter — confirm chip updates immediately without sending a message.
11. Click a chip array field (e.g., Things we like). Add an item. Confirm chip appears. Send a chat message. Inspect network payload — confirm `profile_override` includes the edited field. Confirm agent's response reflects the update.
12. Click Vacation type & vibe. Confirm it opens as an array editor (not a scalar input). Add two values. Confirm both appear as chips.
13. Fresh session: fill out landing screen with a vacation type. Confirm first `POST /chat` body has `onboarding_profile.vacation_type` as a single-item array, not a string.
14. Start session, edit Budget to "Luxury" in the Trip Profile, then send "show me better options". Confirm `profile_override.budget === "Luxury"` in the network request. Confirm backend logs show the profile was updated before the orchestrator ran.

---

## 8. ShortlistCard: Current Web vs Lovable — Comparison & Lovable Feedback

This section documents the differences the PM asked about, and identifies what should be sent back to Lovable.

### What's the same

The current `apps/web/src/components/ShortlistCard.tsx` and the Lovable `ShortlistCard.tsx` have the same visual structure and purpose: a per-destination detail card used in the Compare and Decision views, with a photo, region badge, vibe box, best-for box, seasonal note box, a table of comparison rows, and a winner/choose button. The icon set for comparison rows is identical.

### What's different

| Dimension | Current web app | Lovable |
|---|---|---|
| **CSS tokens** | Pre-baked alpha tokens (`bg-cream-overlay`, `bg-sage-bg`, `bg-sun-bg-soft`, `bg-cream-soft`, `from-sun-glow`, `via-coral-glow`) | v4 opacity modifiers (`bg-cream/90`, `bg-sage/25`, `bg-sun/15`, `bg-cream/50`, `from-sun/30`, `via-coral/15`) |
| **Prop interface** | `candidate: DestinationCandidate`, `comparisonMatrix`, `isEnriching` | `s: Shortlist` with pre-built `rows: DetailRow[]` — demo interface |
| **Row data source** | `comparisonMatrix: Record<string, string>[]` — dynamic, agent-generated | `rows: DetailRow[]` — hardcoded in demo routes |
| **Row icon assignment** | `getIconForCriterion(criterion)` — maps any string label to an icon | Icons assigned at row-construction time in `defaultRows()` — fixed label set |
| **Loading state** | `isEnriching: boolean` on the whole card — shows skeleton rows when true | `exploring?: boolean` per row — more granular |
| **Season note label** | `"In season:"` — generic, correct | `"In September:"` — **hardcoded placeholder** |

The CSS differences are resolved entirely by the Tailwind v4 migration (§3.1). The prop interface, row data source, and loading state remain as the web app has them — they are more mature. No structural rewrite of `ShortlistCard.tsx` is needed.

### What to send back to Lovable

**Issue 1 — `ShortlistCard.tsx`: season note is hardcoded**

```tsx
// Current Lovable source (incorrect):
<span className="font-medium">In September: </span>

// Should be dynamic — either a prop:
<span className="font-medium">{seasonLabel ?? "In season:"} </span>
// Or simply remove the label prefix and let the content carry the context.
```

The web app uses "In season:" which is correct. Lovable should fix "In September:" to accept a dynamic label or remove the hardcoded month.

**Issue 2 — `CandidateCard.tsx`: no shortlisted state designed**

The Lovable `CandidateCard` has no visual state for when a destination is on the user's shortlist. In the live app, once shortlisted:
- The reject X button is replaced by a "✓ Shortlisted" badge in the top-right corner
- The "Add to shortlist" button changes to a filled/active "In shortlist" state

Neither state appears in the Lovable design. Until Lovable adds them, the web app keeps the existing implementation for these two states (with v4 CSS classes only).

---

## 9. Constraints Carried Forward into Sprint 8

1. Flat JSON tool schemas only — no Pydantic schema generation for Groq tools; `additionalProperties` not used.
2. Dual-call conditional ReAct loop preserved.
3. Client owns `uiState.mode` — server responses must not override it.
4. Candidate upsert by `name.lower()` — never replace the full array; shortlisted names skipped; un-rejected candidates are deleted from `session.plan.candidates` (not restored to `suggested`).
5. State JSON to LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`).
6. History is truncated, not summarised — `MAX_HISTORY_TURNS = 4`.
7. Tool names never appear in system prompt instructions.
8. Learning notebooks are not part of the build process.
9. Lovable components are visual references only — prop interfaces, data models, and functional logic are owned by the web app.
