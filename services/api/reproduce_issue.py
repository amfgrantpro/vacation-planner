import sys
import os

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agent.orchestrator import AgentOrchestrator
from agent.models import VacationPlan

def test_agent_loop():
    print("Initializing Agent...")
    try:
        agent = AgentOrchestrator()
    except Exception as e:
        print(f"Failed to initialize agent (check .env?): {e}")
        return

    # Simulate a session
    history = [
        {"role": "user", "content": "I want to go to Japan next month with my partner for a week."}
    ]
    current_plan = VacationPlan()
    
    print(f"\n--- Running Turn with Input: {history[-1]['content']} ---")
    
    try:
        # Step into run_turn manually to see internal state if needed
        # But first just run it and print debug info
        
        # 1. Update system prompt with current plan state
        from agent.prompt import SystemPrompts
        system_msg = SystemPrompts.get_prompt(current_plan.model_dump_json(indent=2))
        messages = [{"role": "system", "content": system_msg}] + history
        
        print("\n--- Sending request to Groq ---")
        response = agent.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=[agent.tool_def],
            tool_choice="auto"
        )
        
        message = response.choices[0].message
        print("\n--- Raw Message Object ---")
        print(f"Content: {message.content}")
        print(f"Tool Calls: {message.tool_calls}")
        
        # Now run the actual orchestration
        response_text, updated_plan, new_messages = agent.run_turn(history, current_plan)
        
        print("\n--- Agent Result ---")
        print(f"Response: {response_text}")
        print(f"Plan Updated: {updated_plan != current_plan}")
        print(f"New Messages Added to History: {len(new_messages)}")
        
        # Check if response looks like the bug (raw function call)
        if message.content and ("<function:" in message.content or "update_plan" in message.content):
            print("\n[FAILURE] The agent is returning tool calls in the content field!")
        elif message.tool_calls or (message.content and "update_plan" in message.content):
            print("\n[SUCCESS] Tool call detected (Native or Fallback).")
        else:
            print("\n[INFO] No tool calls detected.")
            
        print("\n--- Updated Plan ---")
        print(updated_plan.model_dump_json(indent=2))
            
    except Exception as e:
        print(f"\n[ERROR] Exception during test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_agent_loop()
