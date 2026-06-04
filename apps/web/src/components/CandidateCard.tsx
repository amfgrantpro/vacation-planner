import { Plus, MessageCircle } from 'lucide-react';
import type { DestinationCandidate } from '../types';

const GENERIC_FALLBACK_URL =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&auto=format&fit=crop&q=80';

export interface CandidateCardProps {
  candidate: DestinationCandidate;
  isInShortlist: boolean;
  shortlistFull: boolean;
  onTellMeMore: () => void;
  onAddToShortlist: () => void;
}

export function CandidateCard({
  candidate,
  isInShortlist,
  shortlistFull,
  onTellMeMore,
  onAddToShortlist,
}: CandidateCardProps) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card transition hover:shadow-soft duration-300">
      <div className="relative h-48 overflow-hidden">
        <img
          src={candidate.photo_url || GENERIC_FALLBACK_URL}
          alt={candidate.name}
          onError={(e) => {
            e.currentTarget.src = GENERIC_FALLBACK_URL;
          }}
          className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 rounded-full bg-cream-overlay px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ocean-deep backdrop-blur">
          {candidate.region}
        </div>
        {isInShortlist && (
          <div className="absolute right-3 top-3 rounded-full bg-ocean-deep px-2.5 py-1 text-[10.5px] font-semibold text-white shadow-sm">
            ✓ Shortlisted
          </div>
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
                ? 'bg-ocean-deep border-ocean-deep text-white hover:bg-ocean-deep-dim shadow-card'
                : shortlistFull
                  ? 'border-border bg-muted text-muted-foreground/60 cursor-not-allowed'
                  : 'border-ocean-deep-border bg-cream text-ocean-deep hover:bg-ocean-deep hover:text-white'
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
