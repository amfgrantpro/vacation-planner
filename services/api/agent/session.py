from typing import Dict, List

from pydantic import BaseModel, Field

from .models import VacationPlan
from .prototype_models import VacationPlan as PrototypeVacationPlan


class Session(BaseModel):
    id: str
    history: List[dict] = Field(default_factory=list)
    plan: VacationPlan = Field(default_factory=VacationPlan)


class PrototypeSession(BaseModel):
    id: str
    history: List[dict] = Field(default_factory=list)
    plan: PrototypeVacationPlan = Field(default_factory=PrototypeVacationPlan)


class SessionManager:
    def __init__(self):
        self._sessions: Dict[str, Session] = {}

    def get_session(self, session_id: str) -> Session:
        if session_id not in self._sessions:
            self._sessions[session_id] = Session(id=session_id)
        return self._sessions[session_id]

    def save_session(self, session: Session):
        self._sessions[session.id] = session


class PrototypeSessionManager:
    def __init__(self):
        self._sessions: Dict[str, PrototypeSession] = {}

    def get_session(self, session_id: str) -> PrototypeSession:
        if session_id not in self._sessions:
            self._sessions[session_id] = PrototypeSession(id=session_id)
        return self._sessions[session_id]

    def save_session(self, session: PrototypeSession):
        self._sessions[session.id] = session


session_manager = SessionManager()
prototype_session_manager = PrototypeSessionManager()
