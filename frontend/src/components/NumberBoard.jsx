import React from 'react';
import BoardCell from './BoardCell';
import { getBoardNumbers, getCellKey } from '../utils/boardHelpers';

const NumberBoard = ({
  activeQuiz,
  selectedMap,
  activeTarget,
  rowPointDisplay,
  colPointDisplay,
  onSelectTarget,
}) => {
  const numbers = getBoardNumbers();

  return (
    <div className="h-full bg-[#d7d7d7] px-[6px] pt-[8px] pb-[12px] border-r border-[#8a8a8a]">
      <div className="grid grid-cols-[112px_1fr] gap-[8px]">
        <div className="text-[#3799d5] text-[28px] leading-none font-bold pl-1 pt-[4px]">BLOCK</div>
        <div className="grid grid-cols-10 gap-[8px]">
          {Array.from({ length: 10 }, (_, i) => (
            <button
              key={`head-${i}`}
              type="button"
              onClick={() => onSelectTarget({ type: 'col', index: i })}
              className={`h-[18px] border-[2px] text-center text-[11px] leading-none ${
                activeTarget?.type === 'col' && activeTarget?.index === i
                  ? 'border-[#4aba4f] bg-[#efffe8]'
                  : 'border-[#3ea1de] bg-white'
              }`}
            >
              <span className="text-[#d4a5b0] font-semibold">{colPointDisplay?.[i] || ''}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-[8px] space-y-[10px]">
        {Array.from({ length: 10 }, (_, row) => {
          const rowNums = numbers.slice(row * 10, row * 10 + 10);
          return (
            <div key={row} className="grid grid-cols-[112px_1fr] gap-[8px]">
              <button
                type="button"
                onClick={() => onSelectTarget({ type: 'row', index: row })}
                className={`h-[24px] border-[2px] mt-[4px] text-center text-[12px] leading-none ${
                  activeTarget?.type === 'row' && activeTarget?.index === row
                    ? 'border-[#4aba4f] bg-[#efffe8]'
                    : 'border-[#3ea1de] bg-white'
                }`}
              >
                <span className="text-[#d4a5b0] font-semibold">{rowPointDisplay?.[row] || ''}</span>
              </button>
              <div className="grid grid-cols-10 gap-[8px]">
                {rowNums.map((num) => {
                  const key = getCellKey(activeQuiz, num);
                  const value = selectedMap[key];
                  const isTargetSelected =
                    (activeTarget?.type === 'cell' && activeTarget?.index === num) ||
                    (activeTarget?.type === 'row' && Math.floor(num / 10) === activeTarget?.index) ||
                    (activeTarget?.type === 'col' && num % 10 === activeTarget?.index);
                  return (
                    <BoardCell
                      key={key}
                      quizNo={activeQuiz}
                      num={num}
                      value={value}
                      selected={Boolean(value)}
                      targetSelected={isTargetSelected}
                      onClick={() => onSelectTarget({ type: 'cell', index: num })}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NumberBoard;
