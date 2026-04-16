import React from 'react';

const CurrentSlotOverview = ({
    data,
    loading,
    hintRows = [],
    loadingHints = false,
    hasSecretDeclarePassword = false,
    hintPassword = '',
    hintError = '',
    hintUnlocked = false,
    onHintPasswordChange,
    onUnlockHints,
    onLockHints,
    canEditHints = false,
    onEditHint,
}) => {
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

    const { slot, summary } = data;

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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-bold text-gray-700">
                        Running Slot <span className="text-red-500">Hint Numbers</span>
                    </p>
                    {hintUnlocked ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-green-600">Unlocked</span>
                            <button
                                type="button"
                                onClick={onLockHints}
                                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                            >
                                Lock
                            </button>
                        </div>
                    ) : (
                        <span className="text-[11px] font-medium text-gray-500">Locked</span>
                    )}
                </div>
                {!hintUnlocked && hasSecretDeclarePassword ? (
                    <form
                        className="space-y-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            onUnlockHints();
                        }}
                    >
                        <p className="text-xs text-gray-500">Enter the existing secret declare password to view running hint numbers.</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="password"
                                value={hintPassword}
                                onChange={(e) => onHintPasswordChange(e.target.value)}
                                placeholder="Enter secret password"
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
                            />
                            <button
                                type="submit"
                                disabled={loadingHints}
                                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold"
                            >
                                {loadingHints ? 'Checking...' : 'View Hints'}
                            </button>
                        </div>
                        {hintError ? <p className="text-xs text-red-500">{hintError}</p> : null}
                    </form>
                ) : loadingHints ? (
                    <p className="text-xs text-gray-500">Loading hint numbers...</p>
                ) : hintRows.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                        {hintRows.map((item) => (
                            <div key={item.quizId} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs">
                                <span className="text-gray-500">Q{String(item.quizId).padStart(2, '0')}</span>
                                <span className="float-right font-mono font-semibold text-gray-800">{item.hint}</span>
                                {canEditHints ? (
                                    <button
                                        type="button"
                                        onClick={() => onEditHint(item.quizId, item.hint)}
                                        className="mt-2 block w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                        Edit
                                    </button>
                                ) : null}
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
