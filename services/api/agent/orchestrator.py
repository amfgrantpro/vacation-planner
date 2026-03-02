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
            "Update general plan fields: vacation_purpose, trip_shape (origin, duration_days, travelers, pax_description), "
            "mental_model (knowns, unknowns, sentiments), budget_range, notes. "
            "Do NOT use this to add/remove candidates or change the phase."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "vacation_purpose": {"type": "string", "description": "The 'Why' - reason for travel"},
                "origin": {"type": "string", "description": "Where the traveler is starting from"},
                "duration_days": {"type": "integer", "description": "Total length of the trip in days"},
                "travelers": {"type": "integer", "description": "Number of people traveling"},
                "pax_description": {"type": "string", "description": "Description of the group (e.g., 'Couple with a toddler')"},
                "knowns": {"type": "array", "items": {"type": "string"}, "description": "Factual constraints confirmed by the user"},
                "unknowns": {"type": "array", "items": {"type": "string"}, "description": "Major blockers preventing a decision"},
                "sentiments": {"type": "array", "items": {"type": "string"}, "description": "Emotional cues or vibes"},
                "budget_range": {"type": ["string", "null"], "description": "Budget range (e.g. '$2000-$3000')"},
                "notes": {"type": "string", "description": "Free text notes"}
            },
        },
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

    def _get_tools_for_phase(self, phase: Phase) -> list:
        if phase == Phase.INTAKE:
            return [TOOL_UPDATE_PLAN, TOOL_MANAGE_CANDIDATES, TOOL_TRANSITION_PHASE]
        elif phase == Phase.EXPLORE:
            return [TOOL_UPDATE_PLAN, TOOL_MANAGE_CANDIDATES, TOOL_TRANSITION_PHASE]
        elif phase == Phase.SHORTLIST:
            return [TOOL_UPDATE_PLAN, TOOL_MANAGE_CANDIDATES, TOOL_TRANSITION_PHASE]
        elif phase == Phase.COMPARE:
            return [TOOL_UPDATE_PLAN, TOOL_TRANSITION_PHASE, TOOL_GENERATE_MCDM]
        return ALL_TOOLS

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
        if tool_name not in [t["function"]["name"] for t in ALL_TOOLS]:
            raise ValueError(f"Unknown tool: {tool_name}")
            
        if tool_name == "update_plan":
            patch_data = {}
            if "vacation_purpose" in args:
                patch_data["vacation_purpose"] = args.get("vacation_purpose")
            
            trip_shape_keys = ["origin", "duration_days", "travelers", "pax_description"]
            trip_shape_patch = {k: args[k] for k in trip_shape_keys if k in args}
            if trip_shape_patch:
                patch_data["trip_shape"] = trip_shape_patch
                
            mental_model_keys = ["knowns", "unknowns", "sentiments"]
            mental_model_patch = {k: args[k] for k in mental_model_keys if k in args}
            if mental_model_patch:
                patch_data["mental_model"] = mental_model_patch
                
            if "budget_range" in args:
                patch_data["budget_range"] = args.get("budget_range")
            if "notes" in args:
                patch_data["notes"] = args.get("notes")
            patch = VacationPlanPatch(**patch_data)
            patch_data_dump = patch.model_dump(exclude_none=True)
            current_data = plan.model_dump()

            def deep_merge(source, update):
                for k, v in update.items():
                    if k in source and isinstance(source[k], dict) and isinstance(v, dict):
                        deep_merge(source[k], v)
                    else:
                        source[k] = v
                return source

            updated_data = deep_merge(current_data, patch_data_dump)
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

        raise ValueError(f"Unknown tool: {tool_name}")

    def run_turn(self, conversation_history: list, current_plan: VacationPlan) -> tuple[dict, VacationPlan, list]:
        """
        Executes a single turn of the agent loop using dual-call ReAct pattern.
        
        Call 1: LLM reasons about user input and generates tool calls.
        Tool Execution: Tools are applied to the plan and results are recorded.
        Call 2: LLM observes tool results (in updated state) and generates final response.
        
        Returns: (structured_response_dict, updated_plan, new_messages)
        structured_response_dict = {"text_reply": str, "comparison_matrix": Optional[list]}
        """
        plan = current_plan
        tools_for_phase = self._get_tools_for_phase(plan.phase)
        new_messages = []

        # --- CALL 1: LLM reasons and generates tool calls ---
        plan_dict = plan.model_dump()
        plan_dict["phase"] = plan.phase.value
        system_msg = SystemPrompts.get_prompt(plan_dict)
        messages = [{"role": "system", "content": system_msg}] + conversation_history

        try:
            response = self._call_llm(messages=messages, tools=tools_for_phase, tool_choice="auto")
        except Exception as e:
            print(f"LLM call error (Call 1): {e}")
            raise RuntimeError(f"Failed to get output from the LLM: {str(e)}")

        message = response.choices[0].message
        initial_text = message.content if message.content else ""

        # Record assistant message with tool calls (if any)
        if message.tool_calls:
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
                "content": initial_text,
                "tool_calls": tool_calls_serialized,
            })

            # --- Execute all tool calls ---
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
                    raise RuntimeError(f"Tool execution failed for {tc.function.name}: {str(e)}")

            # --- CALL 2: LLM observes tool results and responds ---
            # Regenerate system prompt with updated plan state
            plan_dict_updated = plan.model_dump()
            plan_dict_updated["phase"] = plan.phase.value
            system_msg_updated = SystemPrompts.get_prompt(plan_dict_updated)
            messages_with_results = [{"role": "system", "content": system_msg_updated}] + conversation_history + new_messages

            try:
                response_2 = self._call_llm(messages=messages_with_results, tools=tools_for_phase, tool_choice="none")
            except Exception as e:
                print(f"LLM call error (Call 2): {e}")
                raise RuntimeError(f"Failed to get response after tool execution: {str(e)}")

            message_2 = response_2.choices[0].message
            text_reply = message_2.content if message_2.content else "I have updated the plan accordingly."
        else:
            # No tools called; use LLM's original response (save tokens)
            new_messages.append({
                "role": "assistant",
                "content": initial_text,
            })
            text_reply = initial_text

        return {"text_reply": text_reply, "comparison_matrix": plan.comparison_matrix}, plan, new_messages
