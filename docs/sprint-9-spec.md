# Sprint 9 Implementation Spec: Multi-Agent Architecture & History Pruning

**Status**: Draft — awaiting PM review. Not approved for implementation.

## 1. Executive Alignment

Sprint 9 implements the three phases agreed in `docs/sprint-9-planning.md` §5:

1. **Phase 1 — Orchestrator & routing**: Remove the dead Call 2 retry; parameterise `AgentOrchestrator` with an `AgentConfig` (system prompt, tool list, API key); add a thin router that picks the Explore agent or the Comparison/Decision agent based on `mode`; wire up a second Groq API key for the Comparison/Decision agent.
2. **Phase 2 — Message history**: Fix the duplicate-assistant-message bug on no-tool-call turns, then redefine `_prune_history` as a two-pass scheme — all user messages retained, plus the last `MAX_HISTORY_TURNS` full turns' assistant replies.
3. **Phase 3 — Agent prompt splits**: Split the single `SystemPrompts` class into an Explore-agent prompt and a Comparison/Decision-agent prompt, each scoped to its own tools and modes.

**No UI changes this sprint** — `apps/web` and `apps/lovable-ui` are untouched. All changes are in `services/api`.

**Architectural pattern** (planning §7 decision 2): **Parameterised single orchestrator**. There remains exactly one `AgentOrchestrator` class; it is instantiated twice (once per agent) with a different `AgentConfig`. The ReAct loop in `run_turn` is unchanged in structure — only the inputs (system prompt, tool list, Groq client) vary by instance.

**Architectural constraints inherited from prior sprints — must not be violated:**
- Flat hand-written JSON tool schemas only; no `additionalProperties` in Groq tool schemas.
- Dual-call conditional ReAct loop preserved (per agent).
- Client owns `uiState.mode`. Server responses must not override it.
- Candidate upsert by `name.lower()` — never replace the full candidates array; shortlisted names skipped; un-rejected candidates deleted from `session.plan.candidates`.
- State JSON sent to the LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`).
- Tool names never appear in system prompt instructions.
- Learning notebooks are not part of the build process.

---

## 2. Scope & Non-Goals

### In Scope
- `services/api/agent/orchestrator.py` — `AgentConfig`, parameterised `AgentOrchestrator`, Call 2 retry removal, history pruning rewrite.
- `services/api/agent/router.py` — **new file**, mode-based agent selection.
- `services/api/agent/prompt.py` — split into `BasePrompts`, `ExplorePrompts`, `ComparisonPrompts`.
- `services/api/main.py` — replace the single `agent` instance with the router.
- `services/api/core/config.py` — new `GROQ_API_KEY_2` setting.
- `services/api/core/llm.py` — `get_groq_client` becomes per-key, with a cache.

### Non-Goals (this sprint)
- Any conversational/content rewrite of `MODE_INSTRUCTIONS` beyond the mechanical extraction and tool-scoping trims described in §5 — mirroring/over-confirmation, "ask about past trips", comparison structure, Vacation Vibe / Best For precision, and the "I already have ideas" journey are all **Sprint 10**.
- Landing page, intake form, candidate card UI — **Sprint 11/12**.
- Session persistence / localStorage / Chat ID — backlog, not selected for Sprint 9.
- A handoff marker distinguishing which agent authored a turn in shared history — explicitly decided against (planning §7 decision 7).
- `tool_choice={"type": "function", "function": {"name": "suggest_candidates"}}` (named-tool forcing) — remains undecided from Sprint 8 §6, not part of this sprint.
- Any change to `apps/web` or `apps/lovable-ui`.
- `services/api/agent/prototype_*.py` — untouched, except that `get_groq_client()` must remain callable with no arguments (see §3.4).

---

## 3. Phase 1: Orchestrator & Routing

### 3.1 Remove Call 2 Retry-with-Nudge

Per planning §2 ("Bug carried over from tool-retry implementation") and §5 Phase 1 item 1: the Sprint 8 retry-with-nudge helped only when the model attempted a malformed tool call on **Call 1**. The one observed Call 2 (`tool_choice="none"`) failure retried with the nudge, got the same malformed output back, and still 500'd — an extra wasted LLM call with no chance of success.

**Design**: `_call_llm` gains an `allow_tool_retry: bool = True` parameter. Call 1 (unchanged, `allow_tool_retry=True` by default) keeps the existing detect → log → nudge-retry → log-again-if-still-failing behaviour. Call 2 passes `allow_tool_retry=False`: `tool_use_failed` is still detected and logged with the `⚠️` line (this diagnostic was useful — it's how the Sprint 9 planning bug was understood), but no retry is attempted; the exception propagates immediately to `run_turn`'s existing Call 2 `except` block → `RuntimeError` → `main.py`'s `HTTPException(500)`, exactly as today minus the wasted call.

#### [MODIFY] `services/api/agent/orchestrator.py` — `_call_llm` (currently lines 170–215)

```python
def _call_llm(self, messages: list, tools: list = None, tool_choice: str = None,
               json_mode: bool = False, allow_tool_retry: bool = True):
    """Primary LLM call with fallback on rate limits.

    When allow_tool_retry is True (Call 1), a tool_use_failed 400 gets a single
    same-model retry with a format-correction nudge. Call 2 (tool_choice="none")
    passes allow_tool_retry=False: a tool_use_failed there means the model tried
    to call a tool on the wrong call, which a same-model nudge cannot fix
    (see sprint-9-planning.md §2) — the failure is logged but not retried.
    """
    primary_model = settings.GROQ_PRIMARY_MODEL
    fallback_model = settings.GROQ_FALLBACK_MODEL

    def call_api(model_name, msgs):
        kwargs = {"model": model_name, "messages": msgs}
        if tools:
            kwargs["tools"] = tools
        if tool_choice:
            kwargs["tool_choice"] = tool_choice
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        return self.client.chat.completions.create(**kwargs)

    def call_with_retry(model_name, msgs):
        try:
            return call_api(model_name, msgs)
        except Exception as e:
            failed_generation = self._tool_use_failed_generation(e)
            if failed_generation is None:
                raise
            print(f"⚠️  [TOOL FORMAT ERROR] {model_name} emitted a tool call as text "
                  f"instead of structured tool_calls.\nfailed_generation: {failed_generation}")
            if not allow_tool_retry:
                raise
            print(f"   Retrying once on {model_name} with a format nudge.")
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

#### [MODIFY] `services/api/agent/orchestrator.py` — `run_turn`, Call 2 invocation (currently lines 404–409)

```python
            try:
                response_2 = self._call_llm(
                    messages=messages_with_results,
                    tools=tools_for_mode if tools_for_mode else None,
                    tool_choice="none",
                    allow_tool_retry=False,
                )
```

---

### 3.2 `AgentConfig` & Parameterised `AgentOrchestrator`

Per planning §7 decision 2, system prompt, tool list, and API key are passed in as configuration. A small `AgentConfig` dataclass holds these three things plus a `name` (for logging).

#### [MODIFY] `services/api/agent/orchestrator.py` — imports and new config block

```python
from dataclasses import dataclass
from .prompt import ExplorePrompts, ComparisonPrompts

@dataclass
class AgentConfig:
    name: str
    api_key: str
    prompts: type           # ExplorePrompts or ComparisonPrompts — provides get_system_prompt()
    tools_by_mode: dict      # {mode: [tool_schema, ...]}


EXPLORE_CONFIG = AgentConfig(
    name="explore",
    api_key=settings.GROQ_API_KEY,
    prompts=ExplorePrompts,
    tools_by_mode={
        "explore": [TOOL_UPDATE_TRIP_PROFILE, TOOL_SUGGEST_CANDIDATES],
    },
)

COMPARISON_CONFIG = AgentConfig(
    name="comparison",
    api_key=settings.GROQ_API_KEY_2 or settings.GROQ_API_KEY,
    prompts=ComparisonPrompts,
    tools_by_mode={
        "compare": [TOOL_UPDATE_TRIP_PROFILE, TOOL_GENERATE_COMPARISON_MATRIX],
        "decision": [],
    },
)
```

#### [MODIFY] `services/api/agent/orchestrator.py` — `AgentOrchestrator.__init__` and `_get_tools_for_mode`

```python
class AgentOrchestrator:
    def __init__(self, config: AgentConfig):
        self.config = config
        self.client = get_groq_client(config.api_key)

    ...

    def _get_tools_for_mode(self, mode: str) -> list:
        """Return tools appropriate for the current mode, scoped to this agent."""
        return self.config.tools_by_mode.get(mode, [])
```

`tools_by_mode.get(mode, [])` deliberately has no "default to explore" fallback — the router (§3.3) guarantees the Explore instance is only ever called with `mode == "explore"` and the Comparison instance only with `"compare"`/`"decision"`. If that invariant is ever violated, an empty tool list (rather than silently borrowing the other agent's tools) is the safer failure.

#### [MODIFY] `services/api/agent/orchestrator.py` — `run_turn`, system prompt construction (currently lines 333–334 and 400–401)

```python
        system_msg = self.config.prompts.get_system_prompt(plan_dict, plan.mode)
```
```python
            system_msg_updated = self.config.prompts.get_system_prompt(plan_dict_updated, plan.mode)
```

No other change to `run_turn`'s structure — the dual-call ReAct loop, the `active_count < 3` / `tool_choice="required"` escalation (Sprint 8, explore-only), and `_apply_tool_call` dispatch are all unchanged and remain shared across both `AgentOrchestrator` instances.

---

### 3.3 Routing Layer

A thin router selects the agent instance based on `mode`. Per planning §7 decision 2: "Not mode-based prompt switching — each agent has its own context window," i.e. the router picks which `AgentOrchestrator` instance (and therefore which Groq client + prompt config) handles the turn; it does not itself call the LLM.

#### [NEW] `services/api/agent/router.py`

```python
from .orchestrator import AgentOrchestrator, EXPLORE_CONFIG, COMPARISON_CONFIG

explore_agent = AgentOrchestrator(EXPLORE_CONFIG)
comparison_agent = AgentOrchestrator(COMPARISON_CONFIG)


def get_agent(mode: str) -> AgentOrchestrator:
    """Route to the Explore agent or the Comparison/Decision agent based on mode."""
    return explore_agent if mode == "explore" else comparison_agent
```

#### [MODIFY] `services/api/main.py`

```python
# Before:
from agent.orchestrator import AgentOrchestrator
...
agent = AgentOrchestrator()
prototype_agent = PrototypeAgentOrchestrator()
...
        try:
            structured, updated_plan, new_messages = agent.run_turn(session.history, session.plan)

# After:
from agent.router import get_agent
...
prototype_agent = PrototypeAgentOrchestrator()
...
        try:
            agent = get_agent(session.plan.mode)
            structured, updated_plan, new_messages = agent.run_turn(session.history, session.plan)
```

`session.plan.mode` is set from `request.ui_state.mode` earlier in the handler (the existing "State reconciliation" block), so it reflects the current frontend mode by the time routing happens.

---

### 3.4 Second Groq API Key

Per planning §7 decision 3: a second Groq account (so the rate-limit pool is genuinely independent — Groq limits are org-level, a second key on the *same* account would share the pool) provides the Comparison/Decision agent's API key via a new `.env` variable.

**PM action required**: create the second Groq account/org and add its key to `.env` as `GROQ_API_KEY_2`. Until that's done, `COMPARISON_CONFIG.api_key` falls back to `settings.GROQ_API_KEY` (§3.2) — the app runs correctly on one account (both agents share its rate-limit pool, same as today) until the second key is added, at which point it takes effect with no further code changes.
**PM response**: Done.

Both Groq accounts are assumed to have access to the same model names — `GROQ_PRIMARY_MODEL` / `GROQ_FALLBACK_MODEL` remain global settings shared by both agents; only the account (API key) differs per agent.

#### [MODIFY] `services/api/core/config.py`

```python
class Settings(BaseSettings):
    GROQ_API_KEY: str
    GROQ_API_KEY_2: str = ""  # second Groq account for the Comparison/Decision agent;
                                        # falls back to GROQ_API_KEY if unset
    OPENAI_API_KEY: str = ""
    UNSPLASH_ACCESS_KEY: str = ""
    GROQ_PRIMARY_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_FALLBACK_MODEL: str = "openai/gpt-oss-120b"
```

#### [MODIFY] `services/api/core/llm.py`

`get_groq_client()` becomes per-key with a small cache (two agents → two `Groq` client instances). `prototype_orchestrator.py` calls `get_groq_client()` with no arguments — to leave that file untouched, the parameter is optional and defaults to the primary key.

```python
from groq import Groq
from .config import settings

_clients: dict[str, Groq] = {}


def get_groq_client(api_key: str = None) -> Groq:
    """Return a cached Groq client for the given API key.

    Each agent passes its own key (its own Groq account), so each gets an
    independent client and rate-limit pool. Defaults to GROQ_API_KEY for
    callers that don't specify one (prototype_orchestrator.py).
    """
    key = api_key or settings.GROQ_API_KEY
    if key not in _clients:
        _clients[key] = Groq(api_key=key)
    return _clients[key]
```

---

## 4. Phase 2: Message History

### 4.1 Fix Duplicate Assistant Message on No-Tool-Call Turns

Per planning §2 ("Bug found during Sprint 9 planning review") and §7 decision 6: in the no-tool-call branch, `run_turn` appends the reply to `new_messages`, and `main.py` *also* appends it again as `{"role": "assistant", "content": text_reply}`. `_filter_history` doesn't deduplicate plain assistant messages, so both land in history. The tool-call branch doesn't have this problem — its `new_messages` ends with the Call-2 tool-result(s), and `main.py`'s final append is the *only* place the Call-2 reply is written.

**Fix**: the no-tool-call branch leaves `new_messages` empty, matching the tool-call branch's pattern — `main.py`'s final `session.history.append(...)` is the sole writer of the assistant reply in both branches.

#### [MODIFY] `services/api/agent/orchestrator.py` — `run_turn`, no-tool-call branch (currently lines 416–422)

```python
        else:
            # No tools called; use LLM's original response (save tokens).
            # main.py's final session.history.append(...) is the sole writer of
            # this turn's assistant reply — matches the tool-call branch.
            text_reply = initial_text
```

This is also the prerequisite named in planning §5 Phase 2 item 1 for §4.2 below: the "last N full turns" pruning only makes sense once every turn in `session.history` is cleanly `(user, assistant)` after filtering.

---

### 4.2 Two-Pass Pruning: All User Messages + Last N Full Turns

Per planning §7 decision 5: replace the last-N-messages slice with two passes — **all user messages in chronological order** (never pruned), plus **the last `MAX_HISTORY_TURNS` full turns** (their assistant replies). Older turns retain only their user message. This ensures the agent always has the traveler's full expressed preferences in context, and — per planning §7 decision 7 — this *is* the handoff context when switching agents on a mode change; no separate handoff mechanism is needed.

**Order of operations**: after the §4.1 fix, every turn in raw `session.history` is either `(user, assistant)` (no-tool-call) or `(user, assistant-with-tool_calls, tool[, tool...], assistant)` (tool-call). `_filter_history` already strips the `tool`-role and `tool_calls`-bearing messages, leaving clean `(user, assistant)` pairs for every turn, with the last entry possibly being a dangling `user` message (the current turn, whose reply doesn't exist yet). Running `_prune_history` **after** `_filter_history` means it only ever has to reason about clean `(user, assistant)` pairs — so the call order in `run_turn` swaps from `_filter_history(_prune_history(...))` to `_prune_history(_filter_history(...))`.

**Index-0 special case removed**: the current `_prune_history` unconditionally retains `history[0]` (the onboarding-summary opening message) because the old last-N-messages slice could otherwise drop it. `history[0]` is always a `{"role": "user", ...}` message (the first thing `main.py` appends to a fresh session). Under the new scheme, pass 1 ("all user messages") already retains it — the special case is redundant and is removed.

#### [MODIFY] `services/api/agent/orchestrator.py` — `_prune_history` (currently lines 133–150)

```python
    def _prune_history(self, history: list) -> list:
        """Two-pass pruning over already-filtered (user, assistant) history.

        Pass 1: every user message is retained, in chronological order — the
        traveler's full expressed preferences stay in context for the whole
        session, including across an agent handoff on mode change.
        Pass 2: the last MAX_HISTORY_TURNS user messages additionally retain
        their assistant replies. Assistant replies from older turns are dropped.

        Expects history that has already passed through _filter_history, so
        every message is either {"role": "user", ...} or a plain-text
        {"role": "assistant", ...} (no tool / tool_calls messages).
        """
        user_indices = [i for i, m in enumerate(history) if m.get("role") == "user"]
        if len(user_indices) <= MAX_HISTORY_TURNS:
            return history

        cutoff = user_indices[-MAX_HISTORY_TURNS]
        return [m for i, m in enumerate(history) if m.get("role") == "user" or i >= cutoff]
```

#### [MODIFY] `services/api/agent/orchestrator.py` — `run_turn`, history preparation (currently line 330)

```python
        pruned_history = self._prune_history(self._filter_history(conversation_history))
```

`MAX_HISTORY_TURNS = 4` is unchanged (planning §7 decision 5.1, "Confirmed"). For a session with more than 4 user turns, the pruned history = every earlier user message (one each) + the last 4 user messages + the 3 assistant replies already generated for the first 3 of those 4 (the 4th/current user message has no reply yet) — 7 messages for the most recent window, plus one message per older turn.

---

## 5. Phase 3: Agent Prompt Splits

Per planning §5 Phase 3: extract the Explore-phase and Comparison/Decision-phase instructions and tool lists from the single `SystemPrompts` class into two dedicated prompt providers, each scoped to its own tools. Per the non-goals (§2), this is a **structural extraction** — `MODE_INSTRUCTIONS` content (the actual conversational guidance) is carried over **unchanged**; the only content edits are the mechanical "scope to this agent's tools" trims described below. Sprint 10 is where the conversational content itself gets rewritten.

### 5.1 Structure: `BasePrompts`, `ExplorePrompts`, `ComparisonPrompts`

`agent/prompt.py`'s current `SystemPrompts` class is replaced by three classes:

- **`BasePrompts`** — shared helpers only: `_build_rejected_section`, `_clean_candidates_for_prompt`, and `get_system_prompt` (a classmethod that reads `cls.TEMPLATE`, `cls.MODE_INSTRUCTIONS`, `cls.SHARED_GUIDELINES` — all defined by subclasses). Not instantiated directly.
- **`ExplorePrompts(BasePrompts)`** — `TEMPLATE`, `MODE_INSTRUCTIONS = {"explore": ...}`, `SHARED_GUIDELINES` (trimmed, §5.2).
- **`ComparisonPrompts(BasePrompts)`** — `TEMPLATE`, `MODE_INSTRUCTIONS = {"compare": ..., "decision": ...}`, `SHARED_GUIDELINES` (trimmed, §5.3).

`_build_rejected_section` and `_clean_candidates_for_prompt` are used by both (the Comparison/Decision agent still benefits from seeing what's been rejected, even though it has no `suggest_candidates` tool to avoid re-nominating them with).

`get_system_prompt` drops the current `.get(mode, cls.MODE_INSTRUCTIONS["explore"])` fallback — each subclass's `MODE_INSTRUCTIONS` only contains the modes the router ever calls it with, so a `KeyError` on an unexpected mode is a fail-fast signal of a routing bug rather than a silent wrong-prompt.

```python
class BasePrompts:
    @classmethod
    def _build_rejected_section(cls, plan_dict: dict) -> str:
        # unchanged from current SystemPrompts._build_rejected_section
        ...

    @classmethod
    def _clean_candidates_for_prompt(cls, plan_dict: dict) -> dict:
        # unchanged from current SystemPrompts._clean_candidates_for_prompt
        ...

    @classmethod
    def get_system_prompt(cls, plan_dict: dict, mode: str) -> str:
        mode_instruction = cls.MODE_INSTRUCTIONS[mode]
        rejected_section = cls._build_rejected_section(plan_dict)
        clean_plan = cls._clean_candidates_for_prompt(plan_dict)
        return cls.TEMPLATE.format(
            state_json=json.dumps(clean_plan, indent=2),
            rejected_section=rejected_section,
            mode_instruction=mode_instruction,
            shared_guidelines=cls.SHARED_GUIDELINES,
        )
```

### 5.2 `ExplorePrompts`

`TEMPLATE`'s opening sentence is split off from the current shared one — "structured comparison" (the other agent's job) is dropped, "destination candidates" stays:

```python
class ExplorePrompts(BasePrompts):
    TEMPLATE = """You are an expert Travel Consultant. Your job is to help the user find their ideal next vacation through intelligent diagnosis of their preferences, constraints, and motivations. Whenever the conversation teaches you something new, act on it the same turn by updating what's shown (trip profile, destination candidates) — don't let your understanding get ahead of the screen.

Current Agent State:
{state_json}
{rejected_section}
{mode_instruction}

{shared_guidelines}

"""

    MODE_INSTRUCTIONS = {
        "explore": <unchanged — current MODE_INSTRUCTIONS["explore"], verbatim>,
    }

    SHARED_GUIDELINES = """
## General Guidelines
1. **Concise & Human**: Be concise but warm. You are a travel consultant, not a form. Max 3 sentences per response unless presenting structured output.
2. **Drive Forward**: ALWAYS end with TWO focused questions to give the user options on how they wish to move the conversation forward.
3. **Take Action Naturally**: You have tools available (profile updates, candidate suggestions). Use them naturally as part of your work — don't mention them by name or format them yourself. The system detects what you're doing and executes automatically.
4. **Don't Narrate Your Writes**: When you update the profile or candidates, do not list or recite what you just recorded ("I've noted you like X, Y, Z" / "I've added A, B, C to your options"). The user can already see these changes reflected on screen. Acknowledge briefly in natural language and move straight to your questions — the structured surfaces do the showing; you do the asking.
5. **Keep the Candidate Panel Full**: The panel showing destination options should always display AT LEAST 3 active suggestions. This is a live "best 3 right now" view — whenever a slot becomes empty (candidate removed, shortlisted, or rejected), replace it this turn. A shortlisted destination does NOT count as one of the 3 active suggestions.
6. **Candidate Backdrop**: Destination cards on the right are visual inspiration. The conversation focuses on the traveler's traits, not soliciting feedback for destinations.
7. **No Interrogation**: Never ask "Do you like [Destination]?" or "Should we add [Destination]?" The user decides via UI.
"""
```

Only edit vs. today: guideline item 3 drops "...and comparison matrices" (this agent has no `generate_comparison_matrix` tool). Items 1, 2, 4–7 and `MODE_INSTRUCTIONS["explore"]` are verbatim copies of the current content.

### 5.3 `ComparisonPrompts`

`TEMPLATE`'s opening sentence is rewritten for the Comparison/Decision job (drops "destination candidates", adds "move toward a confident decision" reflecting that this agent also owns Decision mode):

```python
class ComparisonPrompts(BasePrompts):
    TEMPLATE = """You are an expert Travel Consultant. Your job is to help the user compare their shortlisted destinations and move toward a confident decision. Whenever the conversation teaches you something new, act on it the same turn by updating what's shown (trip profile, comparison matrix) — don't let your understanding get ahead of the screen.

Current Agent State:
{state_json}
{rejected_section}
{mode_instruction}

{shared_guidelines}

"""

    MODE_INSTRUCTIONS = {
        "compare": <unchanged — current MODE_INSTRUCTIONS["compare"], verbatim>,
        "decision": <unchanged — current MODE_INSTRUCTIONS["decision"], verbatim>,
    }

    SHARED_GUIDELINES = """
## General Guidelines
1. **Concise & Human**: Be concise but warm. You are a travel consultant, not a form. Max 3 sentences per response unless presenting structured output.
2. **Drive Forward**: ALWAYS end with TWO focused questions to give the user options on how they wish to move the conversation forward.
3. **Take Action Naturally**: You have tools available (profile updates, comparison matrix updates). Use them naturally as part of your work — don't mention them by name or format them yourself. The system detects what you're doing and executes automatically.
4. **Don't Narrate Your Writes**: When you update the profile or comparison matrix, do not list or recite what you just recorded ("I've noted you like X, Y, Z" / "I've added a row for..."). The user can already see these changes reflected on screen. Acknowledge briefly in natural language and move straight to your question — the structured surfaces do the showing; you do the asking.
5. **No Interrogation**: Never ask "Do you like [Destination]?" — the user decides via UI; your job is to surface the comparison, not poll preferences about specific destinations directly.
"""
```

Edits vs. today's `SHARED_GUIDELINES`:
- Item 3 retargeted to "comparison matrix updates" (drops "candidate suggestions" — this agent has no `suggest_candidates` tool).
- Item 4's parenthetical example retargeted to comparison-matrix language.
- Item 5 (`No Interrogation`) kept, reworded slightly, renumbered from 7.
- Items 5 (`Keep the Candidate Panel Full`) and 6 (`Candidate Backdrop`) **dropped** — both describe the Explore-mode `suggest_candidates` panel, which this agent doesn't manage. (`MODE_INSTRUCTIONS["compare"]` item 4, "No Markdown Tables... frontend handles matrix rendering on the right panel," already covers the equivalent "don't describe the visual surface yourself" guidance for this agent's panel.)

**Intentional per-mode override, unchanged by the split**: `SHARED_GUIDELINES` item 2 ("ALWAYS end with TWO focused questions") is the default for this agent — including Decision mode, which (like Explore) pivots to action by offering next-step options. `MODE_INSTRUCTIONS["compare"]` item 6 ("ending with a single driving question") deliberately overrides this default for Compare mode specifically, which needs more guidance and less branching. `ComparisonPrompts` preserves this precedence as-is; any further wording refinement is Sprint 10's "Comparison: add structure and focus", not in scope here.

### 5.4 Dead Code Removal: Legacy `get_prompt`

`agent/prompt.py`'s current `SystemPrompts.get_prompt` (lines 119–123) is a "legacy method for backward compatibility with prototype" that returns a hardcoded generic string. `grep -rn "from .prompt import\|from agent.prompt import" services/api` shows the only importer of `agent/prompt.py` is `orchestrator.py` (importing `SystemPrompts`, soon `ExplorePrompts`/`ComparisonPrompts`); `prototype_orchestrator.py` imports `SystemPrompts` from its own separate `prototype_prompt.py`. `get_prompt` is therefore dead code, with no natural home in the `BasePrompts`/`ExplorePrompts`/`ComparisonPrompts` split. It is removed as part of this restructure.

#### [MODIFY] `services/api/agent/orchestrator.py` — imports

```python
from .prompt import ExplorePrompts, ComparisonPrompts
```

---

## 6. Task Breakdown

### Phase 1: Orchestrator & Routing
- [ ] **1.1** — `orchestrator.py`: `_call_llm` gains `allow_tool_retry: bool = True`; Call 2 passes `allow_tool_retry=False` (§3.1).
- [ ] **1.2** — `orchestrator.py`: add `AgentConfig` dataclass, `EXPLORE_CONFIG`, `COMPARISON_CONFIG` (§3.2).
- [ ] **1.3** — `orchestrator.py`: `AgentOrchestrator.__init__(self, config)`; `_get_tools_for_mode` reads `self.config.tools_by_mode`; `run_turn` calls `self.config.prompts.get_system_prompt(...)` at both call sites (§3.2).
- [ ] **1.4** — new `agent/router.py`: `explore_agent`, `comparison_agent`, `get_agent(mode)` (§3.3).
- [ ] **1.5** — `main.py`: replace `agent = AgentOrchestrator()` with `from agent.router import get_agent` and `agent = get_agent(session.plan.mode)` at the `run_turn` call site (§3.3).
- [ ] **1.6** — `core/config.py`: add `GROQ_API_KEY_2: str = ""` (§3.4).
- [ ] **1.7** — `core/llm.py`: `get_groq_client(api_key: str = None)` with per-key caching, default to `GROQ_API_KEY` (§3.4).

### Phase 2: Message History
- [ ] **2.1** — `orchestrator.py`: no-tool-call branch leaves `new_messages` empty (§4.1).
- [ ] **2.2** — `orchestrator.py`: rewrite `_prune_history` per the two-pass design; swap to `_prune_history(self._filter_history(...))` (§4.2).

### Phase 3: Agent Prompt Splits
- [ ] **3.1** — `prompt.py`: `BasePrompts` with shared helpers + `get_system_prompt` (§5.1).
- [ ] **3.2** — `prompt.py`: `ExplorePrompts(BasePrompts)` (§5.2).
- [ ] **3.3** — `prompt.py`: `ComparisonPrompts(BasePrompts)` (§5.3).
- [ ] **3.4** — `prompt.py`: remove legacy `get_prompt` and old `SystemPrompts` class (§5.4).
- [ ] **3.5** — `orchestrator.py`: update import to `from .prompt import ExplorePrompts, ComparisonPrompts` (§5.4).

---

## 7. Verification Plan

1. **Explore routing**: start a fresh session (Explore mode). Confirm candidate suggestions and profile updates still work as before, and that `explore_agent` (using `GROQ_API_KEY`) handles the turn.
2. **Comparison/Decision routing**: shortlist 2–3 candidates and switch to Compare mode. Confirm `comparison_agent` handles the turn, the comparison matrix tool works, and (if `GROQ_API_KEY_2` is set) requests use the second account — e.g. by temporarily exhausting one key's rate limit and confirming the other agent is unaffected.
3. **Decision mode**: progress to Decision mode (no tools). Confirm `comparison_agent` handles it with an empty tool list and no `tool_choice` issues.
4. **No duplicate assistant messages**: run several no-tool-call turns. Inspect `session.history` (via network response / a temporary debug print) and confirm exactly one assistant message per turn.
5. **Pruning correctness**: run a session past `MAX_HISTORY_TURNS` (4) user turns, including at least one mode switch (Explore → Compare). Inspect the messages sent to the LLM and confirm: every prior user message is present; only the last 4 turns' assistant replies are present; the Comparison agent's first call includes the full user-preference history from the Explore phase.
6. **Call 2 retry removed**: if a `tool_use_failed` occurs on Call 2 during testing, confirm only the `⚠️` detection log appears (no `Retrying once...` line, no second LLM call) and the turn 500s immediately as before. This failure mode is rare — best-effort, not a blocking gate.
7. **Naming cleanup**: `grep -rn "SystemPrompts" services/api/agent/orchestrator.py` returns no results (renamed to `ExplorePrompts`/`ComparisonPrompts`); `grep -rn "get_prompt\b" services/api/agent/prompt.py` returns no results (dead method removed).
8. **Prototype unaffected**: `/chat/prototype` still works — `prototype_orchestrator.py`'s `get_groq_client()` (no args) still resolves to a valid client.

---

## 8. Constraints Carried Forward

1. Flat JSON tool schemas only — no Pydantic schema generation for Groq tools; `additionalProperties` not used.
2. Dual-call conditional ReAct loop preserved, per agent.
3. Client owns `uiState.mode` — server responses must not override it.
4. Candidate upsert by `name.lower()` — never replace the full array; shortlisted names skipped; un-rejected candidates deleted from `session.plan.candidates`.
5. State JSON to LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`), shared by both agents.
6. Tool names never appear in system prompt instructions.
7. `TOOL_FORMAT_NUDGE` is a one-off corrective message for a single retry call, never persisted to `session.history` — **now Call 1 only**.
8. Learning notebooks are not part of the build process.
9. Lovable components are visual references only (no UI work this sprint, but the constraint stands for future sprints).
10. **New this sprint**: One `AgentOrchestrator` class, parameterised by `AgentConfig` — not separate orchestrator subclasses per agent.
11. **New this sprint**: No handoff marker in shared history — the two-pass pruned history (§4.2) is the sole handoff mechanism between agents on a mode change.
12. **New this sprint**: `MAX_HISTORY_TURNS = 4` retains its value but its semantics change to the two-pass scheme (§4.2); `_prune_history` now runs after `_filter_history` and expects clean `(user, assistant)` pairs.
13. **New this sprint**: `GROQ_API_KEY_2` is optional and falls back to `GROQ_API_KEY` — both agents work correctly on a single account until the PM provisions the second one.

---

## 9. Decisions Confirmed During Drafting

Two design choices in §4.2 and §5.1–5.3 involved judgment calls beyond pure mechanics. Both were confirmed with the PM during drafting and are reflected in the text above as written:

- **History pruning (§4.2)**: chronological, no duplication — each user message appears once; only the last `MAX_HISTORY_TURNS` turns additionally carry their assistant reply.
- **Prompt split (§5.1–5.3)**: per-agent trimmed `SHARED_GUIDELINES` — each agent's guidelines reference only its own tool categories, and Explore-only candidate-panel guidance is dropped from `ComparisonPrompts`.

This draft is otherwise unreviewed — over to the PM for the full read-through. Per `agents.md`, nothing in this document is final until the PM approves it.
