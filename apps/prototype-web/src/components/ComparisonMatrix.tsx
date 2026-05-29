interface ComparisonMatrixProps {
    matrix: Record<string, string>[];
    candidateNames: string[];
}

export function ComparisonMatrix({ matrix, candidateNames }: ComparisonMatrixProps) {
    if (!matrix || matrix.length === 0) return null;

    return (
        <div className="mt-3 rounded-lg border border-blue-200 overflow-hidden shadow-sm">
            <div className="bg-blue-600 px-3 py-2">
                <p className="text-xs font-bold text-white uppercase tracking-wide">Comparison</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-blue-50">
                            <th className="px-3 py-2 text-left font-bold text-gray-600 border-b border-blue-100 w-32">
                                Criterion
                            </th>
                            {candidateNames.map((name) => (
                                <th
                                    key={name}
                                    className="px-3 py-2 text-left font-bold text-blue-700 border-b border-blue-100"
                                >
                                    {name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.map((row, idx) => (
                            <tr
                                key={idx}
                                className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                            >
                                <td className="px-3 py-2 font-semibold text-gray-600 border-b border-gray-100">
                                    {row.criterion}
                                </td>
                                {candidateNames.map((name) => (
                                    <td
                                        key={name}
                                        className="px-3 py-2 text-gray-700 border-b border-gray-100"
                                    >
                                        {row[name] ?? '—'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
