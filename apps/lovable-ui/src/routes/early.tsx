import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import { TripProfile, buildProfile } from "@/components/TripProfile";
import { CandidateCard, ShortlistBar, type Candidate } from "@/components/CandidateCard";
import { photos } from "@/lib/photos";

export const Route = createFileRoute("/early")({
  component: EarlyScreen,
});

const messages: ChatMsg[] = [
  { from: "agent", text: "Hi! I'd love to help you find your next trip. Tell me what you're after." },
  { from: "user", text: "A couple from Berlin, looking for somewhere warm in September. We love food and coastal walks." },
  { from: "agent", text: "Lovely brief. Roughly how long do you have, and do you want to fly short-haul or are you open to a longer journey?" },
  { from: "user", text: "About a week. Short-haul ideally. We'd rather not return to Greece, we were there last year." },
  { from: "agent", text: "Got it — noting that. Here are three early possibilities to react to. Tell me which feels closest and we'll narrow down." },
];

const candidates: Candidate[] = [
  {
    name: "Lisbon",
    region: "Portugal",
    image: photos.lisbon,
    vibe: "A walkable, sun-soaked capital with a serious food scene and quick access to wild coastline. Easy short-haul from Berlin.",
  },
  {
    name: "Mallorca",
    region: "Balearic Islands, Spain",
    image: photos.mallorca,
    vibe: "Quiet stone villages, dramatic coastal hikes along the Tramuntana, and warm September swims. Perfect couple's pace.",
  },
  {
    name: "Western Sicily",
    region: "Italy",
    image: photos.sicily,
    vibe: "Markets, seafood and golden September light, with relaxed beach towns like Cefalù and Trapani within easy driving distance.",
  },
];

function EarlyScreen() {
  const fields = buildProfile({
    origin: "Berlin",
    travelers: "Couple",
    when: "September",
    duration: "~1 week",
    vacation_type: "Warm, coastal, relaxed",
    likes: "Food, coastal walks",
    avoid: "Greece (been recently)",
  });

  return (
    <div className="flex min-h-screen w-full">
      <ChatPanel messages={messages} typing />
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
            <ShortlistBar items={[]} canCompare={false} />
          </section>

          <div className="h-24" />
        </div>
      </main>
    </div>
  );
}
