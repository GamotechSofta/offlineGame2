import React from 'react';
import { QUIZ_GROUPS } from '../data/mockData';
import { formatQuizNumber, quizLabel } from '../utils/boardHelpers';

const QuizSelector = ({
  activeQuiz,
  selectedQuizzes,
  multi,
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
    <div className="bg-[#efefef] text-black border-b border-[#5f5f5f]">
      {QUIZ_GROUPS.map((group) => (
        <div key={group.setName} className="grid grid-cols-[86px_1fr_136px]">
          <div className="bg-[#e95757] text-white text-center h-11 leading-[44px] text-[11px] font-semibold border border-[#d1d1d1]">{group.setName}</div>
          <div className="grid grid-cols-10">
            {Array.from({ length: group.end - group.start + 1 }, (_, idx) => group.start + idx).map((quizNo) => {
              const isActive = multi ? selectedQuizzes.includes(quizNo) : activeQuiz === quizNo;
              return (
                <button
                  key={quizNo}
                  type="button"
                  onClick={() => onToggleQuiz(quizNo)}
                  className={`h-11 border text-[11px] font-medium rounded-none ${getSetColors(group.setName, isActive)}`}
                >
                  {quizLabel(quizNo)}
                </button>
              );
            })}
          </div>
          <div className="border border-[#8f8f8f] bg-[#efefef] flex items-center justify-stretch text-[11px] h-11 p-0">
            {group.setName === 'Set A' && (
              <label
                className="w-full h-full flex items-center gap-2 px-3 bg-[#eb4f4f] text-white border border-[#c94343] text-[12px] font-semibold"
              >
                <input type="checkbox" checked={allChecked} onChange={(e) => onToggleAll(e.target.checked)} className="w-4 h-4 accent-white" />
                All
              </label>
            )}
            {group.setName === 'Set B' && (
              <label
                className="w-full h-full flex items-center gap-2 px-3 bg-[#eb4f4f] text-white border border-[#c94343] text-[12px] font-semibold"
              >
                <input type="checkbox" checked={multi} onChange={(e) => onToggleMulti(e.target.checked)} className="w-4 h-4 accent-white" />
                Multi
              </label>
            )}
            {group.setName === 'Set C' && (
              <button
                type="button"
                onClick={onOpenResult}
                className="w-full h-full bg-[#2d9de8] text-white text-[12px] font-semibold border border-[#1c87cd]"
              >
                Last Result
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default QuizSelector;
