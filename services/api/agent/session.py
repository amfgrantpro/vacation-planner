from typing import Dict, List, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field
from supabase import create_client, Client

from core.config import settings
from .models import VacationPlan, TripProfile, DestinationCandidate
from .prototype_models import VacationPlan as PrototypeVacationPlan


class Session(BaseModel):
    id: str
    history: List[dict] = Field(default_factory=list)
    plan: VacationPlan = Field(default_factory=VacationPlan)


class PrototypeSession(BaseModel):
    id: str
    history: List[dict] = Field(default_factory=list)
    plan: PrototypeVacationPlan = Field(default_factory=PrototypeVacationPlan)


class SupabaseSessionManager:
    def __init__(self):
        self.supabase: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )

    def create_session(self) -> str:
        result = self.supabase.table("sessions").insert({}).execute()
        return result.data[0]["id"]

    def get_session(self, session_id: str) -> Session:
        # Step 1 — sessions row
        sessions_result = self.supabase.table("sessions").select("*").eq("id", session_id).execute()
        if not sessions_result.data:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        session_row = sessions_result.data[0]

        # Step 2 — trip_profile row (may be absent before first save)
        profile_result = self.supabase.table("trip_profile").select("*").eq("session_id", session_id).execute()
        if profile_result.data:
            row = profile_result.data[0]
            trip_profile = TripProfile(
                origin=row.get("origin"),
                travelers=row.get("travelers"),
                when=row.get("travel_when"),  # DB column travel_when → Python field when
                duration=row.get("duration"),
                budget=row.get("budget"),
                vacation_type=row.get("vacation_type") or [],
                likes=row.get("likes") or [],
                avoid=row.get("avoid") or [],
            )
        else:
            trip_profile = TripProfile()

        # Step 3 — candidates
        candidates_result = self.supabase.table("candidates").select("*").eq("session_id", session_id).execute()
        candidates: List[DestinationCandidate] = []
        for row in candidates_result.data:
            candidates.append(DestinationCandidate(
                name=row["name"],
                region=row["region"],
                vibe=row["vibe"],
                photo_url=row["photo_url"],
                status=row["status"],
                trip_feel=row.get("trip_feel"),
                seasonal_note=row.get("seasonal_note"),
                rejection_reason=row.get("rejection_reason"),
            ))

        # Step 4 — comparison_matrix reconstruction (shortlisted candidates only)
        criteria_result = self.supabase.table("comparison_criteria").select("*").eq("session_id", session_id).execute()
        comparison_matrix: Optional[List[dict]] = None
        if criteria_result.data:
            shortlisted_lower = {c.name.lower() for c in candidates if c.status == "shortlisted"}
            matrix_dict: Dict[str, dict] = {}
            for row in criteria_result.data:
                if row["candidate_name"].lower() in shortlisted_lower:
                    criterion = row["criterion_name"]
                    if criterion not in matrix_dict:
                        matrix_dict[criterion] = {"criterion": criterion}
                    if row["value"] is not None:
                        matrix_dict[criterion][row["candidate_name"]] = row["value"]
            if matrix_dict:
                comparison_matrix = list(matrix_dict.values())

        # Step 5 — conversation_history (ordered by position)
        history_result = (
            self.supabase.table("conversation_history")
            .select("message")
            .eq("session_id", session_id)
            .order("position")
            .execute()
        )
        history = [row["message"] for row in history_result.data]

        plan = VacationPlan(
            mode=session_row["mode"],
            trip_profile=trip_profile,
            candidates=candidates,
            selected_winner=session_row.get("selected_winner"),
            comparison_matrix=comparison_matrix,
        )
        return Session(id=session_id, history=history, plan=plan)

    def save_session(self, session: Session) -> None:
        session_id = session.id
        plan = session.plan

        # Table 1 — sessions (upsert)
        self.supabase.table("sessions").upsert(
            {
                "id": session_id,
                "mode": plan.mode,
                "selected_winner": plan.selected_winner,
            },
            on_conflict="id",
        ).execute()

        # Table 2 — trip_profile (upsert); Python .when → DB travel_when
        profile = plan.trip_profile
        self.supabase.table("trip_profile").upsert(
            {
                "session_id": session_id,
                "origin": profile.origin,
                "travelers": profile.travelers,
                "travel_when": profile.when,
                "duration": profile.duration,
                "budget": profile.budget,
                "vacation_type": profile.vacation_type or [],
                "likes": profile.likes or [],
                "avoid": profile.avoid or [],
            },
            on_conflict="session_id",
        ).execute()

        # Table 3 — candidates (DB-sync: fetch, then insert/update/delete)
        existing_result = (
            self.supabase.table("candidates")
            .select("id, name")
            .eq("session_id", session_id)
            .execute()
        )
        db_candidates: Dict[str, str] = {
            row["name"].lower(): row["id"] for row in existing_result.data
        }

        plan_names_lower = {c.name.lower() for c in plan.candidates}

        for candidate in plan.candidates:
            data = {
                "session_id": session_id,
                "name": candidate.name,
                "region": candidate.region,
                "vibe": candidate.vibe,
                "photo_url": candidate.photo_url,
                "status": candidate.status,
                "trip_feel": candidate.trip_feel,
                "seasonal_note": candidate.seasonal_note,
                "rejection_reason": candidate.rejection_reason,
            }
            key = candidate.name.lower()
            if key in db_candidates:
                self.supabase.table("candidates").update(data).eq("id", db_candidates[key]).execute()
            else:
                self.supabase.table("candidates").insert(data).execute()

        for name_lower, candidate_id in db_candidates.items():
            if name_lower not in plan_names_lower:
                self.supabase.table("candidates").delete().eq("id", candidate_id).execute()

        # Table 4 — comparison_criteria (upsert, never delete)
        if plan.comparison_matrix:
            rows = []
            for row in plan.comparison_matrix:
                criterion = row.get("criterion")
                if not criterion:
                    continue
                for key, value in row.items():
                    if key == "criterion":
                        continue
                    rows.append({
                        "session_id": session_id,
                        "criterion_name": criterion,
                        "candidate_name": key,
                        "value": value,
                    })
            if rows:
                self.supabase.table("comparison_criteria").upsert(
                    rows,
                    on_conflict="session_id,criterion_name,candidate_name",
                ).execute()

        # Table 5 — conversation_history (insert, conflict = ignore)
        if session.history:
            history_rows = [
                {"session_id": session_id, "position": i, "message": message}
                for i, message in enumerate(session.history)
            ]
            self.supabase.table("conversation_history").upsert(
                history_rows,
                on_conflict="session_id,position",
                ignore_duplicates=True,
            ).execute()


class PrototypeSessionManager:
    def __init__(self):
        self._sessions: Dict[str, PrototypeSession] = {}

    def get_session(self, session_id: str) -> PrototypeSession:
        if session_id not in self._sessions:
            self._sessions[session_id] = PrototypeSession(id=session_id)
        return self._sessions[session_id]

    def save_session(self, session: PrototypeSession):
        self._sessions[session.id] = session


prototype_session_manager = PrototypeSessionManager()
