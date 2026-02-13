import { ChatInterface } from './components/ChatInterface';
import { DebugPanel } from './components/DebugPanel';
import { useAgent } from './hooks/useAgent';

function App() {
  const { messages, plan, isLoading, sendMessage } = useAgent();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold text-gray-800">Agentic Travel Planner (Sprint 1)</h1>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 gap-4 flex flex-col md:flex-row h-[calc(100vh-64px)]">
        {/* Chat Area - 60% width on desktop */}
        <section className="flex-1 md:flex-[3] h-full min-h-[400px]">
          <ChatInterface
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
          />
        </section>

        {/* Debug/State Area - 40% width on desktop */}
        <section className="flex-1 md:flex-[2] h-full min-h-[300px]">
          <DebugPanel plan={plan} />
        </section>
      </main>
    </div>
  );
}

export default App;
