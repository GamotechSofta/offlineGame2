import React from 'react';

const SummaryPanel = ({ totalAmount, setTotals, onBuy, buyDisabled, buyHelpLines = [] }) => {
  const uniformCellTextClass = 'text-[clamp(28px,3vw,28px)] font-extrabold leading-none';
  const uniformLabelTextClass = 'text-[clamp(18px,2.1vw,18px)] font-extrabold leading-none';
  const rows = [
    { count: Number(setTotals?.setA?.count || 0), amount: Number(setTotals?.setA?.amount || 0) },
    { count: Number(setTotals?.setB?.count || 0), amount: Number(setTotals?.setB?.amount || 0) },
    { count: Number(setTotals?.setC?.count || 0), amount: Number(setTotals?.setC?.amount || 0) },
  ];

  return (
    <div className="w-full lg:w-[140px] xl:w-[148px] bg-[#b8c7df] border-r border-[#7f8ea2]">
      <div className={`h-[56px] bg-[#2ca7e8] text-white flex items-center justify-center border-b border-[#9aa4b2] ${uniformLabelTextClass}`}>
        TOTAL
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-2 text-center bg-[#9eb8dc]">
          <div className={`border border-[#9fb0c7] h-[56px] flex items-center justify-center text-[#111827] ${uniformCellTextClass}`}>{row.count}</div>
          <div className={`border border-[#9fb0c7] h-[56px] flex items-center justify-center text-[#111827] ${uniformCellTextClass}`}>{row.amount}</div>
        </div>
      ))}
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="grid grid-cols-2 text-center bg-[#9eb8dc]">
          <div className={`border border-[#9fb0c7] h-[54px] flex items-center justify-center text-[#0f172a] ${uniformCellTextClass}`}>0</div>
          <div className={`border border-[#9fb0c7] h-[54px] flex items-center justify-center text-[#0f172a] ${uniformCellTextClass}`}>0</div>
        </div>
      ))}
      <div className="grid grid-cols-2 text-center bg-[#85e65c]">
        <div className={`border border-[#8ecf70] h-[56px] flex items-center justify-center text-[#0b3d0b] ${uniformLabelTextClass}`}>TOTAL</div>
        <div className={`border border-[#8ecf70] h-[56px] flex items-center justify-center text-[#0b3d0b] ${uniformCellTextClass}`}>{totalAmount}</div>
      </div>
      <button
        type="button"
        onClick={onBuy}
        disabled={buyDisabled || !onBuy}
        className="w-full h-[62px] border-t border-[#b91c1c] bg-[#dc2626] flex items-center justify-center whitespace-nowrap text-[26px] tracking-tight font-bold leading-none text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        BUY NOW
      </button>
      {Array.isArray(buyHelpLines) && buyHelpLines.length > 0 && (
        <div className="border-t border-[#c9a227] bg-[#fff8dc] px-1 py-1.5 text-[9px] font-semibold leading-snug text-[#5c2222]">
          {buyHelpLines.map((line, i) => (
            <p key={i} className="m-0 mb-0.5 last:mb-0">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default SummaryPanel;
