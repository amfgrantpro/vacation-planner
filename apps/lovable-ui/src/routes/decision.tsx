import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import { TripProfile, buildProfile } from "@/components/TripProfile";
import { ShortlistBar } from "@/components/CandidateCard";
import { ShortlistCard, defaultRows, type Shortlist } from "@/components/ShortlistCard";
import { photos } from "@/lib/photos";
import { Check } from "lucide-react";

export const Route = createFileRoute("/decision")({
  component: Decision,
});

const messages: ChatMsg[] = [
  { from: "agent", text: "You picked Mallorca, one base in Sóller. Great call for the pace you described." },
  { from: "user", text: "Yes, let's do it." },
  { from: "agent", text: "Locking it in. Here's the complete picture — flights, where to stay, what to do, and notes for September. Save it or send it on." },
  { from: "user", text: "Perfect. Can you also note that we'd like one day for a vineyard?" },
  { from: "agent", text: "Added — see Activities. Anything else before we wrap?" },
];

const winner: Shortlist = {
  name: "Mallorca · One base in Sóller",
  region: "Balearic Islands, Spain",
  image: photos.mallorca,
  vibe: "Eight nights in a restored stone finca above Sóller. Mornings on the Tramuntana, afternoons swimming in Port de Sóller, slow dinners on the plaça.",
  tripFeel: "A restful, food-led couple's week with one breathtaking landscape on the doorstep.",
  seasonNote: "Sea is 24°C, the lemon harvest begins, and the GR-221 trail is at its most photogenic light.",
  rows: defaultRows({
    weather: "26°C / sunny · warm sea · cool evenings",
    activities: "GR-221 day hikes, Port de Sóller swims, Binissalem vineyard day, market mornings",
    around: "Rental car at the finca, used for 4 of 8 days",
    stay: "Finca Ca'n Quatre, Sóller · €220 / night × 7",
    style: "Slow, restorative, one beautiful base",
    season: "September: shoulder season, fewer crowds, restaurants still humming",
  }),
};

function Decision() {
  const fields = buildProfile({
    origin: "Berlin (BER)",
    travelers: "Couple",
    when: "12–20 September",
    duration: "8 nights",
    budget: "Mid-range · ~€2,800 pp",
    vacation_type: "Coastal, slow, food-led",
    likes: "Coastal hikes, swimming, stone villages, wine, market mornings",
    avoid: "Greece, daily packing/unpacking, big resort crowds",
  });

  return (
    <div className="flex min-h-screen w-full">
      <ChatPanel messages={messages} />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-[1180px] px-10 py-10">
          <TripProfile fields={fields} />

          <section className="mt-10">
            <div className="mb-5 flex items-baseline justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-ocean-deep/10 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ocean-deep">
                  <Check className="size-3" /> decided
                </div>
                <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight">
                  Your destination
                </h2>
              </div>
            </div>

            <div className="mx-auto max-w-[640px]">
              <ShortlistCard s={winner} winner />
            </div>
          </section>

          <section className="mt-8">
            <ShortlistBar items={[]} variant="find-others" showReconsider />
          </section>

          <div className="h-24" />
        </div>
      </main>
    </div>
  );
}
