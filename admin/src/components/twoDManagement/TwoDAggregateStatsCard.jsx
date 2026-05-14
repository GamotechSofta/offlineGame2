import React, { useEffect, useState } from 'react';

const formatInr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const StatCell = ({ label, value, valueClassName = 'text-gray-800' }) => (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-lg font-bold ${valueClassName}`}>{value}</p>
    </div>
);

const TwoDAggregateStatsCard = ({
    data,
    loading,
    error,
    appliedFrom,
    appliedTo,
    onApplyRange,
    onClearRange,
}) => {
    const [draftFrom, setDraftFrom] = useState(appliedFrom);
    const [draftTo, setDraftTo] = useState(appliedTo);
    const [localErr, setLocalErr] = useState('');

    useEffect(() => {
        setDraftFrom(appliedFrom);
        setDraftTo(appliedTo);
    }, [appliedFrom, appliedTo]);

    const handleApply = () => {
        setLocalErr('');
        if (!draftFrom && !draftTo) {
            onClearRange();
            return;
        }
        if (!draftFrom || !draftTo) {
            setLocalErr('Select both From and To (IST), or clear both for all-time.');
            return;
        }
        if (draftFrom > draftTo) {
            setLocalErr('From must be on or before To.');
            return;
        }
        onApplyRange(draftFrom, draftTo);
    };

    const handleClear = () => {
        setLocalErr('');
        setDraftFrom('');
        setDraftTo('');
        onClearRange();
    };

    const hasFilter = Boolean(appliedFrom && appliedTo);
    const net = Number(data?.adminNet ?? 0);
    const netClass = net >= 0 ? 'text-green-600' : 'text-red-600';

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">2D Overall Statistics</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        {hasFilter
                            ? `Filtered by IST slot days: ${appliedFrom} → ${appliedTo} (cancelled excluded).`
                            : 'All-time totals for your scope (cancelled bets excluded).'}
                    </p>
                </div>
                <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
                    <label className="flex min-w-0 flex-1 basis-0 flex-col gap-1 text-xs text-gray-600 lg:min-w-[7.5rem]">
                        <span className="font-medium">From (IST)</span>
                        <input
                            type="date"
                            value={draftFrom}
                            onChange={(e) => {
                                setDraftFrom(e.target.value);
                                setLocalErr('');
                            }}
                            className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
                        />
                    </label>
                    <label className="flex min-w-0 flex-1 basis-0 flex-col gap-1 text-xs text-gray-600 lg:min-w-[7.5rem]">
                        <span className="font-medium">To (IST)</span>
                        <input
                            type="date"
                            value={draftTo}
                            onChange={(e) => {
                                setDraftTo(e.target.value);
                                setLocalErr('');
                            }}
                            className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={loading}
                        className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:bg-orange-300"
                    >
                        Apply range
                    </button>
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={loading}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        All time
                    </button>
                </div>
            </div>
            {localErr ? <p className="mt-2 text-sm text-red-600">{localErr}</p> : null}
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            {loading ? (
                <p className="mt-4 text-sm text-gray-500">Loading aggregate stats...</p>
            ) : !error && data ? (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCell label="Total 2D tickets" value={Number(data?.total2DTickets ?? 0).toLocaleString('en-IN')} />
                    <StatCell label="Total bets" value={Number(data?.totalBets ?? 0).toLocaleString('en-IN')} />
                    <StatCell label="Total stake" value={formatInr(data?.totalStake)} />
                    <StatCell label="Total payout" value={formatInr(data?.totalPayout)} />
                    <StatCell label="Admin net" value={formatInr(data?.adminNet)} valueClassName={netClass} />
                    <StatCell label="Unique users 2D game" value={Number(data?.uniqueUsers2D ?? 0).toLocaleString('en-IN')} />
                    <StatCell label="Total loss" value={formatInr(data?.totalLoss)} valueClassName="text-red-600" />
                </div>
            ) : !error ? (
                <p className="mt-4 text-sm text-gray-500">No data.</p>
            ) : null}
        </div>
    );
};

export default TwoDAggregateStatsCard;
