# Sprint 5 Implementation Spec: Candidate Rejection & UI Polish

## 1. Executive Alignment

Sprint 5 fixes two concrete problems discovered in user testing:

1. **The UI caps useful exploration at 6 cards.** The agent keeps improving its suggestions as the trip profile fills in, but once 6 candidate cards are shown they cannot be cleared. New suggestions are generated but invisible. The fix is a user-controlled reject flow that clears unwanted cards and signals the agent to replace them.

2. **The UI diverges from the Lovable reference design.** Font mappings, color tokens, and the Trip Profile array display are all slightly off. These are correctable with targeted CSS and component changes.

**Sprint Goal**: Enable users to reject candidates via UI, sync that state to the backend, and align the visual presentation with the Lovable reference design.

**Architectural constraints inherited from prior sprints — must not be violated:**

- Flat hand-written JSON tool schemas only. No Pydantic schema auto-generation for Groq tools.
- Dual-call conditional ReAct loop preserved. Do not remove the second LLM call when tools are used.
- Client owns `uiState.mode`. Server responses must not override it.
- Candidate upsert by `name.lower()`. Never replace the full candidates array.
- Learning notebooks are not part of the build process.

---

## 2. Scope & Non-Goals

### In Scope

**Phase 1: UI & Style Fixes**
- Font mapping alignment with the Lovable reference (`font-sans` → Inter in Tailwind config)
- Missing semantic CSS utility tokens added to `index.css`
- Hardcoded generic color classes replaced with semantic tokens in components
- `TripProfileComponent.tsx` array fields rendered as wrapping chip tags, not a joined string
- Backend null-parameter sanitization in `_apply_tool_call`

**Phase 2: Candidate Rejection**
- Reject button (✕) on candidate cards with a reason-chip popover
- Optimistic local hiding of rejected cards (no backend call required)
- Undo toast for misclick recovery
- Collapsible "Removed (N)" tray below the candidate grid
- "Un-remove" clears the rejection flag — does **not** re-insert the card
- `ui_state` payload extended to carry `rejected_candidates` array
- Backend state reconciliation of rejected candidates into `VacationPlan`
- System prompt updated with a `Rejected Destinations` section
- Orchestrator dynamic candidate-count check updated to account for rejected status

### Non-Goals

- Conversational history pruning (Sprint 6)
- Initial intake bypass / direct `TripProfile` injection from Landing Screen (Sprint 6)
- Direct profile editing (Sprint 6)
- Observability harness (Sprint 6)
- Multi-agent architecture (Sprint 7)
- Session persistence / Chat ID (Sprint 8)

---

## 3. Phase 1: UI & Style Fixes

### 3.1 Root Cause: Font Divergence

The Lovable reference (`apps/lovable-ui/src/styles.css`) sets:

```css
--font-sans: "Fraunces", ui-serif, Georgia, serif;
```

This means every Tailwind `font-sans` class in the Lovable design renders in **Fraunces** (a serif). In `apps/web`, the body is set to Inter via the base layer, but Tailwind's `fontFamily.sans` is not customised in `tailwind.config.js`. When components use `font-sans` utilities, they fall back to the system sans-serif (not Inter).

The intended alignment: **body text and UI elements use Inter; headings and display text use Fraunces.** The fix is to make `font-sans` reliably resolve to Inter in `apps/web`.

### 3.2 Root Cause: Missing Semantic Utility Tokens

`TripProfileComponent.tsx` references `bg-ocean-bg`, `bg-sun-bg`, `bg-sage-bg`, `bg-coral-bg` — pre-baked alpha variants of the palette colours. These are intended to exist in `tailwind.config.js` but may not all be present. Several components also hardcode `text-white`, `bg-white`, and `text-gray-*` instead of using the design token equivalents.

### 3.3 Changes Required

#### [MODIFY] `apps/web/tailwind.config.js`

Extend `theme.fontFamily` to map `sans` to `["Inter", "system-ui", "-apple-system", "sans-serif"]`. This ensures every Tailwind `font-sans` class in the web app renders Inter reliably.

Verify that `ocean-bg`, `sun-bg`, `sage-bg`, `coral-bg`, `teal-soft-muted`, `muted-soft`, `destructive-bg`, and `ocean-deep-bg` are all present as named colours in the Tailwind config so they resolve correctly in component class strings. Add any that are missing with these values:

```js
colors: {
  'ocean-bg':        'oklch(0.62 0.12 230 / 0.1)',
  'sun-bg':          'oklch(0.84 0.14 78 / 0.2)',
  'sage-bg':         'oklch(0.78 0.06 155 / 0.25)',
  'coral-bg':        'oklch(0.7 0.16 35 / 0.15)',
  'teal-soft-muted': 'oklch(0.93 0.035 200 / 0.6)',
  'muted-soft':      'oklch(0.96 0.012 80 / 0.5)',
  'destructive-bg':  'oklch(0.58 0.2 25 / 0.1)',
  'ocean-deep-bg':   'oklch(0.42 0.11 235 / 0.1)',
}
```

#### [MODIFY] `apps/web/src/index.css`

Add any remaining missing utility classes to `@layer utilities`. Cross-reference with what `TripProfileComponent.tsx` and `CandidateArea.tsx` reference at runtime.

#### [MODIFY] `apps/web/src/components/TripProfileComponent.tsx`

**Current behaviour**: Array fields (`likes`, `avoid`) are joined as a single comma-separated string and displayed with `truncate`, causing overflow and clipping when more than ~3 items are present.

**Required behaviour**: Each item in the array is rendered as an individual chip inside a `flex flex-wrap` container. Chips use the same visual treatment as the `RemovedTray` pills in the Lovable design:

```tsx
<div className="flex flex-wrap gap-1.5 mt-0.5">
  {arr.map((item) => (
    <span
      key={item}
      className="rounded-full bg-cream px-2 py-0.5 font-sans text-[12px] font-medium text-foreground/80"
    >
      {item}
    </span>
  ))}
</div>
```

The `truncate` class must be removed from the value cell in the bottom-row fields (`vacation_type`, `Things we like`, `Let's avoid`). The top-row scalar fields (Origin, Travelers, When, Duration, Budget) retain their single-line `truncate` layout.

#### [MODIFY] Component hardcoded color sweep

Audit and replace hardcoded generic utilities across `apps/web/src/components/`:

| Hardcoded class | Replace with |
|---|---|
| `text-white` | `text-primary-foreground` |
| `bg-white` | `bg-card` |
| `text-gray-500` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground/70` |
| `bg-gray-100` | `bg-muted` |
| `border-gray-200` | `border-border` |

This sweep should cover `CandidateCard.tsx`, `ShortlistCard.tsx`, `ChatInterface.tsx`, `LandingScreen.tsx`. Do not touch prototype components.

---

## 4. Phase 2: Candidate Rejection

### 4.1 User Flow

```
User hovers a non-shortlisted CandidateCard
  → ✕ button appears (top-right corner of card image)
  → User clicks ✕
  → Popover opens (anchored end-right, w-60)
    → Label: "Why remove?"
    → 4 chips: "Been there" | "Too far" | "Not my vibe" | "Other"
  → User clicks a chip
    → Popover closes
    → Card immediately hides from grid (optimistic local update)
    → Card moves to RemovedTray (collapsible below grid)
    → Sonner toast fires: "Removed [Name]" + "Undo" action (instant recovery)
  → On the user's NEXT chat message:
    → ui_state.rejected_candidates carries the full list of rejections
    → Backend marks candidates as status = "rejected" in VacationPlan
    → System prompt shows agent the rejected list
    → Agent observes fewer than 3 active suggested candidates → calls suggest_candidates
```

**What does NOT happen:**
- No automatic chat message is sent when a card is rejected
- No background API request is triggered
- No card is auto-reinserted when "Un-remove" is clicked

### 4.2 State & API Contract Changes

#### Backend: `services/api/agent/models.py`

Add `rejection_reason` field to `DestinationCandidate`. Extend valid status values to include `"rejected"`:

```python
class DestinationCandidate(BaseModel):
    name: str
    region: str
    vibe: str
    photo_url: str
    status: str = "suggested"  # "suggested" | "shortlisted" | "rejected"
    best_for: Optional[str] = None
    seasonal_note: Optional[str] = None
    rejection_reason: Optional[str] = None  # NEW: e.g. "Too far", "Been there"

class RejectedCandidate(BaseModel):  # NEW
    """A candidate rejected by the user via the UI."""
    name: str
    reason: str  # "Been there" | "Too far" | "Not my vibe" | "Other"

class UiState(BaseModel):
    mode: str = "explore"
    shortlist: List[str] = Field(default_factory=list)
    selected_winner: Optional[str] = None
    rejected_candidates: List[RejectedCandidate] = Field(default_factory=list)  # NEW
```

#### Frontend: `apps/web/src/types.ts`

```typescript
export type CandidateStatus = 'suggested' | 'shortlisted' | 'rejected';

export interface DestinationCandidate {
  name: string;
  region: string;
  vibe: string;
  photo_url: string;
  status: CandidateStatus;           // updated
  best_for?: string | null;
  seasonal_note?: string | null;
  rejection_reason?: string | null;  // NEW
}

export type RejectReason = 'Been there' | 'Too far' | 'Not my vibe' | 'Other';

export interface RejectedCandidate {  // NEW
  name: string;
  reason: RejectReason;
}

export interface UiState {
  mode: Mode;
  shortlist: string[];
  selected_winner: string | null;
  rejected_candidates: RejectedCandidate[];  // NEW
}
```

#### Request payload delta

The `ui_state` object now includes `rejected_candidates`:

```json
{
  "message": "string",
  "session_id": "string",
  "ui_state": {
    "mode": "explore | compare | decision",
    "shortlist": ["Destination A"],
    "selected_winner": null,
    "rejected_candidates": [
      { "name": "Lisbon", "reason": "Been there" },
      { "name": "Barcelona", "reason": "Too far" }
    ]
  }
}
```

The response body is **unchanged**. The `candidates` array in the response will carry updated `status` and `rejection_reason` values, which the frontend already iterates over.

### 4.3 Backend: State Reconciliation (`services/api/main.py`)

Extend the reconciliation block in `POST /chat` to handle rejected candidates alongside the existing shortlist sync:

```python
# After existing shortlist sync block:
if request.ui_state.rejected_candidates:
    rejected_lower = {
        r.name.lower(): r.reason
        for r in request.ui_state.rejected_candidates
    }
    for candidate in session.plan.candidates:
        key = candidate.name.lower().strip()
        if key in rejected_lower:
            # Shortlist takes precedence: don't reject a shortlisted candidate
            if candidate.status != "shortlisted":
                candidate.status = "rejected"
                candidate.rejection_reason = rejected_lower[key]
        elif candidate.status == "rejected" and key not in rejected_lower:
            # Un-removed: clear rejection flag, restore to suggested
            candidate.status = "suggested"
            candidate.rejection_reason = None
```

**Ordering rule**: Shortlist sync runs first, rejection sync runs second. A candidate that is both shortlisted and rejected (edge case — user shortlisted then client un-shortlisted and rejected) is treated as `"rejected"` after reconciliation.

### 4.4 Backend: Null Parameter Sanitization (`services/api/agent/orchestrator.py`)

Add a sanitization step before applying tool args to the plan. This prevents Pydantic validation failures when the LLM outputs `null` for optional string fields (e.g. `"budget": null`):

```python
def _sanitize_args(self, args: dict) -> dict:
    """Strip None values from tool arguments before applying to the plan.
    
    The Groq LLM sometimes outputs null for optional fields (e.g. budget: null),
    which violates the tool schema's 'type: string' constraint and triggers a
    Pydantic validation error on the server. Removing these keys before application
    preserves existing plan values and prevents the 400 error.
    """
    return {k: v for k, v in args.items() if v is not None}
```

Call `args = self._sanitize_args(args)` at the start of the `for tc in message.tool_calls` loop, before `_apply_tool_call` is invoked.

### 4.5 Backend: System Prompt (`services/api/agent/prompt.py`)

Add a `Rejected Destinations` section to the explore-mode system prompt. The section is rendered conditionally — only when there are rejected candidates in the plan. It is inserted after the candidates state block and before the mode-specific instructions:

```
## Rejected Destinations
The user has explicitly removed the following destinations from consideration.
Do NOT suggest these again under any circumstances:
- Lisbon (reason: Been there)
- Barcelona (reason: Too far)
```

This is generated server-side from `plan.candidates` where `status == "rejected"`. If there are no rejected candidates, the section is omitted entirely from the prompt.

### 4.6 Backend: Orchestrator Candidate Count Guard (`services/api/agent/orchestrator.py`)

The existing dynamic injection (line ~241) counts `suggested` candidates to decide when to force the agent to call `suggest_candidates`. It must exclude `rejected` candidates from the count:

```python
# Update from:
suggested_count = len([c for c in plan.candidates if c.status == "suggested"])

# To (functionally equivalent for Sprint 4, but correctly excludes rejected in Sprint 5):
active_count = len([c for c in plan.candidates if c.status == "suggested"])
```

The threshold (3) and injection message text remain unchanged.

### 4.7 Frontend: Component Changes

#### [MODIFY] `apps/web/src/components/CandidateCard.tsx`

Add the reject UI. The Lovable `CandidateCard.tsx` at `apps/lovable-ui/src/components/CandidateCard.tsx` is the authoritative design reference for exact class names and structure.

New prop:

```typescript
onReject: (reason: RejectReason) => void;  // NEW
```

Implementation rules:
- The ✕ button renders inside the card image div, top-right, using absolute positioning.
- Visibility: `opacity-0 group-hover:opacity-100` transition — only visible on hover.
- The ✕ button must **not** render when `isInShortlist === true`.
- The reject popover uses `Popover`/`PopoverContent`/`PopoverTrigger` from `@radix-ui/react-popover`. Verify this package is in `apps/web/package.json`. Install if missing.
- Popover content: `"Why remove?"` label + 4 reason chips in a `flex flex-wrap gap-1.5` container.
- Clicking any chip calls `onReject(reason)` and closes the popover.
- The toast is fired from the parent handler in `App.tsx` (not inside the card), so `CandidateCard` only needs to call `onReject` — it does not import `sonner` directly.

#### [NEW] `RemovedTray` component

Port from `apps/lovable-ui/src/components/CandidateCard.tsx` → `RemovedTray` export. Can be co-located in `CandidateArea.tsx` or extracted to `apps/web/src/components/RemovedTray.tsx`.

Props:

```typescript
interface RemovedTrayProps {
  items: Array<{ name: string; reason: RejectReason }>;
  onUnremove: (name: string) => void;
}
```

Behaviour:
- Returns `null` when `items.length === 0`
- Collapsed by default: single row with `"Removed (N)"` label + `ChevronDown` icon
- Expanded: `flex flex-wrap` pills, one per rejected candidate
- Each pill: `[Name] · [Reason]` text + `RotateCcw` button ("Un-remove")
- Clicking "Un-remove" calls `onUnremove(name)`
- "Un-remove" does NOT send a chat message, does NOT auto-reinsert the card

#### [MODIFY] `apps/web/src/components/CandidateArea.tsx`

In the explore mode block:

1. Update grid filter to exclude rejected:
   ```typescript
   const suggestedCandidates = candidates
     .filter((c) => c.status === 'suggested')
     .slice(0, 6);
   ```

2. Add new props to `CandidateAreaProps`:
   ```typescript
   rejectedCandidates: Array<{ name: string; reason: RejectReason }>;
   onRejectCandidate: (name: string, reason: RejectReason) => void;
   onUnremoveCandidate: (name: string) => void;
   ```

3. Pass `onReject` to each `CandidateCard`.

4. Render `<RemovedTray>` between the candidate grid and the `<ShortlistBar>`.

#### [MODIFY] `apps/web/src/App.tsx`

Add rejection state (client-authoritative, same pattern as shortlist):

```typescript
const [rejectedCandidates, setRejectedCandidates] = useState<RejectedCandidate[]>([]);

const handleRejectCandidate = (name: string, reason: RejectReason) => {
  setRejectedCandidates((prev) => {
    const exists = prev.some((r) => r.name.toLowerCase() === name.toLowerCase());
    if (exists) return prev;
    return [...prev, { name, reason }];
  });
  // Fire undo toast here (after state update)
  toast(`Removed ${name}`, {
    action: {
      label: 'Undo',
      onClick: () => handleUnremoveCandidate(name),
    },
  });
};

const handleUnremoveCandidate = (name: string) => {
  setRejectedCandidates((prev) =>
    prev.filter((r) => r.name.toLowerCase() !== name.toLowerCase())
  );
};
```

Wire `<Toaster />` from `sonner` into the JSX root if not already present:
```tsx
import { Toaster } from 'sonner';
// ...
return (
  <>
    <Toaster position="bottom-right" />
    {/* rest of app */}
  </>
);
```

#### [MODIFY] `apps/web/src/hooks/useAgent.ts`

Accept `rejectedCandidates` as a parameter to `sendMessage` and include in every payload:

```typescript
const sendMessage = async (
  message: string,
  overrideUiState?: Partial<UiState>,
  rejectedCandidates: RejectedCandidate[] = []
) => {
  const payload = {
    message,
    session_id: sessionId,
    ui_state: {
      ...uiState,
      ...overrideUiState,
      rejected_candidates: rejectedCandidates,
    },
  };
  // ...
};
```

---

## 5. Architecture Diagram (Sprint 5 additions highlighted)

```
React Frontend (apps/web/src/)
│
├── App.tsx
│   ├── rejectedCandidates []          ◄── NEW: client-authoritative rejection state
│   ├── handleRejectCandidate()        ◄── NEW: updates state + fires sonner toast
│   └── handleUnremoveCandidate()      ◄── NEW: clears rejection flag
│
├── CandidateArea.tsx (explore mode)
│   ├── grid filter: status === 'suggested' only  ◄── UPDATED (was 'suggested' but now explicitly excludes 'rejected')
│   ├── CandidateCard × N
│   │   └── ✕ button → Popover → Reason chips → onReject()  ◄── NEW
│   ├── RemovedTray (collapsible, items=rejectedCandidates)  ◄── NEW
│   └── ShortlistBar (unchanged)
│
└── useAgent.ts
    └── ui_state payload includes rejected_candidates         ◄── NEW

               │  POST /chat  { message, session_id,
               │    ui_state: { mode, shortlist, selected_winner,
               │    rejected_candidates: [{name, reason}...] } }
               ▼

FastAPI Backend (services/api/)
│
├── main.py
│   ├── shortlist sync (unchanged)
│   └── rejected_candidates sync                              ◄── NEW
│       → candidate.status = "rejected"
│       → candidate.rejection_reason = reason
│       → Un-remove: candidate.status = "suggested", rejection_reason = None
│
├── agent/models.py
│   ├── DestinationCandidate.status includes "rejected"       ◄── UPDATED
│   ├── DestinationCandidate.rejection_reason: Optional[str]  ◄── NEW
│   ├── RejectedCandidate model                               ◄── NEW
│   └── UiState.rejected_candidates                           ◄── NEW
│
├── agent/orchestrator.py
│   ├── _sanitize_args(): strip None values before tool call  ◄── NEW
│   └── count guard: only count status == "suggested"         ◄── UPDATED (explicit)
│
└── agent/prompt.py
    └── "Rejected Destinations" section in explore prompt     ◄── NEW
        (injected only when rejected candidates exist in plan)
```

---

## 6. Task Breakdown

### Phase 1: UI & Style Fixes

- [ ] **Task 1.1** — `tailwind.config.js`: add `fontFamily.sans: ["Inter", ...]`; verify/add all semantic colour aliases (`ocean-bg`, `sun-bg`, `sage-bg`, `coral-bg`, `teal-soft-muted`, `muted-soft`, `destructive-bg`, `ocean-deep-bg`).
- [ ] **Task 1.2** — `index.css`: add any still-missing `@layer utilities` entries for semantic tokens referenced in components.
- [ ] **Task 1.3** — `TripProfileComponent.tsx`: replace `formatArray()` + `truncate` pattern with per-item chip rendering for bottom-row array fields. Top-row scalar fields keep `truncate`.
- [ ] **Task 1.4** — Color sweep: replace hardcoded `text-white`, `bg-white`, `text-gray-*`, `bg-gray-*`, `border-gray-*` with semantic tokens across `CandidateCard.tsx`, `ShortlistCard.tsx`, `ChatInterface.tsx`, `LandingScreen.tsx`.
- [ ] **Task 1.5** — `orchestrator.py`: add `_sanitize_args()` helper; call it before `_apply_tool_call` in the tool execution loop.

### Phase 2: Candidate Rejection

- [ ] **Task 2.1** — `models.py`: add `rejection_reason: Optional[str]` to `DestinationCandidate`; add `RejectedCandidate` model; add `rejected_candidates` field to `UiState`.
- [ ] **Task 2.2** — `types.ts`: update `DestinationCandidate` status union; add `RejectReason` type; add `RejectedCandidate` interface; update `UiState`.
- [ ] **Task 2.3** — `main.py`: add rejection reconciliation block after shortlist sync. Shortlist takes precedence in conflict.
- [ ] **Task 2.4** — `prompt.py`: add conditional `Rejected Destinations` section to explore-mode prompt. Omit if no rejected candidates.
- [ ] **Task 2.5** — `orchestrator.py`: confirm candidate count guard counts `status == "suggested"` only (not `"rejected"`).
- [ ] **Task 2.6** — Dependency check: verify `sonner` and `@radix-ui/react-popover` in `apps/web/package.json`. Install if missing. Wire `<Toaster />` into `App.tsx` JSX root.
- [ ] **Task 2.7** — `CandidateCard.tsx`: add `onReject` prop; add ✕ button with hover-reveal; add reject Popover with 4 reason chips. Reference Lovable for class strings. ✕ hidden on shortlisted cards.
- [ ] **Task 2.8** — `CandidateArea.tsx`: add `rejectedCandidates`, `onRejectCandidate`, `onUnremoveCandidate` props; update grid filter; render `<RemovedTray>` between grid and ShortlistBar.
- [ ] **Task 2.9** — Implement `RemovedTray` component (co-locate in `CandidateArea.tsx` or extract to `RemovedTray.tsx`). Reference Lovable design for layout.
- [ ] **Task 2.10** — `App.tsx`: add `rejectedCandidates` state; add `handleRejectCandidate` (sets state + fires toast with Undo); add `handleUnremoveCandidate` (clears state entry).
- [ ] **Task 2.11** — `useAgent.ts`: include `rejected_candidates` in every `POST /chat` payload via the `sendMessage` function signature.

---

## 7. Verification Plan

### Backend Verification

- `POST /chat` with `ui_state.rejected_candidates: [{"name": "Lisbon", "reason": "Been there"}]` → verify session plan shows `status: "rejected"` and `rejection_reason: "Been there"` for Lisbon.
- Follow-up `POST /chat` with `rejected_candidates: []` → verify Lisbon reverts to `status: "suggested"`, `rejection_reason: null`.
- Trigger the null-parameter bug: send a message that causes the agent to call `update_trip_profile` with `budget: null`. Verify server returns 200 (not 400). Check server logs confirm `_sanitize_args` stripped the key.

### UI Phase 1 Verification

1. Open the app. Compare Trip Profile and candidate card body text to the Lovable reference — all UI text should render in Inter.
2. Expand `font-sans` in browser DevTools → verify it resolves to Inter, not system sans-serif.
3. Fill 6+ items in "Things we like" via conversation. Verify all items display as wrapping chips — no truncation or clipping.
4. Inspect components with DevTools → confirm no `text-white` or `bg-white` remain in rendered output.

### UI Phase 2 Verification

1. Start a session and get 3 candidate cards.
2. Hover a card → verify the ✕ button appears (top-right corner, inside image area).
3. Click ✕ → verify popover opens with 4 chips labeled correctly.
4. Click "Too far" → verify: card hides immediately, toast appears with "Removed [Name]" + "Undo".
5. Click "Undo" in the toast → verify card reappears in grid instantly.
6. Reject the same card again. Send a chat message. Verify:
   - The rejected destination does not appear in the agent's next suggestion.
   - If fewer than 3 active cards remain, the agent suggests new ones.
7. Open the "Removed (N)" tray → verify pill shows `[Name] · Too far` + RotateCcw icon.
8. Click "Un-remove" → verify pill disappears from tray. Send a chat message → verify the destination is eligible to be suggested again (the agent may or may not suggest it depending on profile fit).
9. Reject all 6 cards. Send a message. Verify the agent surfaces 3 new suggestions.

---

## 8. Constraints Carried Forward into Sprint 6

1. Flat JSON tool schemas only — no Pydantic schema generation for Groq tools.
2. Dual-call conditional ReAct loop must not be removed.
3. Client owns `uiState.mode` — server responses must not override it.
4. Candidate upsert by `name.lower()` — never replace the full array.
5. Learning notebooks are not part of the build process.
6. Full rejected candidate list is passed to the LLM system prompt for now. If context window errors return in testing, Sprint 6 will prune the history and may also cap the rejected list.
