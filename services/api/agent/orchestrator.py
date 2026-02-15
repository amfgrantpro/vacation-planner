import json
from .models import VacationPlan, VacationPlanPatch
from .prompt import SystemPrompts
from core.llm import get_groq_client

class AgentOrchestrator:
    def __init__(self):
        self.client = get_groq_client()
        self.tool_def = {
            "type": "function",
            "function": {
                "name": "update_plan",
                "description": "Updates the vacation plan. Use this whenever the user provides new information or changes preferences.",
                "parameters": VacationPlanPatch.model_json_schema()
            }
        }

    def _call_llm_with_fallback(self, messages: list, tools: list = None, tool_choice: str = None):
        """
        Calls the primary model with a fallback to the instant model on rate limits.
        """
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
            
            return self.client.chat.completions.create(**kwargs)

        try:
            return call_api(primary_model)
        except Exception as e:
            if "rate_limit_exceeded" in str(e) or "429" in str(e):
                print(f"⚠️ Rate limit hit on {primary_model}. Falling back to {fallback_model}...")
                return call_api(fallback_model)
            raise e

    def run_turn(self, conversation_history: list, current_plan: VacationPlan) -> tuple[str, VacationPlan, list]:
        """
        Executes a single turn of the agent loop.
        Returns: (response_text, updated_plan, new_messages)
        """
        # 1. Update system prompt with current plan state (as dict for prompt logic)
        plan_dict = current_plan.model_dump()
        system_msg = SystemPrompts.get_prompt(plan_dict)
        
        # 2. Prepare messages
        messages = [{"role": "system", "content": system_msg}] + conversation_history
        new_messages = []
        
        # 3. Call LLM with tool (using fallback wrapper)
        response = None
        try:
            response = self._call_llm_with_fallback(
                messages=messages,
                tools=[self.tool_def],
                tool_choice="auto"
            )
        except Exception as e:
            # Handle Groq 400 "tool_use_failed" by extracting the text it DID generate
            error_str = str(e)
            if "failed_generation" in error_str:
                print(f"⚠️ Groq rejected generation but we'll try to parse it anyway...")
                try:
                    # Extract the content from the error string if it contains the hallucinated tags
                    import re
                    match = re.search(r"'failed_generation': '(.*?)'", error_str, re.DOTALL)
                    if match:
                        content = match.group(1).replace("\\n", "\n").replace("\\'", "'")
                        # Mock a response object
                        from types import SimpleNamespace
                        response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content, tool_calls=None))])
                except Exception as parse_err:
                    print(f"Parsing failed_generation error: {parse_err}")

            if not response:
                print(f"LLM Call Error: {e}")
                return f"I'm sorry, I'm having trouble connecting to my brain right now: {str(e)}", current_plan, []
        
        message = response.choices[0].message
        updated_plan = current_plan
        
        # 4. Handle Tool Call (Native or Tag Fallback)
        tool_call = None
        if message.tool_calls:
            tool_call = message.tool_calls[0]
        elif message.content and ("<update_plan" in message.content or "<function" in message.content):
            try:
                import re
                # Support both <update_plan>{...}</update_plan> AND <function=update_plan>{...}<function>
                tags = [
                    r"<update_plan>(.*?)</update_plan>",
                    r"<function=update_plan>(.*?)(?:<function>|(?=</function>)|$)",
                    r"<function>(.*?)</function>"
                ]
                for pattern in tags:
                    match = re.search(pattern, message.content, re.DOTALL)
                    if match:
                        args_str = match.group(1).strip()
                        # Clean up trailing JSON noise if model mixed tags
                        if args_str.endswith("<function>"): args_str = args_str.replace("<function>", "")
                        
                        from types import SimpleNamespace
                        tool_call = SimpleNamespace(
                            id=f"tag_fallback_{hash(message.content)}",
                            function=SimpleNamespace(name="update_plan", arguments=args_str)
                        )
                        break
            except Exception as e:
                print(f"Tag parsing error: {e}")

        if tool_call:
            try:
                print(f"Tool Call Detected: {tool_call.function.arguments}")
                args = json.loads(tool_call.function.arguments)
                
                # Robustness: Coerce keys if LLM tried to use operators (like {"$gt": 14})
                # We specifically look for TripShape duration_days
                if "trip_shape" in args and isinstance(args["trip_shape"], dict):
                    dur = args["trip_shape"].get("duration_days")
                    if isinstance(dur, dict) and "$gt" in dur:
                        args["trip_shape"]["duration_days"] = int(dur["$gt"]) + 1 # Simple coercion

                patch = VacationPlanPatch(**args)
                
                # Apply patch with nested merge logic
                patch_data = patch.model_dump(exclude_unset=True)
                current_data = current_plan.model_dump()
                
                def deep_merge(source, update):
                    for k, v in update.items():
                        if k in source and isinstance(source[k], dict) and isinstance(v, dict):
                            deep_merge(source[k], v)
                        else:
                            source[k] = v
                    return source

                updated_data = deep_merge(current_data, patch_data)
                updated_plan = VacationPlan(**updated_data)
                
                # 5. Get final response from LLM
                # We normalize the tool call for the history
                tool_call_dict = {
                    "id": tool_call.id,
                    "type": "function",
                    "function": {"name": "update_plan", "arguments": tool_call.function.arguments}
                }
                
                new_messages.append({
                    "role": "assistant", 
                    "content": message.content if not tool_call.id.startswith("tag") else None, 
                    "tool_calls": [tool_call_dict]
                })

                # Append tool result
                tool_result_msg = {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps({"status": "success", "updated_plan": updated_plan.model_dump()})
                }
                new_messages.append(tool_result_msg)
                
                # Call LLM again for natural language response (using fallback wrapper)
                response_2 = self._call_llm_with_fallback(
                    messages=messages + new_messages
                )
                final_content = response_2.choices[0].message.content
                return final_content, updated_plan, new_messages
                
            except Exception as e:
                print(f"Tool handling error: {e}")
                import traceback
                traceback.print_exc()
                return f"I had trouble updating the plan: {str(e)}", current_plan, []

        # No tool call, return original response
        return message.content or "", current_plan, []
