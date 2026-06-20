import { useEffect, useState, type ReactNode, type KeyboardEvent } from "react";
import { Plane, Users, Calendar, Clock, Wallet, Sun, Heart, Ban, X, Plus, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type TripFieldKind = "scalar" | "array";

export type TripField = {
  key: string;
  icon: ReactNode;
  label: string;
  kind: TripFieldKind;
  value?: string;
  chips?: string[];
  set: boolean;
  accent?: "ocean" | "sun" | "teal" | "sage" | "coral";
};

type ChipInput = string | string[] | undefined;

function toChips(val: ChipInput): string[] | undefined {
  if (val == null) return undefined;
  const arr = Array.isArray(val)
    ? val
    : val.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

export function buildProfile(opts: {
  origin?: string;
  travelers?: string;
  when?: string;
  duration?: string;
  budget?: string;
  vacation_type?: ChipInput;
  likes?: ChipInput;
  avoid?: ChipInput;
}): TripField[] {
  const s = (val?: string) => Boolean(val);
  const scalar = (
    key: string,
    icon: ReactNode,
    label: string,
    value: string | undefined,
    accent: TripField["accent"],
  ): TripField => ({
    key,
    icon,
    label,
    kind: "scalar",
    value: value ?? "not set",
    set: s(value),
    accent,
  });
  const arr = (
    key: string,
    icon: ReactNode,
    label: string,
    chips: string[] | undefined,
    accent: TripField["accent"],
  ): TripField => ({
    key,
    icon,
    label,
    kind: "array",
    chips,
    set: !!chips && chips.length > 0,
    accent,
  });
  return [
    scalar("origin", <Plane className="size-3.5" />, "Origin", opts.origin, "ocean"),
    scalar("travelers", <Users className="size-3.5" />, "Travelers", opts.travelers, "teal"),
    scalar("when", <Calendar className="size-3.5" />, "When", opts.when, "sun"),
    scalar("duration", <Clock className="size-3.5" />, "Duration", opts.duration, "sage"),
    scalar("budget", <Wallet className="size-3.5" />, "Budget", opts.budget, "coral"),
    arr("vacation_type", <Sun className="size-3.5" />, "Vacation type & vibe", toChips(opts.vacation_type), "sun"),
    arr("likes", <Heart className="size-3.5" />, "Things we like", toChips(opts.likes), "coral"),
    arr("avoid", <Ban className="size-3.5" />, "Let's avoid", toChips(opts.avoid), "ocean"),
  ];
}

const accentBg: Record<NonNullable<TripField["accent"]>, string> = {
  ocean: "bg-ocean/10 text-ocean-deep",
  sun: "bg-sun/20 text-[oklch(0.45_0.13_70)]",
  teal: "bg-teal-soft text-ocean-deep",
  sage: "bg-sage/25 text-[oklch(0.35_0.06_155)]",
  coral: "bg-coral/15 text-[oklch(0.45_0.16_35)]",
};

export function TripProfile({ fields, title = "Trip profile", step }: { fields: TripField[]; title?: string; step?: number }) {
  // Local editable mirror of fields. Reseed when incoming fields change (last-write-wins).
  const [state, setState] = useState<TripField[]>(fields);
  useEffect(() => setState(fields), [fields]);

  const update = (key: string, patch: Partial<TripField>) =>
    setState((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        const next = { ...f, ...patch };
        next.set =
          next.kind === "scalar"
            ? Boolean(next.value && next.value !== "not set")
            : !!next.chips && next.chips.length > 0;
        return next;
      }),
    );

  const top = state.slice(0, 5);
  const bottom = state.slice(5);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        {step != null && (
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
              step === 1
                ? "bg-ocean/10 text-ocean-deep"
                : step === 2
                ? "bg-sun/20 text-[oklch(0.45_0.13_70)]"
                : "bg-coral/15 text-[oklch(0.45_0.16_35)]"
            } ring-1 ring-border/60 text-sm font-semibold`}
          >
            {step}
          </span>
        )}
        <h3 className="font-serif text-base font-semibold tracking-tight">{title}</h3>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {top.map((f) => (
          <EditableField key={f.key} f={f} onChange={(p) => update(f.key, p)} variant="compact" />
        ))}
      </div>

      <div className="my-4 h-px bg-border/70" />

      <div className="grid grid-cols-3 items-start gap-3">
        {bottom.map((f) => (
          <EditableField key={f.key} f={f} onChange={(p) => update(f.key, p)} variant="chips" />
        ))}
      </div>
    </div>
  );
}

function EditableField({
  f,
  onChange,
  variant,
}: {
  f: TripField;
  onChange: (patch: Partial<TripField>) => void;
  variant: "compact" | "chips";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/field -m-1 flex w-full min-w-0 items-start gap-2.5 rounded-lg p-1 text-left transition hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Edit ${f.label}`}
        >
          <div
            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
              accentBg[f.accent ?? "ocean"]
            }`}
          >
            {f.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              <span className="whitespace-normal break-words">{f.label}</span>
              <Pencil className="size-2.5 opacity-0 transition group-hover/field:opacity-60" />
            </div>
            {f.kind === "scalar" ? (
              <div
                className={`mt-0.5 ${variant === "compact" ? "truncate" : ""} font-sans text-[13px] leading-snug ${
                  f.set ? "font-medium text-foreground" : "italic text-muted-foreground/70"
                }`}
              >
                {f.value}
              </div>
            ) : f.chips && f.chips.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {f.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-cream px-2.5 py-1 font-sans text-[12.5px] font-medium text-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-0.5 font-sans text-[13px] italic leading-snug text-muted-foreground/70">
                not set
              </div>
            )}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        {f.kind === "scalar" ? (
          <ScalarEditor
            label={f.label}
            value={f.set ? f.value ?? "" : ""}
            onCommit={(v) => {
              onChange({ value: v || "not set" });
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        ) : (
          <ArrayEditor
            label={f.label}
            chips={f.chips ?? []}
            onChange={(chips) => onChange({ chips: chips.length ? chips : undefined })}
            onClose={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function ScalarEditor({
  label,
  value,
  onCommit,
  onCancel,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(draft.trim());
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Type a value…"
        className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 font-sans text-[13px] text-foreground outline-none focus:border-ocean-deep/40 focus:ring-2 focus:ring-ocean-deep/15"
      />
      <div className="mt-1.5 text-[11px] text-muted-foreground/80">
        Enter to save · Esc to cancel
      </div>
    </div>
  );
}

function ArrayEditor({
  label,
  chips,
  onChange,
  onClose,
}: {
  label: string;
  chips: string[];
  onChange: (chips: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (chips.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...chips, v]);
    setDraft("");
  };

  const remove = (chip: string) => onChange(chips.filter((c) => c !== chip));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Backspace" && draft === "" && chips.length > 0) {
      e.preventDefault();
      remove(chips[chips.length - 1]);
    }
  };

  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      {chips.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 rounded-full bg-cream py-1 pl-2.5 pr-1 font-sans text-[12.5px] font-medium text-foreground"
            >
              {chip}
              <button
                type="button"
                onClick={() => remove(chip)}
                className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove ${chip}`}
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder="Add…"
          className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 font-sans text-[13px] text-foreground outline-none focus:border-ocean-deep/40 focus:ring-2 focus:ring-ocean-deep/15"
        />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-muted"
          aria-label="Add chip"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground/80">
        Enter to add · Backspace to remove last · Esc to close
      </div>
    </div>
  );
}
