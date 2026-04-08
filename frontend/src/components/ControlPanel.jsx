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
  onIncrease,
  onDecrease,
  onKeypad,
  onEnterAmount,
}) => {
  return (
    <div className="w-full lg:w-[200px] xl:w-[210px] bg-[#d5d5d5] px-2 py-1 text-[12px] text-black border-l border-[#8b8b8b]">
      <TimerCard time={timerText} />

      <button type="button" onClick={onAdvanceDraw} className="w-full mt-2 h-10 bg-[#ef3f34] text-white font-semibold border border-[#d4372f] text-[16px]">
        ADVANCE DRAW
      </button>
      <button type="button" onClick={onResetAll} className="w-full mt-1 h-10 bg-[#ef3f34] text-white font-semibold border border-[#d4372f] text-[16px]">
        RESET ALL
      </button>

      <div className="mt-2 text-[11px]">Family <input type="checkbox" className="ml-1 align-middle" /></div>
      <div className="mt-1 bg-black text-white px-2 h-6 flex items-center gap-2 text-[11px] border border-[#5d5d5d]">
        <label className="inline-flex items-center gap-1"><input type="checkbox" className="w-3 h-3" onChange={(e) => e.target.checked && onApplyFilter('all')} /> All</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" className="w-3 h-3" onChange={(e) => e.target.checked && onApplyFilter('even')} /> Even</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" className="w-3 h-3" onChange={(e) => e.target.checked && onApplyFilter('odd')} /> Odd</label>
      </div>

      <div className="mt-2">
        <AmountInput value={amountDraft} onIncrease={onIncrease} onDecrease={onDecrease} />
      </div>
      <div className="mt-2">
        <Keypad onKey={onKeypad} />
      </div>
      <button type="button" onClick={onEnterAmount} className="w-full mt-2 h-14 bg-[#ef3f34] text-white text-[32px] leading-none font-semibold border border-[#d4372f]">
        ENTER
      </button>
    </div>
  );
};

export default ControlPanel;
