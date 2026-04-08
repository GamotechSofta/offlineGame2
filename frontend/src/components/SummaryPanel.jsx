import React from 'react';

const SummaryPanel = ({ count, totalAmount }) => {
  return (
    <div className="w-full lg:w-[140px] xl:w-[148px] bg-[#b8c7df] border-r border-[#7f8ea2]">
      <div className="h-[44px] bg-[#2ca7e8] text-white flex items-center justify-center font-semibold border-b border-[#9aa4b2] text-[24px] leading-none">
        TOTAL
      </div>
      <div className="grid grid-cols-2 text-center">
        <div className="border border-[#b8c0ca] h-[38px] flex items-center justify-center text-[#f3e77d] text-[24px] leading-none">{count}</div>
        <div className="border border-[#b8c0ca] h-[38px] flex items-center justify-center text-[#f3e77d] text-[24px] leading-none">{totalAmount}</div>
      </div>
      {Array.from({ length: 7 }).map((_, idx) => (
        <div key={idx} className="grid grid-cols-2 text-center bg-[#98accf]">
          <div className="border border-[#b8c0ca] h-[38px] flex items-center justify-center text-white text-[22px] leading-none">0</div>
          <div className="border border-[#b8c0ca] h-[38px] flex items-center justify-center text-white text-[22px] leading-none">0</div>
        </div>
      ))}
      <div className="grid grid-cols-2 text-center bg-[#85e65c]">
        <div className="border border-[#b8c0ca] h-[38px] flex items-center justify-center text-[#f3e77d] font-semibold text-[24px] leading-none">{count}</div>
        <div className="border border-[#b8c0ca] h-[38px] flex items-center justify-center text-[#f3e77d] font-semibold text-[24px] leading-none">{totalAmount}</div>
      </div>
      <button type="button" className="w-full h-[52px] bg-[#ef3f34] text-white font-semibold border-t border-[#d3372f] text-[34px] leading-none">
        BUY
      </button>
    </div>
  );
};

export default SummaryPanel;
