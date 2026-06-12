# Sprint 8 Implementation Spec: Tool-Call Reliability & Agent Proactivity

## 1. Executive Alignment

Sprint 8 addresses the two problems named in the Sprint Goal:

1. **A session should be able to reach and complete the Decision phase without a fatal tool error.** The dominant failure mode is the 400 `tool_use_failed` error — Groq rejects a response where the model wrote a tool call as `<function=name>{...}</function>` text instead of a structured `tool_calls` entry. The `failed_generation` field in the error payload confirms the model's *intent* was correct; only the format was wrong. There is currently no retry — this is treated as fatal and the whole turn fails with a 500.
2. **The agent should use tools proactively without being prompted**, keeping ≥3 active candidates on screen, and its questions should force genuine trade-offs rather than "do you like A, B, or C?" menus.

This spec covers exactly the two phases agreed in `docs/sprint-8-planning.md` §5, informed by the three decisions resolved in §7:

- **Decision 1**: Single retry on `tool_use_failed`, no fallback-model escalation. This spec decides the retry mechanism: a one-off corrective "fix the format" nudge appended for the retry attempt only (rationale in §3.1).
- **Decision 2**: `GROQ_FALLBACK_MODEL` → `openai/gpt-oss-120b`. Role unchanged (429 fallback only); no dedicated comparison test plan.
- **Decision 3**: Forced `tool_choice="required"` for candidate refilling is **deferred** — not designed or built in this spec. See §6.

**Architectural constraints inherited from prior sprints — must not be violated:**
- Flat hand-written JSON tool schemas only; no `additionalProperties` in Groq tool schemas.
- Dual-call conditional ReAct loop preserved.
- Client owns `uiState.mode`. Server responses must not override it.
- Candidate upsert by `name.lower()` — never replace the full candidates array; shortlisted names skipped; un-rejected candidates deleted from `session.plan.candidates`.
- State JSON sent to the LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`).
- History is truncated, not summarised — `MAX_HISTORY_TURNS = 4`.
- Tool names never appear in system prompt instructions.
- Learning notebooks are not part of the build process.

---

## 2. Scope & Non-Goals

### In Scope

**Phase 1: Tool-call reliability** (`services/api/agent/orchestrator.py`)
- Single same-model retry on Groq 400 `tool_use_failed`, scoped to `_call_llm`, applied to whichever model (primary or fallback) is serving the current attempt — no cross-model escalation.
- Targeted logging of `failed_generation` content, on both the initial failure and (if the retry also fails) the retry failure.

**Phase 2: Prompt proactivity & backup model** (`services/api/agent/prompt.py`, `services/api/agent/orchestrator.py`, `services/api/core/config.py`)
- Reframe the agent's top-level job description and the EXPLORE mode job description around two equal, linked halves — understanding the traveler through conversation, and keeping candidates/profile current with that understanding — so the agent acts on what it learns the same turn rather than letting its understanding get ahead of the screen.
- Replace the EXPLORE mode's example diagnostic questions (currently menu-style) with trade-off-framing guidance and examples.
- Change `GROQ_FALLBACK_MODEL` default to `openai/gpt-oss-120b`.
- Remove the leftover "Sprint 4" naming in `prompt.py` (`TEMPLATE_SPRINT4`, `get_prompt_sprint4`) now that this file is being touched anyway.

### Non-Goals (this sprint)
- `tool_choice="required"` forcing for candidate refilling — deferred per planning §7 decision 3 (see §6).
- "Silent prose fallback" (model describes an action in prose with no tool call and no error) — not addressed by Phase 1, which targets the `tool_use_failed` *error* path specifically. Per planning discussion this failure mode is not currently prominent.
- Any change to question *count* (SHARED_GUIDELINES item 2, "always end with two questions") — only question *quality* is in scope.
- Multi-agent architecture, session persistence, landing page / UX work — Sprints 9-11.
- A dedicated backup-model comparison test — observe `openai/gpt-oss-120b` organically per planning §7 decision 2.

---

## 3. Phase 1: Tool-Call Reliability

### 3.1 Retry on `tool_use_failed`

**Evidence checked**: The installed `groq` SDK (`groq==0.37.1`) raises `groq.BadRequestError` (subclass of `APIStatusError`) for 4xx responses. `_base_client.py` (`_make_status_error_from_response`) sets `error.body = response.json()` whenever the body is valid JSON — so for a `tool_use_failed` response, `e.body` is a dict shaped like:

```json
{
  "error": {
    "message": "...",
    "type": "...",
    "code": "tool_use_failed",
    "failed_generation": "<function=suggest_candidates>{...}</function>"
  }
}
```

This gives a precise, structural detection: `isinstance(e, BadRequestError) and e.body.get("error", {}).get("code") == "tool_use_failed"`. The `failed_generation` string is exactly the content described in planning §2 — the model's correct intent, wrong syntax.

**Retry mechanism — corrective nudge, not verbatim retry**: A verbatim retry resends the exact same messages at the same (likely low/zero) temperature, so it risks reproducing the same output. Per planning §2, this failure is "context-length sensitive" and tends to recur under the same conditions (long history, mode transitions) — conditions that don't change between a verbatim first and second attempt. Instead, the retry appends **one extra `system`-role message** to the request, telling the model explicitly that its previous attempt used the wrong format and to use the structured tool-calling mechanism instead. This message is:
- Used **only** for the retry's API call.
- **Not** added to `new_messages` / `session.history` — it's a one-off corrective instruction for this API call, not part of the durable conversation.

If the retry also fails with `tool_use_failed`, that's the Phase 1 logging case (§3.2) — the exception propagates exactly as it does today (→ `run_turn`'s `except` block → `RuntimeError` → `main.py`'s `HTTPException(500)`). No behaviour change for the end user beyond "sometimes the request that used to fail now succeeds."

**Scope of the retry**: implemented inside `_call_llm`, so it applies uniformly to both Call 1 (`tool_choice="auto"`) and Call 2 (`tool_choice="none"`) without `run_turn` needing to know about it. `tool_use_failed` is expected almost exclusively on Call 1 (where the model is offered tools and choosing to use them), but putting the fix in `_call_llm` costs nothing extra and means Call 2 is covered too if it ever occurs there.

**Interaction with the rate-limit fallback** (per planning §7 decision 1 — "no escalation to the fallback model"): the retry-with-nudge logic is a self-contained helper (`call_with_retry`) applied to *whichever model is currently being called* — it never itself escalates across models. The 429 → `fallback_model` branch is unchanged and independent. The two compose: if `primary_model` hits `tool_use_failed`, it gets one same-model retry; if that's exhausted, the error propagates and is **not** escalated to `fallback_model` (per decision 1). If `primary_model` instead hits a 429, `fallback_model` is called — and if *it* raises `tool_use_failed`, it gets the same single same-model retry-with-nudge and `[TOOL FORMAT ERROR]` logging the primary would have gotten. This closes a gap an earlier draft of this spec left open (the fallback model's calls had no `tool_use_failed` handling at all) without adding any new escalation path — each model still gets at most one retry, on itself.

#### [MODIFY] `services/api/agent/orchestrator.py`

Add the import, a module-level nudge constant, and a small detection helper:

```python
from groq import BadRequestError

# ...near MAX_HISTORY_TURNS...

TOOL_FORMAT_NUDGE = {
    "role": "system",
    "content": (
        "Your previous response attempted to call a tool using invalid text-based "
        "syntax (e.g. `<function=name>{...}</function>`) instead of the structured "
        "tool-calling mechanism. Retry now using ONLY the structured tool_calls "
        "mechanism — do not write a function call as text in your response."
    ),
}
```

Add a helper method on `AgentOrchestrator`:

```python
def _tool_use_failed_generation(self, e: Exception) -> Optional[str]:
    """Return the `failed_generation` string if `e` is a Groq tool_use_failed 400, else None."""
    if isinstance(e, BadRequestError) and isinstance(e.body, dict):
        error = e.body.get("error", {})
        if error.get("code") == "tool_use_failed":
            return error.get("failed_generation", "")
    return None
```

Rewrite `_call_llm` (currently `orchestrator.py:151-175`):

```python
def _call_llm(self, messages: list, tools: list = None, tool_choice: str = None, json_mode: bool = False):
    """Primary LLM call with fallback on rate limits. Either model gets a single
    same-model retry-with-nudge if it returns a tool_use_failed 400."""
    primary_model = settings.GROQ_PRIMARY_MODEL
    fallback_model = settings.GROQ_FALLBACK_MODEL

    def call_api(model_name, msgs):
        kwargs = {
            "model": model_name,
            "messages": msgs,
        }
        if tools:
            kwargs["tools"] = tools
        if tool_choice:
            kwargs["tool_choice"] = tool_choice
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        return self.client.chat.completions.create(**kwargs)

    def call_with_retry(model_name, msgs):
        """Call `model_name`; on tool_use_failed, retry once on the same model with a format nudge."""
        try:
            return call_api(model_name, msgs)
        except Exception as e:
            failed_generation = self._tool_use_failed_generation(e)
            if failed_generation is None:
                raise
            print(f"⚠️  [TOOL FORMAT ERROR] {model_name} emitted a tool call as text "
                  f"instead of structured tool_calls. Retrying once with a format nudge.\n"
                  f"failed_generation: {failed_generation}")
            try:
                return call_api(model_name, msgs + [TOOL_FORMAT_NUDGE])
            except Exception as e2:
                retry_failed_generation = self._tool_use_failed_generation(e2)
                if retry_failed_generation is not None:
                    print(f"❌ [TOOL FORMAT ERROR] {model_name} failed again after retry.\n"
                          f"failed_generation: {retry_failed_generation}")
                raise

    try:
        return call_with_retry(primary_model, messages)
    except Exception as e:
        if "rate_limit_exceeded" in str(e) or "429" in str(e):
            print(f"⚠️  Rate limit on {primary_model}. Falling back to {fallback_model}...")
            return call_with_retry(fallback_model, messages)
        raise
```

### 3.2 Targeted Error Logging

Covered by the `print(...)` calls in §3.1 above — no separate code path needed. Both log lines:
- Are prefixed `[TOOL FORMAT ERROR]` so they're easy to `grep` for in server output, matching the format suggested in planning §2/§3.
- Include the full `failed_generation` string — the model's actual (correctly-intentioned) output — so the PM can see exactly what the model tried to do without needing the debug panel.
- Distinguish the first failure (`⚠️`, retrying) from a failure that persists after retry (`❌`, propagating to the 500 the user already sees today).

This is backend console logging only — no new API fields, no debug-panel changes.

### 3.3 Diagnostic Forcing: `tool_choice="required"` when candidates are low

Per planning §7 decision 3, forcing `tool_choice` for candidate refilling was deferred entirely. Revisiting it now, repurposed primarily as a **stress test for §3.1**: forcing Call 1 to make *some* tool call when candidates are low increases the number of tool-calling attempts during testing, which increases the chance of actually observing `tool_use_failed` and confirming the retry-with-nudge recovers from it — rather than waiting for it to occur naturally and rarely.

**Design**: reuse the *same* `active_count < 3` condition that already triggers the existing text note (`orchestrator.py:296-300`) — rather than introducing a second threshold with a second mechanism, the one condition now does both: append the text note **and** escalate Call 1's `tool_choice` from `"auto"` to `"required"`.

#### [MODIFY] `services/api/agent/orchestrator.py` — `run_turn` (currently `orchestrator.py:296-308`)

```python
# Inject dynamic instruction to ensure 3 active (non-rejected) candidates in explore mode
call_1_tool_choice = "auto" if tools_for_mode else None
if plan.mode == "explore":
    active_count = len([c for c in plan.candidates if c.status == "suggested"])
    if active_count < 3:
        system_msg += f"\n\nNote: there are currently only {active_count} active suggested destination(s). You MUST include new candidate suggestions in your response this turn so the list of active candidates stays above 3."
        if tools_for_mode:
            call_1_tool_choice = "required"

messages = [{"role": "system", "content": system_msg}] + pruned_history

try:
    response = self._call_llm(
        messages=messages,
        tools=tools_for_mode if tools_for_mode else None,
        tool_choice=call_1_tool_choice,
    )
```

**Scope note**: `tool_choice="required"` forces the model to call *some* tool on Call 1 — it does not target `suggest_candidates` specifically. This sprint does not claim it as a validated fix for the candidate-refill UX gap (planning §7 decision 3's original motivation); its purpose here is to manufacture more tool-calling attempts for §3.1's stress test, under the same condition that already asks the model to refill candidates in text. Whether it *also* measurably improves candidate-refill reliability is something to observe during testing, not something this spec designs for — see §6.

**Removal criteria** (unchanged from the original deferred note): trivial to remove — a one-line revert of `call_1_tool_choice`. If it destabilises tool-calling further (more `tool_use_failed`, not less), pull it.

---

## 4. Phase 2: Prompt Proactivity & Backup Model

### 4.1 Prompt Redesign for Proactivity

**Reading EXPLORE mode as one piece, not a list of independent edits**: Sprint 6 already made moves in this direction (`SHARED_GUIDELINES` item 5 "Keep the Candidate Panel Full", item 4 "Don't Narrate Your Writes", and the EXPLORE "First Turn" rewrite making `suggest_candidates` the primary first action). Planning §2 confirms the underlying tendency persists — but the mode's title, "Diagnostic Profiler & Matchmaker", already correctly names the job as **two equal halves**: understand the traveler, and match them to candidates. The bug isn't that one half is missing, and it isn't that conversation needs to be subordinated to candidate-refresh — it's that the *link* between the two halves is weak. The agent extracts preferences (half 1) but doesn't reliably act on them by refreshing candidates (half 2) in the same turn. So this phase doesn't redefine the job or add a new standalone "be proactive" rule — it makes that link explicit, once, as the headline both at the top-level template and in EXPLORE's job statement, and lets the existing items (1, 2, 4 — already well-aligned) and the rewritten item 3 serve that framing.

**Considered and dropped**: an earlier draft of this spec proposed appending an "act now, don't defer" sentence to `SHARED_GUIDELINES` item 3 ("Take Action Naturally"). Dropped — `SHARED_GUIDELINES` item 5 and EXPLORE item 2 already say this in their own words, and the rewritten job statements below now state the link explicitly too. A fourth near-restatement in a fourth location is exactly the "agents love to append sentences" pattern to avoid.

#### [MODIFY] `services/api/agent/prompt.py` — opening sentence of the system prompt template (currently `TEMPLATE_SPRINT4`, line 60)

Also renamed as part of §4.2 — shown here under its new name `TEMPLATE`:

```python
# Before:
TEMPLATE_SPRINT4 = """You are an expert Travel Consultant. Your job is to help the user find their ideal next vacation through intelligent diagnosis and structured comparison.

# After:
TEMPLATE = """You are an expert Travel Consultant. Your job has two equal parts: understand the traveler — through natural conversation about their preferences, constraints, and motivations — and keep what's shown on screen (trip profile, destination candidates, comparisons) reflecting that understanding. The two are linked: whenever the conversation teaches you something new, act on it the same turn by updating what's shown — don't let your understanding get ahead of the screen.
```

#### [MODIFY] `services/api/agent/prompt.py` — `MODE_INSTRUCTIONS["explore"]` job description (currently line 20)

```python
# Before:
Your job: Extract travel preferences and surface the 3 best-matching destination candidates constantly as the profile becomes clearer.

# After:
Your job here has two equal halves: build genuine understanding of the traveler — their preferences, constraints, and deeper motivations — through conversation, and keep the 3 candidate suggestions matched to that understanding at all times. The moment something you learn would change what the best 3 destinations are, update the candidates this turn — don't let your understanding of the traveler get ahead of what's on screen.
```

#### [MODIFY] `services/api/agent/prompt.py` — `MODE_INSTRUCTIONS["explore"]` item 3 (currently line 25)

This is the direct fix for planning §2's "questions rarely force a trade-off" item, using the example given there almost verbatim. It serves the "build genuine understanding" half of the job statement above:

```python
# Before:
3. **Stay Conversational**: Frame your extraction as natural dialogue. Ask diagnostic questions that help you to understand real preferences and desired experiences, e.g. "Have you been to this type of location before?" or "What draws you to hiking — mountain views, wildlife, or solitude?"

# After:
3. **Ask Trade-off Questions, Not Menu Questions**: Avoid questions that list several good options and invite a "yes to all" (e.g. "Do you like mountains, forests, or coastlines?") — they don't narrow anything down. Instead, frame questions as genuine trade-offs between two competing values, where the answer changes what you'd recommend — e.g. "Would you rather somewhere peaceful and remote, or somewhere with good infrastructure and restaurants nearby?" or "Is it more important that this trip feels relaxing, or that it feels like an adventure?" A good question narrows the field toward a recommendation; a menu question doesn't.
```

No other items in `SHARED_GUIDELINES` or `MODE_INSTRUCTIONS` change. `MODE_INSTRUCTIONS["compare"]` and `["decision"]` are untouched — planning §2's questioning-pattern complaint is specific to EXPLORE, and COMPARE already ends with "a single driving question" (different pattern, not in scope).

### 4.2 Naming Cleanup: Remove "Sprint 4" References

Now that `prompt.py` is being edited anyway — `TEMPLATE_SPRINT4` and `get_prompt_sprint4` are the last "Sprint 4" references in the codebase (confirmed via `grep -rn "SPRINT4\|sprint4" services/api`). Both are renamed; pure rename, no behaviour change.

#### [MODIFY] `services/api/agent/prompt.py`

- `TEMPLATE_SPRINT4` → `TEMPLATE` (class attribute, line 60; content change is in §4.1 above).
- `get_prompt_sprint4` classmethod (line 104) → `get_system_prompt`. (`get_prompt` is already taken by the separate legacy method at line 119, used by the prototype orchestrator — out of scope, left alone.) Update its internal reference from `cls.TEMPLATE_SPRINT4` to `cls.TEMPLATE` (line 111).

#### [MODIFY] `services/api/agent/orchestrator.py`

Update both call sites:

```python
# orchestrator.py:294
system_msg = SystemPrompts.get_system_prompt(plan_dict, plan.mode)

# orchestrator.py:358
system_msg_updated = SystemPrompts.get_system_prompt(plan_dict_updated, plan.mode)
```

### 4.3 Backup Model Change

#### [MODIFY] `services/api/core/config.py`

```python
# Before:
GROQ_FALLBACK_MODEL: str = "qwen/qwen3-32b"

# After:
GROQ_FALLBACK_MODEL: str = "openai/gpt-oss-120b"
```

No `.env` file in this repo overrides `GROQ_FALLBACK_MODEL`, so the new default takes effect immediately. Role is unchanged — `_call_llm`'s existing 429 branch is the only caller of `fallback_model`. Per planning §7 decision 2, there's no dedicated test session for this; observe its behaviour (markdown output, comparison matrix handling, exposed reasoning — the three issues logged against `qwen/qwen3-32b` in Sprint 7's result doc) organically whenever the 429 path triggers during normal use.

---

## 5. Task Breakdown

### Phase 1: Tool-Call Reliability
- [ ] **1.1** — `orchestrator.py`: add `from groq import BadRequestError`, the `TOOL_FORMAT_NUDGE` constant, and the `_tool_use_failed_generation` helper.
- [ ] **1.2** — `orchestrator.py`: rewrite `_call_llm` per §3.1 — single retry on `tool_use_failed` with the nudge appended only for the retry call; `[TOOL FORMAT ERROR]` logging on first failure and (if retry fails) on the retry failure; existing rate-limit fallback behaviour unchanged.
- [ ] **1.3** — `orchestrator.py`: in `run_turn`, reuse the existing `active_count < 3` condition to also escalate Call 1's `tool_choice` from `"auto"` to `"required"` (§3.3) — diagnostic stress test for §3.1's retry path.

### Phase 2: Prompt Proactivity & Backup Model
- [ ] **2.1** — `prompt.py`: rename `TEMPLATE_SPRINT4` → `TEMPLATE` and reframe its opening sentence (§4.1).
- [ ] **2.2** — `prompt.py`: reframe `MODE_INSTRUCTIONS["explore"]` job description sentence (§4.1).
- [ ] **2.3** — `prompt.py`: replace `MODE_INSTRUCTIONS["explore"]` item 3 with trade-off question guidance (§4.1).
- [ ] **2.4** — `prompt.py`: rename `get_prompt_sprint4` → `get_system_prompt`; update its internal `TEMPLATE` reference (§4.2).
- [ ] **2.5** — `orchestrator.py`: update both `get_prompt_sprint4` call sites (lines 294, 358) to `get_system_prompt` (§4.2).
- [ ] **2.6** — `config.py`: change `GROQ_FALLBACK_MODEL` default to `"openai/gpt-oss-120b"` (§4.3).

---

## 6. Deferred: Forcing a *Specific* Tool (`suggest_candidates`) for Candidate Refilling

§3.3 forces Call 1 to call *some* tool when `active_count < 3`, primarily as a stress test for §3.1's retry path. It does not force `suggest_candidates` specifically — Groq's API also supports `tool_choice={"type": "function", "function": {"name": "..."}}` to force a *named* tool, which would more directly target the candidate-refill UX gap from planning §7 decision 3.

This remains out of scope for this sprint:
- It's a more invasive, less "trivial to remove" change than §3.3's `"required"`.
- Whether it's even needed depends on what testing (§7) shows once §3.3 is in place — if forcing *any* tool call is enough to get `suggest_candidates` called when candidates are low, the named-tool version adds complexity without benefit.

No design beyond this is proposed now.

---

## 7. Verification Plan

Both phases are implemented before testing begins, and verified together in a single combined test pass (Phase 1 and Phase 2 headers below group items by what they test, not by separate test sessions).

### Phase 1
1. Reproduce a `tool_use_failed` scenario (planning §2 notes this is more likely later in a session and on mode transitions back to Explore; §3.3's `tool_choice="required"` escalation increases the odds of seeing this during the combined test). Confirm: server logs show `⚠️ [TOOL FORMAT ERROR] ... failed_generation: ...`; if the retry succeeds, the turn completes normally with no 500 to the frontend.
2. If a retry-exhausted case occurs, confirm the second log line (`❌ [TOOL FORMAT ERROR] ... failed again after retry`) appears with its own `failed_generation`, and the frontend shows the same "Error connecting to agent" it does today (no regression — just better logs).
3. Run a normal session with no `tool_use_failed` errors. Confirm no extra LLM calls are made and the nudge message never appears in `session.history` (inspect via network response / server logs).
4. Confirm the 429 → fallback-model path still works independently (e.g. by temporarily exhausting the primary model's rate limit) — `_call_llm`'s rate-limit branch is unchanged. If `tool_use_failed` happens to occur on the fallback model during this test, confirm it gets the same `⚠️ [TOOL FORMAT ERROR] {fallback_model}...` retry-with-nudge treatment as the primary would (logs should name `fallback_model`, not `primary_model`).
5. With `active_count < 3`, confirm Call 1's `tool_choice` is `"required"` and observe the resulting error rate. If `tool_use_failed` still occurs frequently even with §3.1's retry in place, that's the signal to revisit the proactive prompt-guidance idea discussed during spec review (extending guideline 3 in `SHARED_GUIDELINES` to name the `<function=...>` text-syntax failure mode directly) — not designed in this spec.

### Phase 2
6. Run a fresh Explore session for several turns, volunteering new preferences without explicitly asking for new candidates. Confirm the agent updates the profile and refreshes/adds candidates the same turn it learns something new, rather than waiting to be prompted (planning §2's "had to be prompted explicitly... more than once").
7. Read the agent's questions across an Explore session — confirm they read as trade-offs ("Would you rather X or Y?" / "Is it more important that... or...?") rather than menus ("Do you like A, B, or C?").
8. Whenever the 429 fallback triggers organically during testing, note `openai/gpt-oss-120b`'s behaviour re: markdown formatting, comparison matrix completeness, and exposed reasoning, for future reference — no dedicated test session required.
9. Confirm `grep -rn "SPRINT4\|sprint4" services/api/` returns no results. The rename (`TEMPLATE_SPRINT4` → `TEMPLATE`, `get_prompt_sprint4` → `get_system_prompt`) is purely cosmetic — response content should be unaffected by the rename itself (only by the wording changes in §4.1).

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
10. **New this sprint**: `tool_use_failed` retry is single-attempt per model (same-model only, no cross-model escalation), applies to whichever model — primary or fallback — is serving the current attempt, and lives entirely inside `_call_llm` — no caller-visible signature change.
