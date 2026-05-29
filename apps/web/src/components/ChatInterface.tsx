import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { Send } from 'lucide-react';

interface ChatInterfaceProps {
    messages: ChatMessage[];
    onSendMessage: (msg: string) => void;
    isLoading: boolean;
}

export function ChatInterface({ messages, onSendMessage, isLoading }: ChatInterfaceProps) {
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
        if (!input.trim() || isLoading) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl border border-border/70 shadow-card overflow-hidden">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && (
                    <div className="flex items-center justify-center h-full text-center">
                        <div>
                            <p className="text-gray-400 text-sm">Start the conversation to begin planning</p>
                        </div>
                    </div>
                )}
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[75%] p-3 rounded-xl ${
                                msg.role === 'user'
                                    ? 'bg-ocean-deep text-white rounded-br-none'
                                    : 'bg-cream text-gray-900 rounded-bl-none'
                            }`}
                        >
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-cream text-gray-700 p-3 rounded-xl rounded-bl-none">
                            <span className="animate-pulse text-sm">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <form onSubmit={handleSubmit} className="border-t border-border/70 p-4 bg-white">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Tell me more..."
                        className="flex-1 px-4 py-2 border border-border/70 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-ocean-deep disabled:opacity-50"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-ocean-deep text-white hover:bg-ocean-deep/90 disabled:opacity-50 transition"
                    >
                        <Send className="size-4" />
                    </button>
                </div>
            </form>
        </div>
    );
}
