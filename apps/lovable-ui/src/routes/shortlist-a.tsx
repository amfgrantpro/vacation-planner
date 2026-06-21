import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import { TripProfile, buildProfile } from "@/components/TripProfile";
import { ShortlistBar } from "@/components/CandidateCard";
import { ShortlistCard, defaultRows, type Shortlist } from "@/components/ShortlistCard";
import { photos } from "@/lib/photos";

export const Route = createFileRoute("/shortlist-a")({
  component: ShortlistA,
});

const messages: ChatMsg[] = [
  { from: "agent", text: "You're down to two: Mallorca and Costa Brava. Both fit the brief — let's compare them closely." },
  { from: "user", text: "How do they actually differ for a coastal-walks-and-food week?" },
  { from: "agent", text: "Mallorca wins on dramatic hiking — the Tramuntana is in a different league. Costa Brava wins on food density and quieter coves." },
  { from: "user", text: "What about getting around without renting a car the whole time?" },
  { from: "agent", text: "Costa Brava has a better local bus + ferry network between coves. Mallorca really wants you to drive. I've added that detail to both cards." },
];

const left: Shortlist = {
  name: "Mallorca",
  region: "Balearic Islands, Spain",
  image: photos.mallorca,
  vibe: "Base yourself in Sóller or Deià on the west coast — stone villages, citrus groves and cliff-side hikes a few steps from the door.",
  tripFeel: "Couples who want dramatic coastal hiking and warm September swims.",
  seasonNote: "Sea is still 24°C, crowds have thinned, and the Tramuntana trail is at its best light.",
  rows: defaultRows({
    weather: "26°C / sunny, occasional warm evening breeze",
    activities: "GR-221 cliff walks, sea kayaking, vineyard tours in Binissalem",
    around: "Rental car recommended for the west coast",
    stay: "Restored fincas near Sóller, €180–260 / night",
    style: "Slow, scenic, a little active",
    season: { value: "exploring…", exploring: true },
  }),
};

const right: Shortlist = {
  name: "Costa Brava",
  region: "Catalonia, Spain",
  image: photos.costaBrava,
  vibe: "Base in Begur or Cadaqués and walk the Camí de Ronda between hidden coves, eating long lunches of grilled seafood and Empordà wine.",
  tripFeel: "Food-led couples who want quiet coves and short coastal walks.",
  seasonNote: "Restaurants stay open, beaches empty out, and the light turns golden through October.",
  rows: defaultRows({
    weather: "25°C / sunny, cooler evenings than the Balearics",
    activities: "Camí de Ronda, snorkelling, Dalí museum in Figueres",
    around: "Bus + occasional taxi works; car nice for two of the days",
    stay: "Small boutique hotels in Begur, €160–230 / night",
    style: { value: "exploring…", exploring: true },
    season: "September–early October is the locals' favourite week",
  }),
};

function ShortlistA() {
  const fields = buildProfile({
    origin: "Berlin",
    travelers: "Couple",
    when: "Mid-September",
    duration: "8 nights",
    budget: "Mid-range",
    vacation_type: "Coastal, relaxed, food-led",
    likes: "Food markets, coastal walks, swimming, wine",
    avoid: "Greece, big resort crowds",
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
                Comparing your shortlist
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
