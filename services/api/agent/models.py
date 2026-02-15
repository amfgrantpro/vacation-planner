from typing import List, Optional
from pydantic import BaseModel, Field

class TripShape(BaseModel):
    origin: Optional[str] = Field(None, description="Where the traveler is starting from")
    duration_days: Optional[int] = Field(None, description="Total length of the trip in days")
    travelers: int = Field(1, description="Number of people traveling")
    pax_description: str = Field("", description="Description of the group (e.g., 'Couple with a toddler')")

class MentalModel(BaseModel):
    knowns: List[str] = Field(default_factory=list, description="Factual constraints confirmed by the user")
    unknowns: List[str] = Field(default_factory=list, description="Critical gaps identified by the agent that need solving")
    sentiments: List[str] = Field(default_factory=list, description="Emotional cues or vibes (e.g., 'anxious about cost', 'excited for nature')")

class Destination(BaseModel):
    name: str
    region: str
    country: str
    vibe: str
    rationale: str

class VacationPlan(BaseModel):
    """
    Represents the rich state of the vacation planning process.
    """
    phase: str = Field("context", description="Current funnel phase: 'context', 'exploration', 'refinement', 'finalization'")
    vacation_purpose: str = Field("", description="The 'Why' - reason for travel, anniversary, escape, etc.")
    trip_shape: TripShape = Field(default_factory=TripShape)
    mental_model: MentalModel = Field(default_factory=MentalModel)
    
    # Selection state
    candidates: List[Destination] = Field(default_factory=list, description="List of potential destinations being considered")
    budget_range: Optional[str] = Field(None, description="Budget range (e.g. '$2000-$3000')")
    notes: str = Field("", description="Free text notes")
    status: str = Field("in_progress", description="Overall status of the plan")

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
    """
    Partial update model for VacationPlan.
    """
    phase: Optional[str] = None
    vacation_purpose: Optional[str] = None
    trip_shape: Optional[TripShapePatch] = None
    mental_model: Optional[MentalModelPatch] = None
    candidates: Optional[List[Destination]] = None
    budget_range: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

if __name__ == "__main__":
    # Quick validation check
    try:
        plan = VacationPlan()
        print("Initial Phase:", plan.phase)
        patch = VacationPlanPatch(vacation_purpose="Anniversary", trip_shape={"origin": "London"})
        print("Patch validated successfully")
    except Exception as e:
        print("Validation failed:", e)
