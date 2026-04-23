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
    quizLabelFormatter = (quizId) => `Q${String(quizId).padStart(2, '0')}`,
    /** When set (2D only), clicking the quiz card opens stake-by-number detail; Edit stops propagation. */
    onQuizCardClick,
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
        </div>
    );
};

export default CurrentSlotOverview;
