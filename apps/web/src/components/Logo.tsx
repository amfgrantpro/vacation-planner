// Hand-drawn travel mark: sunset over a horizon line, paired with the
// "Where to?" wordmark in our serif. Warm sun + coral palette so it sits
// with the rest of the page instead of fighting the ocean blue.

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      {/* warm disc background */}
      <circle cx="16" cy="16" r="15" fill="oklch(0.94 0.06 75)" />
      {/* sun */}
      <circle cx="16" cy="14.5" r="5" fill="oklch(0.78 0.16 60)" />
      {/* sun rays */}
      <g stroke="oklch(0.78 0.16 60)" strokeWidth="1.4" strokeLinecap="round">
        <line x1="16" y1="3.5" x2="16" y2="5.5" />
        <line x1="6" y1="14.5" x2="8" y2="14.5" />
        <line x1="24" y1="14.5" x2="26" y2="14.5" />
        <line x1="8.5" y1="7" x2="9.9" y2="8.4" />
        <line x1="23.5" y1="7" x2="22.1" y2="8.4" />
      </g>
      {/* horizon waves */}
      <path
        d="M3 21 Q 8 19, 12 21 T 21 21 T 29 21"
        stroke="oklch(0.55 0.13 220)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M3 25 Q 8 23, 12 25 T 21 25 T 29 25"
        stroke="oklch(0.62 0.11 200)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims =
    size === "lg"
      ? { mark: "size-9", text: "text-[20px]" }
      : size === "sm"
        ? { mark: "size-6", text: "text-[15px]" }
        : { mark: "size-8", text: "text-[18px]" };

  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className={dims.mark} />
      <span
        className={`font-serif ${dims.text} font-semibold tracking-tight text-foreground`}
      >
        Where to<span className="text-coral">?</span>
      </span>
    </div>
  );
}
