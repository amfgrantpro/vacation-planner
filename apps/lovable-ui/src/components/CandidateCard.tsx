import { Plus, X, MessageCircle, ArrowLeft } from "lucide-react";

export type Candidate = {
  name: string;
  region: string;
  image: string;
  vibe: string;
};

export function CandidateCard({ c }: { c: Candidate }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card transition hover:shadow-soft">
      <div className="relative h-48 overflow-hidden">
        <img
          src={c.image}
          alt={c.name}
          className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 rounded-full bg-cream/90 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ocean-deep backdrop-blur">
          {c.region}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h4 className="font-serif text-xl font-semibold tracking-tight">{c.name}</h4>
          <div className="mt-0.5 text-[12px] text-muted-foreground">{c.region}</div>
        </div>

        <div className="rounded-xl bg-teal-soft px-3.5 py-3">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ocean-deep/80">
            Destination vibe
          </div>
          <p className="mt-1 font-sans text-[13.5px] leading-relaxed text-foreground/85">
            {c.vibe}
          </p>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card font-sans text-[12.5px] font-medium text-foreground transition hover:bg-cream">
            <MessageCircle className="size-3.5" /> Tell me more
          </button>
          <button className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-ocean-deep/15 bg-cream font-sans text-[12.5px] font-medium text-ocean-deep transition hover:bg-ocean-deep hover:text-primary-foreground">
            <Plus className="size-3.5" /> Add to shortlist
          </button>
        </div>
      </div>
    </article>
  );
}

export function ShortlistBar({
  items,
  capacity = 3,
  canCompare = false,
  variant = "compare",
  showReconsider = false,
}: {
  items: { name: string; image: string }[];
  capacity?: number;
  canCompare?: boolean;
  variant?: "compare" | "find-others";
  showReconsider?: boolean;
}) {
  if (variant === "find-others") {
    return (
      <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-card">
        <div className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Not quite right?
        </div>
        <div className={`grid gap-3 ${showReconsider ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
            <div>
              <div className="font-serif text-[14.5px] font-semibold leading-tight">
                Explore more destinations
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                Keep the brief, see new options
              </div>
            </div>
            <button className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 font-sans text-[12px] font-medium text-foreground transition hover:bg-muted">
              Find others
            </button>
          </div>
          {showReconsider && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-teal-soft/60 px-4 py-3">
              <div>
                <div className="font-serif text-[14.5px] font-semibold leading-tight">
                  Reconsider your options
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Revisit the trips you compared
                </div>
              </div>
              <button className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-ocean-deep/20 bg-card px-3 font-sans text-[12px] font-medium text-ocean-deep transition hover:bg-cream">
                <ArrowLeft className="size-3.5" /> Back to my shortlist
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }


  const slots = Array.from({ length: capacity }, (_, i) => items[i]);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-card">
      <div className="shrink-0">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Shortlist
        </div>
        <div className="mt-0.5 font-serif text-[15px] font-semibold">
          {items.length} of {capacity}
        </div>
      </div>

      <div className="flex flex-1 items-center gap-2.5">
        {slots.map((slot, i) =>
          slot ? (
            <div
              key={i}
              className="flex items-center gap-2 rounded-full border border-border/70 bg-cream py-1 pl-1 pr-2.5"
            >
              <img src={slot.image} alt={slot.name} className="size-7 rounded-full object-cover" />
              <span className="font-sans text-[12.5px] font-medium">{slot.name}</span>
              <button className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <div
              key={i}
              className="flex h-9 flex-1 items-center justify-center rounded-full border border-dashed border-border bg-muted/40 text-[11.5px] italic text-muted-foreground/70"
            >
              empty slot
            </div>
          ),
        )}
      </div>

      <button
        disabled={!canCompare}
        className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 font-sans text-[13px] font-medium transition ${
          canCompare
            ? "bg-ocean-deep text-primary-foreground shadow-card hover:bg-ocean"
            : "cursor-not-allowed bg-muted text-muted-foreground/70"
        }`}
      >
        Compare shortlist
      </button>
    </div>
  );
}
