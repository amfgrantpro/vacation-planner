import { useState } from 'react';
import { ArrowRight, Lightbulb, MapPin } from 'lucide-react';

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

    // Store the initial message in sessionStorage to be sent after rendering
    sessionStorage.setItem('initialMessage', parts.join(', ') + '.');

    onStartSession(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-white to-teal-soft/30 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">
        {/* Left side: Entry point */}
        <div>
          <div className="mb-8">
            <h1 className="font-serif text-5xl font-bold tracking-tight text-gray-900 mb-3">
              Where to?
            </h1>
            <p className="text-lg text-gray-600">
              We help you decide where to go next.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-border/70 p-8 shadow-card space-y-6">
            {/* Sentence builder */}
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Build your trip brief</p>

              {/* Travelers */}
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-gray-700">I'm</span>
                <select
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                  className="px-3 py-2 rounded-full border border-teal-soft bg-teal-soft text-ocean-deep text-sm font-medium focus:outline-none"
                >
                  <option>solo traveller</option>
                  <option>a couple</option>
                  <option>a family</option>
                  <option>a group of friends</option>
                </select>
              </div>

              {/* Origin */}
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-gray-700">travelling from</span>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="px-3 py-2 rounded-full border border-teal-soft bg-teal-soft text-ocean-deep text-sm font-medium focus:outline-none"
                />
              </div>

              {/* When */}
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-gray-700">in</span>
                <select
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="px-3 py-2 rounded-full border border-teal-soft bg-teal-soft text-ocean-deep text-sm font-medium focus:outline-none"
                >
                  <option>whenever</option>
                  <option>January</option>
                  <option>February</option>
                  <option>March</option>
                  <option>April</option>
                  <option>May</option>
                  <option>June</option>
                  <option>July</option>
                  <option>August</option>
                  <option>September</option>
                  <option>October</option>
                  <option>November</option>
                  <option>December</option>
                  <option>flexible</option>
                </select>
              </div>

              {/* Duration */}
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-gray-700">for</span>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="px-3 py-2 rounded-full border border-teal-soft bg-teal-soft text-ocean-deep text-sm font-medium focus:outline-none"
                >
                  <option>however long</option>
                  <option>a few days</option>
                  <option>a week</option>
                  <option>2 weeks</option>
                  <option>flexible</option>
                </select>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex gap-3">
              <button
                onClick={() => handleStartSession('inspire')}
                className="flex-1 bg-ocean-deep text-white rounded-full py-3 font-medium text-sm hover:bg-ocean-deep/90 transition flex items-center justify-center gap-2"
              >
                <Lightbulb className="size-4" /> Inspire me where to go
              </button>
              <button
                onClick={() => handleStartSession('destinations')}
                className="flex-1 border border-ocean-deep text-ocean-deep rounded-full py-3 font-medium text-sm hover:bg-cream transition flex items-center justify-center gap-2"
              >
                <MapPin className="size-4" /> I already have destinations
              </button>
            </div>

            {/* Optional section */}
            <div className="border-t pt-6">
              <p className="text-xs font-medium text-gray-500 mb-4">OPTIONAL · ADD MORE IF YOU LIKE</p>

              <div className="space-y-4">
                {/* Vacation type */}
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-gray-700 text-sm">We're looking for</span>
                  <select
                    value={vacationType}
                    onChange={(e) => setVacationType(e.target.value)}
                    className="px-3 py-2 rounded-full border border-teal-soft bg-teal-soft text-ocean-deep text-sm font-medium focus:outline-none"
                  >
                    <option>anything</option>
                    <option>beach & relaxation</option>
                    <option>hiking & outdoors</option>
                    <option>city & culture</option>
                    <option>roadtripping</option>
                    <option>good food & drink</option>
                  </select>
                </div>

                {/* Budget */}
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-gray-700 text-sm">The budget is</span>
                  <select
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="px-3 py-2 rounded-full border border-teal-soft bg-teal-soft text-ocean-deep text-sm font-medium focus:outline-none"
                  >
                    <option>not important for now</option>
                    <option>on the cheap</option>
                    <option>mid-range</option>
                    <option>let's get fancy</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Preview of trip profile + candidate area (empty state) */}
        <div className="hidden md:flex flex-col gap-6">
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-border/70 p-6 shadow-card">
            <h3 className="font-serif text-base font-semibold mb-4">Trip profile</h3>
            <div className="space-y-3">
              {[
                { label: 'Origin', value: 'not set' },
                { label: 'Travelers', value: 'not set' },
                { label: 'When', value: 'not set' },
                { label: 'Duration', value: 'not set' },
              ].map((field) => (
                <div key={field.label} className="text-sm">
                  <span className="text-gray-500">{field.label}</span>
                  <span className="text-gray-300"> · {field.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-border/70 p-6 shadow-card">
            <h3 className="font-serif text-base font-semibold mb-4">Your top options</h3>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg border border-dashed border-gray-300" />
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">
              Your top options will appear here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
