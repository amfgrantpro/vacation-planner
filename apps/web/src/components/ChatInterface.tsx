import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { ComparisonMatrix } from './ComparisonMatrix';

interface ChatInterfaceProps {
    messages: ChatMessage[];
    onSendMessage: (msg: string) => void;
    isLoading: boolean;
    activeCandidateNames?: string[];
}

export function ChatInterface({ messages, onSendMessage, isLoading, activeCandidateNames = [] }: ChatInterfaceProps) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}
                        >
                            <div
                                className={`p-3 rounded-lg ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                            </div>

                            {/* Comparison matrix — only visible on assistant messages */}
                            {msg.role === 'assistant' && msg.comparison_matrix && msg.comparison_matrix.length > 0 && (
                                <ComparisonMatrix
                                    matrix={msg.comparison_matrix}
                                    candidateNames={activeCandidateNames}
                                />
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-800 p-3 rounded-lg rounded-bl-none">
                            <span className="animate-pulse text-sm">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="What are you thinking about for your next vacation?"
                        className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
}
