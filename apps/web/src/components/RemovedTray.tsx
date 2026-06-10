import { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import type { RejectedCandidate } from '../types';

export interface RemovedTrayProps {
  items: RejectedCandidate[];
  onUnremove: (name: string) => void;
}

export function RemovedTray({ items, onUnremove }: RemovedTrayProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 shadow-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Removed ({items.length})
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
          {items.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 rounded-full border border-border/70 bg-cream px-3 py-1.5"
            >
              <span className="font-sans text-[12.5px] font-medium text-foreground/80">
                {item.name}
              </span>
              <span className="text-[11px] text-muted-foreground">· {item.reason}</span>
              <button
                onClick={() => onUnremove(item.name)}
                className="ml-0.5 flex size-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={`Un-remove ${item.name}`}
                title="Un-remove (eligible to suggest again)"
              >
                <RotateCcw className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
