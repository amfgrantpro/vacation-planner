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

    def run_turn(self, conversation_history: list, current_plan: VacationPlan) -> tuple[str, VacationPlan, list]:
        """
        Executes a single turn of the agent loop.
        Returns: (response_text, updated_plan, new_messages)
        """
        # 1. Update system prompt with current plan state
        system_msg = SystemPrompts.get_prompt(current_plan.model_dump_json(indent=2))
        
        # 2. Prepare messages
        messages = [{"role": "system", "content": system_msg}] + conversation_history
        new_messages = []
        
        # 3. Call LLM with tool
        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=[self.tool_def],
            tool_choice="auto"
        )
        
        message = response.choices[0].message
        updated_plan = current_plan
        
        # 4. Handle Tool Call (Native or Fallback)
        tool_call = None
        if message.tool_calls:
            tool_call = message.tool_calls[0]
        elif message.content and "<function:update_plan" in message.content:
            # Fallback for when the model outputs raw tags instead of native tools
            try:
                import re
                match = re.search(r"<function:update_plan>(.*?)</function>", message.content, re.DOTALL)
                if match:
                    args_str = match.group(1)
                    args = json.loads(args_str)
                    # Create a mock tool call object for consistency
                    from types import SimpleNamespace
                    tool_call = SimpleNamespace(
                        id=f"fallback_{hash(message.content)}",
                        function=SimpleNamespace(name="update_plan", arguments=args_str)
                    )
            except Exception as e:
                print(f"Fallback parsing error: {e}")

        if tool_call:
            try:
                print(f"Tool Call Detected: {tool_call.function.arguments}")
                args = json.loads(tool_call.function.arguments)
                patch = VacationPlanPatch(**args)
                
                # Apply patch
                updated_data = patch.model_dump(exclude_unset=True)
                current_plan_dict = current_plan.model_dump()
                for key, value in updated_data.items():
                    current_plan_dict[key] = value
                
                updated_plan = VacationPlan(**current_plan_dict)
                
                # 5. Get final response from LLM
                # Track what messages to return to backend for history
                if message.tool_calls:
                    new_messages.append({"role": "assistant", "content": message.content, "tool_calls": [tc.model_dump() for tc in message.tool_calls]})
                else:
                    new_messages.append({"role": "assistant", "content": message.content})

                # Append tool result
                tool_result_msg = {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps({"status": "success", "updated_plan": updated_plan.model_dump()})
                }
                new_messages.append(tool_result_msg)
                
                # Call LLM again for natural language response
                response_2 = self.client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages + new_messages
                )
                final_content = response_2.choices[0].message.content
                return final_content, updated_plan, new_messages
                
            except Exception as e:
                print(f"Tool handling error: {e}")
                return f"I had trouble updating the plan: {str(e)}", current_plan, []

        # No tool call, return original response
        return message.content or "", current_plan, []
