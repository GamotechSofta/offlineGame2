import React from 'react';

const QuizSlotStatsTable = ({
    rows,
    onEditResult,
    canEdit = true,
    resultPadLength = 2,
    quizLabelFormatter = (quizId) => `Quiz${String(quizId).padStart(2, '0')}`,
    title = 'Quiz-wise Slot Stats',
}) => {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                            <th className="py-2 pr-3">Quiz</th>
                            <th className="py-2 pr-3 text-right">Result</th>
                            <th className="py-2 pr-3 text-right">Tickets</th>
                            <th className="py-2 pr-3 text-right">Users</th>
                            <th className="py-2 pr-3 text-right">Winner Tickets</th>
                            <th className="py-2 pr-3 text-right">Winner Users</th>
                            <th className="py-2 pr-3 text-right">Amount</th>
                            <th className="py-2 text-right">Edit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.quizId} className="border-b border-gray-100">
                                <td className="py-2 pr-3 font-medium text-gray-800">{quizLabelFormatter(row.quizId)}</td>
                                <td className="py-2 pr-3 text-right font-mono">{row.result == null ? '--' : String(row.result).padStart(resultPadLength, '0')}</td>
                                <td className="py-2 pr-3 text-right font-mono">{row.ticketCount}</td>
                                <td className="py-2 pr-3 text-right font-mono">{row.uniqueUsers}</td>
                                <td className="py-2 pr-3 text-right font-mono">{row.winnerTickets}</td>
                                <td className="py-2 pr-3 text-right font-mono">{row.winnerUsers}</td>
                                <td className="py-2 pr-3 text-right font-mono text-green-600">
                                    ₹{Number(row.totalBetAmount || 0).toLocaleString('en-IN')}
                                </td>
                                <td className="py-2 text-right">
                                    {canEdit ? (
                                        <button
                                            type="button"
                                            onClick={() => onEditResult(row.quizId, row.result)}
                                            className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs font-semibold text-gray-700"
                                        >
                                            Edit Result
                                        </button>
                                    ) : (
                                        <span className="text-xs text-gray-400">Locked</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default QuizSlotStatsTable;
