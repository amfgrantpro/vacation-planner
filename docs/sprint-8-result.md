# Sprint 8 Final State: Tool-Call Reliability & Agent Proactivity

**Status**: Complete
**Date**: 12th June 2026

This document describes the end of Sprint 8 code state.

---

## 1. Summary

Sprint 8 implements both phases from `docs/sprint-8-spec.md`. Phase 1 adds a same-model retry-with-nudge for Groq's `tool_use_failed` 400 error, plus targeted `[TOOL FORMAT ERROR]` logging, and escalates Call 1's `tool_choice` to `"required"` when active candidates drop below 3. Phase 2 reframes the system prompt around acting on new information the same turn, replaces EXPLORE mode's menu-style example questions with trade-off framing, switches `GROQ_FALLBACK_MODEL` to `openai/gpt-oss-120b`, and removes the leftover "Sprint 4" naming in `prompt.py`. All 9 task-breakdown items (1.1–1.3, 2.1–2.6) are implemented.

---

## 2. Sprint 7 → Sprint 8: Before vs. After

| Dimension | Sprint 7 (Before) | Sprint 8 (After) |
|---|---|---|
| **`tool_use_failed` handling** | Fatal — any `tool_use_failed` 400 propagated straight to `RuntimeError` → 500 | `_call_llm` detects `tool_use_failed` via `_tool_use_failed_generation`, logs `failed_generation`, and retries once on the same model with `TOOL_FORMAT_NUDGE` appended (nudge is not persisted to `session.history`) |
| **Retry scope** | n/a | Applies to whichever model is serving the current attempt (primary or fallback) — no cross-model escalation; the existing 429 → fallback-model path is unchanged |
| **Error logging** | Failures surfaced only as the generic 500 traceback | `⚠️ [TOOL FORMAT ERROR] {model} emitted a tool call as text...` on first failure; `❌ [TOOL FORMAT ERROR] {model} failed again after retry.` if the retry also fails — both log `failed_generation` |
| **Call 1 `tool_choice` when candidates low** | `"auto"` always | Escalates to `"required"` when `active_count < 3` (same condition that already injects the refill note) — diagnostic stress test for the retry path |
| **System prompt framing** | Top-level and EXPLORE job descriptions treated "understand the traveler" and "keep candidates current" as separate activities | Reframed around acting on new understanding the same turn — "don't let your understanding get ahead of the screen" |
| **EXPLORE example questions** | Menu-style ("Do you like mountains, forests, or coastlines?") | Trade-off framing ("Would you rather X or Y?", "Is it more important that... or...?") |
| **`GROQ_FALLBACK_MODEL`** | `qwen/qwen3-32b` | `openai/gpt-oss-120b` |
| **`prompt.py` naming** | `TEMPLATE_SPRINT4`, `get_prompt_sprint4` | `TEMPLATE`, `get_system_prompt` (both `orchestrator.py` call sites updated) |

---

## 3. Phase 1: Tool-Call Reliability (`orchestrator.py`)

- **`TOOL_FORMAT_NUDGE`**: a module-level `system`-role message instructing the model to retry using only the structured `tool_calls` mechanism. Appended only to the retry API call — never written to `new_messages` or `session.history`.
- **`_tool_use_failed_generation(e)`**: returns the `failed_generation` string from a Groq `BadRequestError` if `e.body["error"]["code"] == "tool_use_failed"`, else `None`.
- **`call_with_retry(model_name, msgs)`**: calls the model once; on `tool_use_failed`, logs `⚠️ [TOOL FORMAT ERROR] ...` with the `failed_generation`, then retries once on the same model with `TOOL_FORMAT_NUDGE` appended. If the retry also fails with `tool_use_failed`, logs `❌ [TOOL FORMAT ERROR] {model} failed again after retry.` with its `failed_generation` and re-raises.
- **`_call_llm`** now routes both the primary-model call and the 429 fallback-model call through `call_with_retry`, so the fallback model gets the same retry-with-nudge treatment if it hits `tool_use_failed`.
- **`tool_choice` escalation**: in `run_turn`, when `plan.mode == "explore"` and `active_count < 3`, Call 1's `tool_choice` is now `"required"` (was `"auto"`), in addition to the existing text note injected into the system prompt.

---

## 4. Phase 2: Prompt Proactivity & Backup Model (`prompt.py`, `orchestrator.py`, `config.py`)

- **Top-level template** (`TEMPLATE`, formerly `TEMPLATE_SPRINT4`): retains the original "help the user find their ideal next vacation through intelligent diagnosis and structured comparison" goal sentence, with a new sentence appended that frames the agent's job as acting on new information the same turn it's learned — updating trip profile, candidates, and comparisons — rather than letting understanding outpace the screen. Kept generic since this template is shared across COMPARE and DECISION modes, not just EXPLORE.
- **EXPLORE mode job description**: frames understanding-the-traveler and keeping-candidates-current as two equal, linked halves of the same job, retaining the original "best-matching" and "constantly" language describing how the candidate panel should track the traveler's profile.
- **EXPLORE mode item 3**: replaced the menu-style example questions with guidance to frame questions as genuine trade-offs between competing values, with new examples ("Would you rather somewhere peaceful and remote, or somewhere with good infrastructure and restaurants nearby?", "Is it more important that this trip feels relaxing, or that it feels like an adventure?").
- **Naming cleanup**: `TEMPLATE_SPRINT4` → `TEMPLATE`, `get_prompt_sprint4` → `get_system_prompt`; both call sites in `orchestrator.py` (Call 1 and Call 2 system prompt construction) updated. `grep -rn "SPRINT4\|sprint4" services/api/` returns no results.
- **Backup model**: `GROQ_FALLBACK_MODEL` default changed from `qwen/qwen3-32b` to `openai/gpt-oss-120b`. Role unchanged — 429 fallback only.

---

## 5. Constraints Carried Forward

1. Flat JSON tool schemas only — no Pydantic schema generation for Groq tools; `additionalProperties` not used.
2. Dual-call conditional ReAct loop preserved.
3. Client owns `uiState.mode` — server responses must not override it.
4. Candidate upsert by `name.lower()` — never replace the full array; shortlisted names skipped; un-rejected candidates deleted from `session.plan.candidates`.
5. State JSON to LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`).
6. History is truncated, not summarised — `MAX_HISTORY_TURNS = 4`.
7. Tool names never appear in system prompt instructions.
8. `TOOL_FORMAT_NUDGE` is a one-off corrective message for a single retry call — never persisted to `session.history`.
9. The `tool_use_failed` retry is single-shot and same-model only — no cross-model escalation.
10. Learning notebooks are not part of the build process.

---

## 6. Directory Map (Post-Sprint 8)

```
vacation-planner/
├── docs/
│   ├── sprint-8-planning.md
│   ├── sprint-8-spec.md
│   └── sprint-8-result.md              ← THIS FILE
│
└── services/api/
    ├── agent/
    │   ├── orchestrator.py             Updated: TOOL_FORMAT_NUDGE, _tool_use_failed_generation,
    │   │                                call_with_retry; tool_choice="required" escalation;
    │   │                                get_prompt_sprint4 → get_system_prompt call sites
    │   └── prompt.py                   Updated: TEMPLATE_SPRINT4 → TEMPLATE; get_prompt_sprint4 →
    │                                    get_system_prompt; EXPLORE mode + top-level reframe;
    │                                    trade-off question guidance
    └── core/
        └── config.py                  Updated: GROQ_FALLBACK_MODEL → openai/gpt-oss-120b
```

---

## 7. Testing Results

**Phase 2 validated positively:**
- Agent proactivity is good — the agent updates the profile, candidates, and comparisons in step with the conversation without needing to be prompted.
- The `tool_choice="required"` escalation (§3.3) reliably forces tool calls when active candidates are low, confirmed over many repeated calls in a forced test run.
- The new fallback model (`openai/gpt-oss-120b`) is a clear improvement over `qwen/qwen3-32b`: tool calls continue without a hitch on fallback, and output quality is good — it does not overwrite the trip profile or comparison matrix the way the old fallback did (Sprint 7 §7 item 3).

**Phase 1 (retry/logging) not exercised under normal conditions:** for most of the session, no `tool_use_failed` errors occurred naturally, so the retry-with-nudge mechanism (§3.1) and its logging (§3.2) were not validated either way during that period.

**One `tool_use_failed` was eventually observed**, unfortunately it fired on Call 2 (`tool_choice="none"`). The agent almost always knows to call tools within a single turn (Call 1) - it has not been observed before that a model tried one tool on Call 1 and then a second on Call 2. So we learned that the retry fired and logged correctly, but it couldn't fix the turn because the nudge message just made the model produce the same wrong output again. The retry only helps when the format is wrong on Call 1; it can't help at all if the agent is trying to use a tool on Call 2. The retry on Call 2 should be removed — it's dead code in that path and adds a redundant LLM call that still results in a 500.