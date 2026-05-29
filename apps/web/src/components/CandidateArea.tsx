import { Plus, X, MessageCircle, ArrowLeft } from 'lucide-react';
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
      <div className="space-y-5">
        {/* Heading */}
        <div>
          <h2 className="font-serif text-2xl font-bold text-ink">Destinations to consider</h2>
          <p className="text-xs font-semibold text-muted-foreground mt-1 tracking-wide uppercase">
            Suggested based on your profile
          </p>
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
              <p className="text-sm text-muted-foreground">
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
    // Match shortlisted candidates; fall back to shortlist name stubs if agent
    // hasn't responded yet (immediate transition)
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
      <div className="space-y-5">
        {/* Heading */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-ink">Comparing your shortlist</h2>
            <p className="text-xs font-semibold text-muted-foreground mt-1 tracking-wide uppercase">
              Compared to your profile
            </p>
          </div>
          {isEnriching && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
        <NotQuiteRightBar onFindOthers={onFindOthers} showReconsider={false} />
      </div>
    );
  }

  /* ── DECISION ──────────────────────────────────────────────────────── */
  if (mode === 'decision') {
    const winner = candidates.find((c) => c.name === selectedWinner);

    return (
      <div className="space-y-5">
        {/* Heading */}
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 mb-2">
            <span>✓</span> DECIDED
          </div>
          <h2 className="font-serif text-2xl font-bold text-ink">Your destination</h2>
        </div>

        {/* Decision card */}
        {winner && (
          <div className="rounded-3xl border border-border bg-card shadow-card overflow-hidden">
            <div className="relative h-64 overflow-hidden">
              <img
                src={winner.photo_url || GENERIC_FALLBACK_URL}
                alt={winner.name}
                onError={(e) => {
                  e.currentTarget.src = GENERIC_FALLBACK_URL;
                }}
                className="size-full object-cover"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-5 text-white">
                <h3 className="font-serif text-3xl font-bold">{winner.name}</h3>
                {winner.region && (
                  <p className="text-sm text-white/80 mt-0.5">{winner.region}</p>
                )}
              </div>
              <div className="absolute top-4 right-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
                YOUR PICK
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Vibe */}
              <div className="rounded-xl bg-teal-soft px-4 py-3">
                <p className="text-xs font-semibold uppercase text-ocean-deep mb-1">Vacation vibe</p>
                <p className="text-sm text-ink">{winner.vibe}</p>
              </div>

              {winner.best_for && (
                <div className="rounded-xl bg-cream px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Best for</p>
                  <p className="text-sm text-ink">{winner.best_for}</p>
                </div>
              )}

              {winner.seasonal_note && (
                <div className="rounded-xl bg-amber-50 px-4 py-3 border border-amber-200">
                  <p className="text-xs font-semibold uppercase text-amber-900 mb-1">Seasonal note</p>
                  <p className="text-sm text-amber-900">{winner.seasonal_note}</p>
                </div>
              )}

              {/* Comparison rows for the winner */}
              {comparisonMatrix && comparisonMatrix.length > 0 && (
                <div className="border-t pt-4 space-y-2">
                  {comparisonMatrix.map((row, idx) => {
                    const criterion = row.criterion ?? Object.keys(row)[0];
                    const value =
                      row[winner.name] ??
                      row[winner.name.toLowerCase()] ??
                      Object.entries(row).find(
                        ([k]) => k.toLowerCase() === winner.name.toLowerCase()
                      )?.[1] ??
                      '—';
                    return (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="font-medium text-muted-foreground">{criterion}</span>
                        <span className="text-ink">{value}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                disabled
                className="w-full bg-emerald-100 text-emerald-700 rounded-xl py-3 font-semibold text-sm cursor-not-allowed"
              >
                I'm going there! 🎉
              </button>
            </div>
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
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card sticky bottom-0 backdrop-blur-sm bg-card/95">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Shortlist — {items.length} of {capacity}
      </p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {Array.from({ length: capacity }).map((_, idx) => {
          const item = items[idx];
          return (
            <div key={idx} className="relative">
              {item ? (
                <div className="relative h-20 rounded-xl overflow-hidden border border-border">
                  <img
                    src={item.photo_url || GENERIC_FALLBACK_URL}
                    alt={item.name}
                    onError={(e) => {
                      e.currentTarget.src = GENERIC_FALLBACK_URL;
                    }}
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/25 flex items-end p-1.5">
                    <p className="text-white text-[11px] font-semibold truncate w-full leading-tight">
                      {item.name}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemove(item.name)}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 hover:bg-white transition"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="size-3 text-ink" />
                  </button>
                </div>
              ) : (
                <div className="h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Empty</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        id="compare-shortlist-btn"
        onClick={onCompare}
        disabled={!canCompare}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
          canCompare
            ? 'bg-ocean-deep text-white hover:bg-ocean/80'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
      >
        {canCompare ? 'Compare shortlist →' : `Add ${2 - items.length > 0 ? 2 - items.length : 0} more to compare`}
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
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Not quite right?
      </p>

      <div className={`grid gap-2 ${showReconsider ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          id="find-others-btn"
          onClick={onFindOthers}
          className="flex items-center justify-between gap-2 rounded-xl bg-cream px-4 py-3 text-sm font-medium text-ink hover:bg-sand transition-colors"
        >
          <div className="text-left">
            <p className="font-semibold text-sm">Explore more destinations</p>
            <p className="text-xs text-muted-foreground mt-0.5">Keep the brief, see new options</p>
          </div>
          <span className="text-base shrink-0">→</span>
        </button>

        {showReconsider && onBackToShortlist && (
          <button
            id="back-to-shortlist-btn"
            onClick={onBackToShortlist}
            className="flex items-center justify-between gap-2 rounded-xl bg-teal-soft px-4 py-3 text-sm font-medium text-ink hover:bg-teal/20 transition-colors"
          >
            <div className="text-left">
              <p className="font-semibold text-sm">Reconsider your options</p>
              <p className="text-xs text-muted-foreground mt-0.5">Revisit the trips you compared</p>
            </div>
            <ArrowLeft className="size-4 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}
