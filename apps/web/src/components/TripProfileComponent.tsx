import type { TripProfile } from '../types';
import { Plane, Users, Calendar, Clock, Wallet, Sun, Heart, Ban } from 'lucide-react';

interface TripProfileComponentProps {
  profile: TripProfile;
}

export function TripProfileComponent({ profile }: TripProfileComponentProps) {
  const isSet = (val: any) => {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    return val !== '' && val !== 'not set';
  };

  const topFields = [
    {
      icon: <Plane className="size-3.5" />,
      label: 'Origin',
      value: profile.origin || 'not set',
      set: isSet(profile.origin),
      accent: 'ocean' as const,
    },
    {
      icon: <Users className="size-3.5" />,
      label: 'Travelers',
      value: profile.travelers || 'not set',
      set: isSet(profile.travelers),
      accent: 'teal' as const,
    },
    {
      icon: <Calendar className="size-3.5" />,
      label: 'When',
      value: profile.when || 'not set',
      set: isSet(profile.when),
      accent: 'sun' as const,
    },
    {
      icon: <Clock className="size-3.5" />,
      label: 'Duration',
      value: profile.duration || 'not set',
      set: isSet(profile.duration),
      accent: 'sage' as const,
    },
    {
      icon: <Wallet className="size-3.5" />,
      label: 'Budget',
      value: profile.budget || 'not set',
      set: isSet(profile.budget),
      accent: 'coral' as const,
    },
  ];

  const bottomFields = [
    {
      icon: <Sun className="size-3.5" />,
      label: 'Vacation type & vibe',
      value: profile.vacation_type || 'not set',
      set: isSet(profile.vacation_type),
      accent: 'sun' as const,
      items: null as string[] | null,
    },
    {
      icon: <Heart className="size-3.5" />,
      label: 'Things we like',
      value: null,
      set: isSet(profile.likes),
      accent: 'coral' as const,
      items: profile.likes && profile.likes.length > 0 ? profile.likes : null,
    },
    {
      icon: <Ban className="size-3.5" />,
      label: "Let's avoid",
      value: null,
      set: isSet(profile.avoid),
      accent: 'ocean' as const,
      items: profile.avoid && profile.avoid.length > 0 ? profile.avoid : null,
    },
  ];

  const getCircleClassName = (accent: 'ocean' | 'sun' | 'teal' | 'sage' | 'coral') => {
    const baseClass = 'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full';
    
    // Always-on text classes
    let textClass = '';
    switch (accent) {
      case 'ocean':
      case 'teal':
        textClass = 'text-ocean-deep';
        break;
      case 'sun':
        textClass = 'text-[oklch(0.45_0.13_70)]';
        break;
      case 'sage':
        textClass = 'text-[oklch(0.35_0.06_155)]';
        break;
      case 'coral':
        textClass = 'text-[oklch(0.45_0.16_35)]';
        break;
    }

    // Background: use pre-baked alpha tokens from tailwind.config.js
    // (the /N opacity modifier only works with <alpha-value> colours; these are raw oklch)
    let bgClass = '';
    switch (accent) {
      case 'ocean':
        bgClass = 'bg-ocean-bg';
        break;
      case 'sun':
        bgClass = 'bg-sun-bg';
        break;
      case 'teal':
        bgClass = 'bg-teal-soft';
        break;
      case 'sage':
        bgClass = 'bg-sage-bg';
        break;
      case 'coral':
        bgClass = 'bg-coral-bg';
        break;
    }

    return `${baseClass} ${bgClass} ${textClass} shadow-sm`;
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">Trip profile</h3>
      </div>

      {/* Top row: 5 scalar fields */}
      <div className="grid grid-cols-5 gap-3">
        {topFields.map((f) => {
          const circleClass = getCircleClassName(f.accent);
          return (
            <div key={f.label} className="flex min-w-0 items-start gap-2.5 animate-fade-in">
              <div className={circleClass}>
                {f.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{f.label}</div>
                <div
                  className={`mt-0.5 font-sans text-[13px] leading-snug truncate ${
                    f.set ? 'font-medium text-foreground' : 'italic text-muted-foreground/70'
                  }`}
                >
                  {f.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="my-4 h-px bg-border/70" />

      {/* Bottom row: vacation type (scalar) + two array fields rendered as chips */}
      <div className="grid grid-cols-3 gap-3">
        {bottomFields.map((f) => {
          const circleClass = getCircleClassName(f.accent);
          return (
            <div key={f.label} className="flex min-w-0 items-start gap-2.5 animate-fade-in">
              <div className={circleClass}>
                {f.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{f.label}</div>
                {f.items ? (
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {f.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-cream px-2 py-0.5 font-sans text-[12px] font-medium text-foreground/80"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`mt-0.5 font-sans text-[13px] leading-snug ${
                      f.set ? 'font-medium text-foreground' : 'italic text-muted-foreground/70'
                    }`}
                  >
                    {f.value ?? 'not set'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
