import React, { memo } from 'react';
import BoardCell from './BoardCell';
import { getBoardNumbers, getCellKey } from '../utils/boardHelpers';

const NumberBoard = ({
  activeQuiz,
  selectedMap,
  activeTarget,
  activeFilter,
  rowPointDisplay,
  colPointDisplay,
  onSelectTarget,
}) => {
  const numbers = getBoardNumbers();
  const isVisible = (num) => {
    if (activeFilter === 'even') return num % 2 === 0;
    if (activeFilter === 'odd') return num % 2 !== 0;
    return true;
  };

  return (
    <div className="h-full bg-[#d7d7d7] px-[6px] pt-[10px] pb-[10px] border-r border-[#8a8a8a] flex flex-col">
      <div className="grid grid-cols-11 gap-[9px]">
        <div className="text-[#3799d5] text-[17px] leading-tight font-bold pl-1 pt-[6px] whitespace-nowrap">
          BLOCK
        </div>
        {Array.from({ length: 10 }, (_, i) => {
          const hasVisibleInCol = Array.from({ length: 10 }, (_, row) => row * 10 + i).some((n) => isVisible(n));
          return (
            <button
              key={`head-${i}`}
              type="button"
              disabled={!hasVisibleInCol}
              onClick={() => onSelectTarget({ type: 'col', index: i })}
              className={`h-[34px] border-[2px] text-center text-[12px] leading-none ${
                !hasVisibleInCol
                  ? 'border-[#bdbdbd] bg-[#e9e9e9] opacity-50 cursor-not-allowed'
                  : activeTarget?.type === 'col' && activeTarget?.index === i
                    ? 'border-[#4aba4f] bg-[#efffe8]'
                    : 'border-[#3ea1de] bg-white'
              }`}
            >
              <span className="text-[#d4a5b0] font-semibold">{colPointDisplay?.[i] || ''}</span>
              {hasVisibleInCol && activeTarget?.type === 'col' && activeTarget?.index === i ? <span className="blink-caret ml-[2px]">|</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-[8px] flex-1 flex flex-col gap-[4px] sm:gap-[6px] lg:gap-[7px]">
        {Array.from({ length: 10 }, (_, row) => {
          const rowNums = numbers.slice(row * 10, row * 10 + 10);
          return (
            <div key={row} className="grid grid-cols-11 gap-[9px]">
              <button
                type="button"
                onClick={() => onSelectTarget({ type: 'row', index: row })}
                className={`h-[34px] border-[2px] mt-[1px] text-center text-[12px] leading-none ${
                  activeTarget?.type === 'row' && activeTarget?.index === row
                    ? 'border-[#4aba4f] bg-[#efffe8]'
                    : 'border-[#3ea1de] bg-white'
                }`}
              >
                <span className="text-[#d4a5b0] font-semibold">{rowPointDisplay?.[row] || ''}</span>
                {activeTarget?.type === 'row' && activeTarget?.index === row ? <span className="blink-caret ml-[2px]">|</span> : null}
              </button>
              {rowNums.map((num) => {
                const visible = isVisible(num);
                const key = getCellKey(activeQuiz, num);
                const value = selectedMap[key];
                const isTargetSelected =
                  (activeTarget?.type === 'cell' && activeTarget?.index === num) ||
                  (activeTarget?.type === 'row' && Math.floor(num / 10) === activeTarget?.index) ||
                  (activeTarget?.type === 'col' && num % 10 === activeTarget?.index);
                if (!visible) {
                  return <div key={`hidden-${key}`} className="h-[clamp(50px,7.1vh,68px)] pointer-events-none opacity-0" />;
                }
                return (
                  <BoardCell
                    key={key}
                    quizNo={activeQuiz}
                    num={num}
                    value={value}
                    selected={Boolean(value)}
                    targetSelected={isTargetSelected}
                    onSelectTarget={onSelectTarget}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(NumberBoard);
