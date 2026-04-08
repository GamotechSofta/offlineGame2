import React from 'react';
import TimerCard from './TimerCard';
import AmountInput from './AmountInput';
import Keypad from './Keypad';

const ControlPanel = ({
  timerText,
  amountDraft,
  onAdvanceDraw,
  onResetAll,
  onApplyFilter,
  activeFilter,
  onIncrease,
  onDecrease,
  onKeypad,
  onEnterAmount,
}) => {
  return (
    <div className="w-full h-full lg:w-[200px] xl:w-[210px] bg-[#d5d5d5] px-2 py-2 text-[12px] text-black border-l border-[#8b8b8b] flex flex-col">
      <TimerCard time={timerText} />

      <button type="button" onClick={onAdvanceDraw} className="w-full mt-2 h-12 bg-[#ef3f34] text-white font-semibold border border-[#d4372f] text-[20px] rounded-[2px] shadow-sm hover:bg-[#e83d32] transition">
        ADVANCE DRAW
      </button>
      <button type="button" onClick={onResetAll} className="w-full mt-1 h-12 bg-[#ef3f34] text-white font-semibold border border-[#d4372f] text-[20px] rounded-[2px] shadow-sm hover:bg-[#e83d32] transition">
        RESET ALL
      </button>

      <div className="mt-2 bg-black text-white px-2 h-12 flex items-center gap-3 text-[16px] border border-[#5d5d5d] rounded-[2px]">
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" className="w-4 h-4" checked={activeFilter === 'all'} onChange={() => onApplyFilter('all')} />
          All
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" className="w-4 h-4" checked={activeFilter === 'even'} onChange={() => onApplyFilter('even')} />
          Even
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" className="w-4 h-4" checked={activeFilter === 'odd'} onChange={() => onApplyFilter('odd')} />
          Odd
        </label>
      </div>

      <div className="mt-3">
        <AmountInput value={amountDraft} onIncrease={onIncrease} onDecrease={onDecrease} />
      </div>
      <div className="mt-3">
        <Keypad onKey={onKeypad} />
      </div>
      <button type="button" onClick={onEnterAmount} className="w-full mt-3 h-[72px] bg-[#ef3f34] text-white text-[42px] leading-none font-semibold border border-[#d4372f] rounded-[2px] shadow-md hover:bg-[#e83d32] active:scale-[0.99] transition">
        ENTER
      </button>
    </div>
  );
};

export default ControlPanel;
