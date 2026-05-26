import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import { TripProfile, buildProfile } from "@/components/TripProfile";
import { CandidateCard, ShortlistBar, type Candidate } from "@/components/CandidateCard";
import { photos } from "@/lib/photos";

export const Route = createFileRoute("/mid")({
  component: MidScreen,
});

const messages: ChatMsg[] = [
  { from: "agent", text: "Lisbon vs. Mallorca was the first split — you leaned coastal and quieter." },
  { from: "user", text: "Yes. Lisbon felt a bit too city. We want sea views from where we stay." },
  { from: "agent", text: "Got it. Adding Mallorca to your shortlist. Costa Brava has a similar feel with smaller crowds in September — want me to add it too?" },
  { from: "user", text: "Yes please. And keep Sicily in the running for now." },
  { from: "agent", text: "Done. I've added the Costa Brava. Sicily is still on the table — here are two more options that match the brief." },
  { from: "user", text: "Show me something a bit more off-the-beaten-path." },
  { from: "agent", text: "Try San Sebastián — coastal, walkable, and the food scene is world-class. Or the Algarve's quieter western end." },
];

const candidates: Candidate[] = [
  {
    name: "San Sebastián",
    region: "Basque Country, Spain",
    image: photos.sanSebastian,
    vibe: "Crescent-beach town with the densest pintxo scene in Europe. Walkable, warm in September, and surrounded by green hills.",
  },
  {
    name: "Western Algarve",
    region: "Portugal",
    image: photos.algarve,
    vibe: "Cliff-top trails, quiet fishing villages and dramatic Atlantic beaches. Slower than the eastern resorts and gorgeous in shoulder season.",
  },
  {
    name: "Western Sicily",
    region: "Italy",
    image: photos.sicily,
    vibe: "Markets, seafood and golden September light, with relaxed beach towns like Cefalù and Trapani within easy driving distance.",
  },
];

function MidScreen() {
  const fields = buildProfile({
    origin: "Berlin",
    travelers: "Couple",
    when: "Mid-September",
    duration: "8 nights",
    budget: "Mid-range",
    vibe: "Coastal, relaxed, food-led",
    likes: "Food markets, swimming, walkable old towns, wine",
    avoid: "Greece, big crowds",
  });

  return (
    <div className="flex min-h-screen w-full">
      <ChatPanel messages={messages} />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-[1080px] px-10 py-10">
          <TripProfile fields={fields} />

          <section className="mt-10">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="font-serif text-2xl font-semibold tracking-tight">
                Destinations to consider
              </h2>
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Suggested based on your profile
              </span>
            </div>

            <div className="grid grid-cols-3 gap-5">
              {candidates.map((c) => (
                <CandidateCard key={c.name} c={c} />
              ))}
            </div>
          </section>

          <section className="mt-8">
            <ShortlistBar
              items={[
                { name: "Mallorca", image: photos.mallorca },
                { name: "Costa Brava", image: photos.costaBrava },
              ]}
              canCompare={true}
            />
          </section>

          <div className="h-24" />
        </div>
      </main>
    </div>
  );
}
