import type { VacationPlan } from '../types';

interface DebugPanelProps {
    plan: VacationPlan | null;
}

export function DebugPanel({ plan }: DebugPanelProps) {
    return (
        <div className="h-full bg-gray-900 text-gray-100 p-4 rounded-lg shadow-sm overflow-auto font-mono text-xs">
            <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Agent State</h3>
            {plan ? (
                <pre>{JSON.stringify(plan, null, 2)}</pre>
            ) : (
                <p className="text-gray-500 italic">No plan state yet...</p>
            )}
        </div>
    );
}
