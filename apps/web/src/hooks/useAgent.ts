import { useState, useRef } from 'react';
import type { VacationPlan, ChatMessage, UiState, RejectedCandidate, TripProfile } from '../types';


export function useAgent() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [plan, setPlan] = useState<VacationPlan | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId] = useState(() => Math.random().toString(36).substring(7));
    const [uiState, setUiState] = useState<UiState>({
        mode: 'explore',
        shortlist: [],
        selected_winner: null,
        rejected_candidates: [],
    });

    const uiStateRef = useRef<UiState>(uiState);
    uiStateRef.current = uiState;

    const updateUiState = (updates: Partial<UiState>) => {
        setUiState((prev) => ({ ...prev, ...updates }));
    };

    const sendMessage = async (
        content: string,
        overrideUiState?: UiState,
        rejectedCandidates: RejectedCandidate[] = [],
        onboardingProfile?: TripProfile,
        profileOverride?: TripProfile | null,
    ) => {
        const newMessages: ChatMessage[] = [...messages, { role: 'user', content }];
        setMessages(newMessages);
        setIsLoading(true);

        // Use override state if provided (for immediate state transitions), otherwise use current state
        const stateToSend = overrideUiState || uiStateRef.current;

        try {
            const res = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content,
                    session_id: sessionId,
                    ui_state: {
                        ...stateToSend,
                        rejected_candidates: rejectedCandidates,
                    },
                    onboarding_profile: onboardingProfile ?? null,
                    profile_override: profileOverride ?? null,
                }),
            });

            if (!res.ok) throw new Error('Network response was not ok');

            const data = await res.json();

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: data.text_reply,
            };

            setMessages([...newMessages, assistantMessage]);
            setPlan(data.plan);
            // Client is authoritative for mode — never overwrite from server.
            // Sync shortlist and winner from server candidates (they're the source of truth
            // for status; client shortlist additions are optimistic until confirmed).
            setUiState((prev) => ({
                ...prev,
                // mode intentionally excluded — client controls transitions
                shortlist: data.candidates
                    .filter((c: any) => c.status === 'shortlisted')
                    .map((c: any) => c.name),
                selected_winner: data.plan.selected_winner ?? prev.selected_winner,
            }));
        } catch (error) {
            console.error(error);
            setMessages([
                ...newMessages,
                {
                    role: 'assistant',
                    content: 'Error connecting to agent. Please ensure the backend is running on port 8000.',
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return { messages, plan, isLoading, sessionId, uiState, updateUiState, sendMessage };
}
