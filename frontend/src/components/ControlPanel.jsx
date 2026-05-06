import React from 'react';
import TimerCard from './TimerCard';
import AmountInput from './AmountInput';
import Keypad from './Keypad';
import { FILTER_TYPES } from '../types';

const ControlPanel = ({
  timerText,
  amountDraft,
  onAdvanceDraw,
  onResetAll,
  onApplyFilter,
  onToggleFamilyMode,
  activeFilter,
  familyMode,
  onIncrease,
  onDecrease,
  onKeypad,
}) => {
  return (
    <div className="w-full h-full lg:w-[200px] xl:w-[210px] bg-[#d5d5d5] px-2 py-2 text-[12px] text-black border-l border-[#8b8b8b] flex flex-col">
      <div>
        <TimerCard time={timerText} />

        <button type="button" onClick={onAdvanceDraw} className="w-full mt-2 h-12 bg-[#ef3f34] text-white font-semibold border border-[#d4372f] text-[20px] rounded-[2px] shadow-sm hover:bg-[#e83d32] transition">
          ADVANCE DRAW
        </button>
        <button type="button" onClick={onResetAll} className="w-full mt-1 h-12 bg-[#ef3f34] text-white font-semibold border border-[#d4372f] text-[20px] rounded-[2px] shadow-sm hover:bg-[#e83d32] transition">
          RESET ALL
        </button>

        <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-gradient-to-b from-[#0b0b0b] to-[#141414] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          {[
            { key: FILTER_TYPES.ALL, label: 'All' },
            { key: FILTER_TYPES.EVEN, label: 'Even' },
            { key: FILTER_TYPES.ODD, label: 'Odd' },
            { key: 'family-mode', label: 'Family' },
          ].map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => (filter.key === 'family-mode' ? onToggleFamilyMode() : onApplyFilter(filter.key))}
              className={`h-10 rounded-md border text-center text-[22px] leading-none font-extrabold tracking-tight transition ${
                (filter.key === 'family-mode' ? familyMode : activeFilter === filter.key)
                  ? 'border-[#1e88e5] bg-gradient-to-b from-[#35a7ff] to-[#0b84e5] text-white shadow-[0_4px_12px_rgba(11,132,229,0.35)]'
                  : 'border-[#9a9a9a] bg-gradient-to-b from-[#f8f8f8] to-[#e7e7e7] text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] hover:from-[#ffffff] hover:to-[#ececec]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

      </div>

      <div className="mt-auto pt-3">
        <AmountInput value={amountDraft} onIncrease={onIncrease} onDecrease={onDecrease} />
      </div>
      <div className="mt-3 mb-5">
        <Keypad onKey={onKeypad} />
      </div>
    </div>
  );
};

export default ControlPanel;
