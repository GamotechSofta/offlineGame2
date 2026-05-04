import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '../lib/auth';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { buildPlayer2DHistoryTicketGroups } from '../utils/buildPlayer2DHistoryTicketGroups';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

/**
 * Ticket-wise 2D player history in a popup over the 2D players list.
 */
const Player2DHistoryModal = ({ userId, onClose }) => {
    const closeModal = useModalBackHandler(true, onClose);
    const [playerHistoryData, setPlayerHistoryData] = useState(null);
    const [loadingPlayerHistory, setLoadingPlayerHistory] = useState(true);
    const [playerHistoryError, setPlayerHistoryError] = useState('');
    const [expandedHistoryTickets, setExpandedHistoryTickets] = useState({});

    const toggleHistoryTicketExpanded = useCallback((key) => {
        setExpandedHistoryTickets((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!userId) {
                setPlayerHistoryError('Missing player id.');
                setPlayerHistoryData(null);
                setLoadingPlayerHistory(false);
                return;
            }
            setLoadingPlayerHistory(true);
            setPlayerHistoryError('');
            setExpandedHistoryTickets({});
            try {
                const res = await fetchWithAuth(
                    `${API_BASE_URL}/admin/lottery2d/players/${encodeURIComponent(userId)}/history?limit=200`,
                );
                if (res.status === 401) return;
                const data = await res.json();
                if (!data?.success) throw new Error(data?.message || 'Failed to load player history');
                if (!cancelled) setPlayerHistoryData(data.data || null);
            } catch (err) {
                if (!cancelled) {
                    setPlayerHistoryError(err.message || 'Failed to load player history');
                    setPlayerHistoryData(null);
                }
            } finally {
                if (!cancelled) setLoadingPlayerHistory(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const playerHistoryTicketGroups = useMemo(
        () => buildPlayer2DHistoryTicketGroups(playerHistoryData),
        [playerHistoryData],
    );

    const displayName =
        playerHistoryData?.player?.username || (userId ? `User ${userId.slice(-6)}` : 'Player');

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-2d-history-title"
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/45"
                aria-label="Close dialog"
                onClick={closeModal}
            />
            <div
                className="relative z-[101] flex max-h-[92vh] w-full max-w-[min(96vw,120rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
                    <div className="min-w-0 flex-1">
                        <h2 id="player-2d-history-title" className="text-lg font-semibold text-blue-700">
                            Player 2D History — {displayName}
                        </h2>
                        {playerHistoryData?.player?.phone ? (
                            <p className="text-xs text-gray-500">{playerHistoryData.player.phone}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={closeModal}
                        className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xl font-light leading-none text-red-600 hover:bg-red-100 hover:text-red-700"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                    {loadingPlayerHistory ? (
                        <div className="text-sm text-gray-500">Loading player history...</div>
                    ) : playerHistoryError ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {playerHistoryError}
                        </div>
                    ) : playerHistoryData ? (
                        <>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">Total Bets</p>
                                    <p className="text-lg font-bold text-gray-800">
                                        {playerHistoryData.summary?.totalBets || 0}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">Ticket count</p>
                                    <p
                                        className="text-lg font-bold text-sky-900"
                                        title="Unique tickets in loaded history (table rows)"
                                    >
                                        {playerHistoryTicketGroups.length}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">Total Stake</p>
                                    <p className="text-lg font-bold text-gray-800">
                                        Rs {Number(playerHistoryData.summary?.totalStake || 0).toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">Total Payout</p>
                                    <p className="text-lg font-bold text-gray-800">
                                        Rs {Number(playerHistoryData.summary?.totalPayout || 0).toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">Net Profit/Loss</p>
                                    <p
                                        className={`text-lg font-bold ${
                                            Number(playerHistoryData.summary?.netProfitLoss || 0) >= 0
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        Rs {Number(playerHistoryData.summary?.netProfitLoss || 0).toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <div
                                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                                    title="How many bets settled as WIN after the draw. Each quiz + number is one bet. Count only, not rupees."
                                >
                                    <p className="text-xs text-gray-500">Win bets</p>
                                    <p className="text-lg font-bold text-green-700">
                                        {playerHistoryData.summary?.wins || 0}
                                    </p>
                                    <p className="mt-0.5 text-[10px] leading-snug text-gray-500">One number = one bet</p>
                                </div>
                                <div
                                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                                    title="How many bets settled as LOSE after the draw. Not rupees — use Net P/L, or Loss ₹ per ticket in the table."
                                >
                                    <p className="text-xs text-gray-500">Lose bets</p>
                                    <p className="text-lg font-bold text-red-700">
                                        {playerHistoryData.summary?.losses || 0}
                                    </p>
                                    <p className="mt-0.5 text-[10px] leading-snug text-gray-500">One number = one bet</p>
                                </div>
                                <div
                                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                                    title="Bets still open: draw not finished or result not applied yet."
                                >
                                    <p className="text-xs text-gray-500">Pending bets</p>
                                    <p className="text-lg font-bold text-amber-700">
                                        {playerHistoryData.summary?.pending || 0}
                                    </p>
                                    <p className="mt-0.5 text-[10px] leading-snug text-gray-500">Awaiting result</p>
                                </div>
                            </div>

                            <div className="overflow-auto rounded-xl border border-gray-200 text-[11px]">
                                <p className="sticky top-0 z-[1] border-b border-gray-200 bg-gray-50 px-3 py-2 text-[10px] text-gray-600">
                                    Ticket-wise rows — use the first column to expand and see each number bet.
                                </p>
                                {playerHistoryTicketGroups.length ? (
                                    <table className="min-w-full border-collapse text-left">
                                        <thead className="sticky top-[33px] z-[1] bg-gray-100 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                                            <tr className="border-b border-gray-200">
                                                <th className="w-9 px-1 py-2 text-center">#</th>
                                                <th className="w-10 px-2 py-2" aria-label="Expand" />
                                                <th className="px-2 py-2">Ticket</th>
                                                <th
                                                    className="whitespace-nowrap px-2 py-2 text-right"
                                                    title="Active (non-cancelled) bets on this ticket"
                                                >
                                                    Bets
                                                </th>
                                                <th className="whitespace-nowrap px-2 py-2 text-right">Canc.</th>
                                                <th className="whitespace-nowrap px-2 py-2">Draw</th>
                                                <th className="whitespace-nowrap px-2 py-2">Date</th>
                                                <th className="whitespace-nowrap px-2 py-2 text-right">Stake ₹</th>
                                                <th className="min-w-[9rem] px-2 py-2">Won / payout</th>
                                                <th
                                                    className="whitespace-nowrap px-2 py-2 text-right"
                                                    title="For this ticket after the draw: active stake minus win payout (rupees)."
                                                >
                                                    Loss ₹
                                                </th>
                                                <th className="whitespace-nowrap px-2 py-2">Type</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {playerHistoryTicketGroups.map((g, rowIdx) => {
                                                const linesOpen = Boolean(expandedHistoryTickets[g.key]);
                                                const resultSettled = Boolean(g.slotEnded);
                                                const winPayoutPending =
                                                    resultSettled &&
                                                    g.winningLineCount > 0 &&
                                                    Number(g.totalPayout || 0) <= 0 &&
                                                    g.lines.some(
                                                        (line) =>
                                                            line.outcome === 'win' && Number(line.payout || 0) <= 0,
                                                    );
                                                const stakeNum = Number(g.totalStake || 0);
                                                const payoutNum = winPayoutPending
                                                    ? 0
                                                    : Number(g.totalPayout || 0);
                                                const netLossRs =
                                                    resultSettled && !winPayoutPending && stakeNum > payoutNum
                                                        ? stakeNum - payoutNum
                                                        : 0;
                                                const ticketLabel = g.ticketId
                                                    ? String(g.ticketId).slice(-8).toUpperCase()
                                                    : 'Legacy';
                                                let wonPayoutCell = '—';
                                                if (!resultSettled) {
                                                    wonPayoutCell = 'Pending (draw open)';
                                                } else if (winPayoutPending) {
                                                    wonPayoutCell = `${g.winningLineCount}/${g.lineCountActive} bets won · payout processing…`;
                                                } else {
                                                    wonPayoutCell = `${g.winningLineCount}/${g.lineCountActive} bets won · ₹${Number(g.totalPayout || 0).toLocaleString('en-IN')}`;
                                                }
                                                return (
                                                    <React.Fragment key={g.key}>
                                                        <tr className="border-b border-gray-100 bg-white hover:bg-gray-50/80">
                                                            <td className="px-1 py-2 align-middle text-center tabular-nums text-gray-600">
                                                                {rowIdx + 1}
                                                            </td>
                                                            <td className="px-2 py-2 align-middle">
                                                                <button
                                                                    type="button"
                                                                    aria-expanded={linesOpen}
                                                                    title={linesOpen ? 'Hide bets' : 'Show bets'}
                                                                    onClick={() => toggleHistoryTicketExpanded(g.key)}
                                                                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100"
                                                                >
                                                                    <span className="font-mono text-xs" aria-hidden>
                                                                        {linesOpen ? '▼' : '▶'}
                                                                    </span>
                                                                </button>
                                                            </td>
                                                            <td className="px-2 py-2 align-middle font-mono font-semibold text-gray-900">
                                                                {ticketLabel}
                                                            </td>
                                                            <td className="px-2 py-2 align-middle text-right tabular-nums">
                                                                {g.lineCountActive}
                                                            </td>
                                                            <td className="px-2 py-2 align-middle text-right tabular-nums text-amber-800">
                                                                {g.cancelledCount > 0 ? g.cancelledCount : '—'}
                                                            </td>
                                                            <td className="px-2 py-2 align-middle whitespace-nowrap text-gray-800">
                                                                {g.drawLabelEnd ?? '—'}
                                                            </td>
                                                            <td className="px-2 py-2 align-middle whitespace-nowrap text-gray-700">
                                                                {g.dateLabel}
                                                            </td>
                                                            <td className="px-2 py-2 align-middle text-right tabular-nums">
                                                                {stakeNum.toLocaleString('en-IN')}
                                                            </td>
                                                            <td
                                                                className={`px-2 py-2 align-middle text-[10px] leading-snug ${
                                                                    resultSettled && g.winningLineCount > 0
                                                                        ? 'text-green-800'
                                                                        : 'text-gray-800'
                                                                }`}
                                                            >
                                                                {wonPayoutCell}
                                                            </td>
                                                            <td
                                                                className={`px-2 py-2 align-middle text-right tabular-nums font-semibold ${
                                                                    netLossRs > 0 ? 'text-red-700' : 'text-gray-500'
                                                                }`}
                                                            >
                                                                {netLossRs > 0 ? netLossRs.toLocaleString('en-IN') : '—'}
                                                            </td>
                                                            <td className="px-2 py-2 align-middle whitespace-nowrap">
                                                                {g.isAdvanceDraw ? (
                                                                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                                                                        Advance
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-500">Normal</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        {linesOpen ? (
                                                            <tr className="border-b border-gray-200 bg-slate-50">
                                                                <td colSpan={11} className="p-0">
                                                                    <table className="w-full border-collapse text-[11px]">
                                                                        <thead>
                                                                            <tr className="bg-slate-200 text-gray-700">
                                                                                <th className="border border-gray-300 px-2 py-1.5 text-left">
                                                                                    Set
                                                                                </th>
                                                                                <th className="border border-gray-300 px-2 py-1.5 text-left">
                                                                                    Number
                                                                                </th>
                                                                                <th className="border border-gray-300 px-2 py-1.5 text-right">
                                                                                    Amount ₹
                                                                                </th>
                                                                                <th className="border border-gray-300 px-2 py-1.5 text-left">
                                                                                    Result
                                                                                </th>
                                                                                <th className="border border-gray-300 px-2 py-1.5 text-right">
                                                                                    Payout ₹
                                                                                </th>
                                                                                <th className="border border-gray-300 px-2 py-1.5 text-right">
                                                                                    Net ₹
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {g.lines.map((bet) => (
                                                                                <tr key={bet.betId} className="bg-white">
                                                                                    <td className="border border-gray-300 px-2 py-1">
                                                                                        {bet.setLabel ||
                                                                                            `Q${String(bet.quizId ?? '').padStart(2, '0')}`}
                                                                                    </td>
                                                                                    <td className="border border-gray-300 px-2 py-1 font-mono font-semibold">
                                                                                        {String(bet.number ?? '').padStart(2, '0')}
                                                                                    </td>
                                                                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                                                                        {Number(bet.amount || 0).toLocaleString('en-IN')}
                                                                                    </td>
                                                                                    <td
                                                                                        className={`border border-gray-300 px-2 py-1 font-semibold ${
                                                                                            bet.outcome === 'win'
                                                                                                ? 'text-green-700'
                                                                                                : bet.outcome === 'lose'
                                                                                                  ? 'text-red-700'
                                                                                                  : bet.outcome === 'pending'
                                                                                                    ? 'text-amber-700'
                                                                                                    : 'text-gray-600'
                                                                                        }`}
                                                                                    >
                                                                                        {String(bet.outcome || '').toUpperCase()}
                                                                                    </td>
                                                                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                                                                        {Number(bet.payout || 0).toLocaleString('en-IN')}
                                                                                    </td>
                                                                                    <td
                                                                                        className={`border border-gray-300 px-2 py-1 text-right font-semibold ${
                                                                                            Number(bet.netProfitLoss || 0) >= 0
                                                                                                ? 'text-green-700'
                                                                                                : 'text-red-700'
                                                                                        }`}
                                                                                    >
                                                                                        {Number(bet.netProfitLoss ?? 0).toLocaleString(
                                                                                            'en-IN',
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        ) : null}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="py-6 text-center text-gray-500">No bets found.</p>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default Player2DHistoryModal;
