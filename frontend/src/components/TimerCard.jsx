import React from 'react';

const TimerCard = ({ time }) => {
  return (
    <div className="bg-black border border-[#656565]">
      <div className="text-center text-[11px] py-0.5 text-white">Timer</div>
      <div className="text-center text-[42px] leading-none pb-1 text-white">{time}</div>
    </div>
  );
};

export default TimerCard;
