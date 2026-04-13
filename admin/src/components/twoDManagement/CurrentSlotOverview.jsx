import React from 'react';

const CurrentSlotOverview = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-500">Loading current running slot...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-red-500">Current slot data unavailable.</p>
            </div>
        );
    }

    const { slot, summary, perQuiz = [] } = data;
    const hintRows = Array.isArray(perQuiz)
        ? perQuiz.map((row) => ({
            quizId: row.quizId,
            hint: row.result == null ? '--' : String(row.result).padStart(2, '0'),
        }))
        : [];
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-gray-800">Current Running Slot</h3>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 uppercase">
                    {slot?.phase || 'unknown'}
                </span>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Draw Time</p>
                    <p className="text-lg font-bold text-gray-800">{slot?.drawLabelEnd || '-'}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Total Tickets</p>
                    <p className="text-lg font-bold text-gray-800">{summary?.totalTickets ?? 0}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Total Users</p>
                    <p className="text-lg font-bold text-gray-800">{summary?.totalUsers ?? 0}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Revenue</p>
                    <p className="text-lg font-bold text-green-600">₹{Number((summary?.revenue ?? summary?.totalBetAmount) || 0).toLocaleString('en-IN')}</p>
                </div>
            </div>
            <p className="mt-3 text-xs text-gray-500 break-all">
                Slot Start: {slot?.slotStartIso || '-'}
            </p>
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">Running Slot Hint Numbers</p>
                {hintRows.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                        {hintRows.map((item) => (
                            <div key={item.quizId} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs">
                                <span className="text-gray-500">Q{String(item.quizId).padStart(2, '0')}</span>
                                <span className="float-right font-mono font-semibold text-gray-800">{item.hint}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-gray-500">Hint numbers unavailable for current slot.</p>
                )}
            </div>
        </div>
    );
};

export default CurrentSlotOverview;
