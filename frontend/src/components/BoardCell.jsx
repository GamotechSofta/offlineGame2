import React from 'react';
import { formatQuizNumber } from '../utils/boardHelpers';

const BoardCell = ({ quizNo, num, value, selected, targetSelected, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-[clamp(38px,5.4vh,50px)] rounded-none px-[1px] pt-[1px] pb-0 bg-transparent"
    >
      <div
        className={`h-[clamp(15px,2.2vh,24px)] border-[2px] mb-[3px] text-[clamp(10px,0.95vw,12px)] font-semibold leading-[1] ${
          selected
            ? 'border-[#4aba4f] bg-[#efffe8] text-[#d4a5b0]'
            : targetSelected
              ? 'border-[#4aba4f] bg-[#f7fff4] text-transparent'
              : 'border-[#1f1f1f] bg-[#fbfbfb] text-transparent'
        }`}
      >
        {selected ? value : ''}
        {!selected && targetSelected ? <span className="blink-caret">|</span> : null}
      </div>
      <div className="text-[#111] font-semibold tracking-tight text-[clamp(9px,0.88vw,11px)] leading-none">
        Q{formatQuizNumber(quizNo)}-{formatQuizNumber(num)}
      </div>
    </button>
  );
};

export default BoardCell;
