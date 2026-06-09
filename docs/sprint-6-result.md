# Sprint 6 Final State: Session Reliability & Token Reduction

**Status**: Complete  
**Date**: 9th June 2026

This document describes the end of Sprint 6 code state.

---

## 1. Summary

Sprint 6 fixes two concrete reliability problems and two agent-behaviour bugs surfaced in Sprint 5 testing. Long sessions no longer hit the Groq TPM limit. Turn 1 no longer wastes an LLM call re-extracting data the landing screen already collected. The "best 3" candidate pool no longer includes already-shortlisted destinations. The agent no longer narrates its own tool writes back to the user. The candidate replenishment rule is now clearly stated in both the shared guidelines and the EXPLORE mode instructions.

---

## 2. Sprint 5 → Sprint 6: Before vs. After

| Dimension | Sprint 5 (Before) | Sprint 6 (After) |
|---|---|---|
| **Token limit failures** | `session.history` sent in full to Groq on every turn — long sessions hit the `qwen/qwen3-32b` 6000-token limit with a 413 error | History pruned to the last 4 complete turns before every LLM call; `session.history` (full, durable) is untouched |
| **Pruning boundary safety** | n/a | Pruning slices only at `user`-role message boundaries — `tool_calls`/`tool` message pairs are never split (which would cause a Groq 400) |
| **Opening message retention** | n/a | `history[0]` (the onboarding summary) is always retained even when it falls outside the pruning window |
| **Turn 1 profile extraction** | Agent re-extracted origin, travelers, when, duration, budget from the opening message via `update_trip_profile` — a wasted LLM turn | Landing screen `currentProfile` is persisted to `sessionStorage` and sent as `onboarding_profile` in the first POST body; backend writes it directly into `session.plan.trip_profile` before calling the orchestrator |
| **Turn 1 agent behaviour** | First-turn instruction told the agent to extract profile AND suggest candidates | First-turn instruction tells the agent the profile is already populated; its only job on Turn 1 is to suggest 3 destinations |
| **Top-3 includes shortlisted** | Agent could nominate an already-shortlisted destination as one of its 3 suggestions — leaving as few as 1 active card when 2 were shortlisted | `suggest_candidates` upsert loop skips any incoming candidate whose name matches an existing `shortlisted` candidate; shortlisted names cannot consume a suggestion slot |
| **Agent verbosity** | Agent narrated what it had just written to profile/candidates ("I've added Paris, Lisbon...") | `SHARED_GUIDELINES` item 5 instructs the agent not to recite what it just recorded; the UI surfaces changes, the agent asks questions |
| **Candidate replenishment rule** | Rule existed but was buried in a long EXPLORE mode paragraph; applied EXPLORE mode only | Added as a dedicated standing rule in `SHARED_GUIDELINES` (item 6); EXPLORE item 2 rewritten to lead with the "live best 3" framing |
| **Active-count injection** | `CRITICAL: You MUST suggest N more destinations THIS TURN` injected when active count < 3 — caused the model to emit malformed pseudo-XML function calls (`<function=...>`), producing Groq 400 errors | Rewritten to remove the all-caps pressure while keeping intent clear: `"Note: there are currently only N active suggested destination(s). You MUST include new candidate suggestions in your response this turn so the list of active candidates stays above 3."` |
| **EXPLORE job description** | "Extract travel preferences and surface the top 3 destination candidates as a visual backdrop for conversation" | "Extract travel preferences and surface the 3 best-matching destination candidates constantly as the profile becomes clearer." |
| **Dead prompt rule** | EXPLORE item 5 told the agent not to provide photo URLs — impossible anyway since the tool schema has no such field | Removed |

---

## 3. Conversation History Filtering & Pruning

```python
MAX_HISTORY_TURNS = 4  # tune from live testing

def _prune_history(self, history: list) -> list:
    turn_starts = [i for i, m in enumerate(history) if m.get("role") == "user"]
    if len(turn_starts) <= MAX_HISTORY_TURNS:
        return history
    cutoff = turn_starts[-MAX_HISTORY_TURNS]
    pruned = history[cutoff:]
    if cutoff > 0:
        pruned = [history[0]] + pruned
    return pruned
```

Called once at the top of `run_turn()`. `session.history` itself is never modified — it remains the full durable record of the session.

**Why turn boundaries matter**: a naive last-N slice can split an `assistant` message carrying `tool_calls` from its corresponding `tool` response message(s). Groq rejects such requests with a 400. By slicing only at `user`-role indices, each slice starts a clean turn.

### Tool message filtering

After pruning, a second pass strips all tool infrastructure from the history before it is sent to the LLM:

```python
def _filter_history(self, history: list) -> list:
    return [
        m for m in history
        if m.get("role") != "tool" and not m.get("tool_calls")
    ]
```

**Call 1** receives: system prompt + filtered history (user messages and plain assistant text replies only).  
**Call 2** receives: system prompt + filtered history + `new_messages` (the current turn's tool calls and results, which Call 2 genuinely needs).

The `VacationPlan` state JSON injected into every system prompt already captures the outcome of all previous tool calls, making historical tool messages redundant.

**⚠️ Known risk**: Before this change, historical tool calls were visible in the message history and implicitly showed the model the complete arrays/matrices it had previously sent. Without that context, the fallback model was observed sending only newly-learned items for array fields (`likes`/`avoid`) and only new rows for the comparison matrix — discarding the accumulated state. **Mitigation**: the `update_trip_profile` and `generate_comparison_matrix` tool descriptions now explicitly instruct the model to read the current values from the state and always send the complete list or matrix. If this proves unreliable in further testing, the history filtering may need to be revisited.

---

## 4. Initial Intake Bypass

### Frontend (`LandingScreen.tsx`)

`currentProfile` (already built for the live preview) is now also persisted to `sessionStorage` when the user submits:

```tsx
sessionStorage.setItem('onboardingProfile', JSON.stringify(currentProfile));
```

### Frontend (`App.tsx`)

`handleStartSession` reads both items and passes the profile to `sendMessage`:

```tsx
const onboardingRaw = sessionStorage.getItem('onboardingProfile');
const onboardingProfile = onboardingRaw ? JSON.parse(onboardingRaw) : undefined;
sessionStorage.removeItem('onboardingProfile');
sendMessage(initialMessage, undefined, rejectedCandidates, onboardingProfile);
```

### Frontend (`useAgent.ts`)

`sendMessage` gains a fourth optional parameter; `onboarding_profile` is included in the POST body:

```typescript
const sendMessage = async (
    content: string,
    overrideUiState?: UiState,
    rejectedCandidates: RejectedCandidate[] = [],
    onboardingProfile?: TripProfile
) => { ... onboarding_profile: onboardingProfile ?? null }
```

### Backend (`main.py`)

`ChatRequest` gains an optional field:

```python
class ChatRequest(BaseModel):
    message: str
    session_id: str
    ui_state: Optional[UiState] = None
    onboarding_profile: Optional[TripProfile] = None  # NEW
```

Applied in `/chat` before appending the user message, gated on first turn only:

```python
if not session.history and request.onboarding_profile:
    incoming = request.onboarding_profile.model_dump(exclude_none=True)
    for field, value in incoming.items():
        if value not in (None, [], ""):
            setattr(session.plan.trip_profile, field, value)
```

Only non-empty values are written — same "strip before applying" pattern as `_sanitize_args()`.

---

## 5. Top-3-Includes-Shortlist Fix

In `_apply_tool_call` (`suggest_candidates` branch), incoming candidates that match an existing `shortlisted` candidate by name are skipped entirely before the upsert:

```python
existing = candidates_dict.get(key)
if existing and existing.status == "shortlisted":
    continue
```

A shortlisted destination is already confirmed. Skipping it means it cannot consume one of the model's 3 suggestion slots, guaranteeing 3 genuinely-active cards regardless of what the model nominates.

---

## 6. Prompt Changes (`prompt.py`)

### `SHARED_GUIDELINES`

Two additions:

**Item 4 (new) — Don't Narrate Your Writes**: instructs the agent not to recite what it just recorded to profile or candidates. The structured UI surfaces changes; the agent asks questions.

**Item 5 (new) — Keep the Candidate Panel Full**: makes the "always at least 3 active suggestions" requirement a standing rule visible to every mode, not just EXPLORE. Defines the panel as a "live best 3 right now" view and clarifies that shortlisted destinations do not count as active suggestions.

The previous "Listen First" guideline was removed. Items 6 and 7 are the previous items 6 and 7, renumbered accordingly (total: 7 guidelines).

### `MODE_INSTRUCTIONS["explore"]`

**Job description**: rewritten to put profile extraction and continuous candidate surfacing in the same sentence — "Extract travel preferences and surface the 3 best-matching destination candidates constantly as the profile becomes clearer."

**Item 1 (First Turn)**: rewritten to reflect pre-populated profile. Agent is told the trip basics are already in state and its sole first-turn job is to suggest 3 matching destinations.

**Item 2 (Ongoing)**: rewritten to lead with the "live best 3" framing and make immediate slot-filling explicit.

**Item 5 (No Image Sourcing)**: removed. The `suggest_candidates` tool schema has no `photo_url` field, so the model cannot supply one regardless.

---

## 7. Constraints Carried Forward

1. **Flat JSON tool schemas only** — no Pydantic schema generation for Groq tools; `additionalProperties` not used.
2. **Dual-call conditional ReAct loop** — second LLM call preserved whenever tools are used.
3. **Client owns `uiState.mode`** — server responses must not override it.
4. **Candidate upsert by `name.lower()`** — never replaces the full array; shortlisted names now additionally skipped.
5. **State JSON to LLM strips backend-only candidate fields** — `_clean_candidates_for_prompt()` unchanged.
6. **History is truncated, not summarised** — revisit only if truncation proves lossy in practice.
7. **Learning notebooks are not part of the build process.**

---

## 8. Known Gaps

- Session state is in-memory only (lost on server restart). Persistence deferred to Sprint 9.
- `DebugPanel.tsx` exists but is not wired into the live route. Deferred to Sprint 10.
- Direct profile editing (click-to-edit chip) not yet supported. Deferred to Sprint 7.
- `tool_use_failed` Groq errors (malformed generation from model) have no retry path — softening the active-count injection reduces frequency but does not eliminate the risk entirely.
- **Un-reject restores candidate immediately (BUG: Should be added to Sprint 7)**: When a user un-rejects a candidate, the backend sync restores it to `suggested` status, causing it to reappear in the candidate grid immediately — without the agent deciding it belongs there. The intended behavior is that un-rejecting makes a destination *eligible* for future suggestion, not immediately visible. Fix: on un-reject, remove the candidate from `session.plan.candidates` entirely so it can only return if the agent actively re-suggests it.

---

## 9. Directory Map (Post-Sprint 6)

```
vacation-planner/
├── docs/
│   ├── sprint-6-planning.md
│   ├── sprint-6-spec.md
│   └── sprint-6-result.md              ← THIS FILE
│
├── services/api/
│   └── agent/
│       ├── orchestrator.py             Updated: MAX_HISTORY_TURNS constant; _prune_history();
│       │                               pruned_history used for both LLM calls; shortlisted-skip
│       │                               in suggest_candidates upsert; softened active-count injection
│       ├── prompt.py                   Updated: SHARED_GUIDELINES items 5-6 added (narration,
│       │                               candidate panel); EXPLORE job description, item 1, item 2
│       │                               rewritten; item 5 (image sourcing) removed
│       ├── models.py                   Unchanged
│       └── session.py                  Unchanged
│
├── services/api/
│   └── main.py                         Updated: ChatRequest.onboarding_profile field;
│                                       first-turn TripProfile initialisation block
│
└── apps/web/src/
    ├── App.tsx                         Updated: reads onboardingProfile from sessionStorage;
    │                                   passes to sendMessage
    ├── hooks/useAgent.ts               Updated: sendMessage gains onboardingProfile param;
    │                                   onboarding_profile included in POST body; TripProfile imported
    └── components/
        └── LandingScreen.tsx           Updated: currentProfile persisted to sessionStorage
                                        as onboardingProfile on session start
```
