import { ChatInterface } from './components/ChatInterface';
import { ActiveCartSidebar } from './components/ActiveCartSidebar';
import { useAgent } from './hooks/useAgent';

function App() {
  const { messages, plan, isLoading, sendMessage } = useAgent();

  const activeCandidateNames = plan
    ? plan.candidates.filter((c) => c.status === 'active').slice(0, 3).map((c) => c.name)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-800">Agentic Travel Planner</h1>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 gap-4 flex flex-col md:flex-row h-[calc(100vh-57px)] overflow-hidden">
        {/* Chat Area — 60% */}
        <section className="flex-1 md:flex-[3] h-full min-h-0">
          <ChatInterface
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            activeCandidateNames={activeCandidateNames}
          />
        </section>

        {/* Decision Console Sidebar — 40% */}
        <section className="md:w-80 h-full min-h-0 overflow-hidden">
          <ActiveCartSidebar plan={plan} />
        </section>
      </main>
    </div>
  );
}

export default App;
