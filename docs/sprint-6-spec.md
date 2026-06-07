# Sprint 6 Implementation Spec: Reliability, Token Reduction & Prompt Fixes

## 1. Executive Alignment

Sprint 6 fixes two concrete reliability problems and two agent-behaviour bugs surfaced in Sprint 5 testing:

1. **Long sessions hit the Groq TPM limit.** `session.history` grows unboundedly and is sent to the LLM in full on every turn. Once it crosses ~6000 tokens, the fallback model (`qwen/qwen3-32b`) returns a `413`.
2. **Turn 1 wastes an LLM call re-extracting data the client already collected.** The landing-screen sentence builder gathers structured trip details before the session starts, but none of it currently reaches the backend in structured form — the agent re-derives it from the opening message, inconsistently.
3. **The "best 3" can include already-shortlisted destinations**, leaving as few as 1 genuinely-active suggestion visible when 2 are shortlisted.
4. **The agent narrates its own writes back to the user**, duplicating what the Trip Profile and candidate cards already show — inflating message length and compounding (1).

**Sprint Goal**: Make sessions reliable at scale and cut wasted token usage.

**Architectural constraints inherited from prior sprints — must not be violated:**

- Flat hand-written JSON tool schemas only. No Pydantic schema auto-generation for Groq tools; `additionalProperties` not used (Groq silently drops tools that include it in nested schemas).
- Dual-call conditional ReAct loop preserved. Do not remove the second LLM call when tools are used.
- Client owns `uiState.mode`. Server responses must not override it.
- Candidate upsert by `name.lower()`. Never replace the full candidates array.
- State JSON sent to the LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`).
- Tool names never appear in system prompt instructions — the agent fails reliably whenever they do.
- Learning notebooks are not part of the build process.

---

## 2. Scope & Non-Goals

### In Scope

**Phase 1: Backend Reliability**
- Turn-bounded conversational history pruning before every LLM call
- Initial intake bypass: pre-populate `TripProfile` from the landing-screen onboarding data, end-to-end (frontend payload → backend initialisation → updated first-turn instruction)

**Phase 2: Agent Logic & Prompt Fixes**
- Code-level fix for the top-3-includes-shortlist bug (in `_apply_tool_call`, not the prompt)
- System-prompt guideline reducing agent verbosity / write-narration

### Non-Goals

- Conversational history **summarisation** — truncation only this sprint. Decided explicitly: the agent is already inconsistent, and summarisation would add work for it to do, directly against this sprint's token-reduction goal. Revisit only if truncation proves lossy in practice.
- A formal eval / regression-testing harness — the PM verifies behavioural prompt changes through their own live testing.
- Direct profile editing (Sprint 7)
- Multi-agent architecture (Sprint 8)
- Session persistence / Chat ID continuation (Sprint 9)
- "I already have destinations" entry, region/suburb granularity, Debug Panel wiring (Sprint 10)

---

## 3. Phase 1: Backend Reliability

### 3.1 Conversational History Pruning

**Root cause**: `session.history` (`services/api/agent/session.py:11`) accumulates every user message, assistant reply, tool-call, and tool-response for the life of a session (`main.py:56, 115, 120`), and the full list is sent to Groq on **every** turn (`orchestrator.py:256` for Call 1, `orchestrator.py:313` for Call 2).

**Constraint surfaced during planning**: a naive "keep the last N messages" slice can split an `assistant` message carrying `tool_calls` from its paired `tool` response message(s). Groq rejects requests with orphaned tool messages with a `400` — trading the `413` we're fixing for a different failure. Pruning must therefore cut on **whole conversational turns**.

**Definition of a turn**: one `user`-role message, plus every `assistant`/`tool` message that follows it, up to (but not including) the next `user`-role message.

#### [MODIFY] `services/api/agent/orchestrator.py`

Add a pruning helper and a module-level constant:

```python
MAX_HISTORY_TURNS = 4  # arbitrary-but-reasonable starting point — tune from live testing


def _prune_history(self, history: list) -> list:
    """Trim conversation history to the last N complete turns before sending to the LLM.

    Slices on user-message boundaries only, so a tool_calls/tool message pair is
    never split (which would trigger a Groq 400 in place of the 413 this fixes).
    Always retains index 0 — the onboarding-summary opening message — even when
    it falls outside the retained window, since it carries high signal for the
    whole session.
    """
    turn_starts = [i for i, m in enumerate(history) if m.get("role") == "user"]
    if len(turn_starts) <= MAX_HISTORY_TURNS:
        return history

    cutoff = turn_starts[-MAX_HISTORY_TURNS]
    pruned = history[cutoff:]
    if cutoff > 0:
        pruned = [history[0]] + pruned
    return pruned
```

Call it once near the top of `run_turn()`, and use the pruned result for **both** `messages` (Call 1, currently built at `orchestrator.py:256`) and `messages_with_results` (Call 2, currently built at `orchestrator.py:313`). `session.history` itself — the durable copy held by `SessionManager` — is left untouched; only what gets sent to Groq is trimmed. This matches the planning intent: `VacationPlan` plus the full `session.history` remain the source of truth, and only the LLM-facing window shrinks.

`MAX_HISTORY_TURNS = 4` is a starting point, not a precision figure — per the planning discussion, any number here is somewhat arbitrary. A tool-using turn can span 3–4 messages (assistant w/ `tool_calls` → tool response(s) → final assistant reply), so 4 turns lands in roughly the same order of magnitude as the originally-floated "10 messages" while guaranteeing turn-complete slices. Adjust during live testing if `413`s persist or the agent starts losing useful context too aggressively.

---

### 3.2 Initial Intake Bypass

**What's there today**: `LandingScreen.tsx` already builds a `TripProfile`-shaped object (`currentProfile`, lines 45–54) from the sentence-builder's form values — it's just used to drive the live preview (`<TripProfileComponent>`, line 232) and goes no further. What actually reaches the backend is `initialMessage`, a flattened sentence built from the same values (`handleStartSession`, lines 19–43), sent as a plain chat `message` (`useAgent.ts` POST body, lines 37–45). The agent then has to re-derive the same fields from that sentence via `update_trip_profile` on Turn 1 — the wasted step this fix removes.

**The fix**: send `currentProfile` itself across the wire, and write its fields straight into `session.plan.trip_profile` before the agent's first turn — putting the values into state ourselves rather than having the agent re-extract them. `currentProfile` is already built in exactly the right shape, so there's nothing new to construct on the frontend — just a field to carry it across (`useAgent.ts` → `ChatRequest`) and a few lines on the backend to apply it.

#### [MODIFY] `apps/web/src/components/LandingScreen.tsx`

Alongside the existing `sessionStorage.setItem('initialMessage', ...)` (line 40), persist the structured profile too:

```tsx
sessionStorage.setItem('onboardingProfile', JSON.stringify(currentProfile));
```

#### [MODIFY] `apps/web/src/App.tsx`

In `handleStartSession` (lines 19–23), read and forward the persisted profile:

```tsx
const handleStartSession = (_path: 'inspire' | 'destinations') => {
  const initialMessage = sessionStorage.getItem('initialMessage') || 'Tell me about vacation options.';
  const onboardingRaw = sessionStorage.getItem('onboardingProfile');
  const onboardingProfile = onboardingRaw ? JSON.parse(onboardingRaw) : undefined;
  sessionStorage.removeItem('initialMessage');
  sessionStorage.removeItem('onboardingProfile');
  sendMessage(initialMessage, undefined, rejectedCandidates, onboardingProfile);
};
```

#### [MODIFY] `apps/web/src/hooks/useAgent.ts`

Extend `sendMessage` (currently `lines 21–25`) with a fourth, optional parameter, and include it in the POST body (currently `lines 37–45`):

```typescript
import type { VacationPlan, ChatMessage, UiState, RejectedCandidate, TripProfile } from '../types';

const sendMessage = async (
    content: string,
    overrideUiState?: UiState,
    rejectedCandidates: RejectedCandidate[] = [],
    onboardingProfile?: TripProfile,
) => {
    // ...
    body: JSON.stringify({
        message: content,
        session_id: sessionId,
        ui_state: { ...stateToSend, rejected_candidates: rejectedCandidates },
        onboarding_profile: onboardingProfile ?? null,
    }),
```

#### [MODIFY] `services/api/main.py`

Add an optional field to `ChatRequest` (currently `lines 22–25`):

```python
class ChatRequest(BaseModel):
    message: str
    session_id: str
    ui_state: Optional[UiState] = None
    onboarding_profile: Optional[TripProfile] = None  # NEW
```

In the `/chat` handler, immediately after fetching the session (`line 55`) and **before** appending the user message — gated on this being the session's first turn:

```python
session = session_manager.get_session(request.session_id)

if not session.history and request.onboarding_profile:
    incoming = request.onboarding_profile.model_dump(exclude_none=True)
    for field, value in incoming.items():
        if value not in (None, [], ""):
            setattr(session.plan.trip_profile, field, value)

session.history.append({"role": "user", "content": request.message})
```

This mirrors the "strip empty values before applying" pattern already established by `_sanitize_args` (`orchestrator.py:143`) — only genuinely-set fields overwrite the (currently blank) profile.

#### [MODIFY] `services/api/agent/prompt.py`

Rewrite the EXPLORE mode "First Turn" instruction (`MODE_INSTRUCTIONS["explore"]`, item 1, currently `prompt.py:22`) — today it reads:

> "**First Turn**: You MUST use your tools to update the trip profile AND suggest candidates on your first turn. Extract all profile info from the opening message, then immediately provide 3 candidate destinations to get the user inspired."

Replace with an instruction that reflects a pre-populated profile and re-points the model's first action squarely at suggestions:

> "**First Turn**: The traveler's core trip details (origin, traveler type, timing, duration, budget, and vacation type where given) are already filled in from their onboarding choices — they're visible in the state above. Do NOT re-ask for or restate them. Use your first turn to immediately suggest 3 destinations that fit what's known so far, and use the conversation to surface what onboarding *can't* capture — likes, things to avoid, and the traveler's deeper motivations."

This removes the redundant "extract everything" instruction (the source of the wasted Turn 1) and addresses the planning note that candidate suggestion on the opening turn is "about 50:50 at best" by making it the primary first action rather than a secondary one alongside profile extraction.

---

## 4. Phase 2: Agent Logic & Prompt Fixes

### 4.1 Top-3-Includes-Shortlist — fixed at the source, in code

**Root cause, traced**: `_apply_tool_call`'s `suggest_candidates` branch (`orchestrator.py:178–206`) upserts every incoming candidate by name, *preserving* `existing_status` (`line 190`) when a name already exists. That correctly stops a re-suggested shortlisted destination from being demoted — but it does **not** stop that destination from consuming one of the model's 3 proposed slots. The candidate list shown in the LLM's state JSON includes each candidate's `status` (`_clean_candidates_for_prompt`, `prompt.py:88–102`), so the model can see a destination is shortlisted and still nominate it as part of its mandatory 3 — the upsert then keeps it `shortlisted` (correct), but the turn ends with fewer genuinely-new `suggested` candidates than intended. That's the exact "only 1 active candidate when 2 are shortlisted" symptom from Sprint 5 testing.

**Fix — at the point of upsert**: skip incoming candidates whose name matches an existing `shortlisted` candidate entirely. They're already confirmed and tracked; there's nothing to upsert, and — critically — they no longer consume one of the 3 slots:

```python
elif tool_name == "suggest_candidates":
    incoming = args.get("candidates", [])
    candidates_dict = {c.name.lower(): c for c in plan.candidates}

    for item in incoming:
        key = item["name"].lower()
        existing = candidates_dict.get(key)

        # A shortlisted destination is already confirmed — don't let the model
        # spend one of its 3 suggestion slots re-nominating it.
        if existing and existing.status == "shortlisted":
            continue

        photo_url = resolve_destination_photo(item["name"], item.get("region"))
        existing_status = existing.status if existing else "suggested"
        existing_best_for = existing.best_for if existing else None
        existing_seasonal_note = existing.seasonal_note if existing else None
        # ...unchanged from here
```

(Splice the `if existing and existing.status == "shortlisted": continue` check into the existing loop body at `orchestrator.py:183–203`; the rest of the upsert is unchanged.)

This guarantees the planning goal — "the goal is simply 3 active candidates, that's enforceable deterministically" — regardless of what the model outputs. It's the same "fix it in code, don't rely on model compliance for things you can guarantee" pattern Sprint 5 established with `_sanitize_args` and the `active_count` guard.

**Supporting prompt clarification** (secondary — reduces how often the code-level skip has to fire): add one clause to the EXPLORE instructions (`MODE_INSTRUCTIONS["explore"]`, item 2, `prompt.py:23`) — append to the existing "Ensure there are always at least 3 active 'suggested' candidates..." sentence:

> "...A shortlisted destination is a confirmed choice, not a slot to refill — the 3 active suggestions are always *new* options, distinct from anything already shortlisted."

### 4.2 Reduce Agent Verbosity

**Root cause**: The agent narrates its own tool writes back in chat ("I've added Paris, Lisbon, and Rome to your candidates...", restating profile values it just recorded) — duplicating what the Trip Profile chips and candidate cards already show, inflating message length, and compounding the token-budget problem from §3.1.

#### [MODIFY] `services/api/agent/prompt.py` — `SHARED_GUIDELINES` (`lines 6–14`)

Insert a new guideline after guideline 4 ("Take Action Naturally" — which already establishes "don't mention tools by name"), and renumber the two that follow:

> "5. **Don't Narrate Your Writes**: When you update the profile or candidates, do not list or recite what you just recorded ('I've noted you like X, Y, Z' / 'I've added A, B, C to your options'). The user can already see these changes reflected on screen. Acknowledge briefly in natural language and move straight to your questions — the structured surfaces do the showing; you do the asking."

---

## 5. Task Breakdown

### Phase 1: Backend Reliability
- [ ] **Task 1.1** — `orchestrator.py`: add `MAX_HISTORY_TURNS` constant and `_prune_history()`; call it once in `run_turn()` and use the pruned result for both Call 1 and Call 2 message arrays.
- [ ] **Task 1.2** — `LandingScreen.tsx`: persist `currentProfile` to `sessionStorage` as `onboardingProfile`, alongside the existing `initialMessage`.
- [ ] **Task 1.3** — `App.tsx`: read `onboardingProfile` from `sessionStorage` in `handleStartSession`; forward it to `sendMessage`.
- [ ] **Task 1.4** — `useAgent.ts`: add an `onboardingProfile` parameter to `sendMessage`; include `onboarding_profile` in the POST body; import `TripProfile`.
- [ ] **Task 1.5** — `main.py`: add `onboarding_profile: Optional[TripProfile]` to `ChatRequest`; on the session's first turn (gated on empty `session.history`), initialise `session.plan.trip_profile` from it, skipping empty values.
- [ ] **Task 1.6** — `prompt.py`: rewrite the EXPLORE "First Turn" instruction to reflect a pre-populated profile and make `suggest_candidates` the model's primary first action.

### Phase 2: Agent Logic & Prompt Fixes
- [ ] **Task 2.1** — `orchestrator.py` (`_apply_tool_call`, `suggest_candidates` branch): skip upserting incoming candidates that match an existing `shortlisted` candidate by name.
- [ ] **Task 2.2** — `prompt.py` (`MODE_INSTRUCTIONS["explore"]`): append the clarification that the 3 active suggestions exclude shortlisted destinations.
- [ ] **Task 2.3** — `prompt.py` (`SHARED_GUIDELINES`): insert the "Don't Narrate Your Writes" guideline; renumber items 5–6 to 6–7.

---

## 6. Verification Plan

### History Pruning
1. Run a long conversation (15+ turns, several involving tool calls). Confirm no `413` errors occur — and confirm pruning hasn't introduced `400`s (orphaned tool messages).
2. Temporarily log `len(pruned)` vs. `len(session.history)` per turn — confirm the pruned slice stays within the turn window while `session.history` keeps growing in full.
3. Confirm `session.history[0]` (the opening message) is present in the LLM-facing `messages` on every turn, even once the session has grown well past the pruning window.

### Initial Intake Bypass
4. Fill out the landing-screen sentence builder and start a session. Check the network tab — confirm `onboarding_profile` appears in the first `POST /chat` body and matches the form values.
5. Inspect the Trip Profile panel right after the agent's first reply — confirm origin/travelers/when/duration/budget/vacation_type are populated *without* the agent calling `update_trip_profile` on Turn 1 (check server logs for the `🔧 Tool:` line — it shouldn't appear for `update_trip_profile` on turn 1 unless the user volunteered something new in their opening message).
6. Confirm the agent's first reply calls `suggest_candidates` and surfaces 3 destinations. Repeat across a handful of fresh sessions to gauge whether this is now more consistent than the "50:50" baseline noted in planning.

### Top-3-Includes-Shortlist
7. Reach 3 suggested candidates, shortlist 2 of them, then send a message that would normally prompt re-suggestion (e.g. reveal a new preference). Confirm the grid shows 3 *active* (`status == "suggested"`) candidates — not 1.
8. Check the server log line `🔧 Tool: suggest_candidates | Args: ...` and the resulting `Candidates updated: N suggestions` summary — confirm any shortlisted name the model nominates is silently skipped rather than counted.

### Agent Verbosity
9. Across a few turns that update the profile and candidates, read the agent's chat replies — confirm they acknowledge briefly ("Got it, let's see what fits...") rather than reciting what was written ("I've added Paris, Lisbon, and Rome...").

---

## 7. Constraints Carried Forward into Sprint 7

1. Flat JSON tool schemas only — no Pydantic schema generation for Groq tools; `additionalProperties` not used.
2. Dual-call conditional ReAct loop preserved.
3. Client owns `uiState.mode` — server responses must not override it.
4. Candidate upsert by `name.lower()` — never replace the full array (now with the shortlist-skip exception documented in §4.1).
5. State JSON to LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`).
6. Tool names never appear in system prompt instructions.
7. History is truncated, not summarised, this sprint — revisit only if truncation proves lossy in practice.
8. Learning notebooks are not part of the build process.
