import React from 'react';
import { formatQuizNumber } from '../utils/boardHelpers';

const BoardCell = ({ quizNo, num, value, selected, targetSelected, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-[clamp(50px,7.1vh,68px)] rounded-none px-[1px] pt-[1px] pb-0 bg-transparent"
    >
      <div
        className={`h-[34px] border-[2px] mb-[2px] text-[clamp(12px,1.12vw,15px)] font-semibold flex items-center justify-center ${
          selected
            ? 'border-[#2ea73f] bg-[#dcffd1] text-[#0f172a] font-bold'
            : targetSelected
              ? 'border-[#4aba4f] bg-[#f7fff4] text-transparent'
              : 'border-[#1f1f1f] bg-[#fbfbfb] text-transparent'
        }`}
      >
        {selected ? value : ''}
        {!selected && targetSelected ? <span className="blink-caret">|</span> : null}
      </div>
      <div className="text-[#111] font-semibold tracking-tight text-[clamp(12px,1.16vw,15px)] leading-none">
        Q{formatQuizNumber(quizNo)}-{formatQuizNumber(num)}
      </div>
    </button>
  );
};

export default BoardCell;
