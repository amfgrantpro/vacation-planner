import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ChevronDown, Check, ArrowRight, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TripProfile, buildProfile } from "@/components/TripProfile";
import { photos } from "@/lib/photos";

export const Route = createFileRoute("/")({
  component: Landing,
});

const VACATION_TYPES = [
  "Beaches",
  "City break",
  "Nature & outdoors",
  "Roadtripping",
  "Cultural",
  "Food & wine",
  "Romantic getaway",
  "Sports & recreation",
  "Wellness & relaxation",
];

const TRAVELER_OPTS = ["just me", "a couple", "a family", "a group of friends"];
const MONTH_OPTS = [
  "whenever",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DURATION_OPTS = [
  "however long",
  "a long weekend",
  "about a week",
  "10 days",
  "two weeks",
  "a month",
];
const BUDGET_OPTS = [
  "not important for now",
  "shoestring",
  "mid-range",
  "comfortable",
  "no limit",
];
const START_OPTS = [
  "inspire me where to go",
  "I have destinations in mind",
];

function SelectPill({
  value,
  options,
  filled = false,
  tone = "default",
  palette = "ocean",
  onChange,
}: {
  value: string;
  options: string[];
  filled?: boolean;
  tone?: "default" | "muted";
  palette?: "ocean" | "sun";
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const base =
    "mx-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 align-baseline font-sans font-medium transition";
  const size =
    tone === "muted"
      ? "text-[12.5px] px-2.5 py-0.5"
      : "text-[18px]";
  const filledStyle =
    palette === "sun"
      ? "bg-sun/30 text-[oklch(0.4_0.12_70)] ring-1 ring-sun/50"
      : "bg-teal-soft text-ocean-deep ring-1 ring-ocean/20";
  const style = filled
    ? filledStyle
    : tone === "muted"
      ? "border border-border/70 bg-card/80 text-foreground/80 hover:bg-cream"
      : "border border-border bg-card text-foreground hover:bg-cream";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={`${base} ${size} ${style}`}>
          <span className="truncate">{value}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[240px] p-1.5">
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] transition ${
                on ? "bg-cream font-medium text-foreground" : "hover:bg-muted/60 text-foreground"
              }`}
            >
              <span>{o}</span>
              {on && <Check className="size-3.5 text-ocean-deep" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function VacationTypePill({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (t: string) =>
    onChange(
      selected.includes(t) ? selected.filter((s) => s !== t) : [...selected, t],
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`mx-1 inline-flex max-w-[420px] items-center gap-1.5 rounded-full px-2.5 py-0.5 align-baseline font-sans text-[12.5px] font-medium transition ${
            selected.length
              ? "bg-sun/30 text-[oklch(0.4_0.12_70)] ring-1 ring-sun/50"
              : "border border-border/70 bg-card/80 text-foreground/70 hover:bg-cream"
          }`}
        >
          <span className="truncate">
            {selected.length === 0
              ? "anything"
              : selected.length <= 2
                ? selected.join(" + ")
                : `${selected.slice(0, 2).join(" + ")} +${selected.length - 2}`}
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-3">
        <div className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Vacation type · pick any
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VACATION_TYPES.map((t) => {
            const on = selected.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggle(t)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-sans text-[12.5px] font-medium transition ${
                  on
                    ? "bg-ocean-deep text-primary-foreground"
                    : "bg-cream text-foreground hover:bg-sand"
                }`}
              >
                {on && <Check className="size-3" />}
                {t}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground/80">
          Click to toggle · close when done
        </div>
      </PopoverContent>
    </Popover>
  );
}

// --- Right-panel explainer pieces ---

function ExploreIllustration() {
  const cards = [
    { src: photos.lisbon, label: "Lisbon, Portugal" },
    { src: photos.amalfi, label: "Amalfi, Italy" },
    { src: photos.sanSebastian, label: "San Sebastián, Spain" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cards.map((c, i) => (
        <figure
          key={c.label}
          className="group relative overflow-hidden rounded-lg border border-border/60 bg-muted shadow-card"
        >
          <div className="aspect-[3/4] w-full overflow-hidden">
            <img
              src={c.src}
              alt={c.label}
              loading="lazy"
              className="size-full object-cover transition duration-700 group-hover:scale-[1.04]"
            />
          </div>
          {i !== 1 && (
            <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cream/90 text-ocean-deep/70 shadow-sm">
              <X className="size-3.5" aria-hidden="true" />
            </div>
          )}
          <div className="absolute left-3 bottom-3">
            <div className="rounded-full bg-cream/90 px-3 py-1 text-[11px] font-medium text-ocean-deep backdrop-blur">
              {c.label}
            </div>
          </div>
          {i === 1 && (
            <div className="absolute right-1.5 top-1.5 rounded-full bg-ocean-deep px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground shadow-sm">
              ✓ shortlisted
            </div>
          )}
        </figure>
      ))}
    </div>
  );
}

function CompareIllustration() {
  const rows = [
    { label: "Best time to go", a: "Jul–Oct (river crossings)", b: "Jan–Feb (calving), Jun–Oct" },
    { label: "Where to stay", a: "Tented camps to luxury lodges", b: "Mobile camps following the migration" },
    { label: "Animals you might see", a: "Big Five, cheetah, river crossings", b: "Big Five, wild dogs, calving herds" },
    { label: "Visa for EU citizens", a: "e-visa required (~$50)", b: "e-visa required (~$50)" },
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
      <div className="grid grid-cols-[1.1fr_1fr_1fr] items-center gap-2">
        <div />
        <div className="relative h-16 overflow-hidden rounded-md bg-muted">
          <img
            src={photos.maasaiMara}
            alt="Maasai Mara"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-3 text-white">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em]">
              Maasai Mara
            </span>
            <span className="text-[11px] text-white/80">Kenya</span>
          </div>
        </div>
        <div className="relative h-16 overflow-hidden rounded-md bg-muted">
          <img
            src={photos.serengeti}
            alt="Serengeti"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-3 text-white">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em]">
              Serengeti
            </span>
            <span className="text-[11px] text-white/80">Tanzania</span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[1.1fr_1fr_1fr] items-start gap-2 border-t border-border/60 pt-2"
          >
            <div className="pt-0.5 text-[11.5px] font-medium text-foreground">
              {r.label}
            </div>
            <div className="rounded-md bg-muted/50 px-2 py-1 text-[11.5px] leading-snug text-foreground">
              {r.a}
            </div>
            <div className="rounded-md bg-muted/50 px-2 py-1 text-[11.5px] leading-snug text-foreground">
              {r.b}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExploreSubpoints() {
  const items = [
    "Your trip profile builds as we talk",
    "Destination cards appear and update to match",
    "Shortlist anything that sparks something",
  ];
  return (
    <ol className="mt-3 space-y-1.5">
      {items.map((t, i) => (
        <li
          key={t}
          className="flex items-start gap-2.5 text-[12.5px] leading-snug text-muted-foreground"
        >
          <span className="mt-[1px] flex size-4 shrink-0 items-center justify-center rounded-full bg-cream font-serif text-[10px] font-semibold text-ocean-deep">
            {i + 1}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

function PanelSection({
  eyebrow,
  title,
  step,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  step?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const stepClass =
    step === 1
      ? "bg-ocean/10 text-ocean-deep"
      : step === 2
      ? "bg-sun/20 text-[oklch(0.45_0.13_70)]"
      : "bg-coral/15 text-[oklch(0.45_0.16_35)]";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div className="inline-flex items-baseline gap-3">
          {step != null && (
            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${stepClass} ring-1 ring-border/60 text-sm font-semibold`}>
              {step}
            </span>
          )}
          <h3 className="font-serif text-[20px] font-semibold tracking-tight">
            {title}
          </h3>
        </div>
        <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </div>
      </div>
      <div className="mt-3">{children}</div>
      {footer}
    </div>
  );
}

function Landing() {
  const [travelers, setTravelers] = useState("a couple");
  const [origin, setOrigin] = useState("Berlin");
  const [when, setWhen] = useState("whenever");
  const [duration, setDuration] = useState("however long");
  const [budget, setBudget] = useState("not important for now");
  const [vacationTypes, setVacationTypes] = useState<string[]>([]);
  const [startMode, setStartMode] = useState(START_OPTS[0]);

  // Live trip profile — only show fields the user has actually set
  const profileFields = buildProfile({
    origin: origin || undefined,
    travelers: travelers || undefined,
    when: when !== "whenever" ? when : undefined,
    duration: duration !== "however long" ? duration : undefined,
    budget: budget !== "not important for now" ? budget : undefined,
    vacation_type: vacationTypes,
  });

  return (
    <main className="min-h-screen w-full bg-background">
      <header className="flex items-center justify-between px-10 pt-8">
        <Logo size="lg" />
      </header>

      <div className="mx-auto grid max-w-[1320px] grid-cols-2 gap-14 px-10 pt-12">
        {/* LEFT — intake form */}
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

          {/* Required sentence */}
          <div className="mt-10 space-y-5 font-serif text-[18px] leading-[2.3] text-foreground">
            <div>
              I want to plan a trip for
              <SelectPill
                filled
                value={travelers}
                options={TRAVELER_OPTS}
                onChange={setTravelers}
              />
            </div>
            <div>
              travelling from
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="your city"
                aria-label="Origin city"
                size={Math.max(origin.length || 8, 6)}
                className={`mx-1 inline-flex items-center rounded-full px-3 py-1 align-baseline font-sans text-[18px] font-medium outline-none transition ${
                  origin
                    ? "bg-teal-soft text-ocean-deep ring-1 ring-ocean/20 focus:ring-2 focus:ring-ocean-deep/40"
                    : "border border-border bg-card text-foreground focus:ring-2 focus:ring-ocean-deep/30"
                }`}
              />
            </div>
            <div>
              I want to travel in
              <SelectPill
                value={when}
                options={MONTH_OPTS}
                onChange={setWhen}
                filled={when !== "whenever"}
              />
              for
              <SelectPill
                value={duration}
                options={DURATION_OPTS}
                onChange={setDuration}
                filled={duration !== "however long"}
              />
            </div>
          </div>

          {/* Optional sentence */}
          <div className="mt-14 w-full">
            <div className="space-y-3 font-serif text-[12.5px] leading-[1.9] text-foreground/65">
              <div className="flex flex-wrap items-baseline gap-3">
                <span>We're looking for</span>
                <VacationTypePill
                  selected={vacationTypes}
                  onChange={setVacationTypes}
                />
              </div>
              <div>
                The budget is
                <SelectPill
                  tone="muted"
                  palette="sun"
                  filled={budget !== "not important for now"}
                  value={budget}
                  options={BUDGET_OPTS}
                  onChange={setBudget}
                />
              </div>
              <div>
                To start my journey,
                <SelectPill
                  tone="muted"
                  palette="sun"
                  filled
                  value={startMode}
                  options={START_OPTS}
                  onChange={setStartMode}
                />
              </div>
            </div>
          </div>

          <div className="mt-16 max-w-[620px]">
            <Link
              to="/early"
              className="group inline-flex w-[80%] min-w-[320px] items-center justify-between rounded-full px-6 py-5 text-[18px] font-semibold text-white shadow-[0_24px_44px_-14px_rgba(0,0,0,0.32)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_56px_-16px_rgba(0,0,0,0.32)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                background:
                  "linear-gradient(to right, oklch(0.70 0.16 35), oklch(0.72 0.14 10), oklch(0.82 0.10 25))",
              }}
            >
              <span className="text-[22px] font-bold">Let's get going!</span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/25 transition-colors duration-200 group-hover:bg-white/30">
                <ArrowRight className="h-[14px] w-[14px] text-white" />
              </span>
            </Link>
          </div>
        </section>

        {/* RIGHT — live trip profile + product glimpse */}
        <section>
          <div className="space-y-10">
            <div>
              <div className="inline-flex items-baseline gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ocean/10 text-ocean-deep ring-1 ring-border/60 text-sm font-semibold">
                  1
                </span>
                <h2 className="font-serif text-[20px] font-semibold tracking-tight">
                  Say what you want.
                </h2>
              </div>
              <div className="mt-5">
                <TripProfile fields={profileFields} title="Trip profile" />
              </div>
            </div>

            <div>
              <PanelSection step={2} eyebrow="Explore" title="Find destinations that fit.">
                <ExploreIllustration />
              </PanelSection>
            </div>

            <div>
              <PanelSection
                step={3}
                eyebrow="Compare"
                title="Work out which one's really for you."
              >
                <CompareIllustration />
              </PanelSection>
            </div>
          </div>
        </section>
      </div>

      <div className="h-32" />
    </main>
  );
}
