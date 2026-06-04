import { X, ArrowLeft, Check } from 'lucide-react';
import type { DestinationCandidate, Mode } from '../types';
import { CandidateCard } from './CandidateCard';
import { ShortlistCard } from './ShortlistCard';

const GENERIC_FALLBACK_URL =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&auto=format&fit=crop&q=80';

interface CandidateAreaProps {
  mode: Mode;
  candidates: DestinationCandidate[];
  shortlist: string[];
  selectedWinner: string | null;
  comparisonMatrix: Record<string, string>[] | null;
  isEnriching: boolean;
  onTellMeMore: (destination: string) => void;
  onAddToShortlist: (destination: string) => void;
  onRemoveFromShortlist: (destination: string) => void;
  onCompareShortlist: () => void;
  onSelectWinner: (destination: string) => void;
  onFindOthers: () => void;
  onBackToShortlist: () => void;
  canCompare: boolean;
}

export function CandidateArea({
  mode,
  candidates,
  shortlist,
  selectedWinner,
  comparisonMatrix,
  isEnriching,
  onTellMeMore,
  onAddToShortlist,
  onRemoveFromShortlist,
  onCompareShortlist,
  onSelectWinner,
  onFindOthers,
  onBackToShortlist,
  canCompare,
}: CandidateAreaProps) {
  // Show all non-shortlisted candidates in explore mode (cap at 6 for layout)
  const suggestedCandidates = candidates
    .filter((c) => c.status === 'suggested')
    .slice(0, 6);

  /* ── EXPLORE ───────────────────────────────────────────────────────── */
  if (mode === 'explore') {
    return (
      <div className="space-y-8">
        {/* Heading */}
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Destinations to consider
          </h2>
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-sans font-semibold">
            Suggested based on your profile
          </span>
        </div>

        {/* 3-across grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {suggestedCandidates.length > 0 ? (
            suggestedCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.name}
                candidate={candidate}
                isInShortlist={shortlist.includes(candidate.name)}
                shortlistFull={shortlist.length >= 3}
                onTellMeMore={() => onTellMeMore(candidate.name)}
                onAddToShortlist={() => onAddToShortlist(candidate.name)}
              />
            ))
          ) : (
            <div className="col-span-3 py-16 text-center">
              {/* Ghost placeholder cards */}
              <div className="grid grid-cols-3 gap-5 opacity-40 pointer-events-none mb-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-3xl border-2 border-dashed border-border bg-card overflow-hidden"
                  >
                    <div className="h-36 bg-muted" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 w-3/4 bg-muted rounded-full" />
                      <div className="h-3 w-1/2 bg-muted rounded-full" />
                      <div className="h-14 bg-muted rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[13.5px] italic text-muted-foreground">
                No candidates yet. Start the conversation to discover destinations.
              </p>
            </div>
          )}
        </div>

        {/* Shortlist Bar */}
        <ShortlistBar
          items={shortlist.map((name) => {
            const candidate = candidates.find((c) => c.name === name);
            return { name, photo_url: candidate?.photo_url || '' };
          })}
          capacity={3}
          onRemove={onRemoveFromShortlist}
          onCompare={onCompareShortlist}
          canCompare={canCompare}
        />
      </div>
    );
  }

  /* ── COMPARE ───────────────────────────────────────────────────────── */
  if (mode === 'compare') {
    const shortlistedCandidates = shortlist.map((name) => {
      return (
        candidates.find((c) => c.name === name) || {
          name,
          region: '',
          vibe: '',
          photo_url: '',
          status: 'shortlisted' as const,
          best_for: null,
          seasonal_note: null,
        }
      );
    });

    return (
      <div className="space-y-8">
        {/* Heading */}
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              Comparing your shortlist
            </h2>
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-sans font-semibold">
              Compared to your profile
            </span>
          </div>
          {isEnriching && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-ocean animate-pulse" />
              Analysing…
            </div>
          )}
        </div>

        {/* Compare cards — side-by-side, 2–3 across */}
        <div
          className={`grid gap-6 ${
            shortlistedCandidates.length === 2
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {shortlistedCandidates.map((candidate) => (
            <ShortlistCard
              key={candidate.name}
              candidate={candidate}
              comparisonMatrix={comparisonMatrix}
              isEnriching={isEnriching}
              onSelectWinner={() => onSelectWinner(candidate.name)}
            />
          ))}
        </div>

        {/* Not Quite Right? Bar */}
        <NotQuiteRightBar
          onFindOthers={onFindOthers}
          onBackToShortlist={onBackToShortlist}
          showReconsider={false}
        />
      </div>
    );
  }

  /* ── DECISION ──────────────────────────────────────────────────────── */
  if (mode === 'decision') {
    const winner = candidates.find((c) => c.name === selectedWinner);

    return (
      <div className="space-y-8">
        {/* Heading */}
        <div className="flex items-baseline justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-ocean-deep-bg px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ocean-deep font-sans">
              <Check className="size-3" /> decided
            </div>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
              Your destination
            </h2>
          </div>
        </div>

        {/* Decision card */}
        {winner && (
          <div className="mx-auto max-w-[640px] w-full">
            <ShortlistCard
              candidate={winner}
              comparisonMatrix={comparisonMatrix}
              isEnriching={isEnriching}
              onSelectWinner={() => {}}
              winner={true}
            />
          </div>
        )}

        <NotQuiteRightBar
          onFindOthers={onFindOthers}
          onBackToShortlist={onBackToShortlist}
          showReconsider={true}
        />
      </div>
    );
  }

  return null;
}

/* ────────────────────────────────────────────────────────────────────── */
/* ShortlistBar                                                            */
/* ────────────────────────────────────────────────────────────────────── */

interface ShortlistBarProps {
  items: Array<{ name: string; photo_url: string }>;
  capacity: number;
  onRemove: (name: string) => void;
  onCompare: () => void;
  canCompare: boolean;
}

function ShortlistBar({ items, capacity, onRemove, onCompare, canCompare }: ShortlistBarProps) {
  const slots = Array.from({ length: capacity }, (_, i) => items[i]);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-card">
      <div className="shrink-0">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground font-sans font-semibold">
          Shortlist
        </div>
        <div className="mt-0.5 font-serif text-[15px] font-semibold text-foreground">
          {items.length} of {capacity}
        </div>
      </div>

      <div className="flex flex-1 items-center gap-2.5 flex-wrap">
        {slots.map((slot, i) =>
          slot ? (
            <div
              key={i}
              className="flex items-center gap-2 rounded-full border border-border/70 bg-cream py-1 pl-1 pr-2.5 animate-fade-in"
            >
              <img
                src={slot.photo_url || GENERIC_FALLBACK_URL}
                alt={slot.name}
                onError={(e) => {
                  e.currentTarget.src = GENERIC_FALLBACK_URL;
                }}
                className="size-7 rounded-full object-cover"
              />
              <span className="font-sans text-[12.5px] font-medium text-foreground">{slot.name}</span>
              <button
                onClick={() => onRemove(slot.name)}
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive-bg hover:text-destructive"
                aria-label={`Remove ${slot.name}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <div
              key={i}
              className="flex h-9 flex-1 min-w-[80px] items-center justify-center rounded-full border border-dashed border-border bg-muted-soft text-[11.5px] italic text-muted-foreground/70"
            >
              empty slot
            </div>
          )
        )}
      </div>

      <button
        id="compare-shortlist-btn"
        onClick={onCompare}
        disabled={!canCompare}
        className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 font-sans text-[13px] font-medium transition shrink-0 ${
          canCompare
            ? 'bg-ocean-deep text-primary-foreground shadow-card hover:bg-ocean'
            : 'cursor-not-allowed bg-muted text-muted-foreground/70'
        }`}
      >
        Compare shortlist
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* NotQuiteRightBar                                                        */
/* ────────────────────────────────────────────────────────────────────── */

interface NotQuiteRightBarProps {
  onFindOthers: () => void;
  onBackToShortlist?: () => void;
  showReconsider: boolean;
}

function NotQuiteRightBar({
  onFindOthers,
  onBackToShortlist,
  showReconsider,
}: NotQuiteRightBarProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-card">
      <div className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground font-sans font-semibold">
        Not quite right?
      </div>
      <div className={`grid gap-3 ${showReconsider ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
          <div>
            <div className="font-serif text-[14.5px] font-semibold leading-tight text-foreground">
              Explore more destinations
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground font-sans">
              Keep the brief, see new options
            </div>
          </div>
          <button
            id="find-others-btn"
            onClick={onFindOthers}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 font-sans text-[12px] font-medium text-foreground transition hover:bg-muted"
          >
            Find others
          </button>
        </div>
        {showReconsider && onBackToShortlist && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-teal-soft-muted px-4 py-3">
            <div>
              <div className="font-serif text-[14.5px] font-semibold leading-tight text-ocean-deep">
                Reconsider your options
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground font-sans">
                Revisit the trips you compared
              </div>
            </div>
            <button
              id="back-to-shortlist-btn"
              onClick={onBackToShortlist}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-ocean-deep/20 bg-card px-3 font-sans text-[12px] font-medium text-ocean-deep transition hover:bg-cream"
            >
              <ArrowLeft className="size-3.5" /> Back to my shortlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
