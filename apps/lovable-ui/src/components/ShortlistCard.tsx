import type { ReactNode } from "react";
import { ArrowRight, CloudSun, Activity, Car, BedDouble, Sparkles, CalendarRange } from "lucide-react";

export type DetailRow = {
  icon: ReactNode;
  label: string;
  value: string;
  exploring?: boolean;
};

export function defaultRows(rows: Partial<Record<"weather" | "activities" | "around" | "stay" | "style" | "season", string | { value: string; exploring?: boolean }>>): DetailRow[] {
  const norm = (x?: string | { value: string; exploring?: boolean }) =>
    typeof x === "string" ? { value: x, exploring: false } : x ?? { value: "exploring…", exploring: true };
  return [
    { icon: <CloudSun className="size-3.5" />, label: "Weather", ...norm(rows.weather) },
    { icon: <Activity className="size-3.5" />, label: "Activities", ...norm(rows.activities) },
    { icon: <Car className="size-3.5" />, label: "Getting around", ...norm(rows.around) },
    { icon: <BedDouble className="size-3.5" />, label: "Accommodation", ...norm(rows.stay) },
    { icon: <Sparkles className="size-3.5" />, label: "Travel style", ...norm(rows.style) },
    { icon: <CalendarRange className="size-3.5" />, label: "Peak season", ...norm(rows.season) },
  ];
}

export type Shortlist = {
  name: string;
  region: string;
  image: string;
  vibe: string;
  bestFor: string;
  seasonNote: string;
  seasonLabel?: string;
  rows: DetailRow[];
};

export function ShortlistCard({ s, winner = false }: { s: Shortlist; winner?: boolean }) {
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-3xl border bg-card shadow-card ${
        winner ? "border-ocean-deep/30 ring-2 ring-ocean-deep/15" : "border-border/70"
      }`}
    >
      <div className="relative h-64 overflow-hidden">
        <img src={s.image} alt={s.name} className="size-full object-cover" />
        <div className="absolute left-4 top-4 rounded-full bg-cream/90 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ocean-deep backdrop-blur">
          {s.region}
        </div>
        {winner && (
          <div className="absolute right-4 top-4 rounded-full bg-ocean-deep px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-primary-foreground">
            your pick
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <h4 className="font-serif text-2xl font-semibold tracking-tight">{s.name}</h4>
          <div className="mt-0.5 text-[12.5px] text-muted-foreground">{s.region}</div>
        </div>

        <div className="rounded-xl bg-teal-soft px-4 py-3.5">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ocean-deep/80">
            Vacation vibe
          </div>
          <p className="mt-1 font-sans text-[13.5px] leading-relaxed text-foreground/85">{s.vibe}</p>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-sage/25 px-3.5 py-2.5">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[oklch(0.4_0.07_155)]" />
          <p className="font-sans text-[12.5px] leading-relaxed text-foreground/85">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[oklch(0.4_0.07_155)]">Best for · </span>
            {s.bestFor}
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-sun/15 px-3.5 py-2.5">
          <CalendarRange className="mt-0.5 size-3.5 shrink-0 text-[oklch(0.45_0.13_70)]" />
          <p className="font-sans text-[12.5px] leading-relaxed text-foreground/85">
            <span className="font-medium">{s.seasonLabel ?? "In season:"} </span>
            {s.seasonNote}
          </p>
        </div>

        <div className="divide-y divide-border/70 rounded-xl border border-border/70 bg-cream/50">
          {s.rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[150px_1fr] items-start gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-ocean-deep/80">{r.icon}</span>
                <span className="text-[12px] font-medium uppercase tracking-[0.1em]">{r.label}</span>
              </div>
              <div
                className={`font-sans text-[13px] leading-snug ${
                  r.exploring ? "italic text-muted-foreground/70" : "text-foreground/85"
                }`}
              >
                {r.value}
              </div>
            </div>
          ))}
        </div>

        {winner ? (
          <div className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sun/30 via-coral/15 to-teal-soft px-4 py-3.5 font-serif text-[16px] font-semibold text-ocean-deep">
            <Sparkles className="size-4 text-coral" />
            I'm going to go to there!
          </div>
        ) : (
          <button className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ocean-deep font-sans text-[14px] font-semibold text-primary-foreground shadow-card transition hover:bg-ocean">
            I want to go to there! <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </article>
  );
}
