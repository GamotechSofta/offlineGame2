import React from 'react';

const AmountInput = ({ value, onIncrease, onDecrease }) => {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDecrease}
        className="w-11 h-11 rounded-[10px] bg-gradient-to-b from-[#4b5563] to-[#374151] text-white text-[28px] leading-none border border-[#2f3946] shadow-sm hover:brightness-110 active:scale-[0.97] transition"
      >
        -
      </button>
      <div className="flex-1 h-11 bg-[#f7f7f7] text-black border border-[#8a8a8a] rounded-[2px] flex items-center justify-center text-[38px] leading-none shadow-inner">
        {value}
      </div>
      <button
        type="button"
        onClick={onIncrease}
        className="w-11 h-11 rounded-[10px] bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-white text-[28px] leading-none border border-[#15803d] shadow-sm hover:brightness-110 active:scale-[0.97] transition"
      >
        +
      </button>
    </div>
  );
};

export default AmountInput;
