export interface VacationPlan {
    destination_candidates: string[];
    budget_range: string | null;
    travelers: number;
    dates: string | null;
    requirements: string[];
    notes: string;
    status: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatResponse {
    response: string;
    plan: VacationPlan;
}
