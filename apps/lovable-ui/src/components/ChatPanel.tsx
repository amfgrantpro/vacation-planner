import type { ReactNode } from "react";
import { Send } from "lucide-react";
import { Logo } from "./Logo";

export type ChatMsg = { from: "agent" | "user"; text: ReactNode };

export function ChatPanel({ messages, typing = false }: { messages: ChatMsg[]; typing?: boolean }) {
  return (
    <aside className="flex h-screen w-[35%] min-w-[420px] max-w-[520px] flex-col border-r border-border/70 bg-cream">
      <header className="flex items-center justify-between px-6 py-5">
        <Logo />
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          chat
        </span>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6 pt-2">
        {messages.map((m, i) => (
          <Bubble key={i} from={m.from}>
            {m.text}
          </Bubble>
        ))}
        {typing && (
          <Bubble from="agent">
            <span className="inline-flex items-center gap-1">
              <Dot /> <Dot delay="120ms" /> <Dot delay="240ms" />
            </span>
          </Bubble>
        )}
      </div>

      <div className="px-5 pb-5">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-card">
          <div className="flex-1 px-3 py-2 text-[14px] text-muted-foreground/80">
            Tell me more…
          </div>
          <button className="flex size-9 items-center justify-center rounded-xl bg-ocean-deep text-primary-foreground shadow-card transition hover:bg-ocean">
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function Bubble({ from, children }: { from: "agent" | "user"; children: ReactNode }) {
  if (from === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-[20px] rounded-tr-md bg-ocean-deep px-4 py-2.5 font-sans text-[14px] leading-relaxed text-primary-foreground shadow-card">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-[20px] rounded-tl-md bg-card px-4 py-2.5 font-sans text-[14px] leading-relaxed text-foreground shadow-card">
        {children}
      </div>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="inline-block size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay }}
    />
  );
}
