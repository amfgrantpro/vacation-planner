import { useState } from 'react';
import { Plus, MessageCircle, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DestinationCandidate, RejectReason } from '../types';

const GENERIC_FALLBACK_URL =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&auto=format&fit=crop&q=80';

const REJECT_REASONS: RejectReason[] = ['Been there', 'Too far', 'Not my vibe', 'Other'];

export interface CandidateCardProps {
  candidate: DestinationCandidate;
  isInShortlist: boolean;
  shortlistFull: boolean;
  onTellMeMore: () => void;
  onAddToShortlist: () => void;
  onReject: (reason: RejectReason) => void;
}

export function CandidateCard({
  candidate,
  isInShortlist,
  shortlistFull,
  onTellMeMore,
  onAddToShortlist,
  onReject,
}: CandidateCardProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card transition hover:shadow-soft">
      <div className="relative h-48 overflow-hidden">
        <img
          src={candidate.photo_url || GENERIC_FALLBACK_URL}
          alt={candidate.name}
          onError={(e) => {
            e.currentTarget.src = GENERIC_FALLBACK_URL;
          }}
          className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 rounded-full bg-cream/90 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ocean-deep backdrop-blur">
          {candidate.region}
        </div>

        {isInShortlist ? (
          <div className="absolute right-3 top-3 rounded-full bg-ocean-deep px-2.5 py-1 text-[10.5px] font-semibold text-primary-foreground shadow-sm">
            ✓ Shortlisted
          </div>
        ) : (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                aria-label={`Remove ${candidate.name}`}
                className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-cream/90 text-ocean-deep/70 backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="size-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="w-60 p-3"
            >
              <div className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Why remove?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REJECT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => {
                      setPopoverOpen(false);
                      onReject(reason);
                    }}
                    className="rounded-full border border-border bg-card px-2.5 py-1 font-sans text-[12px] text-foreground transition hover:bg-ocean-deep hover:text-primary-foreground"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h4 className="font-serif text-xl font-semibold tracking-tight text-foreground">{candidate.name}</h4>
          <div className="mt-0.5 text-[12px] text-muted-foreground">{candidate.region}</div>
        </div>

        <div className="rounded-xl bg-teal-soft px-3.5 py-3">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ocean-deep/80">
            Destination vibe
          </div>
          <p className="mt-1 font-sans text-[13.5px] leading-relaxed text-foreground/85">
            {candidate.vibe}
          </p>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            id={`tell-more-${candidate.name.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={onTellMeMore}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card font-sans text-[12.5px] font-medium text-foreground transition hover:bg-cream"
          >
            <MessageCircle className="size-3.5" /> Tell me more
          </button>
          <button
            id={`shortlist-${candidate.name.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={onAddToShortlist}
            disabled={shortlistFull && !isInShortlist}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border font-sans text-[12.5px] font-medium transition ${
              isInShortlist
                ? 'bg-ocean-deep border-ocean-deep text-primary-foreground hover:bg-ocean shadow-card'
                : shortlistFull
                  ? 'border-border bg-muted text-muted-foreground/60 cursor-not-allowed'
                  : 'border-ocean-deep/15 bg-cream text-ocean-deep hover:bg-ocean-deep hover:text-primary-foreground'
            }`}
          >
            <Plus className="size-3.5" />
            {isInShortlist ? 'In shortlist' : 'Add to shortlist'}
          </button>
        </div>
      </div>
    </article>
  );
}
