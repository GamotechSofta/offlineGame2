import React from 'react';

const defaultColumns = [
  { key: 'draw', label: 'Draw' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'result', label: 'Result' },
  { key: 'sale', label: 'Sale' },
  { key: 'at', label: 'At' },
];

/**
 * @param {{ open: boolean, onClose: () => void, rows: object[], loading?: boolean, error?: string, title?: string, columns?: { key: string, label: string }[] }} props
 */
const ResultModal = ({ open, onClose, rows = [], loading = false, error = '', title = 'Last Result History', columns }) => {
  if (!open) return null;
  const cols = Array.isArray(columns) && columns.length ? columns : defaultColumns;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[90vh] w-full max-w-[920px] flex-col border border-[#6c6c6c] bg-[#f1f1f1] text-black">
        <div className="flex shrink-0 items-center justify-between border-b border-[#a1a1a1] bg-[#e3e3e3] px-2 py-1">
          <h3 className="text-[12px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="h-6 border border-[#c5362d] bg-[#ef3f34] px-2 text-[11px] text-white">
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && <p className="p-3 text-center text-[12px]">लोड होत आहे…</p>}
          {error && <p className="p-3 text-center text-[12px] text-red-700">{error}</p>}
          {!loading && !error && (
            <table className="w-full text-[11px]">
              <thead className="bg-[#d9e4f5]">
                <tr>
                  {cols.map((c) => (
                    <th key={c.key} className="border border-[#a0a0a0] p-1">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.key ?? `${r.draw ?? r.drawLabel}-${r.at ?? idx}`} className="bg-[#f8f8f8]">
                    {cols.map((c) => (
                      <td key={c.key} className="break-words border border-[#a0a0a0] p-1 align-top">
                        {r[c.key] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultModal;
