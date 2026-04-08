import React from 'react';

const ResultModal = ({ open, onClose, rows }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3">
      <div className="w-full max-w-[820px] bg-[#f1f1f1] text-black border border-[#6c6c6c]">
        <div className="flex items-center justify-between px-2 py-1 border-b border-[#a1a1a1] bg-[#e3e3e3]">
          <h3 className="font-semibold text-[12px]">Last Result History</h3>
          <button type="button" onClick={onClose} className="px-2 h-6 bg-[#ef3f34] border border-[#c5362d] text-white text-[11px]">Close</button>
        </div>
        <table className="w-full text-[11px]">
          <thead className="bg-[#d9e4f5]">
            <tr>
              <th className="p-1 border border-[#a0a0a0]">Draw</th>
              <th className="p-1 border border-[#a0a0a0]">Quiz</th>
              <th className="p-1 border border-[#a0a0a0]">Result</th>
              <th className="p-1 border border-[#a0a0a0]">Sale</th>
              <th className="p-1 border border-[#a0a0a0]">At</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.draw}-${r.at}`} className="bg-[#f8f8f8]">
                <td className="p-1 border border-[#a0a0a0]">{r.draw}</td>
                <td className="p-1 border border-[#a0a0a0]">{r.quiz}</td>
                <td className="p-1 border border-[#a0a0a0]">{r.result}</td>
                <td className="p-1 border border-[#a0a0a0]">{r.sale}</td>
                <td className="p-1 border border-[#a0a0a0]">{r.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultModal;
