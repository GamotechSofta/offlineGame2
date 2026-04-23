import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const TwoDCurrentSlotPlayers = () => {
    const navigate = useNavigate();
    const [slotStartIso, setSlotStartIso] = useState('');
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    const fetchPlayers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const currentRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot`);
            if (currentRes.status === 401) return;
            const currentJson = await currentRes.json();
            if (!currentJson?.success) throw new Error(currentJson?.message || 'Failed to load current slot');
            const iso = currentJson?.data?.slot?.slotStartIso || '';
            setSlotStartIso(iso);
            if (!iso) {
                setPlayers([]);
                return;
            }

            const playersRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(iso)}/players`);
            if (playersRes.status === 401) return;
            const playersJson = await playersRes.json();
            if (!playersJson?.success) throw new Error(playersJson?.message || 'Failed to load current slot players');
            setPlayers(Array.isArray(playersJson?.data?.players) ? playersJson.data.players : []);
        } catch (err) {
            setPlayers([]);
            setError(err?.message || 'Failed to load current slot players');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlayers();
    }, [fetchPlayers]);

    return (
        <AdminLayout onLogout={handleLogout} title="2D Current Slot Players">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">2D Current Slot Players</h1>
                        <p className="text-sm text-gray-500 break-all">Slot Start: {slotStartIso || '-'}</p>
                    </div>
                    <button
                        type="button"
                        onClick={fetchPlayers}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                        disabled={loading}
                    >
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}

                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">Current Slot Playing Players</h3>
                        {loading ? <span className="text-xs text-gray-500">Loading...</span> : null}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 border-b border-gray-200">
                                    <th className="py-2 pr-3">Player</th>
                                    <th className="py-2 pr-3 text-right">Total Bets (This Slot)</th>
                                    <th className="py-2 pr-3 text-right">All-time Bets</th>
                                    <th className="py-2 pr-3 text-right">Stake</th>
                                    <th className="py-2 pr-3 text-right">Payout</th>
                                    <th className="py-2 pr-3 text-right">P/L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!players.length && !loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-4 text-center text-gray-500">No players in current slot yet.</td>
                                    </tr>
                                ) : null}
                                {players.map((player) => (
                                    <tr key={`current-${player.userId}`} className="border-b border-gray-100">
                                        <td className="py-2 pr-3">
                                            <span className="font-semibold text-gray-800">{player.username || 'unknown'}</span>
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

