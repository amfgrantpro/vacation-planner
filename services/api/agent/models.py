from typing import List, Optional
from pydantic import BaseModel, Field


class TripProfile(BaseModel):
    """Trip profile extracted from the user's conversation."""
    origin: Optional[str] = None
    travelers: Optional[str] = None  # e.g., "solo traveller", "couple", "family"
    when: Optional[str] = None       # e.g., "September", "flexible"
    duration: Optional[str] = None   # e.g., "1 week", "flexible"
    budget: Optional[str] = None     # e.g., "mid-range", "luxury"
    vacation_type: List[str] = Field(default_factory=list)
    likes: List[str] = Field(default_factory=list)
    avoid: List[str] = Field(default_factory=list)


class DestinationCandidate(BaseModel):
    """A destination candidate in exploration or comparison."""
    name: str
    region: str
    vibe: str  # Destination character and atmosphere — a general description of the location
    photo_url: str
    status: str = "suggested"  # "suggested" | "shortlisted" | "rejected"
    trip_feel: Optional[str] = None
    seasonal_note: Optional[str] = None
    rejection_reason: Optional[str] = None  # e.g. "Too far", "Been there"


class RejectedCandidate(BaseModel):
    """A candidate rejected by the user via the UI."""
    name: str
    reason: str  # "Been there" | "Too far" | "Not my vibe" | "Other"


class VacationPlan(BaseModel):
    """Represents the complete vacation planning state."""
    mode: str = "explore"  # "explore" | "compare" | "decision"
    trip_profile: TripProfile = Field(default_factory=TripProfile)
    candidates: List[DestinationCandidate] = Field(default_factory=list)
    selected_winner: Optional[str] = None
    comparison_matrix: Optional[List[dict]] = None


class UiState(BaseModel):
    """Frontend UI state synced with each request."""
    mode: str = "explore"  # "explore" | "compare" | "decision"
    shortlist: List[str] = Field(default_factory=list)  # destination names
    selected_winner: Optional[str] = None
    rejected_candidates: List[RejectedCandidate] = Field(default_factory=list)

