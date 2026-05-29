export type Mode = 'explore' | 'compare' | 'decision';

export interface TripProfile {
  origin: string | null;
  travelers: string | null;
  when: string | null;
  duration: string | null;
  budget: string | null;
  vacation_type: string | null;
  likes: string[];
  avoid: string[];
}

export interface DestinationCandidate {
  name: string;
  region: string;
  vibe: string;
  photo_url: string;
  status: 'suggested' | 'shortlisted';
  best_for?: string | null;
  seasonal_note?: string | null;
}

export interface VacationPlan {
  mode: Mode;
  trip_profile: TripProfile;
  candidates: DestinationCandidate[];
  selected_winner: string | null;
  comparison_matrix: Record<string, string>[] | null;
  notes: string;
}

export interface UiState {
  mode: Mode;
  shortlist: string[];
  selected_winner: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}


export interface ChatResponse {
  text_reply: string;
  plan: VacationPlan;
  trip_profile: TripProfile;
  candidates: DestinationCandidate[];
  comparison_matrix: Record<string, string>[] | null;
}
