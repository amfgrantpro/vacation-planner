from typing import List, Optional
from pydantic import BaseModel, Field

class VacationPlan(BaseModel):
    """
    Represents the current state of the vacation plan.
    This is the "Source of Truth" that the agent updates.
    """
    # Core Constraints
    destination_candidates: List[str] = Field(default_factory=list, description="List of potential destinations being considered")
    budget_range: Optional[str] = Field(None, description="Budget range (e.g. '$2000-$3000')")
    travelers: int = Field(1, description="Number of travelers")
    dates: Optional[str] = Field(None, description="Travel dates or timeframe")
    
    # Preferences & Meta
    requirements: List[str] = Field(default_factory=list, description="Specific requirements like 'beach', 'pet-friendly', etc.")
    notes: str = Field("", description="Free text notes for things that don't fit other fields")
    status: str = Field("exploring", description="Current status: 'exploring', 'narrowing', 'finalized'")

class VacationPlanPatch(BaseModel):
    """
    Partial update model for VacationPlan. All fields are optional.
    """
    destination_candidates: Optional[List[str]] = Field(None, description="List of potential destinations being considered")
    budget_range: Optional[str] = Field(None, description="Budget range (e.g. '$2000-$3000')")
    travelers: Optional[int] = Field(None, description="Number of travelers")
    dates: Optional[str] = Field(None, description="Travel dates or timeframe")
    requirements: Optional[List[str]] = Field(None, description="Specific requirements like 'beach', 'pet-friendly', etc.")
    notes: Optional[str] = Field(None, description="Free text notes for things that don't fit other fields")
    status: Optional[str] = Field(None, description="Current status: 'exploring', 'narrowing', 'finalized'")
