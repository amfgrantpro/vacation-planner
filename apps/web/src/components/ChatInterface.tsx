import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { Send } from 'lucide-react';
import { Logo } from './Logo';

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
    <aside className="flex h-full w-full flex-col border-r border-border/70 bg-cream">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 shrink-0">
        <Logo />
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-sans font-semibold">
          chat
        </span>
      </header>

      {/* Messages area */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6 pt-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <p className="text-muted-foreground/60 text-[13.5px] italic">
              Start the conversation to begin planning
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`font-sans text-[14px] leading-relaxed px-4 py-2.5 shadow-card ${
                msg.role === 'user'
                  ? 'max-w-[88%] rounded-[20px] rounded-tr-md bg-ocean-deep text-primary-foreground'
                  : 'max-w-[92%] rounded-[20px] rounded-tl-md bg-card text-foreground'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-[20px] rounded-tl-md bg-card px-4 py-2.5 shadow-card flex items-center">
              <span className="inline-flex items-center gap-1.5 py-1">
                <Dot />
                <Dot delay="120ms" />
                <Dot delay="240ms" />
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="px-5 pb-5 shrink-0 bg-transparent">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-card focus-within:ring-1 focus-within:ring-ocean/40 transition-shadow">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me more..."
            className="flex-1 px-3 py-2 text-[14px] bg-transparent text-foreground placeholder-muted-foreground/75 focus:outline-none disabled:opacity-50"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ocean-deep text-primary-foreground shadow-card transition hover:bg-ocean disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}

function Dot({ delay = '0ms' }: { delay?: string }) {
  return (
    <span
      className="inline-block size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay }}
    />
  );
}
