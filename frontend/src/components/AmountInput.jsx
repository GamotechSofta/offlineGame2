import React from 'react';

const AmountInput = ({ value, onIncrease, onDecrease }) => {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onDecrease} className="w-9 h-9 rounded-full bg-[#de5f5f] text-white text-[24px] leading-none border border-[#b84c4c]">-</button>
      <div className="flex-1 h-9 bg-white text-black border border-[#777] flex items-center justify-center text-[32px] leading-none">{value}</div>
      <button type="button" onClick={onIncrease} className="w-9 h-9 rounded-full bg-[#de5f5f] text-white text-[24px] leading-none border border-[#b84c4c]">+</button>
    </div>
  );
};

export default AmountInput;
