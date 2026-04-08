import React from 'react';
import BoardCell from './BoardCell';
import { getBoardNumbers, getCellKey } from '../utils/boardHelpers';

const NumberBoard = ({
  activeQuiz,
  selectedMap,
  onCellClick,
  columnDrafts,
  rowDrafts,
  onColumnDraftChange,
  onRowDraftChange,
  onApplyColumn,
  onApplyRow,
}) => {
  const numbers = getBoardNumbers();

  return (
    <div className="h-full bg-[#d7d7d7] px-[6px] pt-[8px] pb-[12px] border-r border-[#8a8a8a]">
      <div className="grid grid-cols-[112px_1fr] gap-[8px]">
        <div className="text-[#3799d5] text-[28px] leading-none font-bold pl-1 pt-[4px]">BLOCK</div>
        <div className="grid grid-cols-10 gap-[8px]">
          {Array.from({ length: 10 }, (_, i) => {
            const draftValue = columnDrafts?.[i] ?? '';
            return (
              <input
                key={`head-${i}`}
                type="text"
                value={draftValue}
                onChange={(e) => onColumnDraftChange(i, e.target.value)}
                onBlur={() => onApplyColumn(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onApplyColumn(i);
                  }
                }}
                className="h-[18px] border-[2px] border-[#3ea1de] bg-white text-[#111] text-center text-[11px] leading-none outline-none"
              />
            );
          })}
        </div>
      </div>

      <div className="mt-[8px] space-y-[10px]">
        {Array.from({ length: 10 }, (_, row) => {
          const rowNums = numbers.slice(row * 10, row * 10 + 10);
          return (
            <div key={row} className="grid grid-cols-[112px_1fr] gap-[8px]">
              <input
                type="text"
                value={rowDrafts?.[row] ?? ''}
                onChange={(e) => onRowDraftChange(row, e.target.value)}
                onBlur={() => onApplyRow(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onApplyRow(row);
                  }
                }}
                className="h-[24px] border-[2px] border-[#3ea1de] bg-white mt-[4px] text-[#111] text-center text-[12px] leading-none outline-none"
              />
              <div className="grid grid-cols-10 gap-[8px]">
                {rowNums.map((num) => {
                  const key = getCellKey(activeQuiz, num);
                  const value = selectedMap[key];
                  return (
                    <BoardCell
                      key={key}
                      quizNo={activeQuiz}
                      num={num}
                      value={value}
                      selected={Boolean(value)}
                      onClick={() => onCellClick(num)}
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
