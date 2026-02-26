import { useState } from 'react';
import type { VacationPlan, ChatMessage } from '../types';

export function useAgent() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [plan, setPlan] = useState<VacationPlan | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId] = useState(() => Math.random().toString(36).substring(7));

    const sendMessage = async (content: string) => {
        const newMessages: ChatMessage[] = [...messages, { role: 'user', content }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const res = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: content, session_id: sessionId }),
            });

            if (!res.ok) throw new Error('Network response was not ok');

            const data = await res.json();

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: data.response,
                comparison_matrix: data.comparison_matrix ?? null,
            };

            setMessages([...newMessages, assistantMessage]);
            setPlan(data.plan);
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

    return { messages, plan, isLoading, sendMessage };
}
