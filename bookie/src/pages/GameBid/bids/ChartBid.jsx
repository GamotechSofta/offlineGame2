import React, { useEffect, useMemo, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';
import { isPastOpeningTime } from '../../../utils/marketTiming';
import { chartData, getNumbersForChartDigit } from './chartData';

const CHART_OPTIONS = Object.keys(chartData);
const DIGIT_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const QUICK_POINTS = [10, 20, 30, 40, 50];

const ChartBid = ({ title, gameType, betType, embedInSingleScroll = false }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [session, setSession] = useState(() => (isPastOpeningTime(market) ? 'CLOSE' : 'OPEN'));
    const [warning, setWarning] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        try {
            const savedDate = localStorage.getItem('bookieBetSelectedDate');
            if (savedDate && savedDate > new Date().toISOString().split('T')[0]) return savedDate;
        } catch (e) { /* ignore */ }
        return new Date().toISOString().split('T')[0];
    });
    const [selectedChart, setSelectedChart] = useState('');
    const [selectedDigit, setSelectedDigit] = useState('');
    const [pointsInput, setPointsInput] = useState('');
    const [generatedRows, setGeneratedRows] = useState([]);

    const handleDateChange = (newDate) => {
        try { localStorage.setItem('bookieBetSelectedDate', newDate); } catch (e) { /* ignore */ }
        setSelectedDate(newDate);
    };
    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const isRunning = isPastOpeningTime(market);
    useEffect(() => { if (isRunning) setSession('CLOSE'); }, [isRunning]);

    const rowsWithPoints = useMemo(
        () => generatedRows.filter((row) => Number(row.points) > 0),
        [generatedRows]
    );
    const bidsCount = rowsWithPoints.length;
    const totalPoints = useMemo(
        () => rowsWithPoints.reduce((sum, row) => sum + (Number(row.points) || 0), 0),
        [rowsWithPoints]
    );

    const clearPointsOnly = () => setPointsInput('');

    const clearLocal = () => {
        setSelectedChart('');
        setSelectedDigit('');
        setPointsInput('');
        setGeneratedRows([]);
    };

    const handleAddRow = () => {
        if (!selectedChart) {
            showWarning('Please select a chart.');
            return;
        }
        if (selectedDigit === '' || selectedDigit == null) {
            showWarning('Please select a digit (0–9).');
            return;
        }
        const pts = Number(pointsInput);
        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }
        const numbers = getNumbersForChartDigit(selectedChart, selectedDigit);
        if (!numbers.length) {
            showWarning('No numbers defined for this chart and digit.');
            return;
        }
        setGeneratedRows((prev) => {
            const out = [...prev];
            for (const pana of numbers) {
                const idx = out.findIndex((r) => r.chart === selectedChart && r.pana === pana);
                if (idx >= 0) {
                    const cur = Number(out[idx].points) || 0;
                    out[idx] = { ...out[idx], points: String(cur + pts) };
                } else {
                    out.push({
                        id: `${selectedChart}-${pana}`,
                        chart: selectedChart,
                        pana,
                        display: `${selectedChart} - ${pana}`,
                        points: String(pts),
                    });
                }
            }
            return out;
        });
        setPointsInput('');
    };

    const updatePoint = (id, value) => {
        const clean = (value ?? '').toString().replace(/\D/g, '').slice(0, 6);
        setGeneratedRows((prev) => prev.map((row) => (row.id === id ? { ...row, points: clean } : row)));
    };

    const removeRow = (id) => {
        setGeneratedRows((prev) => prev.filter((row) => row.id !== id));
    };

    const handleAddToCart = () => {
        const items = generatedRows
            .filter((row) => Number(row.points) > 0)
            .map((row) => ({
                number: row.pana,
                points: String(row.points),
                type: session,
                betType: 'panna',
            }));
        if (!items.length) {
            showWarning('Add at least one row with points.');
            return;
        }
        const count = addToCart(items, gameType, title, betType || 'panna');
        if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
        setGeneratedRows([]);
    };

    return (
        <BookieBidLayout
            title={title}
            bidsCount={bidsCount}
            totalPoints={totalPoints}
            session={session}
            setSession={setSession}
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            hideFooter
            showDateSession={!embedInSingleScroll}
            noHeader={embedInSingleScroll}
            noDateSession={embedInSingleScroll}
            noFooter={embedInSingleScroll}
            contentPaddingClass="pb-24"
        >
            <div className="px-2 sm:px-4 py-3 w-full max-w-full overflow-x-hidden">
                {warning && (
                    <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                        {warning}
                    </div>
                )}
                <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch md:items-start">
                    <div className="flex flex-col gap-3 w-full md:w-1/2 shrink-0 min-w-0">
                        <div>
                            <div className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2">Select Chart</div>
                            <div className="grid grid-cols-3 gap-2">
                                {CHART_OPTIONS.map((ch) => {
                                    const selected = selectedChart === ch;
                                    return (
                                        <button
                                            key={ch}
                                            type="button"
                                            onClick={() => setSelectedChart(ch)}
                                            aria-pressed={selected}
                                            className={`min-h-[40px] h-10 rounded-md font-bold text-xs sm:text-sm transition-all active:scale-[0.98] border ${
                                                selected
                                                    ? 'bg-[#1B3150] text-white border-[#1B3150]'
                                                    : 'bg-white text-[#1B3150] border-gray-300 hover:bg-[#1B3150]/5'
                                            }`}
                                        >
                                            {ch}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <div className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2">Select Digit</div>
                            <div className="grid grid-cols-5 gap-2">
                                {DIGIT_ORDER.map((d) => {
                                    const ds = String(d);
                                    const selected = selectedDigit === ds;
                                    return (
                                        <button
                                            key={ds}
                                            type="button"
                                            onClick={() => setSelectedDigit(ds)}
                                            aria-pressed={selected}
                                            className={`min-h-[40px] h-10 rounded-md font-bold text-sm sm:text-base transition-all active:scale-[0.98] border ${
                                                selected
                                                    ? 'bg-[#1B3150] text-white border-[#1B3150]'
                                                    : 'bg-white text-[#1B3150] border-gray-300 hover:bg-[#1B3150]/5'
                                            }`}
                                        >
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="shrink-0 w-20 sm:w-24 text-xs sm:text-sm font-semibold text-gray-600">Points</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={pointsInput}
                                onChange={(e) => setPointsInput((e.target.value ?? '').replace(/\D/g, '').slice(0, 6))}
                                placeholder="Points"
                                className="flex-1 min-w-[100px] min-h-[44px] h-11 sm:h-12 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800"
                            />
                            <button
                                type="button"
                                onClick={clearPointsOnly}
                                className="min-h-[44px] h-11 px-4 rounded-lg text-xs sm:text-sm font-semibold border-2 border-[#1B3150]/30 text-[#1B3150] bg-white hover:bg-[#1B3150]/5 active:scale-[0.98] transition-all shrink-0"
                            >
                                Clear
                            </button>
                        </div>
                        <div>
                            <div className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2">Quick Points</div>
                            <div className="grid grid-cols-5 gap-2">
                                {QUICK_POINTS.map((pts) => {
                                    const selected = String(pointsInput || '') === String(pts);
                                    return (
                                        <button
                                            key={pts}
                                            type="button"
                                            onClick={() => setPointsInput(String(pts))}
                                            className={`min-h-[36px] h-9 rounded-md text-xs sm:text-sm font-semibold border transition-all active:scale-[0.98] ${
                                                selected
                                                    ? 'bg-[#1B3150] text-white border-[#1B3150]'
                                                    : 'bg-white text-[#1B3150] border-gray-300 hover:bg-[#1B3150]/5'
                                            }`}
                                        >
                                            {pts}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddRow}
                            className="w-full min-h-[48px] py-3.5 rounded-lg bg-[#1B3150] text-white font-bold text-base"
                        >
                            Add to list
                        </button>
                    </div>

                    <div className="w-full md:w-1/2 flex-1 min-w-0 rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-[200px] sm:min-h-[260px] bg-white">
                        <div className="grid grid-cols-[1fr_64px_52px_44px] gap-1 sm:gap-2 bg-[#1B3150] text-white font-bold text-[10px] sm:text-xs py-2.5 px-1 sm:px-2">
                            <div className="text-center">Selection</div>
                            <div className="text-center">Pt</div>
                            <div className="text-center">Type</div>
                            <div className="text-center">Del</div>
                        </div>
                        <div className="max-h-[240px] sm:max-h-[280px] overflow-y-auto flex-1 bg-white">
                            {generatedRows.length === 0 ? (
                                <div className="py-6 text-center text-gray-400 text-sm">Add chart + digit + points</div>
                            ) : (
                                generatedRows.map((row) => (
                                    <div key={row.id} className="grid grid-cols-[1fr_64px_52px_44px] gap-1 sm:gap-2 items-center py-2.5 px-1 sm:px-2 border-b border-gray-200 min-h-[44px]">
                                        <div className="text-center font-bold text-gray-800 text-[10px] sm:text-xs break-all px-0.5">{row.display}</div>
                                        <div className="px-0.5 min-w-0">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={row.points}
                                                onChange={(e) => updatePoint(row.id, e.target.value)}
                                                className="w-full min-h-[36px] h-8 sm:h-9 border border-gray-300 rounded-md px-1 text-center text-xs sm:text-sm font-semibold text-gray-800"
                                            />
                                        </div>
                                        <div className="text-center text-[10px] sm:text-xs font-bold text-[#1B3150]">Single</div>
                                        <button
                                            type="button"
                                            onClick={() => removeRow(row.id)}
                                            className="min-h-[40px] h-9 flex items-center justify-center rounded-md bg-red-50/80 text-red-600"
                                            aria-label="Delete"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-3 mb-1 flex items-center gap-6 text-[#1B3150]">
                    <div className="text-center">
                        <div className="text-[11px] text-gray-500">Count</div>
                        <div className="text-2xl leading-none font-bold">{bidsCount}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[11px] text-gray-500">Bet Amount</div>
                        <div className="text-2xl leading-none font-bold">{totalPoints}</div>
                    </div>
                </div>
                <div className={`flex flex-col gap-2 ${embedInSingleScroll ? 'mt-2' : 'mt-4'}`}>
                    <button type="button" onClick={clearLocal} className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-[#1B3150]/30 text-[#1B3150] bg-white hover:bg-[#1B3150]/5 active:scale-[0.98] transition-all">
                        Clear all
                    </button>
                    <button type="button" onClick={handleAddToCart} disabled={!bidsCount} className={`w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[52px] rounded-lg shadow-lg hover:bg-[#152842] transition-all active:scale-[0.98] ${!bidsCount ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        Add to Cart {bidsCount > 0 && `(${bidsCount})`}
                    </button>
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default ChartBid;
