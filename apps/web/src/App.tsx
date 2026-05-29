
import { ChatInterface } from './components/ChatInterface';
import { TripProfileComponent } from './components/TripProfileComponent';
import { CandidateArea } from './components/CandidateArea';
import { LandingScreen } from './components/LandingScreen';
import { useAgent } from './hooks/useAgent';
import type { VacationPlan, Mode } from './types';

function App() {
  const { messages, plan, isLoading, uiState, updateUiState, sendMessage } = useAgent();

  // Check if session has started
  const sessionStarted = messages.length > 0 || plan !== null;

  // Handler for landing screen CTAs
  const handleStartSession = (_path: 'inspire' | 'destinations') => {
    const initialMessage = sessionStorage.getItem('initialMessage') || 'Tell me about vacation options.';
    sessionStorage.removeItem('initialMessage');
    sendMessage(initialMessage);
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
    sendMessage(`I'd like to compare my shortlist now`, newUiState);
  };

  const handleSelectWinner = (destination: string) => {
    const newUiState = { ...uiState, mode: 'decision' as Mode, selected_winner: destination };
    updateUiState({ mode: 'decision', selected_winner: destination });
    sendMessage(`I've chosen ${destination} as my destination!`, newUiState);
  };

  const handleFindOthers = () => {
    const newUiState = { ...uiState, mode: 'explore' as Mode };
    updateUiState({ mode: 'explore' });
    sendMessage('Find others', newUiState);
  };

  const handleBackToShortlist = () => {
    const newUiState = { ...uiState, mode: 'compare' as Mode };
    updateUiState({ mode: 'compare' });
    sendMessage('Back to my shortlist', newUiState);
  };

  const handleTellMeMore = (destination: string) => {
    sendMessage(`Tell me more about ${destination}`);
  };

  // Determine if compare button should be active
  const canCompare = uiState.shortlist.length >= 2;

  // True when agent is running a compare/decision turn — cards show skeleton rows
  const isEnriching = isLoading && (uiState.mode === 'compare' || uiState.mode === 'decision');

  // If session hasn't started, show landing screen
  if (!sessionStarted) {
    return <LandingScreen onStartSession={handleStartSession} />;
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-border px-6 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-2xl font-bold text-ink tracking-tight">Where to?</h1>
          <span className="hidden sm:inline-block text-xs text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
            AI vacation planner
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              isLoading ? 'bg-ocean animate-pulse' : 'bg-sage'
            }`}
          />
          {isLoading ? 'Thinking…' : 'Ready'}
        </div>
      </header>

      {/* Main content — 35% chat / 65% living document */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-6 py-6 gap-6 flex h-[calc(100vh-120px)] overflow-hidden">
        {/* Left panel: Chat (35%) */}
        <section className="w-[35%] min-w-[320px] shrink-0">
          <ChatInterface
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
          />
        </section>

        {/* Right panel: Living Document (65%) */}
        <section className="flex-1 flex flex-col gap-6 min-w-0 overflow-y-auto pr-2">
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
            onTellMeMore={handleTellMeMore}
            onAddToShortlist={handleAddToShortlist}
            onRemoveFromShortlist={handleRemoveFromShortlist}
            onCompareShortlist={handleCompareShortlist}
            onSelectWinner={handleSelectWinner}
            onFindOthers={handleFindOthers}
            onBackToShortlist={handleBackToShortlist}
            canCompare={canCompare}
          />
        </section>
      </main>
    </div>
  );
}

export default App;

