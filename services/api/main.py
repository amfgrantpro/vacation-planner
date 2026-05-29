from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent.orchestrator import AgentOrchestrator
from agent.prototype_orchestrator import AgentOrchestrator as PrototypeAgentOrchestrator
from agent.session import session_manager, prototype_session_manager
from agent.models import VacationPlan, UiState, DestinationCandidate, TripProfile
from agent.prototype_models import VacationPlan as PrototypeVacationPlan

app = FastAPI(title="Agentic Travel Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: str
    ui_state: Optional[UiState] = None  # Optional for backward compatibility with prototype


class ChatResponse(BaseModel):
    text_reply: str
    plan: VacationPlan
    trip_profile: TripProfile
    candidates: List[DestinationCandidate]
    comparison_matrix: Optional[List[dict]] = None


class PrototypeResponse(BaseModel):
    """Sprint 3 prototype endpoint response (phase-gated plan schema)."""
    response: str
    plan: PrototypeVacationPlan
    comparison_matrix: Optional[List[dict]] = None


agent = AgentOrchestrator()
prototype_agent = PrototypeAgentOrchestrator()


@app.get("/")
def health_check():
    return {"status": "ok", "service": "travel-planner-agent"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        session = session_manager.get_session(request.session_id)
        session.history.append({"role": "user", "content": request.message})

        # State reconciliation: sync frontend UI state with backend plan
        if request.ui_state:
            session.plan.mode = request.ui_state.mode
            session.plan.selected_winner = request.ui_state.selected_winner

            # Update candidate statuses based on shortlist (case-insensitive matching)
            shortlist_lower = set(s.lower().strip() for s in request.ui_state.shortlist)
            updated_candidates = []
            
            for candidate in session.plan.candidates:
                # Check if this candidate is in the shortlist (case-insensitive)
                if candidate.name.lower().strip() in shortlist_lower:
                    candidate.status = "shortlisted"
                else:
                    # Remove from shortlist if it was previously there but isn't anymore
                    if candidate.status == "shortlisted":
                        candidate.status = "suggested"
                updated_candidates.append(candidate)
            
            session.plan.candidates = updated_candidates

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
            text_reply=text_reply,
            plan=updated_plan,
            trip_profile=updated_plan.trip_profile,
            candidates=updated_plan.candidates,
            comparison_matrix=comparison_matrix,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/prototype", response_model=PrototypeResponse)
async def chat_prototype(request: ChatRequest):
    """
    Prototype endpoint for Sprint 3 demo.
    Routes through the locked prototype_orchestrator to preserve Sprint 3 behavior.
    """
    try:
        session = prototype_session_manager.get_session(request.session_id)
        session.history.append({"role": "user", "content": request.message})

        try:
            structured, updated_plan, new_messages = prototype_agent.run_turn(session.history, session.plan)
        except Exception as e:
            # If the orchestrator fails (e.g., tool execution error, rate limit, etc.)
            print(f"Prototype agent orchestrator failed: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))

        session.plan = updated_plan

        if new_messages:
            session.history.extend(new_messages)

        text_reply = structured.get("text_reply", "")
        comparison_matrix = structured.get("comparison_matrix", None)

        session.history.append({"role": "assistant", "content": text_reply})
        prototype_session_manager.save_session(session)

        return PrototypeResponse(
            response=text_reply,
            plan=updated_plan,
            comparison_matrix=comparison_matrix,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chat/prototype endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
