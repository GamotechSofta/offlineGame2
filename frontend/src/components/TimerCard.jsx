import React from 'react';

const TimerCard = ({ time }) => {
  return (
    <div className="bg-black border border-[#656565]">
      <div className="text-center text-[13px] py-1.5 text-white">Timer</div>
      <div className="text-center text-[54px] leading-none pb-2.5 text-white">{time}</div>
    </div>
  );
};

export default TimerCard;
