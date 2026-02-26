import json
from typing import Optional
from .models import VacationPlan, VacationPlanPatch, DestinationCandidate, Phase
from .prompt import SystemPrompts
from core.llm import get_groq_client


# ---------------------------------------------------------------------------
# Tool Definitions
# ---------------------------------------------------------------------------

TOOL_UPDATE_PLAN = {
    "type": "function",
    "function": {
        "name": "update_plan",
        "description": (
            "Update general plan fields: vacation_purpose, trip_shape, mental_model, budget_range, notes. "
            "Do NOT use this to add/remove candidates or change the phase."
        ),
        "parameters": VacationPlanPatch.model_json_schema(),
    },
}

TOOL_MANAGE_CANDIDATES = {
    "type": "function",
    "function": {
        "name": "manage_candidates",
        "description": (
            "Add, eliminate, or update destination candidates in the cart. "
            "Actions: 'add' (upsert new candidate), 'eliminate' (mark status='eliminated' with rationale), "
            "'update_rationale' (update rationale/decision_criteria for existing candidate)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["add", "eliminate", "update_rationale"],
                    "description": "The operation to perform on the candidates list.",
                },
                "candidates": {
                    "type": "array",
                    "description": "List of candidate objects to operate on.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Destination name"},
                            "status": {"type": "string", "description": "'active' or 'eliminated'"},
                            "rationale": {"type": "string", "description": "Why kept or removed"},
                            "pros_cons": {"type": "object", "description": "Optional pros/cons dict"},
                            "decision_criteria": {"type": "object", "description": "Key unknowns for this destination"},
                        },
                        "required": ["name"],
                    },
                },
            },
            "required": ["action", "candidates"],
        },
    },
}

TOOL_TRANSITION_PHASE = {
    "type": "function",
    "function": {
        "name": "transition_phase",
        "description": (
            "Move the funnel to a new phase. Valid targets: intake, explore, shortlist, compare. "
            "Guardrails are enforced server-side."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "target_phase": {
                    "type": "string",
                    "enum": ["intake", "explore", "shortlist", "compare"],
                    "description": "The phase to transition to.",
                }
            },
            "required": ["target_phase"],
        },
    },
}

TOOL_GENERATE_MCDM = {
    "type": "function",
    "function": {
        "name": "generate_mcdm_matrix",
        "description": (
            "Populate the comparison_matrix with trade-off rows for the active candidates. "
            "Only call this in the COMPARE phase. Each row is a criterion with one value per active candidate."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "criteria": {
                    "type": "array",
                    "description": "List of criterion objects. Each must have a 'criterion' key and one key per active candidate name.",
                    "items": {"type": "object"},
                }
            },
            "required": ["criteria"],
        },
    },
}

ALL_TOOLS = [TOOL_UPDATE_PLAN, TOOL_MANAGE_CANDIDATES, TOOL_TRANSITION_PHASE, TOOL_GENERATE_MCDM]


# ---------------------------------------------------------------------------
# Phase Transition Guardrails
# ---------------------------------------------------------------------------

def _can_transition(current_phase: Phase, target_phase: str, plan: VacationPlan) -> tuple[bool, str]:
    """Returns (allowed, reason). Raises descriptive error if not allowed."""
    try:
        target = Phase(target_phase)
    except ValueError:
        return False, f"'{target_phase}' is not a valid phase."

    active_candidates = [c for c in plan.candidates if c.status == "active"]

    if target == Phase.COMPARE and len(active_candidates) < 2:
        return False, f"Cannot enter COMPARE with fewer than 2 active candidates (currently {len(active_candidates)})."

    return True, "ok"


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class AgentOrchestrator:
    def __init__(self):
        self.client = get_groq_client()

    def _call_llm(self, messages: list, tools: list = None, tool_choice: str = None, json_mode: bool = False):
        """Primary LLM call with fallback on rate limits."""
        primary_model = "llama-3.3-70b-versatile"
        fallback_model = "llama-3.1-8b-instant"

        def call_api(model_name):
            kwargs = {
                "model": model_name,
                "messages": messages,
            }
            if tools:
                kwargs["tools"] = tools
            if tool_choice:
                kwargs["tool_choice"] = tool_choice
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            return self.client.chat.completions.create(**kwargs)

        try:
            return call_api(primary_model)
        except Exception as e:
            if "rate_limit_exceeded" in str(e) or "429" in str(e):
                print(f"⚠️  Rate limit on {primary_model}. Falling back to {fallback_model}...")
                return call_api(fallback_model)
            raise

    def _apply_tool_call(self, tool_name: str, args: dict, plan: VacationPlan) -> tuple[VacationPlan, str]:
        """
        Applies a parsed tool call to the plan and returns (updated_plan, result_summary).
        """
        if tool_name == "update_plan":
            patch = VacationPlanPatch(**args)
            patch_data = patch.model_dump(exclude_unset=True)
            current_data = plan.model_dump()

            def deep_merge(source, update):
                for k, v in update.items():
                    if k in source and isinstance(source[k], dict) and isinstance(v, dict):
                        deep_merge(source[k], v)
                    else:
                        source[k] = v
                return source

            updated_data = deep_merge(current_data, patch_data)
            return VacationPlan(**updated_data), "Plan updated."

        elif tool_name == "manage_candidates":
            action = args.get("action")
            incoming = args.get("candidates", [])
            candidates = {c.name.lower(): c for c in plan.candidates}

            for item in incoming:
                key = item["name"].lower()
                if action == "add":
                    if key in candidates:
                        # Upsert: update existing
                        existing = candidates[key]
                        existing.status = item.get("status", existing.status)
                        existing.rationale = item.get("rationale", existing.rationale)
                        if "pros_cons" in item:
                            existing.pros_cons = item["pros_cons"]
                        if "decision_criteria" in item:
                            existing.decision_criteria = item["decision_criteria"]
                    else:
                        candidates[key] = DestinationCandidate(
                            name=item["name"],
                            status=item.get("status", "active"),
                            rationale=item.get("rationale", ""),
                            pros_cons=item.get("pros_cons"),
                            decision_criteria=item.get("decision_criteria"),
                        )
                elif action == "eliminate":
                    if key in candidates:
                        candidates[key].status = "eliminated"
                        candidates[key].rationale = item.get("rationale", candidates[key].rationale)
                    else:
                        # Add as eliminated (record of rejection)
                        candidates[key] = DestinationCandidate(
                            name=item["name"],
                            status="eliminated",
                            rationale=item.get("rationale", "Eliminated by agent"),
                        )
                elif action == "update_rationale":
                    if key in candidates:
                        candidates[key].rationale = item.get("rationale", candidates[key].rationale)
                        if "decision_criteria" in item:
                            candidates[key].decision_criteria = item["decision_criteria"]
                        if "pros_cons" in item:
                            candidates[key].pros_cons = item["pros_cons"]

            plan.candidates = list(candidates.values())
            active_count = sum(1 for c in plan.candidates if c.status == "active")
            return plan, f"Candidates updated. Active count: {active_count}."

        elif tool_name == "transition_phase":
            target = args.get("target_phase")
            allowed, reason = _can_transition(plan.phase, target, plan)
            if not allowed:
                print(f"⚠️  Phase transition blocked: {reason}")
                return plan, f"Phase transition to '{target}' blocked: {reason}"
            plan.phase = Phase(target)
            return plan, f"Phase transitioned to '{target}'."

        elif tool_name == "generate_mcdm_matrix":
            criteria = args.get("criteria", [])
            plan.comparison_matrix = criteria
            return plan, f"MCDM matrix populated with {len(criteria)} criteria."

        return plan, f"Unknown tool: {tool_name}"

    def run_turn(self, conversation_history: list, current_plan: VacationPlan) -> tuple[dict, VacationPlan, list]:
        """
        Executes a single turn of the agent loop.
        Returns: (structured_response_dict, updated_plan, new_messages)
        structured_response_dict = {"text_reply": str, "comparison_matrix": Optional[list]}
        """
        plan = current_plan
        plan_dict = plan.model_dump()
        # Serialize enums to their string values for the prompt
        plan_dict["phase"] = plan.phase.value

        system_msg = SystemPrompts.get_prompt(plan_dict)
        messages = [{"role": "system", "content": system_msg}] + conversation_history
        new_messages = []

        # --- Step 1: Tool-calling turn ---
        try:
            response = self._call_llm(messages=messages, tools=ALL_TOOLS, tool_choice="auto")
        except Exception as e:
            print(f"LLM call error: {e}")
            return {"text_reply": f"I'm having trouble right now: {str(e)}", "comparison_matrix": None}, plan, []

        message = response.choices[0].message

        # --- Step 2: Execute all tool calls (may be multiple) ---
        if message.tool_calls:
            # Record assistant message with tool calls
            tool_calls_serialized = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in message.tool_calls
            ]
            new_messages.append({
                "role": "assistant",
                "content": message.content,
                "tool_calls": tool_calls_serialized,
            })

            for tc in message.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                    print(f"🔧 Tool: {tc.function.name} | Args: {json.dumps(args)[:200]}")
                    plan, result_summary = self._apply_tool_call(tc.function.name, args, plan)
                    new_messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps({"status": "success", "result": result_summary}),
                    })
                except Exception as e:
                    print(f"Tool execution error ({tc.function.name}): {e}")
                    import traceback
                    traceback.print_exc()
                    new_messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps({"status": "error", "error": str(e)}),
                    })

        # --- Step 3: Final structured JSON response ---
        # Rebuild plan_dict with updated state for context
        updated_plan_dict = plan.model_dump()
        updated_plan_dict["phase"] = plan.phase.value

        # Re-inject updated system prompt so the LLM knows the current state
        updated_system_msg = SystemPrompts.get_prompt(updated_plan_dict)
        final_messages = [{"role": "system", "content": updated_system_msg}] + conversation_history + new_messages

        try:
            final_response = self._call_llm(messages=final_messages, json_mode=True)
            raw_json = final_response.choices[0].message.content
            structured = json.loads(raw_json)
            text_reply = structured.get("text_reply", raw_json)
            comparison_matrix = structured.get("comparison_matrix", None)
        except Exception as e:
            print(f"JSON parsing error on final response: {e}")
            # Fallback: return the raw content as text_reply
            try:
                text_reply = final_response.choices[0].message.content
            except Exception:
                text_reply = "I had trouble formatting my response."
            comparison_matrix = None

        return {"text_reply": text_reply, "comparison_matrix": comparison_matrix}, plan, new_messages
