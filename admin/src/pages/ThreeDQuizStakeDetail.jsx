import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const setLabelByQuizId = {
    1: 'Set A',
    2: 'Set B',
    3: 'Set C',
};

const ThreeDQuizStakeDetail = () => {
    const navigate = useNavigate();
    const { quizId: quizIdParam } = useParams();
    const [searchParams] = useSearchParams();
    const slotStartIso = searchParams.get('slotStartIso') || '';

    const quizId = Number(quizIdParam);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [adminRole, setAdminRole] = useState('');
    const [currentSlotInfo, setCurrentSlotInfo] = useState(null);
    const [hintEditOpen, setHintEditOpen] = useState(false);
    const [hintDraft, setHintDraft] = useState('');
    const [hintEditError, setHintEditError] = useState('');
    const [savingHint, setSavingHint] = useState(false);
    const [houseNetSort, setHouseNetSort] = useState('default');

    const sortedRows = useMemo(() => {
        if (!data?.rows?.length) return [];
        const rows = [...data.rows];
        if (houseNetSort === 'desc') {
            rows.sort(
                (a, b) =>
                    (Number(b.houseNetIfWins) || 0) - (Number(a.houseNetIfWins) || 0)
                    || (Number(a.number) - Number(b.number)),
            );
        } else if (houseNetSort === 'asc') {
            rows.sort(
                (a, b) =>
                    (Number(a.houseNetIfWins) || 0) - (Number(b.houseNetIfWins) || 0)
                    || (Number(a.number) - Number(b.number)),
            );
        }
        return rows;
    }, [data, houseNetSort]);

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return undefined;
        }
        try {
            const parsed = JSON.parse(admin);
            setAdminRole(parsed.role || '');
        } catch {
            setAdminRole('');
        }

        if (!slotStartIso || !Number.isInteger(quizId) || ![1, 2, 3].includes(quizId)) {
            setError('Missing slot or invalid set.');
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setError('');
        const url = `${API_BASE_URL}/admin/lottery3d/quizzes/${quizId}/stake-by-number?slotStartIso=${encodeURIComponent(slotStartIso)}`;
        fetchWithAuth(url)
            .then(async (res) => {
                if (res.status === 401) return;
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json?.success) throw new Error(json?.message || `HTTP ${res.status}`);
                if (!cancelled) setData(json.data);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message || 'Failed to load');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [quizId, slotStartIso, navigate]);

    useEffect(() => {
        let cancelled = false;
        fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/current-slot`)
            .then(async (res) => {
                if (res.status === 401) return;
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json?.success) return;
                if (!cancelled) setCurrentSlotInfo(json.data);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    const canEditHintHere = useMemo(() => {
        if (adminRole !== 'super_admin') return false;
        if (!slotStartIso || !currentSlotInfo?.slot?.slotStartIso) return false;
        if (currentSlotInfo.slot.slotStartIso !== slotStartIso) return false;
        return currentSlotInfo?.slot?.phase === 'study';
    }, [adminRole, slotStartIso, currentSlotInfo]);

    const openHintEdit = () => {
        const v = data?.hintPosition;
        setHintDraft(
            Number.isInteger(v) ? String(v).padStart(3, '0') : '',
        );
        setHintEditError('');
        setHintEditOpen(true);
    };

    const cancelHintEdit = () => {
        setHintEditOpen(false);
        setHintEditError('');
    };

    const submitHintEdit = async (e) => {
        e.preventDefault();
        const trimmed = hintDraft.trim();
        if (!/^\d{1,3}$/.test(trimmed)) {
            setHintEditError('Enter a number from 000 to 999.');
            return;
        }
        const result = Number(trimmed);
        if (!Number.isInteger(result) || result < 0 || result > 999) {
            setHintEditError('Enter a number from 000 to 999.');
            return;
        }
        setSavingHint(true);
        setHintEditError('');
        try {
            const res = await fetchWithAuth(
                `${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(slotStartIso)}/result`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ quizId, result }),
                },
            );
            if (res.status === 401) return;
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json?.success) {
                throw new Error(json?.message || `HTTP ${res.status}`);
            }
            setData((prev) => (prev ? { ...prev, hintPosition: result } : prev));
            setHintEditOpen(false);
        } catch (err) {
            setHintEditError(err.message || 'Failed to update hint');
        } finally {
            setSavingHint(false);
        }
    };

    const setLabel = data?.setLabel || setLabelByQuizId[quizId] || `Set ${quizId}`;

    return (
        <AdminLayout onLogout={handleLogout} title={`${setLabel} · Stakes`}>
            <div className="space-y-5 max-w-6xl mx-auto px-4 pb-8">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/3d-management/result-control')}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        <FaArrowLeft className="h-3.5 w-3.5" />
                        Back to Result Control
                    </button>
                </div>

                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{setLabel} — number-wise bets</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Slot: {data?.drawLabelEnd || '—'}
                        {data?.payoutUsesPerPlayRates ? (
                            <span>
                                {' '}
                                · Payout column uses{' '}
                                <strong className="text-gray-700">each bet&apos;s play + Update Rate chart</strong> if that ticket
                                number wins · fallback ×{data?.winMultiplier ?? '—'} when a mode rate is unset
                            </span>
                        ) : (
                            <span> · Win multiplier ×{data?.winMultiplier ?? '—'}</span>
                        )}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-orange-700">Hint / result number:</span>
                        {!hintEditOpen ? (
                            <>
                                <span className="font-mono font-semibold text-orange-800">
                                    {data?.hintPosition != null ? String(data.hintPosition).padStart(3, '0') : '—'}
                                </span>
                                {canEditHintHere ? (
                                    <button
                                        type="button"
                                        onClick={openHintEdit}
                                        className="rounded-lg border border-orange-300 bg-white px-2.5 py-1 text-xs font-semibold text-orange-800 hover:bg-orange-50"
                                    >
                                        Edit
                                    </button>
                                ) : null}
                            </>
                        ) : (
                            <form onSubmit={submitHintEdit} className="flex flex-wrap items-center gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={3}
                                    value={hintDraft}
                                    onChange={(ev) => setHintDraft(ev.target.value.replace(/\D/g, '').slice(0, 3))}
                                    className="w-16 rounded border border-orange-300 px-2 py-1 font-mono text-sm"
                                    placeholder="000"
                                    disabled={savingHint}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={savingHint}
                                    className="rounded-lg bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                                >
                                    {savingHint ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    type="button"
                                    disabled={savingHint}
                                    onClick={cancelHintEdit}
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </form>
                        )}
                    </div>
                    {hintEditError ? <p className="text-xs text-red-600 mt-1">{hintEditError}</p> : null}
                    {adminRole === 'super_admin' && !canEditHintHere && currentSlotInfo?.slot ? (
                        <p className="text-xs text-gray-500 mt-1">
                            Hint editing is only available on this page while this slot is the <strong>current running</strong> slot and in <strong>study phase</strong>.
                        </p>
                    ) : null}
                </div>

                {loading ? <p className="text-gray-500">Loading...</p> : null}
                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}

                {!loading && !error && data ? (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Total stake (this set)</p>
                                <p className="text-xl font-bold text-gray-900">₹{Number(data.totalStake || 0).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Total tickets</p>
                                <p className="text-xl font-bold text-gray-900">{data.totalTickets ?? 0}</p>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Numbers with bets</p>
                                <p className="text-xl font-bold text-gray-900">{data.uniqueNumbersWithBets ?? 0}</p>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Slot start (UTC)</p>
                                <p className="text-xs font-mono text-gray-700 break-all">{data.slotStartIso}</p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                            <strong>House net if this number wins</strong> = total stake on this set − payout on that number (stake × {data.winMultiplier}).
                            Positive means house keeps money if that number is declared; negative means house pays out more than collected on that outcome.
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm max-h-[min(75vh,920px)] overflow-y-auto">
                            <table className="min-w-full text-sm">
                                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2.5 font-semibold">Number</th>
                                        <th className="px-3 py-2.5 font-semibold text-right">Tickets</th>
                                        <th className="px-3 py-2.5 font-semibold text-right">Stake (₹)</th>
                                        <th className="px-3 py-2.5 font-semibold text-right">Payout if wins (₹)</th>
                                        <th className="px-3 py-2.5 font-semibold text-right align-top">
                                            <div className="flex flex-col items-end gap-1.5">
                                                <span>House net if wins (₹)</span>
                                                <label className="sr-only" htmlFor="three-d-house-net-sort">Sort by house net</label>
                                                <select
                                                    id="three-d-house-net-sort"
                                                    value={houseNetSort}
                                                    onChange={(e) => setHouseNetSort(e.target.value)}
                                                    className="max-w-[11rem] rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-800 shadow-sm"
                                                >
                                                    <option value="default">Number order (000–999)</option>
                                                    <option value="desc">High to low (house net)</option>
                                                    <option value="asc">Low to high (house net)</option>
                                                </select>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2.5 font-semibold text-right">
                                            House net %
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedRows.map((row) => {
                                        const noBet = Number(row.stake || 0) <= 0;
                                        const isHint =
                                            data.hintPosition != null && Number(data.hintPosition) === Number(row.number);
                                        const totalStake = Number(data.totalStake || 0);
                                        const houseNet = Number(row.houseNetIfWins || 0);
                                        const houseNetPct = totalStake > 0 ? (houseNet / totalStake) * 100 : null;
                                        const houseNetPctLabel = houseNetPct == null
                                            ? '--'
                                            : `${houseNetPct >= 0 ? '+' : ''}${(Math.round(houseNetPct * 10) / 10).toFixed(1)}%`;
                                        return (
                                            <tr
                                                key={row.number}
                                                className={`border-b border-gray-100 ${
                                                    isHint ? 'bg-amber-50/90' : noBet ? 'bg-gray-50/60 text-gray-500' : 'hover:bg-gray-50/80'
                                                }`}
                                            >
                                                <td className={`px-3 py-1.5 font-mono font-bold ${noBet ? 'text-gray-400' : 'text-gray-900'}`}>
                                                    {row.numberLabel}
                                                </td>
                                                <td className={`px-3 py-1.5 text-right font-mono ${noBet ? 'text-gray-400' : ''}`}>{row.tickets}</td>
                                                <td className={`px-3 py-1.5 text-right font-mono ${noBet ? 'text-gray-400' : ''}`}>
                                                    ₹{Number(row.stake || 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className={`px-3 py-1.5 text-right font-mono ${noBet ? 'text-gray-400' : 'text-blue-800'}`}>
                                                    ₹{Number(row.payoutIfWin || 0).toLocaleString('en-IN')}
                                                </td>
                                                <td
                                                    className={`px-3 py-1.5 text-right font-mono font-semibold ${
                                                        noBet
                                                            ? 'text-gray-500'
                                                            : Number(row.houseNetIfWins || 0) >= 0
                                                              ? 'text-green-700'
                                                              : 'text-red-700'
                                                    }`}
                                                >
                                                    ₹{Number(row.houseNetIfWins || 0).toLocaleString('en-IN')}
                                                </td>
                                                <td
                                                    className={`px-3 py-1.5 text-right font-mono font-semibold ${
                                                        noBet
                                                            ? 'text-gray-500'
                                                            : houseNetPct == null
                                                              ? 'text-gray-500'
                                                              : houseNetPct >= 0
                                                                ? 'text-emerald-700'
                                                                : 'text-red-700'
                                                    }`}
                                                >
                                                    {houseNetPctLabel}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
};

export default ThreeDQuizStakeDetail;
