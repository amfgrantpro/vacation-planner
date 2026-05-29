"""
Sprint 3 state models — locked for /chat/prototype only.

Do not import from Sprint 4 orchestrator or models.py.
"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Phase(str, Enum):
    INTAKE = "intake"
    EXPLORE = "explore"
    SHORTLIST = "shortlist"
    COMPARE = "compare"


class TripShape(BaseModel):
    origin: Optional[str] = Field(None, description="Where the traveler is starting from")
    duration_days: Optional[int] = Field(None, description="Total length of the trip in days")
    travelers: int = Field(1, description="Number of people traveling")
    pax_description: str = Field("", description="Description of the group (e.g., 'Couple with a toddler')")


class MentalModel(BaseModel):
    knowns: List[str] = Field(default_factory=list, description="Factual constraints confirmed by the user")
    unknowns: List[str] = Field(
        default_factory=list,
        description="Major systemic blockers preventing a decision (not last question asked)",
    )
    sentiments: List[str] = Field(default_factory=list, description="Emotional cues or vibes")


class DestinationCandidate(BaseModel):
    name: str = Field(description="Name of the destination (city or region)")
    status: str = Field("active", description="'active' or 'eliminated'")
    rationale: str = Field("", description="Why it was kept or removed")
    pros_cons: Optional[dict] = Field(None, description="Structured pros and cons — populated in Compare phase")
    decision_criteria: Optional[dict] = Field(
        None, description="Key unknowns/deciding factors specific to this destination"
    )


class VacationPlan(BaseModel):
    """Sprint 3 vacation plan (phase-gated funnel)."""

    phase: Phase = Field(Phase.INTAKE, description="Current funnel phase")
    vacation_purpose: str = Field("", description="The 'Why' - reason for travel")
    trip_shape: TripShape = Field(default_factory=TripShape)
    mental_model: MentalModel = Field(default_factory=MentalModel)
    candidates: List[DestinationCandidate] = Field(
        default_factory=list, description="Persistent ledger of destination candidates"
    )
    budget_range: Optional[str] = Field(None, description="Budget range (e.g. '$2000-$3000')")
    comparison_matrix: Optional[List[dict]] = Field(
        None, description="MCDM trade-off rows — populated in Compare phase"
    )
    notes: str = Field("", description="Free text notes")


class TripShapePatch(BaseModel):
    origin: Optional[str] = None
    duration_days: Optional[int] = None
    travelers: Optional[int] = None
    pax_description: Optional[str] = None


class MentalModelPatch(BaseModel):
    knowns: Optional[List[str]] = None
    unknowns: Optional[List[str]] = None
    sentiments: Optional[List[str]] = None


class VacationPlanPatch(BaseModel):
    """Partial update for update_plan tool. Candidates use manage_candidates."""

    vacation_purpose: Optional[str] = None
    trip_shape: Optional[TripShapePatch] = None
    mental_model: Optional[MentalModelPatch] = None
    budget_range: Optional[str] = None
    notes: Optional[str] = None
