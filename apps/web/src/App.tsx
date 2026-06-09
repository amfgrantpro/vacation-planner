
import { useState } from 'react';
import { Toaster, toast } from 'sonner';
import { ChatInterface } from './components/ChatInterface';
import { TripProfileComponent } from './components/TripProfileComponent';
import { CandidateArea } from './components/CandidateArea';
import { LandingScreen } from './components/LandingScreen';
import { useAgent } from './hooks/useAgent';
import type { VacationPlan, Mode, RejectedCandidate, RejectReason } from './types';

function App() {
  const { messages, plan, isLoading, uiState, updateUiState, sendMessage } = useAgent();
  const [rejectedCandidates, setRejectedCandidates] = useState<RejectedCandidate[]>([]);

  // Check if session has started
  const sessionStarted = messages.length > 0 || plan !== null;

  // Handler for landing screen CTAs
  const handleStartSession = (_path: 'inspire' | 'destinations') => {
    const initialMessage = sessionStorage.getItem('initialMessage') || 'Tell me about vacation options.';
    const onboardingRaw = sessionStorage.getItem('onboardingProfile');
    const onboardingProfile = onboardingRaw ? JSON.parse(onboardingRaw) : undefined;
    sessionStorage.removeItem('initialMessage');
    sessionStorage.removeItem('onboardingProfile');
    sendMessage(initialMessage, undefined, rejectedCandidates, onboardingProfile);
  };

  // Handlers for mode transitions and UI actions
  const handleAddToShortlist = (destination: string) => {
    const newShortlist = [...uiState.shortlist, destination];
    if (newShortlist.length <= 3) {
      updateUiState({ shortlist: newShortlist });
    }
  };

  const handleRemoveFromShortlist = (destination: string) => {
    updateUiState({
      shortlist: uiState.shortlist.filter((d) => d !== destination),
    });
  };

  const handleCompareShortlist = () => {
    const newUiState = { ...uiState, mode: 'compare' as Mode };
    updateUiState({ mode: 'compare' });
    sendMessage(`I'd like to compare my shortlist now`, newUiState, rejectedCandidates);
  };

  const handleSelectWinner = (destination: string) => {
    const newUiState = { ...uiState, mode: 'decision' as Mode, selected_winner: destination };
    updateUiState({ mode: 'decision', selected_winner: destination });
    sendMessage(`I've chosen ${destination} as my destination!`, newUiState, rejectedCandidates);
  };

  const handleFindOthers = () => {
    const newUiState = { ...uiState, mode: 'explore' as Mode };
    updateUiState({ mode: 'explore' });
    sendMessage('Find others', newUiState, rejectedCandidates);
  };

  const handleBackToShortlist = () => {
    const newUiState = { ...uiState, mode: 'compare' as Mode };
    updateUiState({ mode: 'compare' });
    sendMessage('Back to my shortlist', newUiState, rejectedCandidates);
  };

  const handleTellMeMore = (destination: string) => {
    sendMessage(`Tell me more about ${destination}`, undefined, rejectedCandidates);
  };

  const handleRejectCandidate = (name: string, reason: RejectReason) => {
    setRejectedCandidates((prev) => {
      if (prev.some((r) => r.name.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, { name, reason }];
    });
    toast(`Removed ${name}`, {
      action: {
        label: 'Undo',
        onClick: () => handleUnremoveCandidate(name),
      },
    });
  };

  const handleUnremoveCandidate = (name: string) => {
    setRejectedCandidates((prev) =>
      prev.filter((r) => r.name.toLowerCase() !== name.toLowerCase())
    );
  };

  // Determine if compare button should be active
  const canCompare = uiState.shortlist.length >= 2;

  // True when agent is running a compare/decision turn — cards show skeleton rows
  const isEnriching = isLoading && (uiState.mode === 'compare' || uiState.mode === 'decision');

  // If session hasn't started, show landing screen
  if (!sessionStarted) {
    return (
      <>
        <Toaster position="bottom-right" />
        <LandingScreen onStartSession={handleStartSession} />
      </>
    );
  }

  // Session started: show split-panel layout
  const defaultPlan: VacationPlan = {
    mode: 'explore',
    trip_profile: {
      origin: null,
      travelers: null,
      when: null,
      duration: null,
      budget: null,
      vacation_type: null,
      likes: [],
      avoid: [],
    },
    candidates: [],
    selected_winner: null,
    comparison_matrix: null,
    notes: '',
  };

  const currentPlan = plan || defaultPlan;

  return (
    <>
    <Toaster position="bottom-right" />
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left panel: Chat (35%) */}
      <section className="w-[35%] min-w-[420px] max-w-[520px] shrink-0 h-full">
        <ChatInterface
          messages={messages}
          onSendMessage={(msg) => sendMessage(msg, undefined, rejectedCandidates)}
          isLoading={isLoading}
        />
      </section>

      {/* Right panel: Living Document (65%) */}
      <main className="flex-1 h-full overflow-y-auto bg-background">
        <div className="mx-auto max-w-[1180px] px-10 py-10 space-y-8">
          {/* Trip Profile - always visible */}
          <TripProfileComponent profile={currentPlan.trip_profile} />

          {/* Candidate Area - changes based on mode */}
          <CandidateArea
            mode={uiState.mode}
            candidates={currentPlan.candidates}
            shortlist={uiState.shortlist}
            selectedWinner={currentPlan.selected_winner}
            comparisonMatrix={currentPlan.comparison_matrix}
            isEnriching={isEnriching}
            rejectedCandidates={rejectedCandidates}
            onTellMeMore={handleTellMeMore}
            onAddToShortlist={handleAddToShortlist}
            onRemoveFromShortlist={handleRemoveFromShortlist}
            onCompareShortlist={handleCompareShortlist}
            onSelectWinner={handleSelectWinner}
            onFindOthers={handleFindOthers}
            onBackToShortlist={handleBackToShortlist}
            onRejectCandidate={handleRejectCandidate}
            onUnremoveCandidate={handleUnremoveCandidate}
            canCompare={canCompare}
          />
        </div>
      </main>
    </div>
    </>
  );
}

export default App;

