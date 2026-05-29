import type { DestinationCandidate } from '../types';

const GENERIC_FALLBACK_URL =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&auto=format&fit=crop&q=80';

export interface ShortlistCardProps {
  candidate: DestinationCandidate;
  comparisonMatrix: Record<string, string>[] | null;
  isEnriching: boolean;
  onSelectWinner: () => void;
}

export function ShortlistCard({
  candidate,
  comparisonMatrix,
  isEnriching,
  onSelectWinner,
}: ShortlistCardProps) {
  return (
    <div className="rounded-3xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
      {/* Photo */}
      <div className="relative h-52 overflow-hidden shrink-0">
        <img
          src={candidate.photo_url || GENERIC_FALLBACK_URL}
          alt={candidate.name}
          onError={(e) => {
            e.currentTarget.src = GENERIC_FALLBACK_URL;
          }}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 text-white">
          <h3 className="font-serif text-2xl font-bold leading-tight">{candidate.name}</h3>
          {candidate.region && (
            <p className="text-xs text-white/70 mt-0.5">{candidate.region}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Vibe box */}
        <div className="rounded-xl bg-teal-soft px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ocean-deep mb-1">
            Vacation vibe
          </p>
          <p className="text-sm text-ink leading-snug">
            {candidate.vibe || (
              <span className="italic text-muted-foreground">Exploring…</span>
            )}
          </p>
        </div>

        {/* Best for */}
        {(candidate.best_for || isEnriching) && (
          <div className="rounded-xl bg-cream px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Best for
            </p>
            <p className={`text-sm ${candidate.best_for ? 'text-ink' : 'italic text-muted-foreground'}`}>
              {candidate.best_for || 'Analysing…'}
            </p>
          </div>
        )}

        {/* Seasonal note */}
        {(candidate.seasonal_note || isEnriching) && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 mb-1">
              Seasonal note
            </p>
            <p className={`text-sm ${candidate.seasonal_note ? 'text-amber-900' : 'italic text-amber-600'}`}>
              {candidate.seasonal_note || 'Analysing…'}
            </p>
          </div>
        )}

        {/* Matrix rows */}
        {comparisonMatrix && comparisonMatrix.length > 0 ? (
          <div className="border-t pt-3 space-y-2 flex-1">
            {comparisonMatrix.map((row, idx) => {
              const criterion = row.criterion ?? Object.keys(row)[0];
              const value =
                row[candidate.name] ??
                row[candidate.name.toLowerCase()] ??
                Object.entries(row).find(
                  ([k]) => k.toLowerCase() === candidate.name.toLowerCase()
                )?.[1];
              return (
                <div key={idx} className="grid grid-cols-[150px_1fr] text-sm gap-3">
                  <span className="font-medium text-muted-foreground">{criterion}</span>
                  <span
                    className={`${
                      !value ? 'italic text-muted-foreground' : 'text-ink'
                    }`}
                  >
                    {value || (isEnriching ? 'Analysing…' : '—')}
                  </span>
                </div>
              );
            })}
          </div>
        ) : isEnriching ? (
          /* Skeleton rows while agent is working */
          <div className="border-t pt-3 space-y-2 flex-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-3 w-24 bg-muted rounded-full animate-pulse" />
                <div className="h-3 w-20 bg-muted rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA */}
        <button
          id={`choose-${candidate.name.toLowerCase().replace(/\s+/g, '-')}`}
          onClick={onSelectWinner}
          className="w-full bg-ocean-deep text-white rounded-xl py-3 font-semibold text-sm hover:bg-ocean/80 transition-colors mt-2"
        >
          I want to go here
        </button>
      </div>
    </div>
  );
}
