import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const formatBetDetails = (bet) => {
    const betType = String(bet?.betType || '').toLowerCase();
    const betNumber = String(bet?.betNumber || '').trim();
    const betOn = String(bet?.betOn || '').toLowerCase();

    if (betType === 'panna' && betNumber) {
        if (betOn === 'close') return `CLOSE PANA ${betNumber}`;
        return `OPEN PANA ${betNumber}`;
    }
    if (betType === 'sp-motor' && betNumber) {
        if (betOn === 'close') return `CLOSE SP MOTOR ${betNumber}`;
        return `OPEN SP MOTOR ${betNumber}`;
    }
    if (betType === 'dp-motor' && betNumber) {
        if (betOn === 'close') return `CLOSE DP MOTOR ${betNumber}`;
        return `OPEN DP MOTOR ${betNumber}`;
    }

    return `${String(bet?.betType || '').toUpperCase()} ${betNumber}`.trim();
};

const Records = () => {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState([]);
    const [betByFilter, setBetByFilter] = useState('all'); // all | player | bookie
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [tableAnchorEl, setTableAnchorEl] = useState(null);

    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const betsRes = await fetch(`${API_BASE_URL}/bets/history`, { headers: getBookieAuthHeaders() });
            const betsData = await betsRes.json();

            const betRecords = (betsData?.success ? betsData.data || [] : []).map((b) => ({
                id: `bet-${b._id}`,
                recordType: 'bet',
                createdAt: b.createdAt,
                playerName: b.userId?.username || '—',
                marketName: b.marketId?.marketName || '—',
                description: formatBetDetails(b),
                amount: Number(b.amount) || 0,
                flow: 'debit',
                status: b.status || 'pending',
                betPlacedBy: b.placedByBookie ? 'bookie' : 'player',
                source: b.placedByBookie ? (b.placedByBookieId?.username || 'Bookie') : 'Player',
            }));

            const combined = [...betRecords].sort((a, b) => {
                const at = new Date(a.createdAt).getTime() || 0;
                const bt = new Date(b.createdAt).getTime() || 0;
                return bt - at;
            });
            setRecords(combined);
        } catch (err) {
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredRecords = useMemo(() => {
        let list = records;
        if (betByFilter !== 'all') {
            list = list.filter((r) => r.recordType === 'bet' && r.betPlacedBy === betByFilter);
        }
        return list;
    }, [records, betByFilter]);

    const totalPages = useMemo(() => {
        const total = Math.ceil(filteredRecords.length / pageSize);
        return total > 0 ? total : 1;
    }, [filteredRecords.length, pageSize]);

    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredRecords.slice(startIndex, startIndex + pageSize);
    }, [filteredRecords, currentPage, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [betByFilter, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (!tableAnchorEl) return;
        tableAnchorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [currentPage, tableAnchorEl]);

    return (
        <Layout title="Bets History">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Bets History</h1>

            <div className="bg-white rounded-lg p-4 mb-4 sm:mb-6 border border-gray-200 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">Bets By:</span>
                <button
                    type="button"
                    onClick={() => setBetByFilter('all')}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                        betByFilter === 'all' ? 'bg-[#1B3150] text-white border-[#1B3150]' : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                >
                    All
                </button>
                <button
                    type="button"
                    onClick={() => setBetByFilter('player')}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                        betByFilter === 'player' ? 'bg-[#1B3150] text-white border-[#1B3150]' : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                >
                    Bets by Player
                </button>
                <button
                    type="button"
                    onClick={() => setBetByFilter('bookie')}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                        betByFilter === 'bookie' ? 'bg-[#1B3150] text-white border-[#1B3150]' : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                >
                    Bets by Bookie
                </button>
                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rows:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="px-2 py-1.5 rounded-lg text-sm font-semibold border bg-gray-100 text-gray-700 border-gray-200"
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <p className="text-gray-400 py-12 text-center">Loading records...</p>
            ) : filteredRecords.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
                    <p className="text-gray-500">No records found.</p>
                </div>
            ) : (
                <div ref={setTableAnchorEl} className="bg-white rounded-lg overflow-hidden border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Player</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Details</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Market</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Source</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Credit</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Debit</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {paginatedRecords.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${r.recordType === 'bet' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                {r.recordType.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-800">{r.playerName}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{r.description || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{r.marketName || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{r.source || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                                            {r.flow === 'credit' ? formatCurrency(r.amount) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-semibold text-red-500">
                                            {r.flow === 'debit' ? formatCurrency(r.amount) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                r.status === 'won' || r.status === 'approved' || r.status === 'completed'
                                                    ? 'bg-green-100 text-green-700'
                                                    : r.status === 'lost' || r.status === 'rejected'
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-[#1B3150]/10 text-[#1B3150]'
                                            }`}>
                                                {String(r.status || 'pending').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {new Date(r.createdAt).toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-gray-600">
                            Showing{' '}
                            <span className="font-semibold text-gray-800">
                                {filteredRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                            </span>{' '}
                            to{' '}
                            <span className="font-semibold text-gray-800">
                                {Math.min(currentPage * pageSize, filteredRecords.length)}
                            </span>{' '}
                            of <span className="font-semibold text-gray-800">{filteredRecords.length}</span> records
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold border bg-gray-100 text-gray-700 border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-sm font-semibold text-gray-700">
                                Page {currentPage} / {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold border bg-gray-100 text-gray-700 border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Records;
