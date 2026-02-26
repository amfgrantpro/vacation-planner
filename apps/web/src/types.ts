export type Phase = 'intake' | 'explore' | 'shortlist' | 'compare';

export interface DestinationCandidate {
    name: string;
    status: 'active' | 'eliminated';
    rationale: string;
    pros_cons?: Record<string, string> | null;
    decision_criteria?: Record<string, string> | null;
}

export interface TripShape {
    origin: string | null;
    duration_days: number | null;
    travelers: number;
    pax_description: string;
}

export interface MentalModel {
    knowns: string[];
    unknowns: string[];
    sentiments: string[];
}

export interface VacationPlan {
    phase: Phase;
    vacation_purpose: string;
    trip_shape: TripShape;
    mental_model: MentalModel;
    candidates: DestinationCandidate[];
    budget_range: string | null;
    comparison_matrix: Record<string, string>[] | null;
    notes: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    comparison_matrix?: Record<string, string>[] | null;
}

export interface ChatResponse {
    response: string;
    plan: VacationPlan;
    comparison_matrix: Record<string, string>[] | null;
}
