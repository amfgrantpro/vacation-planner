# Sprint 9 Final State: Multi-Agent Architecture & Context Sharding

**Status**: Complete
**Date**: 13th June 2026

This document describes the end of Sprint 9 code state.

---

## 1. Summary

Sprint 9 implements all three phases from `docs/sprint-9-spec.md` together, due to the tight coupling between them (Phase 1's `AgentConfig` depends on Phase 3's `ExplorePrompts`/`ComparisonPrompts`, and Phases 1 & 2 both edit `run_turn`). The single `AgentOrchestrator` is now a parameterised class instantiated twice — an Explore agent and a Comparison/Decision agent — each with its own system prompt provider, tool list, and Groq API key, selected per turn by a new mode-based router. The dead Call 2 tool-retry is removed. `_prune_history` is rewritten from a last-N-messages slice to a two-pass scheme that keeps every user message plus the last `MAX_HISTORY_TURNS` turns' assistant replies. The single `SystemPrompts` class is split into `BasePrompts`/`ExplorePrompts`/`ComparisonPrompts`.

The PM live-tested the full build (Explore → Compare → Decision, with mode switching) immediately after implementation. The new architecture validated cleanly — both agents, the router, the second Groq account, and the rate-limit fallback all worked correctly in a real session. Three small content tweaks were made in direct response to that test (§6): `MAX_HISTORY_TURNS` raised from 4 to 5, the "end with TWO focused questions" guideline reduced to ONE for both agents, and a broken example string in the comparison-matrix instructions fixed. Two further observations from the live test — trip profile fields silently dropping on update, and the Comparison agent calling both its tools every turn regardless of new information — are logged as Sprint 10 planning input (§8) and were not addressed this sprint.

---

## 2. Sprint 8 → Sprint 9: Before vs. After

| Dimension | Sprint 8 (Before) | Sprint 9 (After) |
|---|---|---|
| **Orchestrator instances** | One `agent = AgentOrchestrator()`, shared across all modes | Two instances — `explore_agent`, `comparison_agent` — each built from its own `AgentConfig` |
| **Agent selection** | n/a — single instance handles every mode | `agent/router.py`: `get_agent(mode)` returns `explore_agent` for `"explore"`, else `comparison_agent` |
| **System prompt provider** | Single `SystemPrompts.get_system_prompt` | `BasePrompts.get_system_prompt`, specialised per agent via `ExplorePrompts`/`ComparisonPrompts` (`AgentConfig.prompts`) |
| **Tool list per turn** | Hardcoded in `run_turn` | `AgentConfig.tools_by_mode`, scoped to each agent — Explore never sees `generate_comparison_matrix`; Comparison/Decision never sees `suggest_candidates` |
| **Groq client / API key** | One cached client (`GROQ_API_KEY`) shared by both "halves" of the conversation | `get_groq_client(api_key)` caches per key — Explore uses `GROQ_API_KEY`, Comparison/Decision uses `GROQ_API_KEY_2` (independent rate-limit pool) |
| **Call 2 `tool_use_failed`** | Detected, logged, and retried with `TOOL_FORMAT_NUDGE` — Sprint 8 testing found this retry can never succeed on Call 2 | Still detected and logged (`⚠️`), but `allow_tool_retry=False` on Call 2 skips the retry and propagates immediately |
| **No-tool-call branch** | `run_turn` appended the reply to `new_messages` *and* `main.py` appended it again — duplicate assistant message in `session.history` | `new_messages` left empty; `main.py`'s final append is the sole writer, matching the tool-call branch |
| **`_prune_history`** | Last-N-messages slice with a special case retaining `history[0]` | Two-pass: every user message retained chronologically, plus the last `MAX_HISTORY_TURNS` turns' assistant replies; index-0 special case removed (redundant under the new scheme) |
| **Filter/prune order** | `_filter_history(_prune_history(...))` | `_prune_history(_filter_history(...))` — pruning now only ever sees clean `(user, assistant)` pairs |
| **`MAX_HISTORY_TURNS`** | `4` | `5` — raised after live testing showed the model benefits from more assistant-reply context |
| **`SHARED_GUIDELINES` "Drive Forward"** | "ALWAYS end with TWO focused questions..." | "ALWAYS end with ONE focused question..." — both agents |
| **Comparison matrix example criterion** | `(e.g., 'Weather', 'Drives on the', 'Top attractions')` — produced a nonsense "DRIVES ON THE" matrix row in live testing | `(e.g., 'Weather', 'Getting Around', 'Top attractions')` — matches the tool schema's own example |
| **`agent/prompt.py`** | Single `SystemPrompts` class (plus dead `get_prompt` legacy method) | `BasePrompts` (shared helpers), `ExplorePrompts`, `ComparisonPrompts` — `get_prompt` removed |

---

## 3. Phase 1: Orchestrator & Routing (`orchestrator.py`, `router.py`, `main.py`, `config.py`, `llm.py`)

- **`AgentConfig` dataclass**: `name`, `api_key`, `prompts` (a `BasePrompts` subclass providing `get_system_prompt`), `tools_by_mode` (`{mode: [tool_schema, ...]}`).
- **`EXPLORE_CONFIG`**: `name="explore"`, `api_key=settings.GROQ_API_KEY`, `prompts=ExplorePrompts`, tools for `"explore"` = `[TOOL_UPDATE_TRIP_PROFILE, TOOL_SUGGEST_CANDIDATES]`.
- **`COMPARISON_CONFIG`**: `name="comparison"`, `api_key=settings.GROQ_API_KEY_2 or settings.GROQ_API_KEY`, `prompts=ComparisonPrompts`, tools for `"compare"` = `[TOOL_UPDATE_TRIP_PROFILE, TOOL_GENERATE_COMPARISON_MATRIX]`, `"decision"` = `[]`.
- **`AgentOrchestrator.__init__(self, config)`**: stores `self.config` and resolves `self.client = get_groq_client(config.api_key)`. `_get_tools_for_mode` and both `run_turn` system-prompt call sites now read from `self.config`.
- **`agent/router.py`** (new): instantiates `explore_agent = AgentOrchestrator(EXPLORE_CONFIG)` and `comparison_agent = AgentOrchestrator(COMPARISON_CONFIG)` at module load, and exposes `get_agent(mode)` which routes `"explore"` to the Explore agent and everything else (`"compare"`, `"decision"`) to the Comparison/Decision agent.
- **`main.py`**: `from agent.router import get_agent` replaces the module-level `agent = AgentOrchestrator()`. The `/chat` handler now does `agent = get_agent(session.plan.mode)` immediately before `agent.run_turn(...)`. `/chat/prototype` and `PrototypeAgentOrchestrator` are untouched.
- **`core/config.py`**: new `GROQ_API_KEY_2: str = ""` setting, falling back to `GROQ_API_KEY` if unset. The PM has provisioned a real second Groq account and set this in `.env` — the two agents have independent rate-limit pools in practice, not just in code.
- **`core/llm.py`**: `get_groq_client(api_key: str = None)` now caches `Groq` client instances in a module-level `_clients` dict keyed by API key, defaulting to `GROQ_API_KEY` for callers (e.g. `prototype_orchestrator.py`) that pass no argument.
- **Call 2 retry removal**: `_call_llm` gains `allow_tool_retry: bool = True`. Call 1 keeps the Sprint 8 detect → log → nudge-retry → log-again behaviour. Call 2 now passes `allow_tool_retry=False` — a `tool_use_failed` there is still detected and logged with the `⚠️` line, but `call_with_retry` raises immediately instead of attempting a same-model retry that Sprint 8 testing showed can't succeed on Call 2.

---

## 4. Phase 2: Message History (`orchestrator.py`)

- **Duplicate assistant message fix**: the no-tool-call branch of `run_turn` now does only `text_reply = initial_text` and leaves `new_messages` empty. `main.py`'s final `session.history.append({"role": "assistant", "content": text_reply})` is the sole writer of the turn's assistant reply in both the tool-call and no-tool-call branches.
- **Two-pass `_prune_history`**: rewritten to take history that has already passed through `_filter_history` (so every message is a plain `{"role": "user"|"assistant", ...}`, no tool/tool_calls messages):
  - Pass 1: every `user`-role message index is collected — these are *always* retained, in chronological order, regardless of age.
  - Pass 2: if there are more than `MAX_HISTORY_TURNS` user messages, the cutoff is the index of the `MAX_HISTORY_TURNS`-th-from-last user message; everything from that index onward (user and assistant alike) is retained, and assistant replies before the cutoff are dropped.
  - The old index-0 special case (force-retaining `history[0]`, the onboarding-summary message) is removed — pass 1 already retains it as a user message.
- **Order swap**: `run_turn` now calls `self._prune_history(self._filter_history(conversation_history))` (previously the reverse order). This guarantees `_prune_history` only ever reasons about clean `(user, assistant)` pairs.
- This pruned history is also the sole handoff mechanism between the two agents on a mode switch — there is no separate handoff marker (per planning §7 decision 7). The Comparison agent's first call after a switch from Explore sees every prior user message from the Explore phase, giving it the traveler's full expressed preferences even though it has none of the Explore agent's own assistant replies.

---

## 5. Phase 3: Agent Prompt Splits (`prompt.py`)

- **`BasePrompts`**: not instantiated directly. Provides `_build_rejected_section` and `_clean_candidates_for_prompt` (both unchanged from the old `SystemPrompts`), and `get_system_prompt(cls, plan_dict, mode)`, which now does `cls.MODE_INSTRUCTIONS[mode]` — a `KeyError` on an unexpected mode is a fail-fast signal of a routing bug, rather than silently falling back to the Explore prompt as the old code did.
- **`ExplorePrompts(BasePrompts)`**: `TEMPLATE` describes the job as helping the user find their ideal vacation through diagnosis, updating "trip profile, destination candidates". `MODE_INSTRUCTIONS = {"explore": ...}` is the original EXPLORE instructions, unchanged. `SHARED_GUIDELINES` is the original 7-item list, with item 3 ("Take Action Naturally") trimmed to drop "...and comparison matrices" since this agent has no `generate_comparison_matrix` tool.
- **`ComparisonPrompts(BasePrompts)`**: `TEMPLATE` describes the job as helping the user compare shortlisted destinations and move toward a confident decision, updating "trip profile, comparison matrix". `MODE_INSTRUCTIONS = {"compare": ..., "decision": ...}` carries over both modes' instructions. `SHARED_GUIDELINES` is trimmed to 5 items — the Explore-only "Keep the Candidate Panel Full" and "Candidate Backdrop" guidelines are dropped, item 3 retargets to "comparison matrix updates", and "No Interrogation" is kept and renumbered.
- **Dead code removal**: the legacy `SystemPrompts.get_prompt` (a hardcoded fallback string, unused since `prototype_orchestrator.py` has its own separate `prototype_prompt.SystemPrompts`) is removed along with the old `SystemPrompts` class entirely. `grep -rn "SystemPrompts\|get_prompt\b" services/api/agent/` now returns only `prototype_orchestrator.py`/`prototype_prompt.py`, which are untouched.
- **`orchestrator.py` imports**: `from .prompt import ExplorePrompts, ComparisonPrompts`.

---

## 6. Live-Testing Tweaks

The PM ran a full session through the new architecture immediately after implementation — Explore → shortlist → Compare → Decision, including going back and forth between phases — and reported it working end-to-end: both agents handled their modes correctly, candidate suggestions and the comparison matrix populated via tool calls, photo resolution worked, and one Groq rate limit was hit and recovered via the `openai/gpt-oss-120b` fallback exactly as designed.

Three small content tweaks were made directly from this session's findings:

1. **`MAX_HISTORY_TURNS`: 4 → 5** (`orchestrator.py`). The PM judged that the agent could use one more turn of prior assistant-reply context for continuity.
2. **"Drive Forward" guideline: TWO questions → ONE** (`prompt.py`, `SHARED_GUIDELINES` in both `ExplorePrompts` and `ComparisonPrompts`). With the Sprint 8 trade-off-framed questions, two focused questions per turn read as excessive — the PM found one sufficient across all three modes. This also brings the default in line with `ComparisonPrompts.MODE_INSTRUCTIONS["compare"]` item 6, which already specified "a single driving question" as a Compare-mode override of the old "TWO" default; that override is now redundant with (rather than contradicting) the shared default, and was left in place as mode-specific framing.
3. **Comparison matrix example: `'Drives on the'` → `'Getting Around'`** (`prompt.py`, `ComparisonPrompts.MODE_INSTRUCTIONS["compare"]` item 2). The PM observed the live model take the `'Drives on the'` placeholder literally and generate a "DRIVES ON THE" matrix row filled with unrelated road descriptions. `'Getting Around'` is a real, sensible criterion and matches the example already present in `TOOL_GENERATE_COMPARISON_MATRIX`'s own description.

---

## 7. Constraints Carried Forward

1. Flat JSON tool schemas only — no Pydantic schema generation for Groq tools; `additionalProperties` not used in nested schemas (the top-level `matrix_rows` item's `additionalProperties: {"type": "string"}` predates this sprint and is unchanged).
2. Dual-call conditional ReAct loop preserved, per agent.
3. Client owns `uiState.mode` — server responses must not override it.
4. Candidate upsert by `name.lower()` — never replace the full array; shortlisted names skipped; un-rejected candidates deleted from `session.plan.candidates`.
5. State JSON to LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`), shared by both agents.
6. Tool names never appear in system prompt instructions.
7. `TOOL_FORMAT_NUDGE` is a one-off corrective message for a single retry call, never persisted to `session.history` — Call 1 only.
8. Learning notebooks are not part of the build process.
9. Lovable components remain visual references only — no UI work this sprint.
10. One `AgentOrchestrator` class, parameterised by `AgentConfig` — not separate orchestrator subclasses per agent.
11. No handoff marker in shared history — the two-pass pruned history (§4) is the sole handoff mechanism between agents on a mode change.
12. `GROQ_API_KEY_2` falls back to `GROQ_API_KEY` if unset, but the PM has provisioned and set a real second account — both agents have independent rate-limit pools in practice.

---

## 8. Directory Map (Post-Sprint 9)

```
vacation-planner/
├── docs/
│   ├── sprint-9-planning.md
│   ├── sprint-9-spec.md
│   └── sprint-9-result.md              ← THIS FILE
│
└── services/api/
    ├── agent/
    │   ├── orchestrator.py             AgentConfig, EXPLORE_CONFIG, COMPARISON_CONFIG;
    │   │                                AgentOrchestrator(config); allow_tool_retry on _call_llm;
    │   │                                two-pass _prune_history; MAX_HISTORY_TURNS = 5
    │   ├── router.py                   NEW: explore_agent, comparison_agent, get_agent(mode)
    │   └── prompt.py                   BasePrompts / ExplorePrompts / ComparisonPrompts
    │                                    (replaces SystemPrompts; legacy get_prompt removed)
    ├── core/
    │   ├── config.py                   GROQ_API_KEY_2 added
    │   └── llm.py                      get_groq_client(api_key) — per-key cached clients
    └── main.py                          from agent.router import get_agent;
                                          agent = get_agent(session.plan.mode) in /chat
```

---

## 9. Testing Results

**Architecture validated end-to-end in a live session**: the PM ran a full Explore → Compare → Decision flow, including switching back and forth between modes. Routing worked correctly throughout — candidate suggestions and trip profile updates fired in Explore, the comparison matrix populated for shortlisted destinations in Compare, and Decision mode handled the no-tools case cleanly. Unsplash photo resolution worked. A Groq rate limit was hit mid-session and the `openai/gpt-oss-120b` fallback (Sprint 8) handled it without disrupting the turn.

**No `tool_use_failed` errors were observed** during this session, so the Call 2 retry-removal (§3) was not exercised either way.

**Three issues surfaced and were addressed this sprint** (§6): question count tuned to one, `MAX_HISTORY_TURNS` raised to 5, and the broken `'Drives on the'` matrix example fixed.

**Two further observations were logged for Sprint 10 planning, not fixed this sprint** — see §10.

---

## 10. Known Gaps — Sprint 10 Planning Input

1. **Trip profile silently drops array items on update**: during the live session, the Explore agent's `update_trip_profile` call overwrote `likes`/`avoid` with a shorter list than before — some previously recorded items were dropped rather than carried forward, even though the tool description instructs the model to always send the complete current list. No code change was made this sprint; this needs investigation into whether it's a prompt/description issue (the model not reading the existing state correctly) or needs a server-side merge safeguard.
2. **Comparison agent calls both its tools every turn**: in Compare mode, the agent was observed calling both `update_trip_profile` and `generate_comparison_matrix` on every turn, even when there was nothing new to add to the trip profile. Not currently causing visible problems (the upsert/full-resend patterns mean redundant calls are harmless), but it's an extra LLM-driven tool call every turn with no benefit — worth tightening the Compare-mode prompt guidance on when each tool is actually needed.
3. **Explore agent re-records intake data on first turn**: on session start, the Explore agent calls `update_trip_profile` with the values already present from the intake form — origin, travelers, when, duration, vacation type — writing them back unchanged. The intake form pre-populates these fields in the trip profile before the first turn, so the call is redundant. The agent should be guided to skip profiling steps when the intake data is already reflected in state.
