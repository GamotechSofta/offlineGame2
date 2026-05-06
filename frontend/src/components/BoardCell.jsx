import React, { memo } from 'react';
import { formatQuizNumber } from '../utils/boardHelpers';

const BoardCell = ({ quizNo, num, value, selected, targetSelected, onSelectTarget }) => {
  const cellCode = `Q${formatQuizNumber(quizNo)}-${formatQuizNumber(num)}`;
  return (
    <button
      type="button"
      onClick={() => onSelectTarget({ type: 'cell', index: num })}
      className="h-[clamp(50px,7.1vh,68px)] rounded-none px-[1px] pt-[1px] pb-0 bg-transparent"
    >
      <div
        className={`h-[34px] border-[2px] mb-0 text-[clamp(13px,1.2vw,16px)] font-semibold flex items-center justify-center gap-[2px] ${
          selected
            ? 'border-[#2ea73f] bg-[#dcffd1] text-[#0f172a] font-bold'
            : targetSelected
              ? 'border-[#4aba4f] bg-[#f7fff4] text-transparent'
              : 'border-[#1f1f1f] bg-[#fbfbfb] text-[#9ca3af]'
        }`}
      >
        {selected ? (
          <span className="text-[clamp(18px,1.9vw,24px)] font-extrabold leading-none">{value}</span>
        ) : !targetSelected ? (
          <span className="font-semibold">{cellCode}</span>
        ) : null}
        {targetSelected ? <span className="blink-caret font-normal">|</span> : null}
      </div>
      <div className="mt-0 text-[#111] font-bold tracking-tight text-[17px] sm:text-[clamp(15px,1.45vw,19px)] leading-none">
        {cellCode}
      </div>
    </button>
  );
};

export default memo(BoardCell);
