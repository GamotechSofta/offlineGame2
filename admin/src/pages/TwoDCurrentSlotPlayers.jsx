import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';

const slotScheduleLabel = (s) => {
    const tag = s.status === 'live' ? 'Live' : s.status === 'past' ? 'Past' : 'Advance';
    return `${s.drawLabelEnd || s.slotStartIso} (${tag})`;
};

/** Matches user id, player name, or phone (substring; phone also digit-only). */
const rowMatchesSlotPlayerSearch = (player, raw) => {
    const q = String(raw || '').trim();
    if (!q) return true;
    const ql = q.toLowerCase();
    const uid = String(player.userId ?? '').toLowerCase();
    const user = String(player.username || '').toLowerCase();
    const phone = String(player.phone || '');
    const phoneDigits = phone.replace(/\D/g, '');
    const qDigits = q.replace(/\D/g, '');
    if (uid.includes(ql)) return true;
    if (user.includes(ql)) return true;
    if (phone.toLowerCase().includes(ql)) return true;
    if (qDigits.length >= 2 && phoneDigits.includes(qDigits)) return true;
    return false;
};

const TwoDCurrentSlotPlayers = () => {
    const {
        allDaySlotIso: ALL_DAY_SLOT_ISO,
        viewMode,
        setViewMode,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        historySlots,
        selectedHistorySlotIso,
        setSelectedHistorySlotIso,
        loadingHistorySlots,
        slotStartIso,
        players,
        loading,
        error,
        refresh,
        navigateLogout,
        todayDate,
        openPlayerHistory,
    } = useOutletContext();

    const [playerSearch, setPlayerSearch] = useState('');

    const selectedSlotMeta = useMemo(() => {
        if (selectedHistorySlotIso === ALL_DAY_SLOT_ISO) {
            if (dateFrom !== dateTo) {
                return { status: 'range', dateFrom, dateTo };
            }
            return { status: 'day', date: dateFrom };
        }
        return historySlots.find((s) => s.slotStartIso === selectedHistorySlotIso) || null;
    }, [historySlots, selectedHistorySlotIso, dateFrom, dateTo, ALL_DAY_SLOT_ISO]);

    const isDayOrRangeAggregate = viewMode === 'bySlot' && selectedHistorySlotIso === ALL_DAY_SLOT_ISO;

    const filteredPlayers = useMemo(() => {
        if (!playerSearch.trim()) return players;
        return players.filter((p) => rowMatchesSlotPlayerSearch(p, playerSearch));
    }, [players, playerSearch]);

    return (
        <AdminLayout onLogout={navigateLogout} title="2D players">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">2D players</h1>
                        <p className="text-sm text-gray-500 break-all">Slot Start: {slotStartIso || '-'}</p>
                    </div>
                    <button
                        type="button"
                        onClick={refresh}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                        disabled={loading || loadingHistorySlots}
                    >
                        {loading || loadingHistorySlots ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                    <p className="text-xs text-gray-500">
                        Dates are IST (Asia/Kolkata). Choose a range (max 62 days) or the same start/end for one day. For a
                        single day you can pick a specific draw or &quot;All day&quot;. For a range, all draws in the range
                        are merged.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setViewMode('live')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                                viewMode === 'live'
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                        >
                            Live slot
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('bySlot')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                                viewMode === 'bySlot'
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                        >
                            By date &amp; draw time
                        </button>
                    </div>
                    {viewMode === 'bySlot' ? (
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="flex flex-col gap-1 text-sm">
                                <span className="text-gray-600 font-medium">From date (IST)</span>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    max={dateTo}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setDateFrom(v);
                                        if (v > dateTo) setDateTo(v);
                                    }}
                                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-sm">
                                <span className="text-gray-600 font-medium">To date (IST)</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    min={dateFrom}
                                    max={todayDate()}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setDateTo(v);
                                        if (v < dateFrom) setDateFrom(v);
                                    }}
                                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-sm min-w-[220px] flex-1">
                                <span className="text-gray-600 font-medium">Draw (slot end time)</span>
                                <select
                                    value={selectedHistorySlotIso}
                                    onChange={(e) => setSelectedHistorySlotIso(e.target.value)}
                                    disabled={dateFrom !== dateTo || loadingHistorySlots}
                                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full max-w-md disabled:bg-gray-100 disabled:text-gray-500"
                                >
                                    {dateFrom !== dateTo ? (
                                        <option value={ALL_DAY_SLOT_ISO}>All draws in selected date range</option>
                                    ) : (
                                        <>
                                            <option value={ALL_DAY_SLOT_ISO}>All day — every draw on this date</option>
                                            {historySlots.map((s) => (
                                                <option key={s.slotStartIso} value={s.slotStartIso}>
                                                    {slotScheduleLabel(s)}
                                                </option>
                                            ))}
                                        </>
                                    )}
                                </select>
                            </label>
                            {loadingHistorySlots ? (
                                <span className="text-xs text-gray-500 pb-1">Loading schedule…</span>
                            ) : null}
                        </div>
                    ) : null}
                    {viewMode === 'bySlot' && selectedSlotMeta ? (
                        <p className="text-xs text-gray-600">
                            Viewing:{' '}
                            <span className="font-semibold">
                                {selectedSlotMeta.status === 'range'
                                    ? `All draws from ${selectedSlotMeta.dateFrom} to ${selectedSlotMeta.dateTo} (IST)`
                                    : selectedSlotMeta.status === 'day'
                                      ? 'All draws on this IST date (entire day)'
                                      : selectedSlotMeta.status === 'past'
                                        ? 'Completed draw (historical slot)'
                                        : selectedSlotMeta.status === 'upcoming'
                                          ? 'Advance draw (bets already placed for this future slot)'
                                          : 'Current running slot'}
                            </span>
                        </p>
                    ) : null}
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}

                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h3 className="text-lg font-semibold text-gray-800">Current Slot Playing Players</h3>
                            {loading ? <span className="text-xs text-gray-500">Loading...</span> : null}
                            {!loading && players.length > 0 && playerSearch.trim() ? (
                                <span className="text-xs text-gray-500">
                                    Showing {filteredPlayers.length} of {players.length}
                                </span>
                            ) : null}
                        </div>
                        <label className="flex flex-col gap-1 text-sm w-full sm:w-72 shrink-0">
                            <span className="text-gray-600 font-medium">Search</span>
                            <input
                                type="search"
                                value={playerSearch}
                                onChange={(e) => setPlayerSearch(e.target.value)}
                                placeholder="User ID, player name, phone…"
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </label>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 border-b border-gray-200">
                                    <th className="py-2 pr-3">Player</th>
                                    <th className="py-2 pr-3 text-right">
                                        {!isDayOrRangeAggregate
                                            ? 'Total Bets (This Slot)'
                                            : dateFrom !== dateTo
                                              ? 'Total bets (range)'
                                              : 'Total bets (day)'}
                                    </th>
                                    <th className="py-2 pr-3 text-right">All-time Bets</th>
                                    <th className="py-2 pr-3 text-right">Stake</th>
                                    <th className="py-2 pr-3 text-right">Payout</th>
                                    <th className="py-2 pr-3 text-right">P/L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!players.length && !loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-4 text-center text-gray-500">
                                            {viewMode === 'bySlot'
                                                ? 'No players for this slot yet.'
                                                : 'No players in current slot yet.'}
                                        </td>
                                    </tr>
                                ) : null}
                                {players.length > 0 && !loading && !filteredPlayers.length ? (
                                    <tr>
                                        <td colSpan={6} className="py-4 text-center text-gray-500">
                                            No players match your search. Try another user ID, name, or phone.
                                        </td>
                                    </tr>
                                ) : null}
                                {filteredPlayers.map((player) => (
                                    <tr key={`current-${player.userId}`} className="border-b border-gray-100">
                                        <td className="py-2 pr-3">
                                            <button
                                                type="button"
                                                onClick={() => openPlayerHistory(player.userId)}
                                                className="text-left font-semibold text-blue-600 hover:text-blue-800"
                                            >
                                                {player.username || 'unknown'}
                                            </button>
                                            {player.phone ? <div className="text-xs text-gray-500">{player.phone}</div> : null}
                                        </td>
                                        <td className="py-2 pr-3 text-right font-mono">{Number(player.currentSlotBetCount ?? player.batchBetCount ?? player.betCount ?? 0)}</td>
                                        <td className="py-2 pr-3 text-right font-mono">{Number(player.totalBetCountAllTime ?? player.totalBetCount ?? player.betCount ?? 0)}</td>
                                        <td className="py-2 pr-3 text-right font-mono">₹{Number(player.totalStake || 0).toLocaleString('en-IN')}</td>
                                        <td className="py-2 pr-3 text-right font-mono">₹{Number(player.totalPayout || 0).toLocaleString('en-IN')}</td>
                                        <td className={`py-2 pr-3 text-right font-mono ${Number(player.netProfitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            ₹{Number(player.netProfitLoss || 0).toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default TwoDCurrentSlotPlayers;
