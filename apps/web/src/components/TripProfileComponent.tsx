import { Plane, Users, Calendar, Clock, Wallet, Sun, Heart, Ban } from 'lucide-react';
import type { TripProfile } from '../types';

interface TripProfileComponentProps {
  profile: TripProfile;
}

export function TripProfileComponent({ profile }: TripProfileComponentProps) {
  const isSet = (value: string | string[] | null): boolean => {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    return value !== 'not set';
  };

  const topFields = [
    { icon: Plane,   label: 'From',      value: profile.origin },
    { icon: Users,   label: 'Travelers', value: profile.travelers },
    { icon: Calendar,label: 'When',      value: profile.when },
    { icon: Clock,   label: 'Duration',  value: profile.duration },
    { icon: Wallet,  label: 'Budget',    value: profile.budget },
  ] as const;

  const bottomFields = [
    { icon: Sun,   label: 'Vibe',      value: profile.vacation_type },
    { icon: Heart, label: 'We like',   value: profile.likes?.join(', ') || null },
    { icon: Ban,   label: "Avoid",     value: profile.avoid?.join(', ') || null },
  ] as const;

  const filledCount = [...topFields, ...bottomFields].filter((f) =>
    isSet(f.value)
  ).length;
  const totalCount = topFields.length + bottomFields.length;
  const profileComplete = filledCount === totalCount;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-base font-semibold text-ink tracking-tight">Trip profile</h3>
        {filledCount > 0 && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {profileComplete ? '✓ Complete' : `${filledCount} / ${totalCount} fields`}
          </span>
        )}
      </div>

      {/* Top row: 5 compact fields */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {topFields.map((field) => {
          const Icon = field.icon;
          const set = isSet(field.value);
          return (
            <div
              key={field.label}
              className={`rounded-xl p-2.5 flex flex-col gap-1.5 ${
                set
                  ? 'bg-teal-soft border border-ocean/10'
                  : 'bg-muted border border-border'
              }`}
            >
              <Icon className={`size-3 ${set ? 'text-ocean-deep' : 'text-muted-foreground'}`} />
              <div className="leading-tight">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </div>
                <div
                  className={`text-[11px] font-medium mt-0.5 ${
                    set ? 'text-ink' : 'text-muted-foreground'
                  }`}
                >
                  {field.value || 'not set'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom row: 3 slightly larger fields */}
      <div className="grid grid-cols-3 gap-2">
        {bottomFields.map((field) => {
          const Icon = field.icon;
          const set = isSet(field.value);
          return (
            <div
              key={field.label}
              className={`rounded-xl p-3 flex flex-col gap-1.5 ${
                set
                  ? 'bg-cream border border-sand'
                  : 'bg-muted border border-border'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`size-3 ${set ? 'text-ocean-deep' : 'text-muted-foreground'}`} />
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </div>
              </div>
              <div
                className={`text-[11px] leading-relaxed ${
                  set ? 'text-ink font-medium' : 'text-muted-foreground italic'
                }`}
              >
                {field.value || 'not set'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
