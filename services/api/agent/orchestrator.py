import json
from typing import Optional, List
from .models import VacationPlan, DestinationCandidate, TripProfile, UiState
from .prompt import SystemPrompts
from core.llm import get_groq_client
from core.config import settings
from core.image_resolver import resolve_destination_photo


# ---------------------------------------------------------------------------
# Tool Definitions (Flat JSON - Non-negotiable for Groq compatibility)
# ---------------------------------------------------------------------------

TOOL_UPDATE_TRIP_PROFILE = {
    "type": "function",
    "function": {
        "name": "update_trip_profile",
        "description": "Update the traveler's trip profile based on conversation extraction.",
        "parameters": {
            "type": "object",
            "properties": {
                "origin": {"type": "string"},
                "travelers": {"type": "string"},
                "when": {"type": "string"},
                "duration": {"type": "string"},
                "budget": {"type": "string"},
                "vacation_type": {"type": "string"},
                "likes": {"type": "array", "items": {"type": "string"}},
                "avoid": {"type": "array", "items": {"type": "string"}},
            },
        },
    },
}

TOOL_SUGGEST_CANDIDATES = {
    "type": "function",
    "function": {
        "name": "suggest_candidates",
        "description": "Suggest EXACTLY three destination candidates for the user to explore. Choose the BEST three candidates based on the user's trip profile.",
        "parameters": {
            "type": "object",
            "properties": {
                "candidates": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "region": {"type": "string"},
                            "vibe": {"type": "string", "description": "1-sentence vibe statement explaining why this fits this specific user profile."},
                        },
                        "required": ["name", "region", "vibe"],
                    },
                    "minItems": 3,
                    "maxItems": 3,
                },
            },
            "required": ["candidates"],
        },
    },
}

TOOL_GENERATE_COMPARISON_MATRIX = {
    "type": "function",
    "function": {
        "name": "generate_comparison_matrix",
        "description": "Generate a comparative matrix for the shortlisted destinations.",
        "parameters": {
            "type": "object",
            "properties": {
                "matrix_rows": {
                    "type": "array",
                    "description": "List of comparison rows. Each item in the array MUST be an object representing a comparison row. Each object MUST have a 'criterion' key (e.g. 'Weather') and one key per shortlisted candidate name matching their exact compared value. Example: [{'criterion': 'Weather', 'Santorini': 'Sunny, 25C', 'Amalfi Coast': 'Warm, 23C'}, {'criterion': 'Getting Around', 'Santorini': 'Buses & ATVs', 'Amalfi Coast': 'Ferries & scooters'}]. Do NOT wrap in a 'rows' or 'header' object.",
                    "items": {
                        "type": "object",
                        "additionalProperties": {"type": "string"},
                    },
                },
                "candidates_details": {
                    "type": "array",
                    "description": "Provides comparison card details (best_for, seasonal_note) for each compared destination.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "best_for": {"type": "string"},
                            "seasonal_note": {"type": "string"},
                        },
                        "required": ["name", "best_for", "seasonal_note"],
                    },
                },
            },
            "required": ["matrix_rows", "candidates_details"],
        },
    },
}


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class AgentOrchestrator:
    def __init__(self):
        self.client = get_groq_client()

    def _get_tools_for_mode(self, mode: str) -> list:
        """Return tools appropriate for the current mode."""
        if mode == "explore":
            return [TOOL_UPDATE_TRIP_PROFILE, TOOL_SUGGEST_CANDIDATES]
        elif mode == "compare":
            return [TOOL_UPDATE_TRIP_PROFILE, TOOL_GENERATE_COMPARISON_MATRIX]
        elif mode == "decision":
            return []  # No tools in decision mode
        return [TOOL_UPDATE_TRIP_PROFILE, TOOL_SUGGEST_CANDIDATES]  # Default to explore

    def _call_llm(self, messages: list, tools: list = None, tool_choice: str = None, json_mode: bool = False):
        """Primary LLM call with fallback on rate limits."""
        primary_model = settings.GROQ_PRIMARY_MODEL
        fallback_model = settings.GROQ_FALLBACK_MODEL

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
        if tool_name == "update_trip_profile":
            # Update trip profile fields if provided
            if "origin" in args:
                plan.trip_profile.origin = args["origin"]
            if "travelers" in args:
                plan.trip_profile.travelers = args["travelers"]
            if "when" in args:
                plan.trip_profile.when = args["when"]
            if "duration" in args:
                plan.trip_profile.duration = args["duration"]
            if "budget" in args:
                plan.trip_profile.budget = args["budget"]
            if "vacation_type" in args:
                plan.trip_profile.vacation_type = args["vacation_type"]
            if "likes" in args:
                plan.trip_profile.likes = args["likes"]
            if "avoid" in args:
                plan.trip_profile.avoid = args["avoid"]

            return plan, "Trip profile updated."

        elif tool_name == "suggest_candidates":
            # Upsert candidates by name (case-insensitive)
            incoming = args.get("candidates", [])
            candidates_dict = {c.name.lower(): c for c in plan.candidates}

            for item in incoming:
                key = item["name"].lower()
                # Server resolves photo URL
                photo_url = resolve_destination_photo(item["name"], item.get("region"))
                
                # Preserve existing status and details to avoid demoting shortlisted candidates
                existing = candidates_dict.get(key)
                existing_status = existing.status if existing else "suggested"
                existing_best_for = existing.best_for if existing else None
                existing_seasonal_note = existing.seasonal_note if existing else None
                
                candidate = DestinationCandidate(
                    name=item["name"],
                    region=item.get("region", ""),
                    vibe=item.get("vibe", ""),
                    photo_url=photo_url,
                    status=existing_status,
                    best_for=existing_best_for,
                    seasonal_note=existing_seasonal_note,
                )
                candidates_dict[key] = candidate

            plan.candidates = list(candidates_dict.values())
            return plan, f"Candidates updated: {len(plan.candidates)} suggestions."

        elif tool_name == "generate_comparison_matrix":
            # Populate comparison matrix
            matrix_rows = args.get("matrix_rows", [])
            candidates_details = args.get("candidates_details", [])

            # Update candidate details (best_for, seasonal_note)
            candidates_dict = {c.name.lower(): c for c in plan.candidates}
            for detail in candidates_details:
                name = detail.get("name")
                if not name:
                    continue
                key = name.lower()
                if key in candidates_dict:
                    candidates_dict[key].best_for = detail.get("best_for")
                    candidates_dict[key].seasonal_note = detail.get("seasonal_note")

            plan.candidates = list(candidates_dict.values())
            plan.comparison_matrix = matrix_rows

            return plan, f"Comparison matrix populated with {len(matrix_rows)} criteria."

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
        tools_for_mode = self._get_tools_for_mode(plan.mode)
        new_messages = []

        # --- CALL 1: LLM reasons and generates tool calls ---
        plan_dict = plan.model_dump()
        system_msg = SystemPrompts.get_prompt_sprint4(plan_dict, plan.mode)
        
        # Inject dynamic instruction to ensure 3 suggested candidates in explore mode
        if plan.mode == "explore":
            suggested_count = len([c for c in plan.candidates if c.status == "suggested"])
            if suggested_count < 3:
                system_msg += f"\n\nCRITICAL: You currently have {suggested_count} 'suggested' candidates. You MUST suggest {3 - suggested_count} or more new destinations THIS TURN. If you are also updating the profile, you MUST perform both actions in this single response."
            
        messages = [{"role": "system", "content": system_msg}] + conversation_history

        try:
            response = self._call_llm(
                messages=messages,
                tools=tools_for_mode if tools_for_mode else None,
                tool_choice="auto" if tools_for_mode else None,
            )
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
                        "content": json.dumps({"status": "error", "message": str(e)}),
                    })
                    # Do not raise RuntimeError; allow Call 2 to handle the error gracefully

            # --- CALL 2: LLM observes tool results and responds ---
            plan_dict_updated = plan.model_dump()
            system_msg_updated = SystemPrompts.get_prompt_sprint4(plan_dict_updated, plan.mode)
            messages_with_results = [{"role": "system", "content": system_msg_updated}] + conversation_history + new_messages

            try:
                response_2 = self._call_llm(
                    messages=messages_with_results,
                    tools=tools_for_mode if tools_for_mode else None,
                    tool_choice="none",
                )
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
