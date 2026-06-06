# Sprint 5 Final State: Candidate Rejection & UI Polish

**Status**: Complete  
**Date**: 6th June 2026

This document describes the end of Sprint 5 code state.

---

## 1. Summary

Sprint 5 adds user-controlled candidate rejection and brings the UI into alignment with the Lovable reference design. Rejected candidates are hidden immediately (client-side, optimistic), tracked in a collapsible tray, synced to the backend on the next chat turn, and honoured by the agent (it will not re-suggest them). Visual fixes cover font rendering, trip profile chip display, and semantic colour token completeness.

---

## 2. Sprint 4 → Sprint 5: Before vs. After

| Dimension | Sprint 4 (Before) | Sprint 5 (After) |
|---|---|---|
| **Candidate removal** | Not supported — cards persisted indefinitely | User can reject a card via hover ✕ → reason popover. Card hides immediately (optimistic). Rejection synced to backend on next turn. |
| **Removed state** | None | Collapsible "Removed (N)" tray below candidate grid with un-remove button per entry |
| **Undo** | None | Sonner toast fires on rejection: "Removed [Name]" + "Undo" action (instant recovery) |
| **Backend rejection** | No `rejected` status | `DestinationCandidate.status` now includes `"rejected"`; `rejection_reason` field added; `RejectedCandidate` model added; `UiState.rejected_candidates` synced per turn |
| **Agent rejection awareness** | Agent could re-suggest removed destinations | System prompt includes a `## Rejected Destinations` block (explore mode only, injected when rejections exist); agent will not re-suggest listed destinations |
| **Active candidate count guard** | Counted all non-shortlisted candidates | Counts only `status == "suggested"` candidates — correctly excludes rejected |
| **Null tool args** | Agent could send `null` for optional fields, causing Groq 400 error | `update_trip_profile` schema uses `["string", "null"]` types; `_sanitize_args()` strips nulls before applying to plan |
| **Font rendering** | `font-sans` → Inter; diverged from Lovable | `font-sans` → Fraunces; `font-feature-settings: "ss01", "ss02"` applied — matches Lovable exactly |
| **Trip profile array fields** | `likes`/`avoid` joined as truncated string | Per-item chips in `flex flex-wrap` container; no truncation |
| **State JSON to LLM** | Full candidate objects including `photo_url`, `best_for`, `seasonal_note`, `rejection_reason` | Candidates in state JSON contain only `name`, `region`, `vibe`, `status` — prevents LLM from echoing backend-only fields in tool output |

---

## 3. Candidate Rejection Flow

```
User hovers a non-shortlisted CandidateCard
  → ✕ button appears (opacity-0 → opacity-100 on hover, top-right of image)
  → User clicks ✕
  → Popover opens (4 reason chips): "Been there" | "Too far" | "Not my vibe" | "Other"
  → User selects a reason
    → Card hides from grid immediately (rejectedCandidates state in App.tsx)
    → Entry added to RemovedTray below the grid
    → Sonner toast fires with Undo action
  → On user's NEXT chat message:
    → ui_state.rejected_candidates carries full list
    → Backend marks candidates status="rejected", stores rejection_reason
    → System prompt shows ## Rejected Destinations to agent
    → Agent observes fewer than 3 active suggested candidates → calls suggest_candidates
```

**What does NOT happen:**
- No automatic message sent when a card is rejected
- No background API request triggered on rejection
- Un-remove does not auto-reinsert a card into the grid (it just removes from the tray; card re-appears if agent re-suggests it)
- Shortlisted candidates are not affected by rejection sync (shortlist takes precedence)

---

## 4. State Schema (Final)

### `services/api/agent/models.py`

```python
class DestinationCandidate(BaseModel):
    name: str
    region: str
    vibe: str
    photo_url: str                        # Server-resolved
    status: str = "suggested"             # "suggested" | "shortlisted" | "rejected"
    best_for: Optional[str] = None
    seasonal_note: Optional[str] = None
    rejection_reason: Optional[str] = None  # NEW Sprint 5

class RejectedCandidate(BaseModel):        # NEW Sprint 5
    name: str
    reason: str                            # "Been there" | "Too far" | "Not my vibe" | "Other"

class UiState(BaseModel):
    mode: str = "explore"
    shortlist: List[str] = Field(default_factory=list)
    selected_winner: Optional[str] = None
    rejected_candidates: List[RejectedCandidate] = Field(default_factory=list)  # NEW Sprint 5
```

### `apps/web/src/types.ts`

```typescript
export type CandidateStatus = 'suggested' | 'shortlisted' | 'rejected';
export type RejectReason = 'Been there' | 'Too far' | 'Not my vibe' | 'Other';

export interface RejectedCandidate {    // NEW Sprint 5
  name: string;
  reason: RejectReason;
}

export interface DestinationCandidate {
  // ...existing fields...
  status: CandidateStatus;              // updated
  rejection_reason?: string | null;     // NEW Sprint 5
}

export interface UiState {
  // ...existing fields...
  rejected_candidates: RejectedCandidate[];  // NEW Sprint 5
}
```

---

## 5. Tool Definitions (Final)

All flat JSON schemas (no Pydantic `$ref`). Three changes from Sprint 4:

**`update_trip_profile`**: All scalar fields now use `["string", "null"]` type; array fields use `["array", "null"]`. This allows the LLM to send `null` for unset fields without triggering a Groq schema validation error. Nulls are stripped by `_sanitize_args()` before being applied to the plan.

**`suggest_candidates`** and **`generate_comparison_matrix`**: No structural change to schemas. `additionalProperties` is intentionally absent — Groq does not support this keyword in nested schemas and silently drops the tool when it is present.

**Candidate objects in state JSON**: Only `name`, `region`, `vibe`, `status` are included in the serialised state sent to the LLM. `photo_url`, `best_for`, `seasonal_note`, and `rejection_reason` are stripped by `_clean_candidates_for_prompt()` in `prompt.py`. This prevents the LLM from echoing backend-only fields in `suggest_candidates` output (which previously caused malformed JSON generation).

---

## 6. Backend: Rejection Reconciliation (`main.py`)

Runs after shortlist sync on every `POST /chat`:

```python
if request.ui_state.rejected_candidates:
    rejected_lower = { r.name.lower(): r.reason for r in request.ui_state.rejected_candidates }
    for candidate in session.plan.candidates:
        key = candidate.name.lower().strip()
        if key in rejected_lower and candidate.status != "shortlisted":
            candidate.status = "rejected"
            candidate.rejection_reason = rejected_lower[key]
        elif candidate.status == "rejected" and key not in rejected_lower:
            candidate.status = "suggested"     # un-removed
            candidate.rejection_reason = None
else:
    # Empty list = un-remove all
    for candidate in session.plan.candidates:
        if candidate.status == "rejected":
            candidate.status = "suggested"
            candidate.rejection_reason = None
```

**Ordering**: shortlist sync runs first. A candidate that is shortlisted is never marked rejected, regardless of `rejected_candidates` payload.

---

## 7. Frontend: Component Changes

### `CandidateCard.tsx`
- Hover-reveal ✕ button (top-right of image, `opacity-0 group-hover:opacity-100`)
- ✕ is hidden when `isInShortlist === true` (replaced by "✓ Shortlisted" badge)
- `@radix-ui/react-popover` popover with 4 reason chips
- `onReject: (reason: RejectReason) => void` prop

### `RemovedTray.tsx` (new)
- Collapsed by default ("Removed (N)" + ChevronDown)
- Expanded: `flex flex-wrap` pills — `[Name] · [Reason]` + RotateCcw un-remove button
- Returns `null` when empty

### `CandidateArea.tsx`
- Grid filter excludes both backend-rejected (`status !== 'suggested'`) and locally-rejected (name in `rejectedCandidates` set) — provides immediate optimistic hiding
- `RemovedTray` rendered between candidate grid and ShortlistBar
- New props: `rejectedCandidates`, `onRejectCandidate`, `onUnremoveCandidate`

### `App.tsx`
- `rejectedCandidates: RejectedCandidate[]` state (client-authoritative, same pattern as shortlist)
- `handleRejectCandidate` updates state + fires Sonner toast with Undo
- `handleUnremoveCandidate` removes entry from state
- `<Toaster position="bottom-right" />` added
- All `sendMessage` calls pass `rejectedCandidates` as third argument

### `useAgent.ts`
- `sendMessage(content, overrideUiState?, rejectedCandidates?)` signature
- `rejected_candidates` included in every `POST /chat` payload via `ui_state`
- Initial `uiState` includes `rejected_candidates: []`

---

## 8. Design & CSS

### Font
- `font-sans` → Fraunces (updated in `tailwind.config.js` and `index.css` base layer)
- `font-feature-settings: "ss01", "ss02"` applied globally — matches Lovable exactly
- `font-serif` and `font-display` → Fraunces (unchanged from Sprint 4)

### Trip Profile
- `likes` and `avoid` fields rendered as per-item `flex flex-wrap` chips
- Top-row scalar fields (Origin, Travelers, When, Duration, Budget) retain single-line `truncate`
- `not set` renders as italic at `text-muted-foreground/70`

### Colour Tokens
- `index.css` `@layer utilities`: added `text-primary-foreground`, `bg-primary-foreground`, `bg-muted`, `animate-fade-in` utility classes
- `tailwind.config.js`: all named colour aliases present (`ocean-bg`, `sun-bg`, `sage-bg`, `coral-bg`, `teal-soft-muted`, `muted-soft`, `destructive-bg`, `ocean-deep-bg`)
- Hardcoded `text-white` replaced with `text-primary-foreground` across `CandidateCard.tsx` and `ChatInterface.tsx`

---

## 9. Constraints Carried Forward

1. **Flat JSON tool schemas only** — no Pydantic schema generation for Groq tools; `additionalProperties` not used (Groq drops tools that include it in nested schemas).
2. **Dual-call conditional ReAct loop** — do not remove the second LLM call when tools are used.
3. **Client owns `uiState.mode`** — server responses must not override it.
4. **Candidate upsert by `name.lower()`** — never replace the full candidates array.
5. **State JSON to LLM strips backend-only candidate fields** — `photo_url`, `best_for`, `seasonal_note`, `rejection_reason` are not shown in serialised state.
6. **Learning notebooks are not part of the build process.**

---

## 10. Known Gaps

- Session state is in-memory only (lost on server restart).
- Landing screen form data is not injected directly into `TripProfile` state — the agent re-extracts profile fields from the initial message text on turn 1. Deferred to Sprint 6.
- `DebugPanel.tsx` exists but is not wired into the live route.

---

## 11. Directory Map (Post-Sprint 5)

```
vacation-planner/
├── docs/
│   ├── sprint-5-planning.md
│   ├── sprint-5-spec.md
│   └── sprint-5-result.md              ← THIS FILE
│
├── services/api/
│   └── agent/
│       ├── models.py                   Updated: DestinationCandidate.rejection_reason,
│       │                               RejectedCandidate model, UiState.rejected_candidates
│       ├── orchestrator.py             Updated: _sanitize_args(); update_trip_profile nullable
│       │                               types; active_count guard (suggested only)
│       ├── prompt.py                   Updated: _build_rejected_section(); _clean_candidates_for_prompt();
│       │                               rejected_section injected into explore prompt
│       └── session.py                  Unchanged
│
└── apps/web/src/
    ├── index.css                       Updated: font-sans → Fraunces; font-feature-settings;
    │                                   text-primary-foreground, bg-muted, animate-fade-in utilities
    ├── App.tsx                         Updated: rejectedCandidates state; reject/unremove handlers;
    │                                   Toaster; all sendMessage calls updated
    ├── types.ts                        Updated: CandidateStatus, RejectReason, RejectedCandidate,
    │                                   UiState.rejected_candidates
    ├── hooks/useAgent.ts               Updated: sendMessage signature; rejected_candidates in payload
    └── components/
        ├── CandidateArea.tsx           Updated: optimistic grid filter; RemovedTray; new props
        ├── CandidateCard.tsx           Updated: hover ✕; reject popover; onReject prop
        ├── RemovedTray.tsx             NEW: collapsible removed candidates tray
        ├── TripProfileComponent.tsx    Updated: likes/avoid as chip arrays
        └── ChatInterface.tsx           Updated: text-primary-foreground colour fix
```
