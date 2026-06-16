import json
from dataclasses import dataclass
from typing import Optional, List
from groq import BadRequestError
from .models import VacationPlan, DestinationCandidate, TripProfile, UiState
from .prompt import ExplorePrompts, ComparisonPrompts
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
        "description": (
            "Update the traveler's trip profile based on conversation extraction. "
            "For 'vacation_type', 'likes', and 'avoid', send the current items plus "
            "anything newly mentioned — the server merges these additively, so "
            "existing items are never dropped even if you omit them. Removing an "
            "item from any of these lists is a UI-only action, not done via this tool."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "origin": {"type": ["string", "null"]},
                "travelers": {"type": ["string", "null"]},
                "when": {"type": ["string", "null"]},
                "duration": {"type": ["string", "null"]},
                "budget": {"type": ["string", "null"]},
                "vacation_type": {"type": ["array", "null"], "items": {"type": "string"}, "description": "List of vacation style descriptors (e.g. ['beach', 'adventure', 'city break'])."},
                "likes": {"type": ["array", "null"], "items": {"type": "string"}},
                "avoid": {"type": ["array", "null"], "items": {"type": "string"}},
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
                            "vibe": {
                                "type": "string",
                                "description": (
                                    "1-sentence description of what this destination is actually like — its character and atmosphere (e.g. 'a laid-back island with whitewashed villages and volcanic beaches')."
                                ),
                            },
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
        "description": "Generate a comparative matrix for the shortlisted destinations. Always include ALL existing rows from the current state above plus any new rows — never send only the new criterion. The full matrix must be sent every time this tool is called.",
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
                            "best_for": {
                                "type": "string",
                                "description": (
                                    "This traveler's personalised 'trip feel' for this "
                                    "destination — given their profile, what would THEIR trip here actually be like? Not a general description of the place — that's `vibe`."
                                ),
                            },
                            "seasonal_note": {
                                "type": "string",
                                "description": (
                                    "What this destination is like during the time of year this traveler is planning to visit."
                                ),
                            },
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
# Agent Configuration
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

MAX_HISTORY_TURNS = 5  # increased from 4 after live testing showed the model benefits from more assistant-reply context

TOOL_FORMAT_NUDGE = {
    "role": "system",
    "content": (
        "Your previous response attempted to call a tool using invalid text-based "
        "syntax (e.g. `<function=name>{...}</function>`) instead of the structured "
        "tool-calling mechanism. Retry now using ONLY the structured tool_calls "
        "mechanism — do not write a function call as text in your response."
    ),
}


def _merge_unique(existing: list[str], incoming: list[str]) -> list[str]:
    """Union-merge two string lists, case-insensitively, preserving order.

    Existing items are kept in their current order; incoming items not already
    present (by case-insensitive match) are appended. Makes trip-profile list
    fields (vacation_type/likes/avoid) additive-only — protects against the
    model sending a shorter list and silently dropping previously recorded
    items. Deliberate removal is a UI-only action (TripProfileComponent chip
    removal -> profile_override).
    """
    seen = {item.lower() for item in existing}
    merged = list(existing)
    for item in incoming:
        if item.lower() not in seen:
            merged.append(item)
            seen.add(item.lower())
    return merged


class AgentOrchestrator:
    def __init__(self, config: AgentConfig):
        self.config = config
        self.client = get_groq_client(config.api_key)

    def _filter_history(self, history: list) -> list:
        """Strip tool infrastructure from history before sending to the LLM.

        Keeps only user messages and plain assistant text replies — the chat
        as the user sees it. Tool call messages and tool result messages carry
        no information the current state JSON doesn't already capture.
        """
        return [
            m for m in history
            if m.get("role") != "tool" and not m.get("tool_calls")
        ]

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

    def _get_tools_for_mode(self, mode: str) -> list:
        """Return tools appropriate for the current mode, scoped to this agent."""
        return self.config.tools_by_mode.get(mode, [])

    def _tool_use_failed_generation(self, e: Exception) -> Optional[str]:
        """Return the `failed_generation` string if `e` is a Groq tool_use_failed 400, else None."""
        if isinstance(e, BadRequestError) and isinstance(e.body, dict):
            error = e.body.get("error", {})
            if error.get("code") == "tool_use_failed":
                return error.get("failed_generation", "")
        return None

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

    def _sanitize_args(self, args: dict) -> dict:
        """Strip None values from tool arguments before applying to the plan.

        The Groq LLM sometimes outputs null for optional fields (e.g. budget: null),
        which violates the tool schema's 'type: string' constraint and triggers a
        Pydantic validation error on the server. Removing these keys before application
        preserves existing plan values and prevents the 400 error.

        Also defensively coerces vacation_type to a list if the model sends a bare string.
        """
        cleaned = {k: v for k, v in args.items() if v is not None}
        if "vacation_type" in cleaned and isinstance(cleaned["vacation_type"], str):
            cleaned["vacation_type"] = [cleaned["vacation_type"]] if cleaned["vacation_type"] else []
        return cleaned

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
                plan.trip_profile.vacation_type = _merge_unique(plan.trip_profile.vacation_type, args["vacation_type"])
            if "likes" in args:
                plan.trip_profile.likes = _merge_unique(plan.trip_profile.likes, args["likes"])
            if "avoid" in args:
                plan.trip_profile.avoid = _merge_unique(plan.trip_profile.avoid, args["avoid"])

            return plan, "Trip profile updated."

        elif tool_name == "suggest_candidates":
            # Upsert candidates by name (case-insensitive)
            incoming = args.get("candidates", [])
            candidates_dict = {c.name.lower(): c for c in plan.candidates}

            for item in incoming:
                key = item["name"].lower()
                existing = candidates_dict.get(key)

                # A shortlisted destination is already confirmed — don't let the model
                # spend one of its 3 suggestion slots re-nominating it.
                if existing and existing.status == "shortlisted":
                    continue

                # Server resolves photo URL
                photo_url = resolve_destination_photo(item["name"], item.get("region"))

                # Preserve existing status and details to avoid demoting shortlisted candidates
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
        pruned_history = self._prune_history(self._filter_history(conversation_history))

        # --- CALL 1: LLM reasons and generates tool calls ---
        plan_dict = plan.model_dump()
        system_msg = self.config.prompts.get_system_prompt(plan_dict, plan.mode)
        
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
                    args = self._sanitize_args(json.loads(tc.function.arguments))
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
            system_msg_updated = self.config.prompts.get_system_prompt(plan_dict_updated, plan.mode)
            messages_with_results = [{"role": "system", "content": system_msg_updated}] + pruned_history + new_messages

            try:
                response_2 = self._call_llm(
                    messages=messages_with_results,
                    tools=tools_for_mode if tools_for_mode else None,
                    tool_choice="none",
                    allow_tool_retry=False,
                )
            except Exception as e:
                print(f"LLM call error (Call 2): {e}")
                raise RuntimeError(f"Failed to get response after tool execution: {str(e)}")

            message_2 = response_2.choices[0].message
            text_reply = message_2.content if message_2.content else "I have updated the plan accordingly."
        else:
            # No tools called; use LLM's original response (save tokens).
            # main.py's final session.history.append(...) is the sole writer of
            # this turn's assistant reply — matches the tool-call branch.
            text_reply = initial_text

        return {"text_reply": text_reply, "comparison_matrix": plan.comparison_matrix}, plan, new_messages
