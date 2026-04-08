import React from 'react';
import { QUIZ_GROUPS } from '../data/mockData';
import { formatQuizNumber, quizLabel } from '../utils/boardHelpers';

const QuizSelector = ({ activeQuiz, selectedQuizzes, multi, onToggleQuiz, onToggleMulti, onOpenResult }) => {
  return (
    <div className="bg-[#efefef] text-black border-b border-[#5f5f5f]">
      {QUIZ_GROUPS.map((group) => (
        <div key={group.setName} className="grid grid-cols-[78px_1fr_128px]">
          <div className="bg-[#e95757] text-white text-center h-10 leading-[40px] text-[11px] font-semibold border border-[#d1d1d1]">{group.setName}</div>
          <div className="grid grid-cols-10">
            {Array.from({ length: group.end - group.start + 1 }, (_, idx) => group.start + idx).map((quizNo) => {
              const isActive = multi ? selectedQuizzes.includes(quizNo) : activeQuiz === quizNo;
              return (
                <button
                  key={quizNo}
                  type="button"
                  onClick={() => onToggleQuiz(quizNo)}
                  className={`h-10 border border-[#8f8f8f] text-[11px] font-medium rounded-none ${isActive ? 'bg-[#f08ec7]' : 'bg-[#f3f3f3]'}`}
                >
                  {quizLabel(quizNo)}
                </button>
              );
            })}
          </div>
          <div className="border border-[#8f8f8f] bg-[#efefef] flex items-center justify-center gap-2 text-[11px]">
            {group.setName === 'Set A' && (
              <>
                <label className="flex items-center gap-1">
                  <input type="checkbox" readOnly className="w-3 h-3" />
                  All
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={multi} onChange={(e) => onToggleMulti(e.target.checked)} className="w-3 h-3" />
                  Multi
                </label>
              </>
            )}
            {group.setName === 'Set B' && (
              <button type="button" onClick={onOpenResult} className="bg-[#249ceb] text-white w-[94px] h-7 text-[11px] border border-[#1c87cd]">
                Last Result
              </button>
            )}
            {group.setName === 'Set C' && <span className="text-[11px] text-[#666]">{formatQuizNumber(activeQuiz)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default QuizSelector;
