import React from 'react';

const TimerDisplay = ({ countdownText, currentTimeText, timeToDrawText, timerSeconds, intervalSeconds }) => {
  const isDanger = timerSeconds <= 10;
  const progress = Math.max(0, Math.min(100, (timerSeconds / intervalSeconds) * 100));

  return (
    <div className="w-full bg-[#f4c12d] border border-[#c79300] rounded-lg p-2 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-center">
        <div className="bg-white border border-[#d9d9d9] rounded-md px-2 py-2">
          <div className="text-[12px] text-[#444]">Time To Draw</div>
          <div className={`text-[28px] font-bold leading-none mt-1 ${isDanger ? 'text-[#d4372f] animate-pulse' : 'text-[#111]'}`}>
            {countdownText}
          </div>
          <div className="mt-2 h-1.5 w-full bg-[#efefef] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${isDanger ? 'bg-[#d4372f]' : 'bg-[#2e59c6]'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="bg-white border border-[#d9d9d9] rounded-md px-2 py-2">
          <div className="text-[12px] text-[#444]">Current Time</div>
          <div className="text-[16px] font-semibold text-[#111] leading-none mt-1">{currentTimeText}</div>
        </div>
        <div className="bg-white border border-[#d9d9d9] rounded-md px-2 py-2">
          <div className="text-[12px] text-[#444]">Next Draw</div>
          <div className="text-[16px] font-semibold text-[#111] leading-none mt-1">{timeToDrawText}</div>
        </div>
      </div>
    </div>
  );
};

export default TimerDisplay;
