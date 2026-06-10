import { useState } from 'react';
import { Sparkles, MapPin, Lightbulb, ChevronDown, Compass } from 'lucide-react';
import { Logo } from './Logo';
import { TripProfileComponent } from './TripProfileComponent';
import type { TripProfile } from '../types';

interface LandingScreenProps {
  onStartSession: (path: 'inspire' | 'destinations') => void;
}

export function LandingScreen({ onStartSession }: LandingScreenProps) {
  const [travelers, setTravelers] = useState('a couple');
  const [origin, setOrigin] = useState('Berlin');
  const [when, setWhen] = useState('whenever');
  const [duration, setDuration] = useState('however long');
  const [vacationType, setVacationType] = useState('anything');
  const [budget, setBudget] = useState('not important for now');

  const currentProfile: TripProfile = {
    origin: origin || null,
    travelers: travelers,
    when: when !== 'whenever' ? when : null,
    duration: duration !== 'however long' ? duration : null,
    budget: budget !== 'not important for now' ? budget : null,
    vacation_type: vacationType !== 'anything' ? [vacationType] : [],
    likes: [],
    avoid: [],
  };

  const handleStartSession = (path: 'inspire' | 'destinations') => {
    // Build the initial message to send to the agent
    const parts = [
      `I'm ${travelers}`,
      `travelling from ${origin}`,
      `in ${when}`,
      `for ${duration}`,
    ];

    if (vacationType !== 'anything') {
      parts.push(`looking for ${vacationType}`);
    }
    if (budget !== 'not important for now') {
      parts.push(`with a budget of ${budget}`);
    }

    if (path === 'destinations') {
      parts.push(`and I already have destinations in mind`);
    }

    // Store the initial message and structured profile in sessionStorage to be sent after rendering
    sessionStorage.setItem('initialMessage', parts.join(', ') + '.');
    sessionStorage.setItem('onboardingProfile', JSON.stringify(currentProfile));

    onStartSession(path);
  };

  return (
    <main className="min-h-screen w-full bg-background flex flex-col">
      <header className="flex items-center justify-between px-10 pt-8 shrink-0">
        <Logo size="lg" />
      </header>

      <div className="mx-auto grid max-w-[1320px] grid-cols-1 md:grid-cols-2 gap-14 px-10 pt-16 flex-1 items-start">
        {/* LEFT COLUMN */}
        <section className="flex flex-col items-start">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sun/25 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[oklch(0.4_0.12_70)] animate-fade-in">
            <Sparkles className="size-3" /> A new way to plan
          </div>

          <h1 className="mt-5 font-serif text-[88px] font-semibold leading-[0.95] tracking-[-0.04em] text-foreground">
            Where to<span className="text-coral">?</span>
          </h1>

          <p className="mt-5 max-w-[460px] text-[15.5px] leading-relaxed text-muted-foreground">
            A simple, conversational way to choose your next trip.
          </p>

          {/* Primary sentence builder */}
          <div className="mt-10 space-y-3 font-serif text-[18px] leading-[2.3] text-foreground w-full">
            <div>
              <span>I want to plan a trip for</span>
              <div className="relative inline-block mx-1">
                <select
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                  className="appearance-none cursor-pointer rounded-full pl-3 pr-7 py-0.5 font-serif text-[18px] font-medium transition focus:outline-none bg-teal-soft text-ocean-deep ring-1 ring-ocean/20 hover:bg-teal-soft/80"
                >
                  <option value="solo traveller">solo traveller</option>
                  <option value="a couple">a couple</option>
                  <option value="a family">a family</option>
                  <option value="a group of friends">a group of friends</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 opacity-60 pointer-events-none text-ocean-deep" />
              </div>
            </div>

            <div>
              <span>travelling from</span>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className={`mx-1 inline-block align-baseline rounded-full px-3 py-0.5 font-serif text-[18px] font-medium transition focus:outline-none w-28 text-center ${
                  origin.trim()
                    ? 'bg-teal-soft text-ocean-deep ring-1 ring-ocean/20'
                    : 'border border-border bg-card text-foreground hover:bg-cream'
                }`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-y-2">
              <span>I want to travel in</span>
              <div className="relative inline-block mx-1">
                <select
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className={`appearance-none cursor-pointer rounded-full pl-3 pr-7 py-0.5 font-serif text-[18px] font-medium transition focus:outline-none ${
                    when !== 'whenever'
                      ? 'bg-teal-soft text-ocean-deep ring-1 ring-ocean/20'
                      : 'border border-border bg-card text-foreground hover:bg-cream'
                  }`}
                >
                  <option value="whenever">whenever</option>
                  <option value="January">January</option>
                  <option value="February">February</option>
                  <option value="March">March</option>
                  <option value="April">April</option>
                  <option value="May">May</option>
                  <option value="June">June</option>
                  <option value="July">July</option>
                  <option value="August">August</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="November">November</option>
                  <option value="December">December</option>
                  <option value="flexible">flexible</option>
                </select>
                <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 size-3.5 opacity-60 pointer-events-none ${when !== 'whenever' ? 'text-ocean-deep' : 'text-foreground'}`} />
              </div>
              <span>for</span>
              <div className="relative inline-block mx-1">
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={`appearance-none cursor-pointer rounded-full pl-3 pr-7 py-0.5 font-serif text-[18px] font-medium transition focus:outline-none ${
                    duration !== 'however long'
                      ? 'bg-teal-soft text-ocean-deep ring-1 ring-ocean/20'
                      : 'border border-border bg-card text-foreground hover:bg-cream'
                  }`}
                >
                  <option value="however long">however long</option>
                  <option value="a few days">a few days</option>
                  <option value="a week">a week</option>
                  <option value="2 weeks">2 weeks</option>
                  <option value="flexible">flexible</option>
                </select>
                <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 size-3.5 opacity-60 pointer-events-none ${duration !== 'however long' ? 'text-ocean-deep' : 'text-foreground'}`} />
              </div>
            </div>
          </div>

          {/* Submit chips */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => handleStartSession('destinations')}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-ocean-deep/15 bg-cream px-5 font-sans text-[14px] font-medium text-ocean-deep transition hover:bg-ocean-deep hover:text-primary-foreground shadow-sm"
            >
              <MapPin className="size-4" /> I already have destinations in mind
            </button>
            <button
              onClick={() => handleStartSession('inspire')}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-ocean-deep/15 bg-cream px-5 font-sans text-[14px] font-medium text-ocean-deep transition hover:bg-ocean-deep hover:text-primary-foreground shadow-sm"
            >
              <Lightbulb className="size-4" /> Inspire me where to go
            </button>
          </div>

          {/* Optional sentence builder */}
          <div className="mt-12 border-t border-dashed border-border pt-6 w-full">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              optional · add more if you like
            </div>
            <div className="mt-3 space-y-2 font-serif text-[17px] leading-[2.2] text-muted-foreground w-full animate-fade-in">
              <div className="flex flex-wrap items-center gap-y-1">
                <span>We're looking for</span>
                <div className="relative inline-block mx-1">
                  <select
                    value={vacationType}
                    onChange={(e) => setVacationType(e.target.value)}
                    className={`appearance-none cursor-pointer rounded-full pl-3 pr-7 py-0.5 font-serif text-[17px] font-medium transition focus:outline-none ${
                      vacationType !== 'anything'
                        ? 'bg-teal-soft text-ocean-deep ring-1 ring-ocean/20'
                        : 'border border-border bg-card text-muted-foreground hover:bg-cream'
                    }`}
                  >
                    <option value="anything">anything</option>
                    <option value="beach & relaxation">beach & relaxation</option>
                    <option value="hiking & outdoors">hiking & outdoors</option>
                    <option value="city & culture">city & culture</option>
                    <option value="roadtripping">roadtripping</option>
                    <option value="good food & drink">good food & drink</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 opacity-60 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-y-1">
                <span>The budget is</span>
                <div className="relative inline-block mx-1">
                  <select
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className={`appearance-none cursor-pointer rounded-full pl-3 pr-7 py-0.5 font-serif text-[17px] font-medium transition focus:outline-none ${
                      budget !== 'not important for now'
                        ? 'bg-teal-soft text-ocean-deep ring-1 ring-ocean/20'
                        : 'border border-border bg-card text-muted-foreground hover:bg-cream'
                    }`}
                  >
                    <option value="not important for now">not important for now</option>
                    <option value="on the cheap">on the cheap</option>
                    <option value="mid-range">mid-range</option>
                    <option value="let's get fancy">let's get fancy</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 opacity-60 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <section className="space-y-4 w-full">
          <TripProfileComponent profile={currentProfile} />

          <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center shadow-sm">
            <div className="flex size-14 items-center justify-center rounded-full bg-teal-soft text-ocean-deep">
              <Compass className="size-6 text-ocean-deep" />
            </div>
            <div className="max-w-[340px]">
              <div className="font-serif text-[17px] font-semibold tracking-tight text-foreground">
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

      <div className="h-32 shrink-0" />
    </main>
  );
}
