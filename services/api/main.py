from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent.orchestrator import AgentOrchestrator
from agent.session import session_manager
from agent.models import VacationPlan

app = FastAPI(title="Agentic Travel Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
    comparison_matrix: Optional[List[dict]] = None


agent = AgentOrchestrator()


@app.get("/")
def health_check():
    return {"status": "ok", "service": "travel-planner-agent"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        session = session_manager.get_session(request.session_id)
        session.history.append({"role": "user", "content": request.message})

        try:
            structured, updated_plan, new_messages = agent.run_turn(session.history, session.plan)
        except Exception as e:
            # If the orchestrator fails (e.g., tool execution error, rate limit, etc.)
            print(f"Agent orchestrator failed: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))

        session.plan = updated_plan

        if new_messages:
            session.history.extend(new_messages)

        text_reply = structured.get("text_reply", "")
        comparison_matrix = structured.get("comparison_matrix", None)

        session.history.append({"role": "assistant", "content": text_reply})
        session_manager.save_session(session)

        return ChatResponse(
            response=text_reply,
            plan=updated_plan,
            comparison_matrix=comparison_matrix,
        )

    except HTTPException:
        # Re-raise HTTP exceptions so FastAPI can handle them natively
        raise
        print(f"Error in chat endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
