import type { DestinationCandidate } from '../types';
import { ArrowRight, CloudSun, Activity, Car, BedDouble, Sparkles, CalendarRange } from 'lucide-react';

const GENERIC_FALLBACK_URL =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&auto=format&fit=crop&q=80';

export interface ShortlistCardProps {
  candidate: DestinationCandidate;
  comparisonMatrix: Record<string, string>[] | null;
  isEnriching: boolean;
  onSelectWinner: () => void;
  winner?: boolean;
}

export function ShortlistCard({
  candidate,
  comparisonMatrix,
  isEnriching,
  onSelectWinner,
  winner = false,
}: ShortlistCardProps) {
  const getIconForCriterion = (label: string) => {
    const norm = label.toLowerCase();
    if (norm.includes('weather')) return <CloudSun className="size-3.5" />;
    if (norm.includes('activities') || norm.includes('activity')) return <Activity className="size-3.5" />;
    if (norm.includes('around') || norm.includes('transit') || norm.includes('car') || norm.includes('getting')) return <Car className="size-3.5" />;
    if (norm.includes('accommodation') || norm.includes('hotel') || norm.includes('stay')) return <BedDouble className="size-3.5" />;
    if (norm.includes('style') || norm.includes('vibe')) return <Sparkles className="size-3.5" />;
    if (norm.includes('season') || norm.includes('month') || norm.includes('when')) return <CalendarRange className="size-3.5" />;
    return <Sparkles className="size-3.5" />;
  };

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-3xl border bg-card shadow-card ${
        winner ? 'border-ocean-deep/30 ring-2 ring-ocean-deep/15' : 'border-border/70'
      }`}
    >
      {/* Photo */}
      <div className="relative h-64 overflow-hidden">
        <img
          src={candidate.photo_url || GENERIC_FALLBACK_URL}
          alt={candidate.name}
          onError={(e) => {
            e.currentTarget.src = GENERIC_FALLBACK_URL;
          }}
          className="size-full object-cover"
        />
        <div className="absolute left-4 top-4 rounded-full bg-cream/90 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ocean-deep backdrop-blur">
          {candidate.region}
        </div>
        {winner && (
          <div className="absolute right-4 top-4 rounded-full bg-ocean-deep px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-primary-foreground">
            your pick
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <h4 className="font-serif text-2xl font-semibold tracking-tight text-foreground">{candidate.name}</h4>
          <div className="mt-0.5 text-[12.5px] text-muted-foreground">{candidate.region}</div>
        </div>

        {/* Vibe box */}
        <div className="rounded-xl bg-teal-soft px-4 py-3.5">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ocean-deep/80">
            Vacation vibe
          </div>
          <p className="mt-1 font-sans text-[13.5px] leading-relaxed text-foreground/85">
            {candidate.vibe || <span className="italic text-muted-foreground/70">Exploring…</span>}
          </p>
        </div>

        {/* Best for */}
        {(candidate.best_for || isEnriching) && (
          <div className="flex items-start gap-2 rounded-xl bg-sage/25 px-3.5 py-2.5">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[oklch(0.4_0.07_155)]" />
            <p className="font-sans text-[12.5px] leading-relaxed text-foreground/85">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[oklch(0.4_0.07_155)]">Best for · </span>
              {candidate.best_for || <span className="italic text-muted-foreground/70">Analysing…</span>}
            </p>
          </div>
        )}

        {/* Seasonal note */}
        {(candidate.seasonal_note || isEnriching) && (
          <div className="flex items-start gap-2 rounded-xl bg-sun/15 px-3.5 py-2.5">
            <CalendarRange className="mt-0.5 size-3.5 shrink-0 text-[oklch(0.45_0.13_70)]" />
            <p className="font-sans text-[12.5px] leading-relaxed text-foreground/85">
              <span className="font-medium text-[oklch(0.45_0.13_70)]">In season: </span>
              {candidate.seasonal_note || <span className="italic text-muted-foreground/70">Analysing…</span>}
            </p>
          </div>
        )}

        {/* Comparison rows */}
        <div className="divide-y divide-border/70 rounded-xl border border-border/70 bg-cream/50">
          {comparisonMatrix && comparisonMatrix.length > 0 ? (
            comparisonMatrix.map((row, idx) => {
              const criterion = row.criterion ?? Object.keys(row)[0];
              const value =
                row[candidate.name] ??
                row[candidate.name.toLowerCase()] ??
                Object.entries(row).find(
                  ([k]) => k.toLowerCase() === candidate.name.toLowerCase()
                )?.[1];
              return (
                <div key={idx} className="grid grid-cols-[150px_1fr] items-start gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                    <span className="text-ocean-deep/80">{getIconForCriterion(criterion)}</span>
                    <span className="text-[12px] font-medium uppercase tracking-[0.1em]">{criterion}</span>
                  </div>
                  <div
                    className={`font-sans text-[13px] leading-snug ${
                      !value ? 'italic text-muted-foreground/75' : 'text-foreground/85'
                    }`}
                  >
                    {value || (isEnriching ? 'Analysing…' : '—')}
                  </div>
                </div>
              );
            })
          ) : isEnriching ? (
            /* Skeleton rows when enriching */
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="grid grid-cols-[150px_1fr] items-center gap-3 px-4 py-2.5 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="size-3.5 bg-muted rounded-full animate-pulse" />
                  <div className="h-3 w-16 bg-muted rounded-full animate-pulse" />
                </div>
                <div className="h-3 w-3/4 bg-muted rounded-full animate-pulse" />
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-center text-xs text-muted-foreground italic">
              No comparison matrix generated yet.
            </div>
          )}
        </div>

        {/* Action Button */}
        {winner ? (
          <div className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sun/30 via-coral/15 to-teal-soft px-4 py-3.5 font-serif text-[16px] font-semibold text-ocean-deep">
            <Sparkles className="size-4 text-coral" />
            I'm going to go to there!
          </div>
        ) : (
          <button
            id={`choose-${candidate.name.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={onSelectWinner}
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ocean-deep font-sans text-[14px] font-semibold text-primary-foreground shadow-card transition hover:bg-ocean"
          >
            I want to go to there! <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </article>
  );
}
