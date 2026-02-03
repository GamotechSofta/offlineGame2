import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const TRIPLE_PATTI_DIGITS = DIGITS.map((d) => d + d + d);

const getAuthHeaders = () => {
    const admin = JSON.parse(localStorage.getItem('admin') || '{}');
    const password = sessionStorage.getItem('adminPassword') || '';
    return {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${admin.username}:${password}`)}`,
    };
};

const StatTable = ({ title, rowLabel1, rowLabel2, columns, getAmount, getCount, totalAmount, totalBets, cellClass = '' }) => (
    <div className="mb-8">
        <h2 className="text-lg font-bold text-yellow-500 mb-3 border-b border-yellow-500/50 pb-2">{title}</h2>
        <div className="overflow-x-auto rounded-lg border-2 border-amber-600/80 bg-amber-500/10">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-amber-600/30">
                        <th className="border border-amber-700/80 px-2 py-2 text-left font-semibold text-black">{rowLabel1}</th>
                        {columns.map((c) => (
                            <th key={c} className="border border-amber-700/80 px-2 py-2 text-center font-semibold text-black">{c}</th>
                        ))}
                        <th className="border border-amber-700/80 px-2 py-2 text-center font-semibold text-black">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="bg-amber-100/90">
                        <td className="border border-amber-700/80 px-2 py-2 font-medium text-black">{rowLabel2}</td>
                        {columns.map((c) => (
                            <td key={c} className={`border border-amber-700/80 px-2 py-2 text-center text-black ${cellClass}`}>
                                {getAmount(c)}
                            </td>
                        ))}
                        <td className="border border-amber-700/80 px-2 py-2 text-center font-semibold text-black">{totalAmount}</td>
                    </tr>
                    <tr className="bg-amber-50/90">
                        <td className="border border-amber-700/80 px-2 py-2 font-medium text-black">No Of Bets</td>
                        {columns.map((c) => (
                            <td key={c} className="border border-amber-700/80 px-2 py-2 text-center text-black">
                                {getCount(c)}
                            </td>
                        ))}
                        <td className="border border-amber-700/80 px-2 py-2 text-center font-semibold text-black">{totalBets}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
);

const MarketDetail = () => {
    const { marketId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        const fetchStats = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`${API_BASE_URL}/markets/get-market-stats/${marketId}`, { headers: getAuthHeaders() });
                const json = await res.json();
                if (json.success) setData(json.data);
                else setError(json.message || 'Failed to load market detail');
            } catch (err) {
                setError('Network error. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [marketId, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    if (loading) {
        return (
            <AdminLayout onLogout={handleLogout} title="Market Detail">
                <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
                </div>
            </AdminLayout>
        );
    }

    if (error || !data) {
        return (
            <AdminLayout onLogout={handleLogout} title="Market Detail">
                <div className="rounded-lg border border-red-700/60 bg-red-900/20 p-4 text-red-200">
                    {error || 'Market not found'}
                </div>
                <Link to="/markets" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-yellow-500 text-black font-semibold">
                    <FaArrowLeft /> Back to Markets
                </Link>
            </AdminLayout>
        );
    }

    const { market, singleDigit, jodi, singlePatti, doublePatti, triplePatti, halfSangam = { items: {}, totalAmount: 0, totalBets: 0 }, fullSangam = { items: {}, totalAmount: 0, totalBets: 0 } } = data;

    return (
        <AdminLayout onLogout={handleLogout} title="Market Detail">
            <div className="mb-4">
                <Link to="/markets" className="text-gray-400 hover:text-yellow-500 text-sm inline-flex items-center gap-1 mb-2">
                    <FaArrowLeft className="w-4 h-4" /> Markets Management
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{market.marketName} – Detail</h1>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-300">
                    <span>Result: <span className="text-yellow-400 font-mono">{market.displayResult || '***-**-***'}</span></span>
                    <span>Opening: {market.startingTime}</span>
                    <span>Closing: {market.closingTime}</span>
                </div>
            </div>

            {/* Single Digit */}
            <StatTable
                title="Single Digit"
                rowLabel1="Digit"
                rowLabel2="Amount"
                columns={DIGITS}
                getAmount={(d) => (singleDigit.digits[d]?.amount ?? 0).toLocaleString('en-IN')}
                getCount={(d) => singleDigit.digits[d]?.count ?? 0}
                totalAmount={(singleDigit.totalAmount ?? 0).toLocaleString('en-IN')}
                totalBets={singleDigit.totalBets ?? 0}
            />

            {/* Jodi - 10x10 grid: row = first digit, col = second digit */}
            <div className="mb-8">
                <h2 className="text-lg font-bold text-yellow-500 mb-3 border-b border-yellow-500/50 pb-2">Jodi</h2>
                <div className="overflow-x-auto rounded-lg border-2 border-amber-600/80 bg-amber-500/10">
                    <table className="w-full text-sm border-collapse min-w-[500px]">
                        <thead>
                            <tr className="bg-amber-600/30">
                                <th className="border border-amber-700/80 px-1 py-1.5 text-center font-semibold text-black w-12">#</th>
                                {DIGITS.map((d) => (
                                    <th key={d} className="border border-amber-700/80 px-1 py-1.5 text-center font-semibold text-black">{d}</th>
                                ))}
                                <th className="border border-amber-700/80 px-2 py-1.5 text-center font-semibold text-black">Total Amt / No of Bets</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DIGITS.map((r) => (
                                <tr key={r} className="bg-amber-100/80">
                                    <td className="border border-amber-700/80 px-1 py-1 text-center font-medium text-black">{r}</td>
                                    {DIGITS.map((c) => {
                                        const key = r + c;
                                        const item = jodi.items[key];
                                        const amt = item?.amount ?? 0;
                                        const cnt = item?.count ?? 0;
                                        return (
                                            <td key={key} className="border border-amber-700/80 px-1 py-1 text-center text-black text-xs">
                                                {amt > 0 || cnt > 0 ? (
                                                    <><span className="font-medium">{amt.toLocaleString('en-IN')}</span><br /><span className="text-amber-900/80">{cnt}</span></>
                                                ) : (
                                                    '0'
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="border border-amber-700/80 px-1 py-1 text-center text-black text-xs" />
                                </tr>
                            ))}
                            <tr className="bg-amber-600/40 font-semibold">
                                <td className="border border-amber-700/80 px-2 py-2 text-center text-black">#</td>
                                <td colSpan={10} className="border border-amber-700/80 px-2 py-2 text-center text-black">
                                    Total Amt {(jodi.totalAmount ?? 0).toLocaleString('en-IN')} &nbsp;|&nbsp; No of Bets {jodi.totalBets ?? 0}
                                </td>
                                <td className="border border-amber-700/80 px-2 py-2 text-center text-black">—</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Single Patti - list with total */}
            <div className="mb-8">
                <h2 className="text-lg font-bold text-yellow-500 mb-3 border-b border-yellow-500/50 pb-2">Single Patti</h2>
                <div className="overflow-x-auto rounded-lg border-2 border-amber-600/80 bg-amber-500/10">
                    <p className="px-3 py-2 text-amber-900 text-sm">
                        Total Amt {(singlePatti.totalAmount ?? 0).toLocaleString('en-IN')} &nbsp;|&nbsp; No of Bets {singlePatti.totalBets ?? 0}
                    </p>
                    <div className="px-3 pb-3 flex flex-wrap gap-2">
                        {Object.entries(singlePatti.items || {}).length === 0 ? (
                            <span className="text-amber-900/80">No bets</span>
                        ) : (
                            Object.entries(singlePatti.items).map(([key, v]) => (
                                <span key={key} className="bg-amber-200/90 text-black px-2 py-1 rounded text-xs font-medium">
                                    {key}: ₹{(v.amount || 0).toLocaleString('en-IN')} ({v.count || 0})
                                </span>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Double Patti */}
            <div className="mb-8">
                <h2 className="text-lg font-bold text-yellow-500 mb-3 border-b border-yellow-500/50 pb-2">Double Patti</h2>
                <div className="overflow-x-auto rounded-lg border-2 border-amber-600/80 bg-amber-500/10">
                    <p className="px-3 py-2 text-amber-900 text-sm">
                        Total Amt {(doublePatti.totalAmount ?? 0).toLocaleString('en-IN')} &nbsp;|&nbsp; No of Bets {doublePatti.totalBets ?? 0}
                    </p>
                    <div className="px-3 pb-3 flex flex-wrap gap-2">
                        {Object.entries(doublePatti.items || {}).length === 0 ? (
                            <span className="text-amber-900/80">No bets</span>
                        ) : (
                            Object.entries(doublePatti.items).map(([key, v]) => (
                                <span key={key} className="bg-amber-200/90 text-black px-2 py-1 rounded text-xs font-medium">
                                    {key}: ₹{(v.amount || 0).toLocaleString('en-IN')} ({v.count || 0})
                                </span>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Triple Patti */}
            <StatTable
                title="Triple Patti"
                rowLabel1="Patti"
                rowLabel2="Amount"
                columns={TRIPLE_PATTI_DIGITS}
                getAmount={(d) => (triplePatti.items[d]?.amount ?? 0).toLocaleString('en-IN')}
                getCount={(d) => triplePatti.items[d]?.count ?? 0}
                totalAmount={(triplePatti.totalAmount ?? 0).toLocaleString('en-IN')}
                totalBets={triplePatti.totalBets ?? 0}
            />

            {/* Half Sangam */}
            <div className="mb-8">
                <h2 className="text-lg font-bold text-yellow-500 mb-3 border-b border-yellow-500/50 pb-2">Half Sangam</h2>
                <div className="overflow-x-auto rounded-lg border-2 border-amber-600/80 bg-amber-500/10">
                    <p className="px-3 py-2 text-amber-900 text-sm">
                        Total Amt {(halfSangam.totalAmount ?? 0).toLocaleString('en-IN')} &nbsp;|&nbsp; No of Bets {halfSangam.totalBets ?? 0}
                    </p>
                    <div className="px-3 pb-3 flex flex-wrap gap-2">
                        {Object.entries(halfSangam.items || {}).length === 0 ? (
                            <span className="text-amber-900/80">No bets</span>
                        ) : (
                            Object.entries(halfSangam.items).map(([key, v]) => (
                                <span key={key} className="bg-amber-200/90 text-black px-2 py-1 rounded text-xs font-medium">
                                    {key}: ₹{(v.amount || 0).toLocaleString('en-IN')} ({v.count || 0})
                                </span>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Full Sangam */}
            <div className="mb-8">
                <h2 className="text-lg font-bold text-yellow-500 mb-3 border-b border-yellow-500/50 pb-2">Full Sangam</h2>
                <div className="overflow-x-auto rounded-lg border-2 border-amber-600/80 bg-amber-500/10">
                    <p className="px-3 py-2 text-amber-900 text-sm">
                        Total Amt {(fullSangam.totalAmount ?? 0).toLocaleString('en-IN')} &nbsp;|&nbsp; No of Bets {fullSangam.totalBets ?? 0}
                    </p>
                    <div className="px-3 pb-3 flex flex-wrap gap-2">
                        {Object.entries(fullSangam.items || {}).length === 0 ? (
                            <span className="text-amber-900/80">No bets</span>
                        ) : (
                            Object.entries(fullSangam.items).map(([key, v]) => (
                                <span key={key} className="bg-amber-200/90 text-black px-2 py-1 rounded text-xs font-medium">
                                    {key}: ₹{(v.amount || 0).toLocaleString('en-IN')} ({v.count || 0})
                                </span>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6">
                <Link to="/markets" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-black font-semibold">
                    <FaArrowLeft /> Back to Markets
                </Link>
            </div>
        </AdminLayout>
    );
};

export default MarketDetail;
