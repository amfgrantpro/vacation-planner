import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, MapPin, Lightbulb, Compass, ChevronDown } from "lucide-react";
import { Logo } from "@/components/Logo";
import { TripProfile, buildProfile } from "@/components/TripProfile";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Pill({
  children,
  filled = false,
  hasChevron = true,
}: {
  children: React.ReactNode;
  filled?: boolean;
  hasChevron?: boolean;
}) {
  return (
    <span
      className={`mx-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 align-baseline font-sans text-[18px] font-medium transition ${
        filled
          ? "bg-teal-soft text-ocean-deep ring-1 ring-ocean/20"
          : "border border-border bg-card text-foreground hover:bg-cream"
      }`}
    >
      {children}
      {hasChevron && <ChevronDown className="size-3.5 opacity-60" />}
    </span>
  );
}

function Inline({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-1 inline-flex items-center rounded-full border border-dashed border-ocean/40 bg-cream px-3 py-1 align-baseline font-sans text-[18px] font-medium text-ocean-deep">
      {children}
    </span>
  );
}

function Landing() {
  const emptyFields = buildProfile({});

  return (
    <main className="min-h-screen w-full bg-background">
      <header className="flex items-center justify-between px-10 pt-8">
        <Logo size="lg" />
      </header>

      <div className="mx-auto grid max-w-[1320px] grid-cols-2 gap-14 px-10 pt-16">
        {/* LEFT */}
        <section>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sun/25 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[oklch(0.4_0.12_70)]">
            <Sparkles className="size-3" /> A new way to plan
          </div>

          <h1 className="mt-5 font-serif text-[88px] font-semibold leading-[0.95] tracking-[-0.04em] text-foreground">
            Where to<span className="text-coral">?</span>
          </h1>

          <p className="mt-5 max-w-[460px] text-[15.5px] leading-relaxed text-muted-foreground">
            A simple, conversational way to choose your next trip.
          </p>

          {/* Primary sentence */}
          <div className="mt-10 space-y-3 font-serif text-[18px] leading-[2.3] text-foreground">
            <div>
              I want to plan a trip for
              <Pill filled>a couple</Pill>
            </div>
            <div>
              travelling from
              <Pill filled hasChevron={false}>Berlin</Pill>
            </div>
            <div>
              I want to travel in
              <Pill>whenever</Pill>
              for
              <Pill>however long</Pill>
            </div>
          </div>

          {/* Submit chips */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-full border border-ocean-deep/15 bg-cream px-5 py-2.5 font-sans text-[14px] font-medium text-ocean-deep transition hover:bg-ocean-deep hover:text-primary-foreground">
              <MapPin className="size-4" /> I already have destinations in mind
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-ocean-deep/15 bg-cream px-5 py-2.5 font-sans text-[14px] font-medium text-ocean-deep transition hover:bg-ocean-deep hover:text-primary-foreground">
              <Lightbulb className="size-4" /> Inspire me where to go
            </button>
          </div>

          {/* Optional */}
          <div className="mt-12 border-t border-dashed border-border pt-6">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              optional · add more if you like
            </div>
            <div className="mt-3 space-y-2 font-serif text-[17px] leading-[2.2] text-muted-foreground">
              <div>
                We're looking for <Pill>anything</Pill>
              </div>
              <div>
                The budget is <Pill>not important for now</Pill>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT */}
        <section className="space-y-4">
          <TripProfile fields={emptyFields} />

          <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-teal-soft text-ocean-deep">
              <Compass className="size-6" />
            </div>
            <div className="max-w-[340px]">
              <div className="font-serif text-[17px] font-semibold tracking-tight">
                Your top options will appear here as we explore.
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Tell us a little about what you like to do, and we'll build a
                personalised shortlist together — right here, as we talk.
              </p>
            </div>
            <div className="mt-2 grid w-full max-w-[420px] grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-xl border border-dashed border-border bg-muted/40"
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="h-32" />
    </main>
  );
}
