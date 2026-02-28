# Sprint 3 Debugging: Tool Calling Failures Block Testing

**Sprint 3 Goal**: Move from "A chatbot who tries to make you pick something" to a consultative agent that helps a user narrow to 2 or 3 feasible vacation candidates. The agent should do this by building an initial profile, exploring ideas, shortlisting candidates, and finally comparing the candidates against the profile.

## 1. The Core Problem

**The agent's tool calls are not executing reliably.**

During Sprint 3 user testing, the agent fails to execute the tools needed to mutate state. Without reliable tool execution, the structured funnel cannot be tested. This is the blocking issue.

Specifically:
- Tool definitions are malformed and rejected by the Groq API
- The prompt architecture creates conflicting directives that confuse the LLM  
- The LLM is forced to output tool calls via prescribed syntax instead of attempting to achieve outcomes
- Without these fixes, state mutations (adding candidates, transitioning phases) never happen

---

## 2. The Three Technical Root Causes

### Root Cause 2.1: Pydantic `$defs` in Tool Schemas (Parser Failure)

**The Issue**: The `update_plan` tool schema is generated via `VacationPlanPatch.model_json_schema()`. This produces nested `$defs` and `$ref` references inside the JSON schema.

**Why It Fails**: The Groq API parser cannot reliably handle schemas with `$defs` and `$ref`. It rejects the tool definition with an `invalid_request_error` before the LLM even sees it.

**Impact**: Tool calls never reach the LLM's inference. The API rejects the malformed definition at the request level.

---

### Root Cause 2.2: Conflicting Prompt Directives (Architecture Confusion)

**The Issue**: The `AgentOrchestrator` uses a two-call pattern per turn:
1. First call: Expects the LLM to use tools
2. Second call: Forces the LLM to output **strict JSON only** via `json_mode=True`

The system prompt explicitly mandates: `OUTPUT FORMAT — CRITICAL: You MUST respond with a valid JSON object only.`

**Why It Fails**: Faced with conflicting instructions ("use tools" vs. "output only JSON"), the LLM often abandons the native tool-calling format and hallucinates tool syntax directly into the JSON `text_reply` field.

**Impact**: Even when the LLM intends to call a tool, it embeds the call as text inside the JSON response instead of using the proper tool-calling mechanism.

---

### Root Cause 2.3: Prescriptive Syntax vs. Outcome-Focused Language

**The Issue**: The current system prompts use highly prescriptive language:
- "Call `update_plan(budget='$5000')`"
- "Call `manage_candidates(action='add', candidates=[...])`"

This forces the LLM to memorize and execute exact syntax.

**Why It Fails**: Under cognitive load (especially with fallback models on rate limits), LLMs struggle to correctly format tool call syntax. They hallucinate parameter names, forget required fields, or mistranslate the intent into incorrect function calls.

**Impact**: Even when tool definitions are syntactically correct, the LLM doesn't reliably call them because it's trying to output syntax rather than achieve an outcome.

---

## 3. The Three-Step Fix

### Step 1: Flatten Tool Schemas (Remove `$defs`)

Tool schemas must use only primitive types and flat JSON structures. No nested Pydantic models, no `$defs`, no `$ref`.

**What Changes**:
- `TOOL_UPDATE_PLAN`: Replace `VacationPlanPatch.model_json_schema()` with explicit flat parameters
  - Instead of: `{"patch": {...}}` (nested object), use: `{"vacation_purpose": "...", "origin": "...", ...}` (all fields as scalars)
- `TOOL_MANAGE_CANDIDATES`: Already flat, no changes needed
- `TOOL_TRANSITION_PHASE`: Already flat, no changes needed
- `TOOL_GENERATE_MCDM`: Already flat, no changes needed

**Result**: Groq API can parse the tool definitions. Tool calls reach the LLM's inference engine.

**File**: `services/api/agent/orchestrator.py` (TOOL_UPDATE_PLAN definition)

---

### Step 2: Single-Call Architecture + Outcome-Focused Prompting

1. Move from a dual-call pattern (tool call + JSON formatting call) to a single call where the LLM naturally outputs conversational text alongside tool calls. 
2. Rewrite prompts to describe outcomes, not syntax.

**What Changes**:
- **Orchestrator Flow**: Remove the second LLM call (`LLM call #2` in current `run_turn()`). The LLM outputs its text response naturally in `message.content` during the tool-calling turn.
- **System Prompt**: Remove the `OUTPUT FORMAT — CRITICAL` JSON mandate entirely. Replace prescriptive instructions with outcome-focused language:
  - OLD: e.g. "Call `update_plan(budget='$5000')` to set the user budget."
  - NEW: e.g. "Ensure the user's budget constraint is recorded in your internal plan. The system will handle the persistence."
- **Phase Instructions**: Rewrite all phase instructions to describe goals and wanted state, not function syntax.

**Result**: 
- Single LLM call per turn (halves tokens and latency)
- Conflicting directives removed
- LLM focuses on *outcomes* not *syntax*, making tool calls more reliable
- Tool calls are properly structured and executed

**Files**: 
- `services/api/agent/orchestrator.py` (refactor `run_turn()` method)
- `services/api/agent/prompt.py` (rewrite TEMPLATE and PHASE_INSTRUCTIONS)

---

### Step 3: Phase-Gated Tool Visibility + Fail-Fast Error Handling

Only expose tools relevant to the current phase. When tool execution fails, explicitly report the failure instead of silently continuing.

**What Changes**:
- Create `_get_tools_for_phase(phase: Phase) -> list` function that returns only valid tools for the current phase
  - **Intake**: `[update_plan, manage_candidates]`
  - **Explore**: `[update_plan, manage_candidates, transition_phase]`
  - **Shortlist**: `[update_plan, manage_candidates, transition_phase]`
  - **Compare**: `[update_plan, transition_phase, generate_mcdm_matrix]`
- Pass filtered tools to LLM call instead of ALL_TOOLS
- When `_apply_tool_call()` raises an exception, return it as a tool_result message (status: error). Do not silently log and continue.
- Check new_messages for tool failures. If critical tool failed, return error JSON to frontend instead of generating a response that claims success.

**Result**: 
- Reduced cognitive load on LLM (fewer irrelevant tools)
- Tool failures are explicit in the message history and UI
- Debugging is tractable (you can see where failures occur)

**Files**: 
- `services/api/agent/orchestrator.py` (add phase-gating, improve error handling)
- `services/api/main.py` (handle error responses from orchestrator)

---

## 4. How This is Done in Real-World AI Products

- **Single-Call Architectures**: Production agents (LangGraph, native provider tool-use APIs) combine reasoning, tool execution, and response generation in a single inference cycle. Dual-call patterns are anti-patterns that waste tokens and latency.
- **Flat Schemas for Tools**: Production systems explicitly flatten nested data structures into primitive arguments. The backend handles the "translation" back into internal models.
- **Outcome-Focused Prompting**: Real production prompts describe *what the agent should achieve* (e.g., "Ensure all user constraints are recorded") rather than *how to call functions* (e.g., "Call [this function] with [these parameters]"). This is more robust across model families and sizes.
- **Selective Tool Availability**: State machines expose tools conditionally. The LLM never sees irrelevant tools, reducing hallucination and token waste.

---

## 5. Other Improvements for Consideration in Future Sprints

These items are architectural improvements but not blockers for Sprint 3 testing:

### 5.1 Use a better fallback model 
Current: Falls back to `llama-3.1-8b-instant` on rate limits. This model is weak at complex tool orchestration.

Future: Replace with a stronger free-tier option (e.g., `mixtral-8x7b-32768` or another 70b variant supported by Groq). This requires checking the current available models (Groq frequently updates supported models without updating public docs).

### 5.2 Observability & Debug Harness
Current: Debugging happens only through manual testing using the UI. A broken agent loop (e.g. phase transition failures) will result in an inability to test and debug later phases.

Future: Implement `scripts/debug_harness.py` — a standalone tool that ingests a conversation transcript, allows for changes to primary components (LLM model, system prompt, tool definitions) and logs outputs to a debug file:
- Raw LLM responses at each turn
- Tool definitions and calls
- State mutations and their results
- Diagnostic report (e.g. cumulative token usage, LLM latency, tool call success rates)

This would allow testing of specific changes to the LLM model, prompt wording and tool definitions.

### 5.3 Simplify the Tool Calling Interface
Real-world agents (Perplexity, Anthropic's Tool Use Patterns, LangChain examples) encounter the same issue: too many tools in a single turn confuses models. Production solutions:

- **Tool Clustering**: Group related tools (e.g., all database operations into one `execute_query` tool).  
- **Sequential Tool Calling**: Explicitly ask the model to call one tool, wait for result, then decide on the next tool.  
- **Selective Tool Availability**: Enable/disable tools based on phase or context (as we are attempting as part of this debugging).