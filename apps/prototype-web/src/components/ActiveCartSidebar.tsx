import type { VacationPlan, Phase, DestinationCandidate } from '../types';

interface ActiveCartSidebarProps {
    plan: VacationPlan | null;
}

const PHASE_STEPS: Phase[] = ['intake', 'explore', 'shortlist', 'compare'];

const PHASE_LABELS: Record<Phase, string> = {
    intake: 'Intake',
    explore: 'Explore',
    shortlist: 'Shortlist',
    compare: 'Compare',
};

function PhaseBreadcrumb({ phase }: { phase: Phase }) {
    const currentIndex = PHASE_STEPS.indexOf(phase);

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {PHASE_STEPS.map((step, idx) => {
                const isDone = idx < currentIndex;
                const isCurrent = idx === currentIndex;
                return (
                    <div key={step} className="flex items-center gap-1">
                        <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full transition-all ${isCurrent
                                    ? 'bg-blue-600 text-white'
                                    : isDone
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-400'
                                }`}
                        >
                            {PHASE_LABELS[step]}
                        </span>
                        {idx < PHASE_STEPS.length - 1 && (
                            <span className={`text-xs ${isDone ? 'text-blue-400' : 'text-gray-300'}`}>›</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ConstraintPill({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</span>
            <span className="text-xs text-gray-700 font-semibold">{value}</span>
        </div>
    );
}

function CandidateCard({ candidate, rank }: { candidate: DestinationCandidate; rank: number }) {
    const criteria = candidate.decision_criteria
        ? Object.entries(candidate.decision_criteria)
        : [];

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm space-y-2">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                        {rank}
                    </span>
                    <span className="font-semibold text-gray-800 text-sm">{candidate.name}</span>
                </div>
            </div>

            {candidate.rationale && (
                <p className="text-xs text-gray-500 leading-relaxed pl-7">{candidate.rationale}</p>
            )}

            {criteria.length > 0 && (
                <div className="pl-7 flex flex-wrap gap-1">
                    {criteria.map(([key, val]) => (
                        <span
                            key={key}
                            className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded"
                            title={`${key}: ${val}`}
                        >
                            ⚠ {key}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ActiveCartSidebar({ plan }: ActiveCartSidebarProps) {
    if (!plan) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 h-full flex items-center justify-center">
                <p className="text-sm text-gray-400">No active session</p>
            </div>
        );
    }

    const activeCandidates = plan.candidates
        .filter((c) => c.status === 'active')
        .slice(0, 3);

    const hasConstraints =
        plan.trip_shape.origin || plan.trip_shape.duration_days || plan.budget_range;

    return (
        <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Decision Console</h2>
                </div>
                <PhaseBreadcrumb phase={plan.phase} />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Constraints strip */}
                {hasConstraints && (
                    <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1.5">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Constraints</p>
                        <div className="space-y-1">
                            {plan.trip_shape.origin && (
                                <ConstraintPill label="From" value={plan.trip_shape.origin} />
                            )}
                            {plan.trip_shape.duration_days && (
                                <ConstraintPill label="Duration" value={`${plan.trip_shape.duration_days} days`} />
                            )}
                            {plan.budget_range && (
                                <ConstraintPill label="Budget" value={plan.budget_range} />
                            )}
                            {plan.trip_shape.travelers > 1 && (
                                <ConstraintPill label="Travelers" value={String(plan.trip_shape.travelers)} />
                            )}
                        </div>
                    </div>
                )}

                {/* Candidate cards */}
                <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        Top Candidates
                        {activeCandidates.length > 0
                            ? ` · ${activeCandidates.length}/3`
                            : ''}
                    </p>

                    {activeCandidates.length === 0 ? (
                        <div className="text-xs text-gray-400 bg-white border border-dashed border-gray-200 rounded-lg p-4 text-center">
                            Candidates will appear here as the conversation progresses.
                        </div>
                    ) : (
                        activeCandidates.map((c, idx) => (
                            <CandidateCard key={c.name} candidate={c} rank={idx + 1} />
                        ))
                    )}
                </div>

                {/* Mental model unknowns — visible for debugging */}
                {plan.mental_model.unknowns.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-3">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Open Blockers</p>
                        <ul className="space-y-1">
                            {plan.mental_model.unknowns.map((u, i) => (
                                <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                                    <span className="text-orange-400 flex-shrink-0">•</span>
                                    {u}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
