from typing import Dict, List
from pydantic import BaseModel, Field
from .models import VacationPlan

class Session(BaseModel):
    id: str
    history: List[dict] = Field(default_factory=list)  # [{"role": "user", "content": "..."}]
    plan: VacationPlan = Field(default_factory=VacationPlan)

class SessionManager:
    def __init__(self):
        # Simulating a database with an in-memory dictionary
        self._sessions: Dict[str, Session] = {}

    def get_session(self, session_id: str) -> Session:
        if session_id not in self._sessions:
            self._sessions[session_id] = Session(id=session_id)
        return self._sessions[session_id]

    def save_session(self, session: Session):
        self._sessions[session.id] = session

# Global instance
session_manager = SessionManager()
