import React from 'react';
import { X } from 'lucide-react';

const ROW_META = [
  { key: 'str', code: 'STR', desc: 'Straight — exact match' },
  { key: 'box_1way', code: 'BOX 1-way', desc: 'Triple same digit (e.g. 111)' },
  { key: 'box_3way', code: 'BOX 3-way', desc: 'Two same + one different' },
  { key: 'box_6way', code: 'BOX 6-way', desc: 'All different digits' },
  { key: 'fp', code: 'FP', desc: 'Front pair — first two digits' },
  { key: 'bp', code: 'BP', desc: 'Back pair — last two digits' },
  { key: 'sp', code: 'SP', desc: 'Split pair — 1st & 3rd' },
  { key: 'ap', code: 'AP', desc: 'Any pair (FP or BP or SP)' },
  { key: 'duplicates', code: 'DP', desc: 'Duplicates play' },
  { key: 'triples', code: 'TP', desc: 'Triples play' },
  { key: 'fallback', code: '—', desc: 'Default if a mode row is absent (admin)' },
];

export default function ThreeDRatesModal({ open, onClose, chart = {}, loading = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/65 p-2 sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-600 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-600 px-4 py-3">
          <div>
            <h3 className="text-lg font-black tracking-wide">3D rate chart</h3>
            <p className="text-xs text-emerald-200/90">Win ₹ per ₹1 played (same as Admin → Update Rate)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-500 bg-slate-800 p-2 hover:bg-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[min(72vh,520px)] overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading rates…</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-600 text-left text-slate-400">
                  <th className="py-2 pr-2 font-semibold">Play</th>
                  <th className="py-2 text-right font-semibold">× (per ₹1)</th>
                </tr>
              </thead>
              <tbody>
                {ROW_META.map((row) => {
                  const raw = chart[row.key];
                  const val = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : '—';
                  return (
                    <tr key={row.key} className="border-b border-slate-700/80 last:border-0">
                      <td className="py-2 pr-2 align-top text-slate-200">
                        <div className="font-semibold text-amber-200/95">{row.code}</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{row.desc}</div>
                      </td>
                      <td className="py-2 text-right align-top font-mono text-base font-black text-emerald-300">
                        {val === '—' ? '—' : `×${val}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
