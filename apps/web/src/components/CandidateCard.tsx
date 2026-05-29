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
    <div className="group rounded-3xl border border-border bg-card shadow-card overflow-hidden hover:shadow-soft transition-shadow duration-300">
      {/* Photo */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={candidate.photo_url || GENERIC_FALLBACK_URL}
          alt={candidate.name}
          onError={(e) => {
            e.currentTarget.src = GENERIC_FALLBACK_URL;
          }}
          className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Region badge */}
        <div className="absolute top-3 left-3 rounded-full bg-cream/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-ocean-deep">
          {candidate.region}
        </div>
        {/* Shortlisted indicator */}
        {isInShortlist && (
          <div className="absolute top-3 right-3 rounded-full bg-ocean-deep px-2.5 py-1 text-xs font-semibold text-white">
            ✓ Shortlisted
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        <div>
          <h4 className="font-serif text-xl font-semibold text-ink leading-tight">{candidate.name}</h4>
        </div>

        {/* Vibe box */}
        <div className="rounded-xl bg-teal-soft px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ocean-deep mb-1">
            Destination vibe
          </p>
          <p className="text-sm text-ink leading-snug">{candidate.vibe}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            id={`tell-more-${candidate.name.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={onTellMeMore}
            className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-xs font-medium text-ink hover:bg-cream transition-colors"
          >
            <MessageCircle className="size-3.5" />
            Tell me more
          </button>
          <button
            id={`shortlist-${candidate.name.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={onAddToShortlist}
            disabled={shortlistFull && !isInShortlist}
            className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors ${
              isInShortlist
                ? 'bg-ocean-deep text-white'
                : shortlistFull
                  ? 'border border-border bg-muted text-muted-foreground cursor-not-allowed'
                  : 'border border-ocean/30 bg-cream text-ocean-deep hover:bg-ocean-deep hover:text-white'
            }`}
          >
            <Plus className="size-3.5" />
            {isInShortlist ? 'In shortlist' : 'Add to shortlist'}
          </button>
        </div>
      </div>
    </div>
  );
}
