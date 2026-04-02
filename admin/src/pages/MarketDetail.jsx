import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaArrowLeft, FaClock, FaHashtag, FaChartBar, FaEdit } from 'react-icons/fa';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth } from '../lib/auth';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const TRIPLE_PATTI_DIGITS = DIGITS.map((d) => d + d + d);

/** Format "10:15" or "10:15:00" for display */
const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] ? String(parseInt(parts[1], 10)).padStart(2, '0') : '00';
    return `${Number.isFinite(h) ? h : ''}:${m}`;
};

const formatNum = (n) => (n != null && Number.isFinite(n) ? Number(n).toLocaleString('en-IN') : '0');

/** Merge two single-digit stat blocks (open + close sessions). */
const mergeSingleDigitBlocks = (a = {}, b = {}) => {
    const digits = {};
    const take = (src) => {
        const dg = (src && src.digits) || {};
        for (const k of Object.keys(dg)) {
            if (!digits[k]) digits[k] = { amount: 0, count: 0 };
            digits[k].amount += Number(dg[k]?.amount || 0);
            digits[k].count += Number(dg[k]?.count || 0);
        }
    };
    take(a);
    take(b);
    let totalAmount = 0;
    let totalBets = 0;
    Object.values(digits).forEach((x) => {
        totalAmount += x.amount;
        totalBets += x.count;
    });
    return { digits, totalAmount, totalBets };
};

/** Merge two { items: { key: { amount, count } } } stat blocks; recomputes totals. */
const mergeItemsBlocks = (a = {}, b = {}) => {
    const items = {};
    const take = (src) => {
        const it = (src && src.items) || {};
        for (const k of Object.keys(it)) {
            if (!items[k]) items[k] = { amount: 0, count: 0 };
            items[k].amount += Number(it[k]?.amount || 0);
            items[k].count += Number(it[k]?.count || 0);
        }
    };
    take(a);
    take(b);
    let totalAmount = 0;
    let totalBets = 0;
    Object.values(items).forEach((x) => {
        totalAmount += x.amount;
        totalBets += x.count;
    });
    return { items, totalAmount, totalBets };
};

/** Combined open + close session aggregates for “All bets” view. */
const mergeSessionStatsForView = (open, close) => {
    const o = open || {};
    const c = close || {};
    return {
        singleDigit: mergeSingleDigitBlocks(o.singleDigit, c.singleDigit),
        jodi: mergeItemsBlocks(o.jodi, c.jodi),
        singlePatti: mergeItemsBlocks(o.singlePatti, c.singlePatti),
        doublePatti: mergeItemsBlocks(o.doublePatti, c.doublePatti),
        triplePatti: mergeItemsBlocks(o.triplePatti, c.triplePatti),
        halfSangam: mergeItemsBlocks(o.halfSangam, c.halfSangam),
        fullSangam: mergeItemsBlocks(o.fullSangam, c.fullSangam),
    };
};

/** Display label for bet type (super admin panel) */
const getBetTypeLabel = (t) => ({ 'sp-motor': 'SP Motor', 'dp-motor': 'DP Motor', 'single': 'Single', 'jodi': 'Jodi', 'panna': 'Panna', 'half-sangam': 'Half Sangam', 'full-sangam': 'Full Sangam', 'odd-even': 'Odd Even', 'sp-common': 'SP Common', 'dp-common': 'DP Common' }[String(t || '').toLowerCase()] || (t ? String(t).toUpperCase() : 'N/A'));

/** Card container matching AddResult/UpdateRate style */
const SectionCard = ({ title, children, className = '' }) => (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden ${className}`}>
        <h2 className="text-base sm:text-lg font-bold text-orange-500 bg-white/90 px-4 py-3 border-b border-gray-200">
            {title}
        </h2>
        <div className="p-3 sm:p-4">{children}</div>
    </div>
);

/** Stat table: dark theme, same as admin tables */
const StatTable = ({ title, rowLabel1, rowLabel2, columns, getAmount, getCount, totalAmount, totalBets }) => (
    <SectionCard title={title}>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200">
                        <th className="text-left py-2.5 px-3 font-semibold text-orange-500">{rowLabel1}</th>
                        {columns.map((c) => (
                            <th key={c} className="py-2.5 px-2 text-center font-semibold text-gray-600">{c}</th>
                        ))}
                        <th className="py-2.5 px-3 text-center font-semibold text-orange-500">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b border-gray-200">
                        <td className="py-2 px-3 font-medium text-gray-600">{rowLabel2}</td>
                        {columns.map((c) => (
                            <td key={c} className="py-2 px-2 text-center text-gray-800 font-mono text-xs sm:text-sm">
                                {getAmount(c)}
                            </td>
                        ))}
                        <td className="py-2 px-3 text-center font-semibold text-orange-500">{formatNum(totalAmount)}</td>
                    </tr>
                    <tr className="bg-gray-100/30">
                        <td className="py-2 px-3 font-medium text-gray-400">No. of Bets</td>
                        {columns.map((c) => (
                            <td key={c} className="py-2 px-2 text-center text-gray-600">
                                {getCount(c)}
                            </td>
                        ))}
                        <td className="py-2 px-3 text-center font-semibold text-gray-700">{formatNum(totalBets)}</td>
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
    '7': ['124', '160', '179', '250', '269', '278', '340', '359', '368', '458', '467', '890'],
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

const ALL_SINGLE_PATTI_IN_CHART = new Set(DIGITS.flatMap((d) => SINGLE_PANA_BY_ANK[d] || []));
const ALL_DOUBLE_PATTI_IN_CHART = new Set(DIGITS.flatMap((d) => DOUBLE_PANA_BY_ANK[d] || []));

const cloneSinglePattiByAnk = (byAnk) => {
    const o = {};
    for (const d of DIGITS) {
        const g = byAnk[d] || { pattis: [], totalAmount: 0, totalBets: 0 };
        o[d] = {
            pattis: (g.pattis || []).map((r) => ({
                patti: r.patti,
                amount: Number(r.amount) || 0,
                count: Number(r.count) || 0,
            })),
            totalAmount: Number(g.totalAmount) || 0,
            totalBets: Number(g.totalBets) || 0,
        };
    }
    return o;
};

const cloneDoublePattiByAnk = (byAnk) => {
    const o = {};
    for (const d of DIGITS) {
        const g = byAnk[d] || { pattis: [], totalAmount: 0, totalBets: 0 };
        o[d] = {
            pattis: (g.pattis || []).map((r) => ({
                patti: r.patti,
                amount: Number(r.amount) || 0,
                count: Number(r.count) || 0,
            })),
            totalAmount: Number(g.totalAmount) || 0,
            totalBets: Number(g.totalBets) || 0,
        };
    }
    return o;
};

/** SP Common: 3-digit → that patti row; legacy 1-digit → every chart patti containing the digit (amount only on rows). */
const mergeSinglePattiWithSpCommonBets = (baseByAnk, bets = []) => {
    const merged = cloneSinglePattiByAnk(baseByAnk);
    for (const bet of bets) {
        if (String(bet?.betType || '').toLowerCase() !== 'sp-common') continue;
        const amt = Number(bet?.amount) || 0;
        if (!amt) continue;
        const raw = String(bet?.betNumber || '').trim();
        const digitsOnly = raw.replace(/\D/g, '');
        const p3 = digitsOnly.length >= 3 ? digitsOnly.slice(0, 3).padStart(3, '0') : '';

        if (/^[0-9]{3}$/.test(p3) && ALL_SINGLE_PATTI_IN_CHART.has(p3) && isSinglePatti(p3)) {
            const ank = String(getAnk(p3));
            const group = merged[ank];
            let row = group.pattis.find((r) => r.patti === p3);
            if (!row) {
                row = { patti: p3, amount: 0, count: 0 };
                group.pattis.push(row);
                group.pattis.sort((a, b) => String(a.patti).localeCompare(String(b.patti), undefined, { numeric: true }));
            }
            row.amount += amt;
            row.count += 1;
            continue;
        }
        if (/^[0-9]$/.test(raw)) {
            for (const ank of DIGITS) {
                for (const row of merged[ank].pattis) {
                    if (String(row.patti).includes(raw)) {
                        row.amount += amt;
                    }
                }
            }
        }
    }
    for (const ank of DIGITS) {
        const g = merged[ank];
        g.totalAmount = g.pattis.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        g.totalBets = g.pattis.reduce((s, r) => s + (Number(r.count) || 0), 0);
    }
    return merged;
};

/** DP Common: 3-digit → that patti row; legacy 1-digit → every chart double patti containing the digit. */
const mergeDoublePattiWithDpCommonBets = (baseByAnk, bets = []) => {
    const merged = cloneDoublePattiByAnk(baseByAnk);
    for (const bet of bets) {
        if (String(bet?.betType || '').toLowerCase() !== 'dp-common') continue;
        const amt = Number(bet?.amount) || 0;
        if (!amt) continue;
        const raw = String(bet?.betNumber || '').trim();
        const digitsOnly = raw.replace(/\D/g, '');
        const p3 = digitsOnly.length >= 3 ? digitsOnly.slice(0, 3).padStart(3, '0') : '';

        if (/^[0-9]{3}$/.test(p3) && ALL_DOUBLE_PATTI_IN_CHART.has(p3) && isDoublePatti(p3)) {
            const ank = String(getAnk(p3));
            const group = merged[ank];
            let row = group.pattis.find((r) => r.patti === p3);
            if (!row) {
                row = { patti: p3, amount: 0, count: 0 };
                group.pattis.push(row);
                group.pattis.sort((a, b) => String(a.patti).localeCompare(String(b.patti), undefined, { numeric: true }));
            }
            row.amount += amt;
            row.count += 1;
            continue;
        }
        if (/^[0-9]$/.test(raw)) {
            for (const ank of DIGITS) {
                for (const row of merged[ank].pattis) {
                    if (String(row.patti).includes(raw)) {
                        row.amount += amt;
                    }
                }
            }
        }
    }
    for (const ank of DIGITS) {
        const g = merged[ank];
        g.totalAmount = g.pattis.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        g.totalBets = g.pattis.reduce((s, r) => s + (Number(r.count) || 0), 0);
    }
    return merged;
};

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
            <div className="mb-4 p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm font-semibold text-orange-500 mb-1">What is Half Sangam?</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                    Half Sangam = <strong className="text-gray-800">one 3-digit Pana + one 1-digit Ank</strong> from Open and Close (Open Pana × Close Ank), e.g. <span className="font-mono">156-6</span>.
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                <span className="text-gray-400 text-sm">Total Amount:</span>
                <span className="font-mono font-semibold text-orange-500">₹{formatNum(totalAmount)}</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400 text-sm">No. of Bets:</span>
                <span className="font-semibold text-gray-800">{formatNum(totalBets)}</span>
            </div>
            {entries.length === 0 ? (
                <p className="text-gray-500 text-sm">No bets in this category</p>
            ) : (
                <>
                    {hasFormatA && (
                        <div className="mb-6">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Format A — Open Pana × Close Ank</p>
                            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                                <table className="w-full text-sm border-collapse min-w-[320px]">
                                    <thead>
                                        <tr className="bg-gray-100/80 border-b-2 border-gray-200">
                                            <th className="py-2 px-2 text-center font-semibold text-orange-500 border-r-2 border-gray-200 bg-gray-100/90 w-14">Open Pana ↓</th>
                                            {DIGITS.map((d) => (
                                                <th key={d} className="py-2 px-1.5 text-center font-bold text-orange-500 border-r border-gray-200 min-w-[3.5rem]" title={`Close Ank ${d}`}>{d}</th>
                                            ))}
                                            <th className="py-2 px-2 text-center font-semibold text-orange-500 bg-orange-500/10 border-l-2 min-w-[4rem]">Row total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formatA.openPanas.map((pana) => {
                                            const rowTotal = DIGITS.reduce((sum, d) => sum + (formatA.grid[d][pana]?.amount ?? 0), 0);
                                            const rowBets = DIGITS.reduce((sum, d) => sum + (formatA.grid[d][pana]?.count ?? 0), 0);
                                            return (
                                                <tr key={pana} className="border-b border-gray-200 hover:bg-gray-100/25">
                                                    <td className="py-1.5 px-2 text-center font-bold text-orange-500 border-r-2 border-gray-200 bg-gray-50 font-mono text-xs">{pana}</td>
                                                    {DIGITS.map((d) => {
                                                        const cell = formatA.grid[d][pana];
                                                        return (
                                                            <td key={d} className="p-1 border-r border-gray-200 text-center">
                                                                <div className="rounded bg-gray-100/40 border border-gray-200 px-1.5 py-1 min-h-[2.5rem] flex flex-col items-center justify-center gap-0">
                                                                    <span className="font-mono text-orange-500 text-xs font-semibold">₹{formatNum(cell?.amount)}</span>
                                                                    <span className="font-mono text-gray-400 text-[10px]">{cell?.count ?? 0}</span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-1.5 bg-orange-500/5 border-l-2 border-amber-500/20 text-center">
                                                        <span className="font-mono text-orange-500 text-xs font-semibold">₹{formatNum(rowTotal)}</span>
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
                    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                        <table className="w-full text-sm border-collapse min-w-[320px]">
                            <thead>
                                <tr className="bg-gray-100/70 border-b border-gray-200">
                                    <th className="text-left py-2.5 px-3 font-semibold text-orange-500">Option</th>
                                    <th className="text-right py-2.5 px-3 font-semibold text-gray-600">Amount (₹)</th>
                                    <th className="text-right py-2.5 px-3 font-semibold text-gray-600">No. of Bets</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(([key, v]) => (
                                    <tr key={key} className="border-b border-gray-200 hover:bg-gray-100/30">
                                        <td className="py-2 px-3 text-gray-700 font-mono text-xs sm:text-sm" title={key}>
                                            {getHalfSangamLabel(key)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-orange-500 font-semibold">₹{formatNum(v.amount)}</td>
                                        <td className="py-2 px-3 text-right text-gray-600">{formatNum(v.count || 0)}</td>
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
            <div className="mb-4 p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm font-semibold text-orange-500 mb-1">What is Full Sangam?</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                    Full Sangam = exact <strong className="text-gray-800">Open Pana (3 digits) + Close Pana (3 digits)</strong>. E.g. Open 123, Close 456 → bet <span className="font-mono text-orange-500">123-456</span>.
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                <span className="text-gray-400 text-sm">Total Amount:</span>
                <span className="font-mono font-semibold text-orange-500">₹{formatNum(totalAmount)}</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400 text-sm">No. of Bets:</span>
                <span className="font-semibold text-gray-800">{formatNum(totalBets)}</span>
            </div>
            {entries.length === 0 ? (
                <p className="text-gray-500 text-sm">No bets in this category</p>
            ) : (
                <>
                    {hasMatrix && (
                        <div className="mb-6">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Matrix — Open Pana (row) × Close Pana (column)</p>
                            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                                <table className="w-full text-sm border-collapse min-w-[320px]">
                                    <thead>
                                        <tr className="bg-gray-100/80 border-b-2 border-gray-200">
                                            <th className="py-2 px-2 text-center font-semibold text-orange-500 border-r-2 border-gray-200 bg-gray-100/90 w-14">Open Pana ↓</th>
                                            {closePanas.map((pana) => (
                                                <th key={pana} className="py-2 px-1.5 text-center font-bold text-orange-500 border-r border-gray-200 min-w-[3.5rem] font-mono text-xs" title={`Close Pana ${pana}`}>{pana}</th>
                                            ))}
                                            <th className="py-2 px-2 text-center font-semibold text-orange-500 bg-orange-500/10 border-l-2 min-w-[4rem]">Row total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {openPanas.map((openPana) => {
                                            const rowTotal = closePanas.reduce((sum, closePana) => sum + (grid[openPana]?.[closePana]?.amount ?? 0), 0);
                                            const rowBets = closePanas.reduce((sum, closePana) => sum + (grid[openPana]?.[closePana]?.count ?? 0), 0);
                                            return (
                                                <tr key={openPana} className="border-b border-gray-200 hover:bg-gray-100/25">
                                                    <td className="py-1.5 px-2 text-center font-bold text-orange-500 border-r-2 border-gray-200 bg-gray-50 font-mono text-xs">{openPana}</td>
                                                    {closePanas.map((closePana) => {
                                                        const cell = grid[openPana]?.[closePana];
                                                        return (
                                                            <td key={closePana} className="p-1 border-r border-gray-200 text-center">
                                                                <div className="rounded bg-gray-100/40 border border-gray-200 px-1.5 py-1 min-h-[2.5rem] flex flex-col items-center justify-center gap-0">
                                                                    <span className="font-mono text-orange-500 text-xs font-semibold">₹{formatNum(cell?.amount)}</span>
                                                                    <span className="font-mono text-gray-400 text-[10px]">{cell?.count ?? 0}</span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-1.5 bg-orange-500/5 border-l-2 border-amber-500/20 text-center">
                                                        <span className="font-mono text-orange-500 text-xs font-semibold">₹{formatNum(rowTotal)}</span>
                                                        <span className="block font-mono text-gray-400 text-[10px]">{formatNum(rowBets)}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-100/70 font-semibold border-t-2 border-gray-200">
                                            <td className="py-2 px-2 text-center border-r-2 border-gray-200 bg-gray-100/80 text-gray-400 text-xs">All</td>
                                            {closePanas.map((closePana) => {
                                                const colTotal = openPanas.reduce((sum, openPana) => sum + (grid[openPana]?.[closePana]?.amount ?? 0), 0);
                                                const colBets = openPanas.reduce((sum, openPana) => sum + (grid[openPana]?.[closePana]?.count ?? 0), 0);
                                                return (
                                                    <td key={closePana} className="p-1.5 border-r border-gray-200 text-center bg-orange-500/5">
                                                        <span className="font-mono text-orange-500 text-xs font-semibold">₹{formatNum(colTotal)}</span>
                                                        <span className="block font-mono text-gray-400 text-[10px]">{formatNum(colBets)}</span>
                                                    </td>
                                                );
                                            })}
                                            <td className="py-2 px-2 text-center border-l-2 border-orange-200 bg-orange-500/10">
                                                <span className="font-mono text-orange-500 text-xs font-bold">₹{formatNum(totalAmount)}</span>
                                                <span className="block font-mono text-gray-800 text-[10px] font-semibold">{formatNum(totalBets)}</span>
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
                    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                        <table className="w-full text-sm border-collapse min-w-[320px]">
                            <thead>
                                <tr className="bg-gray-100/70 border-b border-gray-200">
                                    <th className="text-left py-2.5 px-3 font-semibold text-orange-500">Option (Open · Close)</th>
                                    <th className="text-right py-2.5 px-3 font-semibold text-gray-600">Amount (₹)</th>
                                    <th className="text-right py-2.5 px-3 font-semibold text-gray-600">No. of Bets</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(([key, v]) => (
                                    <tr key={key} className="border-b border-gray-200 hover:bg-gray-100/30">
                                        <td className="py-2 px-3 text-gray-700 font-mono text-xs sm:text-sm" title={key}>
                                            {getFullSangamLabel(key)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-orange-500 font-semibold">₹{formatNum(v.amount)}</td>
                                        <td className="py-2 px-3 text-right text-gray-600">{formatNum(v.count || 0)}</td>
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

/** Shared chip style for “Patti (actual profit %)” in Find pannas + bucket chart */
const PROFIT_PATTI_CHIP_CLASS =
    'inline-flex items-center gap-1 rounded-md bg-orange-50 border border-orange-100 px-2 py-0.5 font-mono text-xs text-gray-800';

/** Nearest 10% band label (10–100), same idea as bucket rows */
function nearestTenPercentBand(pct) {
    const p = Number(pct);
    if (!Number.isFinite(p)) return 10;
    let b = Math.round(p / 10) * 10;
    return Math.min(100, Math.max(10, b));
}

function renderPattiChips(matches, mode, keyPrefix) {
    if (!matches?.length) {
        return <span className="text-gray-400">—</span>;
    }
    return (
        <div className="flex flex-wrap gap-1.5">
            {matches.map((row, i) => (
                <span
                    key={`${keyPrefix}-${i}`}
                    className={
                        row.nearestBandFill
                            ? `${PROFIT_PATTI_CHIP_CLASS} bg-gray-50 border-gray-200`
                            : PROFIT_PATTI_CHIP_CLASS
                    }
                    title={`Pool ₹${formatNum(row.totalBetAmount)} · House profit ₹${formatNum(row.profit)}${
                        row.nearestBandFill ? ' · closest to this band' : ''
                    }`}
                >
                    {mode === 'open' ? (
                        <>
                            <span className="text-orange-600 font-semibold">{row.openingPanna}</span>
                            <span className="text-gray-500">·</span>
                            <span>{row.profitPercent}%</span>
                        </>
                    ) : (
                        <>
                            <span className="text-orange-600 font-semibold">{row.closingPanna}</span>
                            <span className="text-gray-500">·</span>
                            <span>{row.profitPercent}%</span>
                        </>
                    )}
                </span>
            ))}
        </div>
    );
}

/** 3-digit pannas whose declare preview has house profit ≈ target % (same rules as declare preview). */
const ProfitTargetFinder = ({ marketId, hasOpenDeclared }) => {
    const [targetPct, setTargetPct] = useState('60');
    const [tolerance, setTolerance] = useState('10');
    const [mode, setMode] = useState('open');
    const [loading, setLoading] = useState(false);
    const [scanErr, setScanErr] = useState('');
    const [scanData, setScanData] = useState(null);
    const [bucketsData, setBucketsData] = useState(null);
    const [bucketsLoading, setBucketsLoading] = useState(false);
    const [bucketsErr, setBucketsErr] = useState('');

    useEffect(() => {
        if (!hasOpenDeclared && mode === 'close') setMode('open');
    }, [hasOpenDeclared, mode]);

    useEffect(() => {
        if (!marketId) return;
        if (mode === 'close' && !hasOpenDeclared) {
            setBucketsData(null);
            setBucketsErr('');
            return;
        }
        let cancelled = false;
        (async () => {
            setBucketsLoading(true);
            setBucketsErr('');
            setBucketsData(null);
            try {
                const q = new URLSearchParams({ mode });
                const res = await fetchWithAuth(`${API_BASE_URL}/markets/scan-profit-buckets/${marketId}?${q}`);
                if (res.status === 401) return;
                const json = await res.json();
                if (cancelled) return;
                if (!json.success) {
                    setBucketsErr(json.message || 'Could not load profit buckets');
                    return;
                }
                setBucketsData(json.data);
            } catch (e) {
                if (!cancelled) setBucketsErr('Network error loading buckets.');
            } finally {
                if (!cancelled) setBucketsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [marketId, mode, hasOpenDeclared]);

    const runScan = async () => {
        if (!marketId) return;
        const tp = Number(targetPct);
        const tol = Number(tolerance);
        if (!Number.isFinite(tp) || tp < 0 || tp > 100) {
            setScanErr('Enter target profit % between 0 and 100.');
            return;
        }
        setLoading(true);
        setScanErr('');
        setScanData(null);
        try {
            const q = new URLSearchParams({
                mode,
                targetPct: String(tp),
                tolerance: Number.isFinite(tol) ? String(tol) : '10',
            });
            const res = await fetchWithAuth(`${API_BASE_URL}/markets/scan-profit-outcomes/${marketId}?${q}`);
            if (res.status === 401) return;
            const json = await res.json();
            if (!json.success) {
                setScanErr(json.message || 'Scan failed');
                return;
            }
            setScanData(json.data);
        } catch (e) {
            setScanErr('Network error. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SectionCard title="Target house profit %" className="mt-8">
            <p className="text-sm text-gray-600 mb-4">
                Enter target house profit % (e.g. 60). We only check 3-digit pannas that players actually played (panna / patti
                tickets). Result numbers are only those played numbers whose declare preview hits your
                target. Tolerance 0 means exact match on the same two-decimal % as the table below (e.g. 9.58).
            </p>
            <div className="flex flex-wrap items-end gap-3 mb-4">
                <label className="flex flex-col gap-1 text-xs text-gray-600">
                    Target profit %
                    <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={targetPct}
                        onChange={(e) => setTargetPct(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 w-28 text-gray-900"
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs text-gray-600">
                    Tolerance ±% (0 = exact)
                    <input
                        type="number"
                        min={0}
                        max={50}
                        step={0.1}
                        value={tolerance}
                        onChange={(e) => setTolerance(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 w-28 text-gray-900"
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs text-gray-600">
                    Session
                    <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white min-w-[140px]"
                    >
                        <option value="open">Opening declare</option>
                        <option value="close" disabled={!hasOpenDeclared}>
                            Closing declare
                        </option>
                    </select>
                </label>
                <button
                    type="button"
                    onClick={runScan}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-gray-900 font-semibold text-sm"
                >
                    {loading ? 'Scanning…' : 'Find pannas'}
                </button>
            </div>
            {!hasOpenDeclared && (
                <p className="text-gray-500 text-xs mb-3">Closing scan is available after the opening panna is declared.</p>
            )}
            {scanErr && <p className="text-red-600 text-sm mb-3">{scanErr}</p>}
            {scanData && (
                <div className="mt-2">
                    <p className="text-sm text-gray-700 mb-2">
                        {scanData.mode === 'open' ? 'Opening' : 'Closing'} · target {scanData.targetPct}%
                        {Number(scanData.tolerance) === 0 ? ' (exact)' : ` ± ${scanData.tolerance}%`} · played pannas checked:{' '}
                        <span className="font-semibold">{scanData.betPannaCount ?? '—'}</span> ·{' '}
                        <span className="font-semibold">{scanData.count}</span> match{scanData.count === 1 ? '' : 'es'}
                        {scanData.mode === 'close' && scanData.openPanna ? ` (open ${scanData.openPanna})` : ''}
                    </p>
                    {scanData.count === 0 ? (
                        <p className="text-gray-500 text-sm">
                            {(scanData.betPannaCount ?? 0) === 0
                                ? 'No 3-digit panna/patti bets in this session — only numbers players played as panna (or close panna / full sangam leg) are checked.'
                                : 'None of those played pannas hit this profit % at current rates; try a small tolerance or a different target.'}
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-[420px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28 whitespace-nowrap">
                                            Target band
                                        </th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Patti (actual profit %)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    <tr className="align-top hover:bg-gray-50/80">
                                        <td className="px-3 py-2 font-semibold text-orange-600 whitespace-nowrap">
                                            ~{nearestTenPercentBand(scanData.targetPct)}%
                                            <span className="block text-[10px] font-normal text-gray-500 normal-case">
                                                Search: {scanData.targetPct}%
                                                {Number(scanData.tolerance) === 0 ? ' exact' : ` ±${scanData.tolerance}%`}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-800">
                                            {renderPattiChips(scanData.matches, scanData.mode, 'scan')}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-bold text-gray-800 mb-1">Played patti by profit % (10% – 100%)</h3>
                <p className="text-xs text-gray-500 mb-3">
                    Each row is 10%–100%. Pannas sit in their nearest band (e.g. 54% → ~50%). If a band has no exact nearest
                    matches, we still show the closest pannas so every row has data (lighter chips, tooltip “closest to this band”).
                </p>
                {bucketsLoading && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-orange-500" />
                        Loading bucket table…
                    </div>
                )}
                {bucketsErr && <p className="text-red-600 text-sm mb-2">{bucketsErr}</p>}
                {!bucketsLoading && bucketsData && (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24 whitespace-nowrap">
                                        Target band
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Patti (actual profit %)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {bucketsData.buckets.map((bucket) => (
                                    <tr key={bucket.targetPct} className="align-top hover:bg-gray-50/80">
                                        <td className="px-3 py-2 font-semibold text-orange-600 whitespace-nowrap">
                                            ~{bucket.targetPct}%
                                            {bucket.nearestFill && (
                                                <span className="block text-[10px] font-normal text-gray-500 font-sans">
                                                    closest matches
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-gray-800">
                                            {bucket.matches.length === 0 ? (
                                                <span className="text-gray-400">—</span>
                                            ) : (
                                                renderPattiChips(bucket.matches, bucketsData.mode, `bucket-${bucket.targetPct}`)
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!bucketsLoading && bucketsData && (bucketsData.betPannaCount ?? 0) === 0 && (
                    <p className="text-gray-500 text-xs mt-2">No played 3-digit pannas in this session — table will fill when panna/patti bets exist.</p>
                )}
            </div>
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
    const [allBets, setAllBets] = useState(null);
    const [loadingBets, setLoadingBets] = useState(false);
    /** 'open' | 'closed' | 'all' – open only, close only, or combined */
    const [statusView, setStatusView] = useState('open');
    const initialStatusSetForMarketId = React.useRef(null);

    const fetchStats = async () => {
        if (!marketId) return;
        setLoading(true);
        setError('');
        setSinglePattiSummary(null);
        try {
            const [statsRes, summaryRes] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/markets/get-market-stats/${marketId}`),
                fetchWithAuth(`${API_BASE_URL}/markets/get-single-patti-summary/${marketId}`),
            ]);
            if (statsRes.status === 401 || summaryRes.status === 401) return;
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

    const fetchAllBets = async () => {
        if (!marketId) return;
        setLoadingBets(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/markets/get-market-bets/${marketId}`);
            if (res.status === 401) return;
            const json = await res.json();
            if (json.success) {
                setAllBets(json.data);
            }
        } catch (err) {
            console.error('Failed to fetch bets:', err);
        } finally {
            setLoadingBets(false);
        }
    };

    useEffect(() => {
        if (data?.market) {
            fetchAllBets();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketId, data]);

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
        clearAdminSession();
        navigate('/');
    };

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

    // Single Patti: grouped by Ank (0–9), same as user side - hooks must be called before conditional returns
    const singlePattiByAnk = useMemo(() => buildSinglePattiByAnk(data?.singlePatti?.items || {}), [data?.singlePatti?.items]);
    const singlePattiTotals = useMemo(() => getSinglePattiTotalsFromByAnk(singlePattiByAnk), [singlePattiByAnk]);
    // Double Patti: grouped by Ank (0–9), same as user side
    const doublePattiByAnk = useMemo(() => buildDoublePattiByAnk(data?.doublePatti?.items || {}), [data?.doublePatti?.items]);
    const doublePattiTotals = useMemo(() => getDoublePattiTotalsFromByAnk(doublePattiByAnk), [doublePattiByAnk]);

    // Session-aware view stats (new API returns bySession.open/close; fallback to overall stats).
    const statsOpen = data?.bySession?.open || data;
    const statsClose = data?.bySession?.close || data;
    const splitSessions =
        data?.bySession != null && data.bySession.open != null && data.bySession.close != null;
    const viewStats =
        statusView === 'open'
            ? statsOpen
            : statusView === 'closed'
              ? statsClose
              : splitSessions
                ? mergeSessionStatsForView(data.bySession.open, data.bySession.close)
                : data;

    const viewSinglePattiItems = viewStats?.singlePatti?.items || {};
    const viewDoublePattiItems = viewStats?.doublePatti?.items || {};

    const sessionBetsForView =
        statusView === 'open'
            ? allBets?.open || []
            : statusView === 'closed'
              ? allBets?.close || []
              : [...(allBets?.open || []), ...(allBets?.close || [])];

    // View-dependent: SP/DP Common merged into the same per-patti rows as the user chart (3-digit on that patti; legacy 1-digit spread).
    const singlePattiByAnkForView = useMemo(
        () => mergeSinglePattiWithSpCommonBets(buildSinglePattiByAnk(viewSinglePattiItems), sessionBetsForView || []),
        [viewSinglePattiItems, sessionBetsForView]
    );
    const singlePattiTotalsForView = useMemo(() => getSinglePattiTotalsFromByAnk(singlePattiByAnkForView), [singlePattiByAnkForView]);
    const doublePattiByAnkForView = useMemo(
        () => mergeDoublePattiWithDpCommonBets(buildDoublePattiByAnk(viewDoublePattiItems), sessionBetsForView || []),
        [viewDoublePattiItems, sessionBetsForView]
    );
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
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-yellow-500" />
                </div>
            </AdminLayout>
        );
    }

    if (error || !data) {
        return (
            <AdminLayout onLogout={handleLogout} title="Market Detail">
                <div className="rounded-xl border border-red-200/60 bg-red-900/20 p-4 text-red-600">
                    {error || 'Market not found'}
                </div>
                <Link
                    to="/markets"
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold transition-colors"
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
        resultOnPatti = { open: null, close: null },
    } = data;

    if (!market) {
        return (
            <AdminLayout onLogout={handleLogout} title="Market Detail">
                <div className="rounded-xl border border-red-200/60 bg-red-900/20 p-4 text-red-600">
                    Market data not available
                </div>
                <Link
                    to="/markets"
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold transition-colors"
                >
                    <FaArrowLeft /> Back to Markets
                </Link>
            </AdminLayout>
        );
    }

    const hasOpen = market?.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
    const hasClose = market?.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
    const isClosed = hasOpen && hasClose;
    const timeline = `${formatTime(market?.startingTime)} – ${formatTime(market?.closingTime)}`;
    const resultDisplay = market?.displayResult || '***-**-***';

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

    // Section data by view (Open/Closed/All): show session-specific or merged bets in all sections
    const singleDigitDisplay = viewStats?.singleDigit || { digits: {}, totalAmount: 0, totalBets: 0 };
    const jodiDisplay =
        statusView === 'all' && splitSessions
            ? mergeItemsBlocks(data.bySession.open?.jodi, data.bySession.close?.jodi)
            : statsClose?.jodi || { items: {}, totalAmount: 0, totalBets: 0 };
    const triplePattiDisplay = viewStats?.triplePatti || { items: {}, totalAmount: 0, totalBets: 0 };
    const halfSangamDisplay =
        statusView === 'open'
            ? { items: {}, totalAmount: 0, totalBets: 0 }
            : statusView === 'closed'
              ? (statsClose?.halfSangam?.totalBets
                  ? statsClose.halfSangam
                  : statsOpen?.halfSangam || { items: {}, totalAmount: 0, totalBets: 0 })
              : splitSessions
                ? mergeItemsBlocks(data.bySession.open?.halfSangam, data.bySession.close?.halfSangam)
                : data?.halfSangam || { items: {}, totalAmount: 0, totalBets: 0 };
    const fullSangamDisplay =
        statusView === 'all' && splitSessions
            ? mergeItemsBlocks(data.bySession.open?.fullSangam, data.bySession.close?.fullSangam)
            : statsClose?.fullSangam || { items: {}, totalAmount: 0, totalBets: 0 };

    // Open view: exclude Half Sangam from totals.
    const openTotalAmount =
        (singleDigitDisplay?.totalAmount ?? 0) +
        (singlePattiTotalsForView?.totalAmount ?? 0) +
        (doublePattiTotalsForView?.totalAmount ?? 0) +
        (triplePattiDisplay?.totalAmount ?? 0);
    const openTotalBets =
        (singleDigitDisplay?.totalBets ?? 0) +
        (singlePattiTotalsForView?.totalBets ?? 0) +
        (doublePattiTotalsForView?.totalBets ?? 0) +
        (triplePattiDisplay?.totalBets ?? 0);
    // Closed view: include Half Sangam totals.
    const closedTotalAmount =
        (singleDigitDisplay?.totalAmount ?? 0) +
        (jodiDisplay?.totalAmount ?? 0) +
        (singlePattiTotalsForView?.totalAmount ?? 0) +
        (doublePattiTotalsForView?.totalAmount ?? 0) +
        (triplePattiDisplay?.totalAmount ?? 0) +
        (halfSangamDisplay?.totalAmount ?? 0) +
        (fullSangamDisplay?.totalAmount ?? 0);
    const closedTotalBets =
        (singleDigitDisplay?.totalBets ?? 0) +
        (jodiDisplay?.totalBets ?? 0) +
        (singlePattiTotalsForView?.totalBets ?? 0) +
        (doublePattiTotalsForView?.totalBets ?? 0) +
        (triplePattiDisplay?.totalBets ?? 0) +
        (halfSangamDisplay?.totalBets ?? 0) +
        (fullSangamDisplay?.totalBets ?? 0);
    const allViewTotalAmount =
        (singleDigitDisplay?.totalAmount ?? 0) +
        (jodiDisplay?.totalAmount ?? 0) +
        (singlePattiTotalsForView?.totalAmount ?? 0) +
        (doublePattiTotalsForView?.totalAmount ?? 0) +
        (triplePattiDisplay?.totalAmount ?? 0) +
        (halfSangamDisplay?.totalAmount ?? 0) +
        (fullSangamDisplay?.totalAmount ?? 0);
    const allViewTotalBets =
        (singleDigitDisplay?.totalBets ?? 0) +
        (jodiDisplay?.totalBets ?? 0) +
        (singlePattiTotalsForView?.totalBets ?? 0) +
        (doublePattiTotalsForView?.totalBets ?? 0) +
        (triplePattiDisplay?.totalBets ?? 0) +
        (halfSangamDisplay?.totalBets ?? 0) +
        (fullSangamDisplay?.totalBets ?? 0);
    const displayAmount =
        statusView === 'open' ? openTotalAmount : statusView === 'closed' ? closedTotalAmount : allViewTotalAmount;
    const displayBets =
        statusView === 'open' ? openTotalBets : statusView === 'closed' ? closedTotalBets : allViewTotalBets;

    const handleStatusViewChange = (e) => {
        const v = e.target.value;
        if (v === 'open') setStatusView('open');
        else if (v === 'closed') setStatusView('closed');
        else if (v === 'all') setStatusView('all');
    };

    const viewTotalsLabel =
        statusView === 'open' ? 'Open' : statusView === 'closed' ? 'Closed' : 'All (open + close)';
    const viewTotalsSubLabel =
        statusView === 'open'
            ? 'Open bets only'
            : statusView === 'closed'
              ? 'Closed bets only'
              : 'All bets (open + close sessions)';

    return (
        <AdminLayout onLogout={handleLogout} title="Market Detail">
            <div className="w-full min-w-0 px-0 sm:px-1 pb-6 sm:pb-8">
                <Link
                    to="/markets"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-500 text-sm mb-4 transition-colors"
                >
                    <FaArrowLeft className="w-4 h-4" /> Markets Management
                </Link>

                {/* Overview card – updates when Open/Closed view changes (key forces refresh) */}
                <div key={`overview-${statusView}`} className="rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden mb-6 sm:mb-8">
                    <div className="bg-white border-b border-gray-200 px-4 py-3">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{market?.marketName || 'Market'}</h1>
                        <p className="text-gray-400 text-sm mt-0.5">Market overview & result</p>
                        {marketId && (
                            <p className="text-[11px] text-gray-500 mt-1 font-mono" title="Same ID as in Add Result → Check">ID: {marketId}</p>
                        )}
                    </div>
                    <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100/80 flex items-center justify-center shrink-0">
                                <FaClock className="text-orange-500 w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Timeline</p>
                                <p className="font-mono text-gray-800 text-sm sm:text-base">{timeline}</p>
                                <p className="text-xs text-gray-500">Opens 12:00 AM · closes at closing time</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100/80 flex items-center justify-center shrink-0">
                                <FaHashtag className="text-orange-500 w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Result</p>
                                <p className="font-mono text-orange-500 text-lg font-bold">{resultDisplay}</p>
                                <p className="text-xs text-gray-500">
                                    Open: {hasOpen ? market.openingNumber : '—'} · Close: {hasClose ? market.closingNumber : '—'} ·
                                    {' '}Viewing totals: <strong>{viewTotalsLabel}</strong> bets
                                </p>
                                {(resultOnPatti?.open || resultOnPatti?.close) && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-[11px]">
                                        <p className="text-gray-400 font-semibold uppercase tracking-wider">Result on Patti</p>
                                        {resultOnPatti?.open && (
                                            <div className="rounded bg-gray-100/40 border border-gray-200 p-2 space-y-1">
                                                <p className="text-gray-500 font-medium mb-1">Open</p>
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-gray-400 shrink-0">Total Bet Amount on Patti</span>
                                                    <span className="font-mono text-orange-500">₹{formatNum(resultOnPatti.open.totalBetAmountOnPatti)}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-gray-400 shrink-0">Total Win Amount on Patti</span>
                                                    <span className="font-mono text-orange-500">₹{formatNum(resultOnPatti.open.totalWinAmountOnPatti)}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-gray-400 shrink-0">Total Players Bet on Patti</span>
                                                    <span className="font-mono text-orange-500">{formatNum(resultOnPatti.open.totalPlayersBetOnPatti)}</span>
                                                </div>
                                            </div>
                                        )}
                                        {resultOnPatti?.close && (
                                            <div className="rounded bg-gray-100/40 border border-gray-200 p-2 space-y-1">
                                                <p className="text-gray-500 font-medium mb-1">Close</p>
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-gray-400 shrink-0">Total Bet Amount on Patti</span>
                                                    <span className="font-mono text-orange-500">₹{formatNum(resultOnPatti.close.totalBetAmountOnPatti)}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-gray-400 shrink-0">Total Win Amount on Patti</span>
                                                    <span className="font-mono text-orange-500">₹{formatNum(resultOnPatti.close.totalWinAmountOnPatti)}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-gray-400 shrink-0">Total Players Bet on Patti</span>
                                                    <span className="font-mono text-orange-500">{formatNum(resultOnPatti.close.totalPlayersBetOnPatti)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100/80 flex items-center justify-center shrink-0">
                                <FaChartBar className="text-orange-500 w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Total Bet Amount</p>
                                <p className="font-mono text-lg font-semibold text-gray-800">₹{formatNum(displayAmount)}</p>
                                <p className="text-xs text-gray-500">{formatNum(displayBets)} bets</p>
                                <p className="text-[10px] text-gray-500">({viewTotalsSubLabel})</p>
                            </div>
                        </div>
                        {(
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 w-full sm:w-auto">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">View</p>
                                <select
                                    value={statusView}
                                    onChange={handleStatusViewChange}
                                    aria-label="View open, closed, or all bets"
                                    className="w-full sm:w-auto min-w-[200px] rounded-lg border border-gray-200 bg-gray-100 text-gray-800 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none cursor-pointer"
                                >
                                    <option value="open">Open bets only</option>
                                    <option value="closed">Closed bets only</option>
                                    <option value="all">All bets (open + close)</option>
                                </select>
                            </div>
                        </div>
                        )}
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
                        <div className="mb-4 p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-200">
                            <p className="text-sm font-semibold text-orange-500 mb-1">What is Jodi?</p>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Jodi = 2-digit number from <strong className="text-gray-800">last digit of Open</strong> + <strong className="text-gray-800">last digit of Close</strong>. E.g. Open 123, Close 456 → Jodi <span className="font-mono font-bold text-orange-500">36</span>.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                <span className="text-gray-400">How to read:</span>
                                <span className="text-orange-500 font-medium">1st digit = row (left column)</span>
                                <span className="text-gray-500">·</span>
                                <span className="text-orange-500 font-medium">2nd digit = column (top row)</span>
                                <span className="text-gray-500">·</span>
                                <span className="text-gray-800">Jodi 36 = row 3, column 6</span>
                            </div>
                        </div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                            <span>2nd digit (column) →</span>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white -mx-1 sm:mx-0">
                            <table className="w-full text-sm border-collapse min-w-[320px] sm:min-w-[420px] md:min-w-[520px]">
                                <thead>
                                    <tr className="bg-gray-100/80 border-b-2 border-gray-200">
                                        <th className="py-2 px-2 text-center font-semibold text-orange-500 border-r-2 border-gray-200 bg-gray-100/90 w-12" title="First digit of Jodi (0–9)">1st ↓</th>
                                        {DIGITS.map((d) => (
                                            <th key={d} className="py-2.5 px-2 text-center font-bold text-orange-500 border-r border-gray-200 min-w-[4rem]" title={`2nd digit = ${d}`}>{d}</th>
                                        ))}
                                        <th className="py-2.5 px-3 text-center font-semibold text-orange-500 bg-orange-500/10 border-orange-200 border-l-2 min-w-[5rem]">Row total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {DIGITS.map((firstDigit) => {
                                        const rowTotal = DIGITS.reduce((sum, secondDigit) => sum + (jodiDisplay.items?.[firstDigit + secondDigit]?.amount ?? 0), 0);
                                        const rowBets = DIGITS.reduce((sum, secondDigit) => sum + (jodiDisplay.items?.[firstDigit + secondDigit]?.count ?? 0), 0);
                                        return (
                                            <tr key={firstDigit} className="border-b border-gray-200 hover:bg-gray-100/25">
                                                <td className="py-2 px-2 text-center font-bold text-orange-500 border-r-2 border-gray-200 bg-gray-50 align-middle w-12" title={`Row = 1st digit ${firstDigit}`}>
                                                    {firstDigit}
                                                </td>
                                                {DIGITS.map((secondDigit) => {
                                                    const jodiKey = firstDigit + secondDigit;
                                                    const item = jodiDisplay.items?.[jodiKey];
                                                    const amt = item?.amount ?? 0;
                                                    const cnt = item?.count ?? 0;
                                                    return (
                                                        <td key={jodiKey} className="p-1 sm:p-2 border-r border-gray-200 align-top">
                                                            <div className="rounded-lg bg-gray-100/40 border border-gray-200 p-1.5 sm:p-2 md:p-2.5 min-h-[3.75rem] sm:min-h-[4.25rem] md:min-h-[4.75rem] flex flex-col items-center justify-center gap-0.5 sm:gap-1 md:gap-1.5 text-center">
                                                                <span className="font-mono font-bold text-orange-500 text-xs sm:text-sm md:text-base" title={`Jodi ${jodiKey}`}>{jodiKey}</span>
                                                                <div className="w-full">
                                                                    <p className="hidden sm:block text-[10px] text-gray-500 uppercase tracking-wide">Amount</p>
                                                                    <p className="font-mono text-gray-800 text-[10px] sm:text-xs md:text-sm font-semibold">₹{formatNum(amt)}</p>
                                                                </div>
                                                                <div className="w-full border-t border-gray-200 pt-0.5 sm:pt-1">
                                                                    <p className="hidden sm:block text-[10px] text-gray-500 uppercase tracking-wide">No. of Bets</p>
                                                                    <p className="font-mono text-gray-600 text-[10px] sm:text-xs font-medium">{formatNum(cnt)}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-2 bg-orange-500/5 border-l-2 border-amber-500/20 align-top">
                                                    <div className="rounded-lg border border-orange-200 bg-white p-2 min-h-[4.25rem] flex flex-col justify-center text-center">
                                                        <p className="text-xs text-orange-500/90 font-semibold">Total Amt</p>
                                                        <p className="font-mono text-orange-500 font-bold text-sm">₹{formatNum(rowTotal)}</p>
                                                        <p className="text-xs text-gray-400 font-semibold mt-1">No of Bets</p>
                                                        <p className="font-mono text-gray-800 font-semibold text-sm">{formatNum(rowBets)}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-gray-100/70 font-semibold border-t-2 border-gray-200">
                                        <td className="py-2 px-2 text-center border-r-2 border-gray-200 bg-gray-100/80 text-gray-400 text-xs">All</td>
                                        {DIGITS.map((d) => (
                                            <td key={d} className="py-1 px-1 border-r border-gray-200" />
                                        ))}
                                        <td className="py-3 px-3 border-l-2 border-orange-200 bg-orange-500/10">
                                            <div className="text-center">
                                                <p className="text-xs text-orange-500 font-semibold">Total Amt</p>
                                                <p className="font-mono text-orange-500 font-bold text-base">₹{formatNum(jodiDisplay.totalAmount)}</p>
                                                <p className="text-xs text-gray-400 font-semibold mt-1">No of Bets</p>
                                                <p className="font-mono text-gray-800 font-bold text-base">{formatNum(jodiDisplay.totalBets)}</p>
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
                        <div className="mb-4 p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                            <p className="text-sm font-semibold text-orange-500">Same as user app</p>
                            <p className="text-gray-600 text-sm">
                                Grouped by <strong className="text-gray-800">Ank</strong> (last digit of sum of 3 digits). E.g. 127 → 1+2+7=10 → Ank <span className="font-mono text-orange-500">0</span>. Panels 0–9 below match the user-side Single Panna layout.
                            </p>
                            <p className="text-gray-500 text-xs">
                                SP Common amounts appear on each matching patti row (new bets store 3-digit panna; older digit-only bets are spread across pattis that contain that digit).
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
                                <div className="mb-4 overflow-x-auto rounded-xl border border-orange-200 bg-white">
                                    <p className="text-xs text-gray-400 px-2 py-1.5">Total by Ank (0–9). Yellow = highest exposure.</p>
                                    <table className="w-full text-sm border-collapse min-w-[320px]">
                                        <thead>
                                            <tr className="bg-gray-100/80 border-b border-gray-200">
                                                {DIGITS.map((d) => (
                                                    <th key={d} className="py-2 px-1.5 text-center font-bold text-orange-500 border-r border-gray-200 min-w-[2.5rem]">{d}</th>
                                                ))}
                                                <th className="py-2 px-2 text-center font-semibold text-orange-500 bg-orange-500/10 border-l-2 border-orange-200 min-w-[4rem]">#</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                {DIGITS.map((d) => {
                                                    const g = singlePattiByAnkForView[d] || { totalAmount: 0, totalBets: 0 };
                                                    const isMax = Number(d) === maxAnk;
                                                    return (
                                                        <td key={d} className={`p-2 border-r border-gray-200 text-center ${isMax ? 'bg-orange-500/25' : ''}`}>
                                                            <p className="font-mono text-gray-800 text-xs font-semibold">₹{formatNum(g.totalAmount)}</p>
                                                            <p className="font-mono text-gray-400 text-[10px]">{formatNum(g.totalBets)}</p>
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-2 px-2 text-center font-semibold bg-orange-500/10 border-l-2 border-orange-200">
                                                    <p className="font-mono text-orange-500 font-bold text-xs">₹{formatNum(singlePattiTotalsForView.totalAmount)}</p>
                                                    <p className="font-mono text-gray-800 text-[10px]">{formatNum(singlePattiTotalsForView.totalBets)}</p>
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
                                    <div key={ank} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-2 bg-gray-100/80 border-b border-gray-200">
                                            <span className="font-bold text-orange-500 text-lg">{ank}</span>
                                            <span className="text-xs text-gray-400">₹{formatNum(group.totalAmount)} · {formatNum(group.totalBets)} bets</span>
                                        </div>
                                        <div className="p-2 grid grid-cols-2 gap-1.5">
                                            {group.pattis.map(({ patti, amount, count }) => (
                                                <div key={patti} className="flex items-center justify-between rounded bg-gray-50 border border-gray-200 px-2 py-1.5">
                                                    <span className="font-mono text-orange-500 font-semibold text-sm">{patti}</span>
                                                    <div className="text-right">
                                                        <p className="font-mono text-gray-800 text-[10px]">₹{formatNum(amount)}</p>
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
                        <div className="mb-4 p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                            <p className="text-sm font-semibold text-orange-500">Same as user app</p>
                            <p className="text-gray-600 text-sm">
                                Grouped by <strong className="text-gray-800">Ank</strong> (last digit of sum of 3 digits). Double Patti = 3-digit with <strong className="text-gray-800">exactly two same digits</strong> (e.g. 112, 121, 233). Panels 0–9 match the user Double Pana layout.
                            </p>
                            <p className="text-gray-500 text-xs">
                                DP Common amounts appear on each matching patti row (3-digit panna per line, or legacy digit spread like SP Common).
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
                                <div className="mb-4 overflow-x-auto rounded-xl border border-orange-200 bg-white">
                                    <p className="text-xs text-gray-400 px-2 py-1.5">Total by Ank (0–9). Yellow = highest exposure.</p>
                                    <table className="w-full text-sm border-collapse min-w-[320px]">
                                        <thead>
                                            <tr className="bg-gray-100/80 border-b border-gray-200">
                                                {DIGITS.map((d) => (
                                                    <th key={d} className="py-2 px-1.5 text-center font-bold text-orange-500 border-r border-gray-200 min-w-[2.5rem]">{d}</th>
                                                ))}
                                                <th className="py-2 px-2 text-center font-semibold text-orange-500 bg-orange-500/10 border-l-2 border-orange-200 min-w-[4rem]">#</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                {DIGITS.map((d) => {
                                                    const g = doublePattiByAnkForView[d] || { totalAmount: 0, totalBets: 0 };
                                                    const isMax = Number(d) === maxAnk;
                                                    return (
                                                        <td key={d} className={`p-2 border-r border-gray-200 text-center ${isMax ? 'bg-orange-500/25' : ''}`}>
                                                            <p className="font-mono text-gray-800 text-xs font-semibold">₹{formatNum(g.totalAmount)}</p>
                                                            <p className="font-mono text-gray-400 text-[10px]">{formatNum(g.totalBets)}</p>
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-2 px-2 text-center font-semibold bg-orange-500/10 border-l-2 border-orange-200">
                                                    <p className="font-mono text-orange-500 font-bold text-xs">₹{formatNum(doublePattiTotalsForView.totalAmount)}</p>
                                                    <p className="font-mono text-gray-800 text-[10px]">{formatNum(doublePattiTotalsForView.totalBets)}</p>
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
                                    <div key={ank} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-2 bg-gray-100/80 border-b border-gray-200">
                                            <span className="font-bold text-orange-500 text-lg">{ank}</span>
                                            <span className="text-xs text-gray-400">₹{formatNum(group.totalAmount)} · {formatNum(group.totalBets)} bets</span>
                                        </div>
                                        <div className="p-2 grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto">
                                            {group.pattis.map(({ patti, amount, count }) => (
                                                <div key={patti} className="flex items-center justify-between rounded bg-gray-50 border border-gray-200 px-2 py-1.5">
                                                    <span className="font-mono text-orange-500 font-semibold text-sm">{patti}</span>
                                                    <div className="text-right">
                                                        <p className="font-mono text-gray-800 text-[10px]">₹{formatNum(amount)}</p>
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

                    {(statusView === 'closed' || statusView === 'all') && (
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

                <ProfitTargetFinder marketId={marketId} hasOpenDeclared={!!hasOpen} />

                {/* Detailed Bet Analysis Section */}
                <SectionCard title="Detailed Bet Analysis" className="mt-8">
                    {loadingBets ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-orange-500 mx-auto" />
                            <p className="text-gray-500 mt-2">Loading bets...</p>
                        </div>
                    ) : allBets ? (
                        <div className="space-y-6">
                            {/* Opening Bets Section */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-orange-600 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        Opening Bets ({allBets.totalOpen})
                                    </h3>
                                    <span className="text-sm text-gray-600">
                                        Total: ₹{formatNum(allBets.open.reduce((sum, b) => sum + (b.amount || 0), 0))}
                                    </span>
                                </div>
                                {allBets.open.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4">No opening bets found</p>
                                ) : (
                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Time</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Player</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Phone</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Game Type</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Number</th>
                                                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Amount</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Status</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Placed By</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {allBets.open.map((bet) => (
                                                    <tr key={bet._id} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                                                            {new Date(bet.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-800 font-medium">{bet.userId?.username || 'N/A'}</td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">{bet.userId?.phone || '—'}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                                                                {getBetTypeLabel(bet.betType)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-center font-mono font-bold text-orange-600">{bet.betNumber || '—'}</td>
                                                        <td className="px-3 py-2 text-right font-semibold text-gray-800">₹{formatNum(bet.amount)}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                                bet.status === 'won' ? 'bg-green-100 text-green-700' :
                                                                bet.status === 'lost' ? 'bg-red-100 text-red-700' :
                                                                'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                                {bet.status?.toUpperCase() || 'PENDING'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-xs text-gray-600">
                                                            {bet.placedByBookie ? (bet.placedByBookieId?.username || 'Bookie') : 'Player'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Closing Bets Section */}
                            <div className="pt-6 border-t border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-orange-600 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                        Closing Bets ({allBets.totalClose})
                                    </h3>
                                    <span className="text-sm text-gray-600">
                                        Total: ₹{formatNum(allBets.close.reduce((sum, b) => sum + (b.amount || 0), 0))}
                                    </span>
                                </div>
                                {allBets.close.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4">No closing bets found</p>
                                ) : (
                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Time</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Player</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Phone</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Game Type</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Number</th>
                                                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Amount</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Status</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Placed By</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {allBets.close.map((bet) => (
                                                    <tr key={bet._id} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                                                            {new Date(bet.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-800 font-medium">{bet.userId?.username || 'N/A'}</td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">{bet.userId?.phone || '—'}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                                                                {getBetTypeLabel(bet.betType)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-center font-mono font-bold text-orange-600">{bet.betNumber || '—'}</td>
                                                        <td className="px-3 py-2 text-right font-semibold text-gray-800">₹{formatNum(bet.amount)}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                                bet.status === 'won' ? 'bg-green-100 text-green-700' :
                                                                bet.status === 'lost' ? 'bg-red-100 text-red-700' :
                                                                'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                                {bet.status?.toUpperCase() || 'PENDING'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-xs text-gray-600">
                                                            {bet.placedByBookie ? (bet.placedByBookieId?.username || 'Bookie') : 'Player'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-4">No bet data available</p>
                    )}
                </SectionCard>

                <div className="mt-8 pt-4 border-t border-gray-200 flex items-center gap-2 sm:gap-3 flex-nowrap">
                    <Link
                        to="/markets"
                        className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold border border-gray-200 transition-colors shrink-0 whitespace-nowrap text-xs sm:text-sm"
                    >
                        <FaArrowLeft /> Back to Markets
                    </Link>
                    <Link
                        to="/add-result"
                        state={{ preselectedMarket: market }}
                        className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold border border-amber-400 transition-colors min-w-0 flex-1 text-xs sm:text-sm"
                    >
                        <FaEdit className="shrink-0" />
                        <span className="truncate">Add Result for {market?.marketName || 'Market'}</span>
                    </Link>
                </div>
            </div>
        </AdminLayout>
    );
};

export default MarketDetail;
