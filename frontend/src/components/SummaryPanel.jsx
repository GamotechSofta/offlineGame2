import React from 'react';

const SummaryPanel = ({ totalAmount, setTotals, onBuy, buyDisabled, buyHelpLines = [] }) => {
  const rows = [
    { count: Number(setTotals?.setA?.count || 0), amount: Number(setTotals?.setA?.amount || 0) },
    { count: Number(setTotals?.setB?.count || 0), amount: Number(setTotals?.setB?.amount || 0) },
    { count: Number(setTotals?.setC?.count || 0), amount: Number(setTotals?.setC?.amount || 0) },
  ];

  return (
    <div className="w-full lg:w-[140px] xl:w-[148px] bg-[#b8c7df] border-r border-[#7f8ea2]">
      <div className="h-[56px] bg-[#2ca7e8] text-white flex items-center justify-center font-semibold border-b border-[#9aa4b2] text-[28px] leading-none">
        TOTAL
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className={`grid grid-cols-2 text-center ${idx % 2 === 0 ? 'bg-[#c3d4eb]' : 'bg-[#a9bede]'}`}>
          <div className="border border-[#b8c0ca] h-[56px] flex items-center justify-center text-[#f3e77d] text-[26px] leading-none">{row.count}</div>
          <div className="border border-[#b8c0ca] h-[56px] flex items-center justify-center text-[#f3e77d] text-[26px] leading-none">{row.amount}</div>
        </div>
      ))}
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="grid grid-cols-2 text-center bg-[#98accf]">
          <div className="border border-[#b8c0ca] h-[54px] flex items-center justify-center text-white text-[24px] leading-none">0</div>
          <div className="border border-[#b8c0ca] h-[54px] flex items-center justify-center text-white text-[24px] leading-none">0</div>
        </div>
      ))}
      <div className="grid grid-cols-2 text-center bg-[#85e65c]">
        <div className="border border-[#b8c0ca] h-[56px] flex items-center justify-center text-white font-semibold text-[20px] leading-none">TOTAL</div>
        <div className="border border-[#b8c0ca] h-[56px] flex items-center justify-center text-[#f3e77d] font-semibold text-[26px] leading-none">{totalAmount}</div>
      </div>
      <button
        type="button"
        onClick={onBuy}
        disabled={buyDisabled || !onBuy}
        className="w-full h-[62px] border-t border-[#d3372f] bg-[#ef3f34] text-[38px] font-semibold leading-none text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        BUY
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
