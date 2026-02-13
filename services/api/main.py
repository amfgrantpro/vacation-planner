from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent.orchestrator import AgentOrchestrator
from agent.session import session_manager
from agent.models import VacationPlan

app = FastAPI(title="Agentic Travel Planner API")

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str

class ChatResponse(BaseModel):
    response: str
    plan: VacationPlan

agent = AgentOrchestrator()

@app.get("/")
def health_check():
    return {"status": "ok", "service": "travel-planner-agent"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Get or create session
        session = session_manager.get_session(request.session_id)
        
        # Update history with user message
        session.history.append({"role": "user", "content": request.message})
        
        # Run agent
        response_text, updated_plan, new_messages = agent.run_turn(session.history, session.plan)
        
        # Update session state
        session.plan = updated_plan
        
        # Add all intermediate messages (tool calls, results) to history
        if new_messages:
            session.history.extend(new_messages)
            
        # Add the final natural language response
        session.history.append({"role": "assistant", "content": response_text})
        
        session_manager.save_session(session)
        
        return ChatResponse(response=response_text, plan=updated_plan)
        
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
