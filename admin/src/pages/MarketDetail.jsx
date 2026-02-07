import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaArrowLeft, FaClock, FaHashtag, FaChartBar, FaEdit } from 'react-icons/fa';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';

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

/** Format "10:15" or "10:15:00" for display */
const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] ? String(parseInt(parts[1], 10)).padStart(2, '0') : '00';
    return `${Number.isFinite(h) ? h : ''}:${m}`;
};

const formatNum = (n) => (n != null && Number.isFinite(n) ? Number(n).toLocaleString('en-IN') : '0');

/** Card container matching AddResult/UpdateRate style */
const SectionCard = ({ title, children, className = '' }) => (
    <div className={`rounded-xl border border-gray-700 bg-gray-800/80 shadow-lg overflow-hidden ${className}`}>
        <h2 className="text-base sm:text-lg font-bold text-yellow-500 bg-gray-800/90 px-4 py-3 border-b border-gray-700">
            {title}
        </h2>
        <div className="p-3 sm:p-4">{children}</div>
    </div>
);

/** Stat table: dark theme, same as admin tables */
const StatTable = ({ title, rowLabel1, rowLabel2, columns, getAmount, getCount, totalAmount, totalBets }) => (
    <SectionCard title={title}>
        <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-gray-700/70 border-b border-gray-600">
                        <th className="text-left py-2.5 px-3 font-semibold text-yellow-500">{rowLabel1}</th>
                        {columns.map((c) => (
                            <th key={c} className="py-2.5 px-2 text-center font-semibold text-gray-300">{c}</th>
                        ))}
                        <th className="py-2.5 px-3 text-center font-semibold text-yellow-500">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b border-gray-700">
                        <td className="py-2 px-3 font-medium text-gray-300">{rowLabel2}</td>
                        {columns.map((c) => (
                            <td key={c} className="py-2 px-2 text-center text-white font-mono text-xs sm:text-sm">
                                {getAmount(c)}
                            </td>
                        ))}
                        <td className="py-2 px-3 text-center font-semibold text-amber-400">{formatNum(totalAmount)}</td>
                    </tr>
                    <tr className="bg-gray-700/30">
                        <td className="py-2 px-3 font-medium text-gray-400">No. of Bets</td>
                        {columns.map((c) => (
                            <td key={c} className="py-2 px-2 text-center text-gray-300">
                                {getCount(c)}
                            </td>
                        ))}
                        <td className="py-2 px-3 text-center font-semibold text-gray-200">{formatNum(totalBets)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </SectionCard>
);

/**
 * Single Patti: same as user side — grouped by Ank (last digit of sum of 3 digits).
 * User app shows panels 0–9; each panel lists pattis where (d1+d2+d3)%10 = that digit.
 */
const isSinglePatti = (patti) => {
    const s = String(patti ?? '').trim();
    if (s.length !== 3 || !/^\d{3}$/.test(s)) return false;
    const a = s[0], b = s[1], c = s[2];
    return a !== b && b !== c && a !== c;
};

/** Ank = (d1+d2+d3) % 10 — same as user-side grouping */
const getAnk = (patti) => {
    const s = String(patti).trim();
    if (s.length !== 3 || !/^\d{3}$/.test(s)) return null;
    return (Number(s[0]) + Number(s[1]) + Number(s[2])) % 10;
};

/** Same Single Panna list by sum digit (0–9) as user side (SinglePanaBulkBid) */
const SINGLE_PANA_BY_ANK = {
    '0': ['127', '136', '145', '190', '235', '280', '370', '389', '460', '479', '569', '578'],
    '1': ['128', '137', '146', '236', '245', '290', '380', '470', '489', '560', '579', '678'],
    '2': ['129', '138', '147', '156', '237', '246', '345', '390', '480', '570', '589', '679'],
    '3': ['120', '139', '148', '157', '238', '247', '256', '346', '490', '580', '670', '689'],
    '4': ['130', '149', '158', '167', '239', '248', '257', '347', '356', '590', '680', '789'],
    '5': ['140', '159', '168', '230', '249', '258', '267', '348', '357', '456', '690', '780'],
    '6': ['123', '150', '169', '178', '240', '259', '268', '349', '358', '367', '457', '790'],
    '7': ['124', '133', '142', '151', '160', '179', '250', '278', '340', '359', '467', '890'],
    '8': ['125', '134', '170', '189', '260', '279', '350', '369', '378', '459', '468', '567'],
    '9': ['126', '135', '180', '234', '270', '289', '360', '379', '450', '469', '478', '568'],
};

/**
 * Build Ank-grouped data (0–9) from API items. Each group has same patti list as user side + amount/count from bets.
 */
const buildSinglePattiByAnk = (items = {}) => {
    const byAnk = {};
    for (let a = 0; a <= 9; a++) {
        const key = String(a);
        byAnk[key] = { pattis: (SINGLE_PANA_BY_ANK[key] || []).map((p) => ({ patti: p, amount: 0, count: 0 })), totalAmount: 0, totalBets: 0 };
    }
    for (const [patti, v] of Object.entries(items)) {
        const pattiStr = String(patti ?? '').trim();
        if (pattiStr.length !== 3 || !/^\d{3}$/.test(pattiStr)) continue;
        const ank = getAnk(pattiStr);
        if (ank === null) continue;
        const key = String(ank);
        if (!byAnk[key]) byAnk[key] = { pattis: [], totalAmount: 0, totalBets: 0 };
        const amt = Number(v?.amount) || 0;
        const cnt = Number(v?.count) || 0;
        const row = byAnk[key].pattis.find((r) => r.patti === pattiStr);
        if (row) {
            row.amount = amt;
            row.count = cnt;
        } else {
            byAnk[key].pattis.push({ patti: pattiStr, amount: amt, count: cnt });
        }
        byAnk[key].totalAmount += amt;
        byAnk[key].totalBets += cnt;
    }
    return byAnk;
};

const getSinglePattiTotalsFromByAnk = (byAnk) => {
    let totalAmount = 0, totalBets = 0;
    for (const key of Object.keys(byAnk || {})) {
        totalAmount += byAnk[key].totalAmount ?? 0;
        totalBets += byAnk[key].totalBets ?? 0;
    }
    return { totalAmount, totalBets };
};

/**
 * Double Patti: same as user side — grouped by Ank (sum of digits % 10).
 * Valid = 3-digit with exactly two same digits (consecutive). Same rules as DoublePanaBulkBid.
 */
const isDoublePatti = (patti) => {
    const str = String(patti ?? '').trim();
    if (!/^[0-9]{3}$/.test(str)) return false;
    const [first, second, third] = str.split('').map(Number);
    const hasConsecutiveSame = first === second || second === third;
    if (!hasConsecutiveSame) return false;
    if (first === 0) return false;
    if (second === 0 && third === 0) return true;
    if (first === second && third === 0) return true;
    if (third <= first) return false;
    return true;
};

/** Build list of all valid Double Panna, then group by Ank (same as DoublePanaBulkBid) */
const buildDoublePanaByAnk = () => {
    const valid = [];
    for (let i = 0; i <= 999; i++) {
        const str = String(i).padStart(3, '0');
        if (isDoublePatti(str)) valid.push(str);
    }
    const byAnk = {};
    for (let d = 0; d <= 9; d++) byAnk[String(d)] = [];
    valid.forEach((p) => {
        const ank = getAnk(p);
        if (ank !== null) byAnk[String(ank)].push(p);
    });
    return byAnk;
};

const DOUBLE_PANA_BY_ANK = buildDoublePanaByAnk();

const buildDoublePattiByAnk = (items = {}) => {
    const byAnk = {};
    for (let a = 0; a <= 9; a++) {
        const key = String(a);
        byAnk[key] = { pattis: (DOUBLE_PANA_BY_ANK[key] || []).map((p) => ({ patti: p, amount: 0, count: 0 })), totalAmount: 0, totalBets: 0 };
    }
    for (const [patti, v] of Object.entries(items)) {
        const pattiStr = String(patti ?? '').trim();
        if (pattiStr.length !== 3 || !/^\d{3}$/.test(pattiStr)) continue;
        const ank = getAnk(pattiStr);
        if (ank === null) continue;
        const key = String(ank);
        if (!byAnk[key]) byAnk[key] = { pattis: [], totalAmount: 0, totalBets: 0 };
        const amt = Number(v?.amount) || 0;
        const cnt = Number(v?.count) || 0;
        const row = byAnk[key].pattis.find((r) => r.patti === pattiStr);
        if (row) {
            row.amount = amt;
            row.count = cnt;
        } else {
            byAnk[key].pattis.push({ patti: pattiStr, amount: amt, count: cnt });
        }
        byAnk[key].totalAmount += amt;
        byAnk[key].totalBets += cnt;
    }
    return byAnk;
};

const getDoublePattiTotalsFromByAnk = (byAnk) => {
    let totalAmount = 0, totalBets = 0;
    for (const key of Object.keys(byAnk || {})) {
        totalAmount += byAnk[key].totalAmount ?? 0;
        totalBets += byAnk[key].totalBets ?? 0;
    }
    return { totalAmount, totalBets };
};

/** Parse Half Sangam key "156-6" or "6-156" into human-readable label */
const getHalfSangamLabel = (key) => {
    const parts = String(key || '').split('-').map((p) => (p || '').trim());
    const first = parts[0] || '';
    const second = parts[1] || '';
    if (/^[0-9]{3}$/.test(first) && /^[0-9]$/.test(second)) {
        return `Open Pana ${first} · Close Ank ${second}`;
    }
    if (/^[0-9]$/.test(first) && /^[0-9]{3}$/.test(second)) {
        return `Open Ank ${first} · Close Pana ${second}`;
    }
    return key;
};

/** Parse Full Sangam key "123-456" into human-readable label */
const getFullSangamLabel = (key) => {
    const parts = String(key || '').split('-').map((p) => (p || '').trim());
    const open3 = parts[0] || '';
    const close3 = parts[1] || '';
    if (/^[0-9]{3}$/.test(open3) && /^[0-9]{3}$/.test(close3)) {
        return `Open ${open3} · Close ${close3}`;
    }
    return key;
};

/** Build Half Sangam Format A matrix: Open Pana (rows) × Close Ank 0-9 (cols) */
const buildHalfSangamFormatAMatrix = (items) => {
    const openPanas = [];
    const grid = {};
    DIGITS.forEach((ank) => { grid[ank] = {}; });
    for (const [key, v] of Object.entries(items)) {
        const parts = key.split('-').map((p) => (p || '').trim());
        const a = parts[0] || '';
        const b = parts[1] || '';
        if (/^[0-9]{3}$/.test(a) && /^[0-9]$/.test(b)) {
            if (!grid[b][a]) grid[b][a] = { amount: 0, count: 0 };
            grid[b][a].amount += v.amount ?? 0;
            grid[b][a].count += v.count ?? 0;
            if (!openPanas.includes(a)) openPanas.push(a);
        }
    }
    openPanas.sort();
    return { openPanas, grid };
};

/** Half Sangam section: explainer + matrix (Format A) + table */
const HalfSangamSection = ({ items = {}, totalAmount = 0, totalBets = 0 }) => {
    const entries = Object.entries(items).sort(([a], [b]) => String(a).localeCompare(b));
    const formatA = buildHalfSangamFormatAMatrix(items);
    const hasFormatA = formatA.openPanas.length > 0;
    return (
        <SectionCard title="Half Sangam">
            <div className="mb-4 p-3 sm:p-4 rounded-lg bg-gray-700/50 border border-gray-600">
                <p className="text-sm font-semibold text-yellow-500 mb-1">What is Half Sangam?</p>
                <p className="text-gray-300 text-sm leading-relaxed">
                    Half Sangam = <strong className="text-white">one 3-digit Pana + one 1-digit Ank</strong> from Open and Close (Open Pana × Close Ank), e.g. <span className="font-mono">156-6</span>.
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-700">
                <span className="text-gray-400 text-sm">Total Amount:</span>
                <span className="font-mono font-semibold text-amber-400">₹{formatNum(totalAmount)}</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400 text-sm">No. of Bets:</span>
                <span className="font-semibold text-white">{formatNum(totalBets)}</span>
            </div>
            {entries.length === 0 ? (
                <p className="text-gray-500 text-sm">No bets in this category</p>
            ) : (
                <>
                    {hasFormatA && (
                        <div className="mb-6">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Format A — Open Pana × Close Ank</p>
                            <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-800">
                                <table className="w-full text-sm border-collapse min-w-[320px]">
                                    <thead>
                                        <tr className="bg-gray-700/80 border-b-2 border-gray-600">
                                            <th className="py-2 px-2 text-center font-semibold text-yellow-500 border-r-2 border-gray-600 bg-gray-700/90 w-14">Open Pana ↓</th>
                                            {DIGITS.map((d) => (
                                                <th key={d} className="py-2 px-1.5 text-center font-bold text-yellow-500 border-r border-gray-600 min-w-[3.5rem]" title={`Close Ank ${d}`}>{d}</th>
                                            ))}
                                            <th className="py-2 px-2 text-center font-semibold text-amber-400 bg-amber-500/10 border-l-2 min-w-[4rem]">Row total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formatA.openPanas.map((pana) => {
                                            const rowTotal = DIGITS.reduce((sum, d) => sum + (formatA.grid[d][pana]?.amount ?? 0), 0);
                                            const rowBets = DIGITS.reduce((sum, d) => sum + (formatA.grid[d][pana]?.count ?? 0), 0);
                                            return (
                                                <tr key={pana} className="border-b border-gray-700 hover:bg-gray-700/25">
                                                    <td className="py-1.5 px-2 text-center font-bold text-amber-400 border-r-2 border-gray-600 bg-gray-700/50 font-mono text-xs">{pana}</td>
                                                    {DIGITS.map((d) => {
                                                        const cell = formatA.grid[d][pana];
                                                        return (
                                                            <td key={d} className="p-1 border-r border-gray-700 text-center">
                                                                <div className="rounded bg-gray-700/40 border border-gray-600 px-1.5 py-1 min-h-[2.5rem] flex flex-col items-center justify-center gap-0">
                                                                    <span className="font-mono text-amber-400 text-xs font-semibold">₹{formatNum(cell?.amount)}</span>
                                                                    <span className="font-mono text-gray-400 text-[10px]">{cell?.count ?? 0}</span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-1.5 bg-amber-500/5 border-l-2 border-amber-500/20 text-center">
                                                        <span className="font-mono text-amber-400 text-xs font-semibold">₹{formatNum(rowTotal)}</span>
                                                        <span className="block font-mono text-gray-400 text-[10px]">{formatNum(rowBets)}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mb-2">List view</p>
                    <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800">
                        <table className="w-full text-sm border-collapse min-w-[320px]">
                            <thead>
                                <tr className="bg-gray-700/70 border-b border-gray-600">
                                    <th className="text-left py-2.5 px-3 font-semibold text-yellow-500">Option</th>
                                    <th className="text-right py-2.5 px-3 font-semibold text-gray-300">Amount (₹)</th>
                                    <th className="text-right py-2.5 px-3 font-semibold text-gray-300">No. of Bets</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(([key, v]) => (
                                    <tr key={key} className="border-b border-gray-700 hover:bg-gray-700/30">
                                        <td className="py-2 px-3 text-gray-200 font-mono text-xs sm:text-sm" title={key}>
                                            {getHalfSangamLabel(key)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-amber-400 font-semibold">₹{formatNum(v.amount)}</td>
                                        <td className="py-2 px-3 text-right text-gray-300">{formatNum(v.count || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </SectionCard>
    );
};

/** Build Full Sangam matrix: Open Pana (rows) × Close Pana (columns) */
const buildFullSangamMatrix = (items) => {
    const openPanas = [];
    const closePanas = [];
    const grid = {};
    for (const [key, v] of Object.entries(items)) {
        const parts = key.split('-').map((p) => (p || '').trim());
        const open3 = parts[0] || '';
        const close3 = parts[1] || '';
        if (/^[0-9]{3}$/.test(open3) && /^[0-9]{3}$/.test(close3)) {
            if (!grid[open3]) grid[open3] = {};
            if (!grid[open3][close3]) grid[open3][close3] = { amount: 0, count: 0 };
            grid[open3][close3].amount += v.amount ?? 0;
            grid[open3][close3].count += v.count ?? 0;
            if (!openPanas.includes(open3)) openPanas.push(open3);
            if (!closePanas.includes(close3)) closePanas.push(close3);
        }
    }
    openPanas.sort();
    closePanas.sort();
    return { openPanas, closePanas, grid };
};

/** Full Sangam section: explainer + matrix (Open × Close) + table */
const FullSangamSection = ({ items = {}, totalAmount = 0, totalBets = 0 }) => {
    const entries = Object.entries(items).sort(([a], [b]) => String(a).localeCompare(b));
    const { openPanas, closePanas, grid } = buildFullSangamMatrix(items);
    const hasMatrix = openPanas.length > 0 && closePanas.length > 0;
    return (
        <SectionCard title="Full Sangam">
            <div className="mb-4 p-3 sm:p-4 rounded-lg bg-gray-700/50 border border-gray-600">
                <p className="text-sm font-semibold text-yellow-500 mb-1">What is Full Sangam?</p>
                <p className="text-gray-300 text-sm leading-relaxed">
                    Full Sangam = exact <strong className="text-white">Open Pana (3 digits) + Close Pana (3 digits)</strong>. E.g. Open 123, Close 456 → bet <span className="font-mono text-amber-400">123-456</span>.
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-700">
                <span className="text-gray-400 text-sm">Total Amount:</span>
                <span className="font-mono font-semibold text-amber-400">₹{formatNum(totalAmount)}</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400 text-sm">No. of Bets:</span>
                <span className="font-semibold text-white">{formatNum(totalBets)}</span>
            </div>
            {entries.length === 0 ? (
                <p className="text-gray-500 text-sm">No bets in this category</p>
            ) : (
                <>
                    {hasMatrix && (
                        <div className="mb-6">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Matrix — Open Pana (row) × Close Pana (column)</p>
                            <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-800">
                                <table className="w-full text-sm border-collapse min-w-[320px]">
                                    <thead>
                                        <tr className="bg-gray-700/80 border-b-2 border-gray-600">
                                            <th className="py-2 px-2 text-center font-semibold text-yellow-500 border-r-2 border-gray-600 bg-gray-700/90 w-14">Open Pana ↓</th>
                                            {closePanas.map((pana) => (
                                                <th key={pana} className="py-2 px-1.5 text-center font-bold text-yellow-500 border-r border-gray-600 min-w-[3.5rem] font-mono text-xs" title={`Close Pana ${pana}`}>{pana}</th>
                                            ))}
                                            <th className="py-2 px-2 text-center font-semibold text-amber-400 bg-amber-500/10 border-l-2 min-w-[4rem]">Row total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {openPanas.map((openPana) => {
                                            const rowTotal = closePanas.reduce((sum, closePana) => sum + (grid[openPana]?.[closePana]?.amount ?? 0), 0);
                                            const rowBets = closePanas.reduce((sum, closePana) => sum + (grid[openPana]?.[closePana]?.count ?? 0), 0);
                                            return (
                                                <tr key={openPana} className="border-b border-gray-700 hover:bg-gray-700/25">
                                                    <td className="py-1.5 px-2 text-center font-bold text-amber-400 border-r-2 border-gray-600 bg-gray-700/50 font-mono text-xs">{openPana}</td>
                                                    {closePanas.map((closePana) => {
                                                        const cell = grid[openPana]?.[closePana];
                                                        return (
                                                            <td key={closePana} className="p-1 border-r border-gray-700 text-center">
                                                                <div className="rounded bg-gray-700/40 border border-gray-600 px-1.5 py-1 min-h-[2.5rem] flex flex-col items-center justify-center gap-0">
                                                                    <span className="font-mono text-amber-400 text-xs font-semibold">₹{formatNum(cell?.amount)}</span>
                                                                    <span className="font-mono text-gray-400 text-[10px]">{cell?.count ?? 0}</span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-1.5 bg-amber-500/5 border-l-2 border-amber-500/20 text-center">
                                                        <span className="font-mono text-amber-400 text-xs font-semibold">₹{formatNum(rowTotal)}</span>
                                                        <span className="block font-mono text-gray-400 text-[10px]">{formatNum(rowBets)}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-700/70 font-semibold border-t-2 border-gray-600">
                                            <td className="py-2 px-2 text-center border-r-2 border-gray-600 bg-gray-700/80 text-gray-400 text-xs">All</td>
                                            {closePanas.map((closePana) => {
                                                const colTotal = openPanas.reduce((sum, openPana) => sum + (grid[openPana]?.[closePana]?.amount ?? 0), 0);
                                                const colBets = openPanas.reduce((sum, openPana) => sum + (grid[openPana]?.[closePana]?.count ?? 0), 0);
                                                return (
                                                    <td key={closePana} className="p-1.5 border-r border-gray-600 text-center bg-amber-500/5">
                                                        <span className="font-mono text-amber-400 text-xs font-semibold">₹{formatNum(colTotal)}</span>
                                                        <span className="block font-mono text-gray-400 text-[10px]">{formatNum(colBets)}</span>
                                                    </td>
                                                );
                                            })}
                                            <td className="py-2 px-2 text-center border-l-2 border-amber-500/30 bg-amber-500/10">
                                                <span className="font-mono text-amber-400 text-xs font-bold">₹{formatNum(totalAmount)}</span>
                                                <span className="block font-mono text-white text-[10px] font-semibold">{formatNum(totalBets)}</span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <p className="text-gray-500 text-xs mt-2 text-center">
                                Row = Open Pana, Column = Close Pana. Total: ₹{formatNum(totalAmount)} · {formatNum(totalBets)} bets
                            </p>
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mb-2">List view</p>
                    <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800">
                        <table className="w-full text-sm border-collapse min-w-[320px]">
                            <thead>
                                <tr className="bg-gray-700/70 border-b border-gray-600">
                                    <th className="text-left py-2.5 px-3 font-semibold text-yellow-500">Option (Open · Close)</th>
                                    <th className="text-right py-2.5 px-3 font-semibold text-gray-300">Amount (₹)</th>
                                    <th className="text-right py-2.5 px-3 font-semibold text-gray-300">No. of Bets</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(([key, v]) => (
                                    <tr key={key} className="border-b border-gray-700 hover:bg-gray-700/30">
                                        <td className="py-2 px-3 text-gray-200 font-mono text-xs sm:text-sm" title={key}>
                                            {getFullSangamLabel(key)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-amber-400 font-semibold">₹{formatNum(v.amount)}</td>
                                        <td className="py-2 px-3 text-right text-gray-300">{formatNum(v.count || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </SectionCard>
    );
};

const MarketDetail = () => {
    const { marketId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [singlePattiSummary, setSinglePattiSummary] = useState(null);
    /** 'open' | 'closed' – view only open bets or only closed bets */
    const [statusView, setStatusView] = useState('open');
    const initialStatusSetForMarketId = React.useRef(null);

    const fetchStats = async () => {
        if (!marketId) return;
        const headers = getAuthHeaders();
        setLoading(true);
        setError('');
        setSinglePattiSummary(null);
        try {
            const [statsRes, summaryRes] = await Promise.all([
                fetch(`${API_BASE_URL}/markets/get-market-stats/${marketId}`, { headers }),
                fetch(`${API_BASE_URL}/markets/get-single-patti-summary/${marketId}`, { headers }),
            ]);
            const statsJson = await statsRes.json();
            if (!statsJson.success) {
                setError(statsJson.message || 'Failed to load market detail');
                setLoading(false);
                return;
            }
            setData(statsJson.data);
            const d = statsJson.data;
            const hasOpenDeclared = d?.market?.openingNumber && /^\d{3}$/.test(String(d.market.openingNumber));
            if (initialStatusSetForMarketId.current !== marketId) {
                initialStatusSetForMarketId.current = marketId;
            }
            setStatusView(hasOpenDeclared ? 'closed' : 'open');
            if (summaryRes.ok) {
                const summaryJson = await summaryRes.json();
                if (summaryJson.success && summaryJson.data) {
                    setSinglePattiSummary(summaryJson.data);
                } else {
                    setSinglePattiSummary(null);
                }
            } else {
                setSinglePattiSummary(null);
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchStats();
    }, [marketId, navigate]);

    useRefreshOnMarketReset(fetchStats);

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    // Single Patti: grouped by Ank (0–9), same as user side
    const singlePattiByAnk = useMemo(() => buildSinglePattiByAnk(data?.singlePatti?.items), [data?.singlePatti?.items]);
    const singlePattiTotals = useMemo(() => getSinglePattiTotalsFromByAnk(singlePattiByAnk), [singlePattiByAnk]);
    // Double Patti: grouped by Ank (0–9), same as user side
    const doublePattiByAnk = useMemo(() => buildDoublePattiByAnk(data?.doublePatti?.items), [data?.doublePatti?.items]);
    const doublePattiTotals = useMemo(() => getDoublePattiTotalsFromByAnk(doublePattiByAnk), [doublePattiByAnk]);

    // Session-aware view stats (new API returns bySession.open/close; fallback to overall stats).
    const statsOpen = data?.bySession?.open || data;
    const statsClose = data?.bySession?.close || data;
    const viewStats = statusView === 'open' ? statsOpen : statsClose;

    const viewSinglePattiItems = viewStats?.singlePatti?.items || {};
    const viewDoublePattiItems = viewStats?.doublePatti?.items || {};

    // View-dependent data (Open/Closed): build same user-side grouping, but from view session items
    const singlePattiByAnkForView = useMemo(() => buildSinglePattiByAnk(viewSinglePattiItems), [viewSinglePattiItems]);
    const singlePattiTotalsForView = useMemo(() => getSinglePattiTotalsFromByAnk(singlePattiByAnkForView), [singlePattiByAnkForView]);
    const doublePattiByAnkForView = useMemo(() => buildDoublePattiByAnk(viewDoublePattiItems), [viewDoublePattiItems]);
    const doublePattiTotalsForView = useMemo(() => getDoublePattiTotalsFromByAnk(doublePattiByAnkForView), [doublePattiByAnkForView]);

    // Sanity check: Ank grouping matches user side
    useEffect(() => {
        if (import.meta.env?.DEV) {
            const a127 = getAnk('127');
            const a128 = getAnk('128');
            if (a127 === 0 && a128 === 1) {
                console.debug('[Single Patti] Ank grouping OK (127→0, 128→1).');
            } else {
                console.warn('[Single Patti] Ank check failed:', { a127, a128 });
            }
        }
    }, []);

    if (loading) {
        return (
            <AdminLayout onLogout={handleLogout} title="Market Detail">
                <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-600 border-t-yellow-500" />
                </div>
            </AdminLayout>
        );
    }

    if (error || !data) {
        return (
            <AdminLayout onLogout={handleLogout} title="Market Detail">
                <div className="rounded-xl border border-red-700/60 bg-red-900/20 p-4 text-red-200">
                    {error || 'Market not found'}
                </div>
                <Link
                    to="/markets"
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold transition-colors"
                >
                    <FaArrowLeft /> Back to Markets
                </Link>
            </AdminLayout>
        );
    }

    const {
        market,
        singleDigit = { digits: {}, totalAmount: 0, totalBets: 0 },
        jodi = { items: {}, totalAmount: 0, totalBets: 0 },
        singlePatti = { items: {}, totalAmount: 0, totalBets: 0 },
        doublePatti = { items: {}, totalAmount: 0, totalBets: 0 },
        triplePatti = { items: {}, totalAmount: 0, totalBets: 0 },
        halfSangam = { items: {}, totalAmount: 0, totalBets: 0 },
        fullSangam = { items: {}, totalAmount: 0, totalBets: 0 },
    } = data;

    const hasOpen = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
    const hasClose = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
    const isClosed = hasOpen && hasClose;
    const timeline = `${formatTime(market.startingTime)} – ${formatTime(market.closingTime)}`;
    const resultDisplay = market.displayResult || '***-**-***';

    const grandTotalAmount =
        (singleDigit?.totalAmount ?? 0) +
        (jodi?.totalAmount ?? 0) +
        (singlePattiTotals?.totalAmount ?? 0) +
        (doublePattiTotals?.totalAmount ?? 0) +
        (triplePatti?.totalAmount ?? 0) +
        (halfSangam?.totalAmount ?? 0) +
        (fullSangam?.totalAmount ?? 0);
    const grandTotalBets =
        (singleDigit?.totalBets ?? 0) +
        (jodi?.totalBets ?? 0) +
        (singlePattiTotals?.totalBets ?? 0) +
        (doublePattiTotals?.totalBets ?? 0) +
        (triplePatti?.totalBets ?? 0) +
        (halfSangam?.totalBets ?? 0) +
        (fullSangam?.totalBets ?? 0);

    // Section data by view (Open/Closed): show session-specific bets in all sections
    const singleDigitDisplay = viewStats?.singleDigit || { digits: {}, totalAmount: 0, totalBets: 0 };
    // Jodi + Full Sangam should show in both views, but are always "close" category.
    // Do NOT include them in Open totals (openTotalAmount/openTotalBets remain unchanged).
    const jodiDisplay = statsClose?.jodi || { items: {}, totalAmount: 0, totalBets: 0 };
    const triplePattiDisplay = viewStats?.triplePatti || { items: {}, totalAmount: 0, totalBets: 0 };
    const halfSangamDisplay = viewStats?.halfSangam || { items: {}, totalAmount: 0, totalBets: 0 };
    const fullSangamDisplay = statsClose?.fullSangam || { items: {}, totalAmount: 0, totalBets: 0 };

    // Open view: Single Digit, Single Patti, Double Patti, Triple Patti, Half Sangam
    const openTotalAmount =
        (singleDigitDisplay?.totalAmount ?? 0) +
        (singlePattiTotalsForView?.totalAmount ?? 0) +
        (doublePattiTotalsForView?.totalAmount ?? 0) +
        (triplePattiDisplay?.totalAmount ?? 0) +
        (halfSangamDisplay?.totalAmount ?? 0);
    const openTotalBets =
        (singleDigitDisplay?.totalBets ?? 0) +
        (singlePattiTotalsForView?.totalBets ?? 0) +
        (doublePattiTotalsForView?.totalBets ?? 0) +
        (triplePattiDisplay?.totalBets ?? 0) +
        (halfSangamDisplay?.totalBets ?? 0);
    // Closed view: show close bets totals in all key games (as requested)
    const closedTotalAmount =
        (singleDigitDisplay?.totalAmount ?? 0) +
        (jodiDisplay?.totalAmount ?? 0) +
        (singlePattiTotalsForView?.totalAmount ?? 0) +
        (doublePattiTotalsForView?.totalAmount ?? 0) +
        (triplePattiDisplay?.totalAmount ?? 0) +
        (fullSangamDisplay?.totalAmount ?? 0);
    const closedTotalBets =
        (singleDigitDisplay?.totalBets ?? 0) +
        (jodiDisplay?.totalBets ?? 0) +
        (singlePattiTotalsForView?.totalBets ?? 0) +
        (doublePattiTotalsForView?.totalBets ?? 0) +
        (triplePattiDisplay?.totalBets ?? 0) +
        (fullSangamDisplay?.totalBets ?? 0);
    const displayAmount = statusView === 'open' ? openTotalAmount : closedTotalAmount;
    const displayBets = statusView === 'open' ? openTotalBets : closedTotalBets;

    const handleStatusViewChange = (e) => {
        const v = e.target.value;
        if (v === 'open') setStatusView('open');
        else if (v === 'closed') setStatusView('closed');
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Market Detail">
            <div className="w-full min-w-0 px-0 sm:px-1 pb-6 sm:pb-8">
                <Link
                    to="/markets"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-yellow-500 text-sm mb-4 transition-colors"
                >
                    <FaArrowLeft className="w-4 h-4" /> Markets Management
                </Link>

                {/* Overview card – updates when Open/Closed view changes (key forces refresh) */}
                <div key={`overview-${statusView}`} className="rounded-xl border border-gray-700 bg-gray-800/80 shadow-xl overflow-hidden mb-6 sm:mb-8">
                    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
                        <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{market.marketName}</h1>
                        <p className="text-gray-400 text-sm mt-0.5">Market overview & result</p>
                    </div>
                    <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-700/80 flex items-center justify-center shrink-0">
                                <FaClock className="text-yellow-500 w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Timeline</p>
                                <p className="font-mono text-white text-sm sm:text-base">{timeline}</p>
                                <p className="text-xs text-gray-500">Opens 12:00 AM, closes at closing time</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-700/80 flex items-center justify-center shrink-0">
                                <FaHashtag className="text-yellow-500 w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Result</p>
                                <p className="font-mono text-amber-400 text-lg font-bold">{resultDisplay}</p>
                                <p className="text-xs text-gray-500">
                                    Open: {hasOpen ? market.openingNumber : '—'} · Close: {hasClose ? market.closingNumber : '—'}
                                </p>
                                <p className="text-[10px] text-amber-400/90 mt-0.5">
                                    Viewing totals: <strong>{statusView === 'open' ? 'Open' : 'Closed'}</strong> bets
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-700/80 flex items-center justify-center shrink-0">
                                <FaChartBar className="text-yellow-500 w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Total Bet Amount</p>
                                <p className="font-mono text-lg font-semibold text-white">₹{formatNum(displayAmount)}</p>
                                <p className="text-xs text-gray-500">{formatNum(displayBets)} bets</p>
                                <p className="text-[10px] text-gray-500">({statusView === 'open' ? 'Open bets only' : 'Closed bets only'})</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 w-full sm:w-auto">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">View</p>
                                <select
                                    value={statusView}
                                    onChange={handleStatusViewChange}
                                    aria-label="View open bets or closed bets"
                                    className="w-full sm:w-auto min-w-[140px] rounded-lg border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none cursor-pointer"
                                >
                                    <option value="open">Open bets only</option>
                                    <option value="closed">Closed bets only</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* All games shown in both views; section data updates by Open/Closed (other view = blank). */}
                <div key={`sections-${statusView}`} className="space-y-6">
                    <StatTable
                        title="Single Digit"
                        rowLabel1="Digit"
                        rowLabel2="Amount (₹)"
                        columns={DIGITS}
                        getAmount={(d) => formatNum(singleDigitDisplay.digits?.[d]?.amount)}
                        getCount={(d) => singleDigitDisplay.digits?.[d]?.count ?? 0}
                        totalAmount={singleDigitDisplay.totalAmount}
                        totalBets={singleDigitDisplay.totalBets}
                    />

                    <SectionCard title="Jodi">
                        <div className="mb-4 p-3 sm:p-4 rounded-lg bg-gray-700/50 border border-gray-600">
                            <p className="text-sm font-semibold text-yellow-500 mb-1">What is Jodi?</p>
                            <p className="text-gray-300 text-sm leading-relaxed">
                                Jodi = 2-digit number from <strong className="text-white">last digit of Open</strong> + <strong className="text-white">last digit of Close</strong>. E.g. Open 123, Close 456 → Jodi <span className="font-mono font-bold text-amber-400">36</span>.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                <span className="text-gray-400">How to read:</span>
                                <span className="text-amber-400 font-medium">1st digit = row (left column)</span>
                                <span className="text-gray-500">·</span>
                                <span className="text-amber-400 font-medium">2nd digit = column (top row)</span>
                                <span className="text-gray-500">·</span>
                                <span className="text-white">Jodi 36 = row 3, column 6</span>
                            </div>
                        </div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                            <span>2nd digit (column) →</span>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-800 -mx-1 sm:mx-0">
                            <table className="w-full text-sm border-collapse min-w-[320px] sm:min-w-[420px] md:min-w-[520px]">
                                <thead>
                                    <tr className="bg-gray-700/80 border-b-2 border-gray-600">
                                        <th className="py-2 px-2 text-center font-semibold text-yellow-500 border-r-2 border-gray-600 bg-gray-700/90 w-12" title="First digit of Jodi (0–9)">1st ↓</th>
                                        {DIGITS.map((d) => (
                                            <th key={d} className="py-2.5 px-2 text-center font-bold text-yellow-500 border-r border-gray-600 min-w-[4rem]" title={`2nd digit = ${d}`}>{d}</th>
                                        ))}
                                        <th className="py-2.5 px-3 text-center font-semibold text-amber-400 bg-amber-500/10 border-amber-500/30 border-l-2 min-w-[5rem]">Row total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {DIGITS.map((firstDigit) => {
                                        const rowTotal = DIGITS.reduce((sum, secondDigit) => sum + (jodiDisplay.items?.[firstDigit + secondDigit]?.amount ?? 0), 0);
                                        const rowBets = DIGITS.reduce((sum, secondDigit) => sum + (jodiDisplay.items?.[firstDigit + secondDigit]?.count ?? 0), 0);
                                        return (
                                            <tr key={firstDigit} className="border-b border-gray-700 hover:bg-gray-700/25">
                                                <td className="py-2 px-2 text-center font-bold text-amber-400 border-r-2 border-gray-600 bg-gray-700/50 align-middle w-12" title={`Row = 1st digit ${firstDigit}`}>
                                                    {firstDigit}
                                                </td>
                                                {DIGITS.map((secondDigit) => {
                                                    const jodiKey = firstDigit + secondDigit;
                                                    const item = jodiDisplay.items?.[jodiKey];
                                                    const amt = item?.amount ?? 0;
                                                    const cnt = item?.count ?? 0;
                                                    return (
                                                        <td key={jodiKey} className="p-1 sm:p-2 border-r border-gray-700 align-top">
                                                            <div className="rounded-lg bg-gray-700/40 border border-gray-600 p-1.5 sm:p-2 md:p-2.5 min-h-[3.75rem] sm:min-h-[4.25rem] md:min-h-[4.75rem] flex flex-col items-center justify-center gap-0.5 sm:gap-1 md:gap-1.5 text-center">
                                                                <span className="font-mono font-bold text-amber-400 text-xs sm:text-sm md:text-base" title={`Jodi ${jodiKey}`}>{jodiKey}</span>
                                                                <div className="w-full">
                                                                    <p className="hidden sm:block text-[10px] text-gray-500 uppercase tracking-wide">Amount</p>
                                                                    <p className="font-mono text-white text-[10px] sm:text-xs md:text-sm font-semibold">₹{formatNum(amt)}</p>
                                                                </div>
                                                                <div className="w-full border-t border-gray-600 pt-0.5 sm:pt-1">
                                                                    <p className="hidden sm:block text-[10px] text-gray-500 uppercase tracking-wide">No. of Bets</p>
                                                                    <p className="font-mono text-gray-300 text-[10px] sm:text-xs font-medium">{formatNum(cnt)}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-2 bg-amber-500/5 border-l-2 border-amber-500/20 align-top">
                                                    <div className="rounded-lg border border-amber-500/30 bg-gray-800/80 p-2 min-h-[4.25rem] flex flex-col justify-center text-center">
                                                        <p className="text-xs text-amber-400/90 font-semibold">Total Amt</p>
                                                        <p className="font-mono text-amber-400 font-bold text-sm">₹{formatNum(rowTotal)}</p>
                                                        <p className="text-xs text-gray-400 font-semibold mt-1">No of Bets</p>
                                                        <p className="font-mono text-white font-semibold text-sm">{formatNum(rowBets)}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-gray-700/70 font-semibold border-t-2 border-gray-600">
                                        <td className="py-2 px-2 text-center border-r-2 border-gray-600 bg-gray-700/80 text-gray-400 text-xs">All</td>
                                        {DIGITS.map((d) => (
                                            <td key={d} className="py-1 px-1 border-r border-gray-600" />
                                        ))}
                                        <td className="py-3 px-3 border-l-2 border-amber-500/30 bg-amber-500/10">
                                            <div className="text-center">
                                                <p className="text-xs text-amber-400 font-semibold">Total Amt</p>
                                                <p className="font-mono text-amber-400 font-bold text-base">₹{formatNum(jodiDisplay.totalAmount)}</p>
                                                <p className="text-xs text-gray-400 font-semibold mt-1">No of Bets</p>
                                                <p className="font-mono text-white font-bold text-base">{formatNum(jodiDisplay.totalBets)}</p>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-gray-500 text-xs mt-3 text-center">
                            <span className="text-gray-400">Row = 1st digit, Column = 2nd digit.</span> Total: ₹{formatNum(jodiDisplay.totalAmount)} · {formatNum(jodiDisplay.totalBets)} bets
                        </p>
                    </SectionCard>

                    <SectionCard title="Single Patti">
                        <div className="mb-4 p-3 sm:p-4 rounded-lg bg-gray-700/50 border border-gray-600 space-y-2">
                            <p className="text-sm font-semibold text-yellow-500">Same as user app</p>
                            <p className="text-gray-300 text-sm">
                                Grouped by <strong className="text-white">Ank</strong> (last digit of sum of 3 digits). E.g. 127 → 1+2+7=10 → Ank <span className="font-mono text-amber-400">0</span>. Panels 0–9 below match the user-side Single Panna layout.
                            </p>
                        </div>
                        {/* Summary by Ank (0–9), same order as user panels */}
                        {(() => {
                            let maxAnk = 0;
                            let maxAmt = 0;
                            DIGITS.forEach((d) => {
                                const a = singlePattiByAnkForView[d]?.totalAmount ?? 0;
                                if (a > maxAmt) { maxAmt = a; maxAnk = Number(d); }
                            });
                            return (
                                <div className="mb-4 overflow-x-auto rounded-xl border border-amber-500/30 bg-gray-800">
                                    <p className="text-xs text-gray-400 px-2 py-1.5">Total by Ank (0–9). Yellow = highest exposure.</p>
                                    <table className="w-full text-sm border-collapse min-w-[320px]">
                                        <thead>
                                            <tr className="bg-gray-700/80 border-b border-gray-600">
                                                {DIGITS.map((d) => (
                                                    <th key={d} className="py-2 px-1.5 text-center font-bold text-yellow-500 border-r border-gray-600 min-w-[2.5rem]">{d}</th>
                                                ))}
                                                <th className="py-2 px-2 text-center font-semibold text-amber-400 bg-amber-500/10 border-l-2 border-amber-500/30 min-w-[4rem]">#</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                {DIGITS.map((d) => {
                                                    const g = singlePattiByAnkForView[d] || { totalAmount: 0, totalBets: 0 };
                                                    const isMax = Number(d) === maxAnk;
                                                    return (
                                                        <td key={d} className={`p-2 border-r border-gray-700 text-center ${isMax ? 'bg-amber-500/25' : ''}`}>
                                                            <p className="font-mono text-white text-xs font-semibold">₹{formatNum(g.totalAmount)}</p>
                                                            <p className="font-mono text-gray-400 text-[10px]">{formatNum(g.totalBets)}</p>
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-2 px-2 text-center font-semibold bg-amber-500/10 border-l-2 border-amber-500/30">
                                                    <p className="font-mono text-amber-400 font-bold text-xs">₹{formatNum(singlePattiTotalsForView.totalAmount)}</p>
                                                    <p className="font-mono text-white text-[10px]">{formatNum(singlePattiTotalsForView.totalBets)}</p>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                        {/* 10 panels by Ank (0–9), same layout as user Single Panna */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {DIGITS.map((ank) => {
                                const group = singlePattiByAnkForView[ank] || { pattis: [], totalAmount: 0, totalBets: 0 };
                                return (
                                    <div key={ank} className="rounded-xl border border-gray-600 bg-gray-800/80 overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-2 bg-gray-700/80 border-b border-gray-600">
                                            <span className="font-bold text-amber-400 text-lg">{ank}</span>
                                            <span className="text-xs text-gray-400">₹{formatNum(group.totalAmount)} · {formatNum(group.totalBets)} bets</span>
                                        </div>
                                        <div className="p-2 grid grid-cols-2 gap-1.5">
                                            {group.pattis.map(({ patti, amount, count }) => (
                                                <div key={patti} className="flex items-center justify-between rounded bg-gray-700/50 border border-gray-600 px-2 py-1.5">
                                                    <span className="font-mono text-amber-400 font-semibold text-sm">{patti}</span>
                                                    <div className="text-right">
                                                        <p className="font-mono text-white text-[10px]">₹{formatNum(amount)}</p>
                                                        <p className="font-mono text-gray-400 text-[9px]">{formatNum(count)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-gray-500 text-xs mt-3 text-center">
                            Total Single Patti: ₹{formatNum(singlePattiTotalsForView.totalAmount)} · {formatNum(singlePattiTotalsForView.totalBets)} bets
                        </p>
                    </SectionCard>

                    <SectionCard title="Double Patti">
                        <div className="mb-4 p-3 sm:p-4 rounded-lg bg-gray-700/50 border border-gray-600 space-y-2">
                            <p className="text-sm font-semibold text-yellow-500">Same as user app</p>
                            <p className="text-gray-300 text-sm">
                                Grouped by <strong className="text-white">Ank</strong> (last digit of sum of 3 digits). Double Patti = 3-digit with <strong className="text-white">exactly two same digits</strong> (e.g. 112, 121, 233). Panels 0–9 match the user Double Pana layout.
                            </p>
                        </div>
                        {(() => {
                            let maxAnk = 0;
                            let maxAmt = 0;
                            DIGITS.forEach((d) => {
                                const a = doublePattiByAnkForView[d]?.totalAmount ?? 0;
                                if (a > maxAmt) { maxAmt = a; maxAnk = Number(d); }
                            });
                            return (
                                <div className="mb-4 overflow-x-auto rounded-xl border border-amber-500/30 bg-gray-800">
                                    <p className="text-xs text-gray-400 px-2 py-1.5">Total by Ank (0–9). Yellow = highest exposure.</p>
                                    <table className="w-full text-sm border-collapse min-w-[320px]">
                                        <thead>
                                            <tr className="bg-gray-700/80 border-b border-gray-600">
                                                {DIGITS.map((d) => (
                                                    <th key={d} className="py-2 px-1.5 text-center font-bold text-yellow-500 border-r border-gray-600 min-w-[2.5rem]">{d}</th>
                                                ))}
                                                <th className="py-2 px-2 text-center font-semibold text-amber-400 bg-amber-500/10 border-l-2 border-amber-500/30 min-w-[4rem]">#</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                {DIGITS.map((d) => {
                                                    const g = doublePattiByAnkForView[d] || { totalAmount: 0, totalBets: 0 };
                                                    const isMax = Number(d) === maxAnk;
                                                    return (
                                                        <td key={d} className={`p-2 border-r border-gray-700 text-center ${isMax ? 'bg-amber-500/25' : ''}`}>
                                                            <p className="font-mono text-white text-xs font-semibold">₹{formatNum(g.totalAmount)}</p>
                                                            <p className="font-mono text-gray-400 text-[10px]">{formatNum(g.totalBets)}</p>
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-2 px-2 text-center font-semibold bg-amber-500/10 border-l-2 border-amber-500/30">
                                                    <p className="font-mono text-amber-400 font-bold text-xs">₹{formatNum(doublePattiTotalsForView.totalAmount)}</p>
                                                    <p className="font-mono text-white text-[10px]">{formatNum(doublePattiTotalsForView.totalBets)}</p>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {DIGITS.map((ank) => {
                                const group = doublePattiByAnkForView[ank] || { pattis: [], totalAmount: 0, totalBets: 0 };
                                return (
                                    <div key={ank} className="rounded-xl border border-gray-600 bg-gray-800/80 overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-2 bg-gray-700/80 border-b border-gray-600">
                                            <span className="font-bold text-amber-400 text-lg">{ank}</span>
                                            <span className="text-xs text-gray-400">₹{formatNum(group.totalAmount)} · {formatNum(group.totalBets)} bets</span>
                                        </div>
                                        <div className="p-2 grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto">
                                            {group.pattis.map(({ patti, amount, count }) => (
                                                <div key={patti} className="flex items-center justify-between rounded bg-gray-700/50 border border-gray-600 px-2 py-1.5">
                                                    <span className="font-mono text-amber-400 font-semibold text-sm">{patti}</span>
                                                    <div className="text-right">
                                                        <p className="font-mono text-white text-[10px]">₹{formatNum(amount)}</p>
                                                        <p className="font-mono text-gray-400 text-[9px]">{formatNum(count)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-gray-500 text-xs mt-3 text-center">
                            Total Double Patti: ₹{formatNum(doublePattiTotalsForView.totalAmount)} · {formatNum(doublePattiTotalsForView.totalBets)} bets
                        </p>
                    </SectionCard>

                    <StatTable
                        title="Triple Patti"
                        rowLabel1="Patti"
                        rowLabel2="Amount (₹)"
                        columns={TRIPLE_PATTI_DIGITS}
                        getAmount={(d) => formatNum(triplePattiDisplay.items?.[d]?.amount)}
                        getCount={(d) => triplePattiDisplay.items?.[d]?.count ?? 0}
                        totalAmount={triplePattiDisplay.totalAmount}
                        totalBets={triplePattiDisplay.totalBets}
                    />

                    {statusView === 'open' && (
                        <HalfSangamSection
                            items={halfSangamDisplay.items}
                            totalAmount={halfSangamDisplay.totalAmount}
                            totalBets={halfSangamDisplay.totalBets}
                        />
                    )}
                    <FullSangamSection
                        items={fullSangamDisplay.items}
                        totalAmount={fullSangamDisplay.totalAmount}
                        totalBets={fullSangamDisplay.totalBets}
                    />
                </div>

                <div className="mt-8 pt-4 border-t border-gray-700 flex flex-wrap items-center gap-3">
                    <Link
                        to="/markets"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold border border-gray-600 transition-colors"
                    >
                        <FaArrowLeft /> Back to Markets
                    </Link>
                    {market.marketType !== 'startline' && (
                        <Link
                            to="/add-result"
                            state={{ preselectedMarket: market }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold border border-amber-400 transition-colors"
                        >
                            <FaEdit /> Add Result for {market.marketName}
                        </Link>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};

export default MarketDetail;
