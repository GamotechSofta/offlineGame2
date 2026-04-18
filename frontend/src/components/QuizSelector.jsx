import React from 'react';
import { QUIZ_GROUPS } from '../data/mockData';
import { pad2, quizLabel } from '../utils/boardHelpers';

const prevSlotLabel = (winningPosition) => {
  if (winningPosition == null || !Number.isInteger(winningPosition)) return '—';
  return pad2(winningPosition);
};

/** Same size + weight as quiz names (Quiz01) across this bar */
const selectorTextClass = 'text-[clamp(15px,2.6vw,19px)] font-extrabold leading-none tracking-tight';

const QuizSelector = ({
  activeQuiz,
  selectedQuizzes,
  multi,
  lastDrawByQuiz,
  previousSlotTimeLabel,
  onToggleQuiz,
  onToggleMulti,
  onToggleAll,
  onOpenResult,
}) => {
  const allChecked = selectedQuizzes.length === 30;
  const getSetColors = (setName, isActive) => {
    if (!isActive) return 'bg-white border-[#8f8f8f]';
    if (setName === 'Set A') return 'bg-[#f4a7c8] border-[#bf6f95]';
    if (setName === 'Set B') return 'bg-[#a9c9ff] border-[#6e94d1]';
    return 'bg-[#b8e6b8] border-[#77b077]';
  };
  return (
    <div className="flex flex-row items-stretch bg-[#efefef] text-black border-b border-[#5f5f5f]">
      <div
        className="flex w-[76px] shrink-0 flex-col items-center justify-center gap-0 border border-[#e5d9bc] bg-[#fff9e6] px-2 py-1.5 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]"
        aria-label="Previous slot result time"
      >
        <span className={`${selectorTextClass} tabular-nums text-[#1a1a1a]`}>
          {previousSlotTimeLabel || '—'}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
      {QUIZ_GROUPS.map((group) => (
        <div key={group.setName} className="grid grid-cols-[86px_1fr_136px] items-stretch">
          <div
            className={`bg-[#e95757] text-white text-center min-h-[48px] flex items-center justify-center border border-[#d1d1d1] px-1 py-0.5 ${selectorTextClass}`}
          >
            {group.setName}
          </div>
          <div className="grid grid-cols-10">
            {Array.from({ length: group.end - group.start + 1 }, (_, idx) => group.start + idx).map((quizNo) => {
              const isActive = multi ? selectedQuizzes.includes(quizNo) : activeQuiz === quizNo;
              const prev = lastDrawByQuiz?.[quizNo];
              return (
                <button
                  key={quizNo}
                  type="button"
                  onClick={() => onToggleQuiz(quizNo)}
                  className={`min-h-[48px] w-full border px-0.5 py-0.5 sm:px-1 rounded-none flex flex-row flex-nowrap items-center justify-center gap-x-1 sm:gap-x-1.5 leading-none ${getSetColors(group.setName, isActive)}`}
                >
                  <span className={`${selectorTextClass} text-[#111] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap shrink`}>
                    {quizLabel(quizNo)}
                  </span>
                  <span className={`${selectorTextClass} shrink-0 text-[#6b6b6b]`} aria-hidden>
                    –
                  </span>
                  <span className={`${selectorTextClass} tabular-nums text-[#2d9de8] shrink-0`}>
                    {prevSlotLabel(prev)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border border-[#8f8f8f] bg-[#efefef] flex items-center justify-stretch min-h-[48px] p-0">
            {group.setName === 'Set A' && (
              <label
                className={`w-full h-full flex cursor-pointer items-center gap-2 px-2 sm:px-3 bg-[#eb4f4f] text-white border border-[#c94343] ${selectorTextClass}`}
              >
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  className="w-5 h-5 accent-slate-900 bg-white border border-[#d9d9d9] rounded-[2px] shrink-0"
                />
                All
              </label>
            )}
            {group.setName === 'Set B' && (
              <label
                className={`w-full h-full flex cursor-pointer items-center gap-2 px-2 sm:px-3 bg-[#eb4f4f] text-white border border-[#c94343] ${selectorTextClass}`}
              >
                <input
                  type="checkbox"
                  checked={multi}
                  onChange={(e) => onToggleMulti(e.target.checked)}
                  className="w-5 h-5 accent-slate-900 bg-white border border-[#d9d9d9] rounded-[2px] shrink-0"
                />
                Multi
              </label>
            )}
            {group.setName === 'Set C' && (
              <button
                type="button"
                onClick={onOpenResult}
                className={`w-full h-full bg-[#2d9de8] text-white border border-[#1c87cd] ${selectorTextClass}`}
              >
                Old Results
              </button>
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
};

export default QuizSelector;
