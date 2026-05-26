import type { ReactNode } from "react";
import { Plane, Users, Calendar, Clock, Wallet, Sun, Heart, Ban } from "lucide-react";

export type TripField = {
  icon: ReactNode;
  label: string;
  value: string;
  set: boolean;
  accent?: "ocean" | "sun" | "teal" | "sage" | "coral";
};

export function buildProfile(opts: Partial<Record<
  "origin" | "travelers" | "when" | "duration" | "budget" | "vibe" | "likes" | "avoid",
  string
>>): TripField[] {
  const v = (val?: string) => val ?? "not set";
  const s = (val?: string) => Boolean(val);
  return [
    { icon: <Plane className="size-3.5" />, label: "Origin", value: v(opts.origin), set: s(opts.origin), accent: "ocean" },
    { icon: <Users className="size-3.5" />, label: "Travelers", value: v(opts.travelers), set: s(opts.travelers), accent: "teal" },
    { icon: <Calendar className="size-3.5" />, label: "When", value: v(opts.when), set: s(opts.when), accent: "sun" },
    { icon: <Clock className="size-3.5" />, label: "Duration", value: v(opts.duration), set: s(opts.duration), accent: "sage" },
    { icon: <Wallet className="size-3.5" />, label: "Budget", value: v(opts.budget), set: s(opts.budget), accent: "coral" },
    { icon: <Sun className="size-3.5" />, label: "Vacation type & vibe", value: v(opts.vibe), set: s(opts.vibe), accent: "sun" },
    { icon: <Heart className="size-3.5" />, label: "Things we like", value: v(opts.likes), set: s(opts.likes), accent: "coral" },
    { icon: <Ban className="size-3.5" />, label: "Let's avoid", value: v(opts.avoid), set: s(opts.avoid), accent: "ocean" },
  ];
}

const accentBg: Record<NonNullable<TripField["accent"]>, string> = {
  ocean: "bg-ocean/10 text-ocean-deep",
  sun: "bg-sun/20 text-[oklch(0.45_0.13_70)]",
  teal: "bg-teal-soft text-ocean-deep",
  sage: "bg-sage/25 text-[oklch(0.35_0.06_155)]",
  coral: "bg-coral/15 text-[oklch(0.45_0.16_35)]",
};

export function TripProfile({ fields, title = "Trip profile" }: { fields: TripField[]; title?: string }) {
  const top = fields.slice(0, 5);
  const bottom = fields.slice(5);
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-serif text-base font-semibold tracking-tight">{title}</h3>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {top.map((f) => (
          <FieldChip key={f.label} f={f} />
        ))}
      </div>

      <div className="my-4 h-px bg-border/70" />

      <div className="grid grid-cols-3 gap-3">
        {bottom.map((f) => (
          <FieldChip key={f.label} f={f} multiline />
        ))}
      </div>
    </div>
  );
}

function FieldChip({ f, multiline }: { f: TripField; multiline?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${accentBg[f.accent ?? "ocean"]}`}>
        {f.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{f.label}</div>
        <div
          className={`mt-0.5 font-sans text-[13px] leading-snug ${
            f.set ? "font-medium text-foreground" : "italic text-muted-foreground/70"
          } ${multiline ? "" : "truncate"}`}
        >
          {f.value}
        </div>
      </div>
    </div>
  );
}
