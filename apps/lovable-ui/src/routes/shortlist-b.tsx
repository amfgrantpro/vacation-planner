import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import { TripProfile, buildProfile } from "@/components/TripProfile";
import { ShortlistBar } from "@/components/CandidateCard";
import { ShortlistCard, defaultRows, type Shortlist } from "@/components/ShortlistCard";
import { photos } from "@/lib/photos";

export const Route = createFileRoute("/shortlist-b")({
  component: ShortlistB,
});

const messages: ChatMsg[] = [
  { from: "agent", text: "You're set on Mallorca. The last call is how to spend the week." },
  { from: "user", text: "Stay in one place, or move around?" },
  { from: "agent", text: "Two clean versions of the same trip. Both based on Mallorca — same flights, same dates. Compare and decide." },
  { from: "user", text: "I like the idea of a base, but I don't want to miss the north." },
  { from: "agent", text: "Then the second option fits — three nights in Sóller, then a slow drive up to Pollença for the rest. Details on the right." },
];

const left: Shortlist = {
  name: "Mallorca · One base",
  region: "Sóller, Mallorca",
  image: photos.mallorca,
  vibe: "Settle into one stone-village finca for the whole week. Day-trip to coves, hike the Tramuntana, return to the same terrace each night.",
  bestFor: "Couples who unpack once and want a slow, deeply restful pace.",
  seasonNote: "Sóller's lemon harvest begins, market stays lively, and evenings are perfect on the plaça.",
  rows: defaultRows({
    weather: "26°C / sunny, warm sea",
    activities: "GR-221 day hikes, Port de Sóller swims, vineyard tour",
    around: "Rental car parked at the finca, used for 3–4 days",
    stay: "One restored finca, €220 / night × 7",
    style: "Slow, restorative, low logistics",
    season: { value: "exploring…", exploring: true },
  }),
};

const right: Shortlist = {
  name: "Mallorca · Base + road trip",
  region: "Sóller → Pollença, Mallorca",
  image: photos.roadtrip,
  vibe: "Three nights in Sóller for the western hikes, then drive the spine of the Tramuntana north to a quieter base in Pollença for the rest.",
  bestFor: "Couples who want variety, scenic driving and to see more of the island.",
  seasonNote: "Drive is at its best in September — clear roads, soft light, open mountain restaurants.",
  rows: defaultRows({
    weather: "26°C south, slightly cooler in the north",
    activities: "Tramuntana drive, Cap de Formentor, Pollença old town",
    around: "Rental car the whole week",
    stay: { value: "exploring…", exploring: true },
    style: "Two distinct rhythms in one trip",
    season: "September: fewer cars on the MA-10, restaurants still open",
  }),
};

function ShortlistB() {
  const fields = buildProfile({
    origin: "Berlin",
    travelers: "Couple",
    when: "Mid-September",
    duration: "8 nights",
    budget: "Mid-range",
    vibe: "Coastal, relaxed, food-led",
    likes: "Coastal walks, scenic drives, stone villages, swimming",
    avoid: "Greece, packing/unpacking every day",
  });

  return (
    <div className="flex min-h-screen w-full">
      <ChatPanel messages={messages} />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-[1180px] px-10 py-10">
          <TripProfile fields={fields} />

          <section className="mt-10">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="font-serif text-2xl font-semibold tracking-tight">
                Two ways to do Mallorca
              </h2>
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Compared to your profile
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <ShortlistCard s={left} />
              <ShortlistCard s={right} />
            </div>
          </section>

          <section className="mt-8">
            <ShortlistBar items={[]} variant="find-others" />
          </section>

          <div className="h-24" />
        </div>
      </main>
    </div>
  );
}
