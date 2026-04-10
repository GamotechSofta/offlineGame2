import React from 'react';

const colorMap = {
  A: 'bg-[#294ca9]',
  B: 'bg-[#c43f26]',
  C: 'bg-[#1f7a57]',
};

const ResultPanel = ({ title, digits, isUpdated }) => {
  const panelBg = colorMap[title] || colorMap.A;

  return (
    <div
      className={`flex flex-col gap-1.5 h-full min-h-0 ${isUpdated ? 'ring-2 ring-yellow-300/90 rounded-xl p-0.5' : ''}`}
    >
      <div className={`${panelBg} text-white rounded-lg flex items-center justify-center py-2.5 shrink-0`}>
        <span className="text-[34px] font-bold leading-none">{title}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 min-h-0 flex-1">
        {digits.map((digit, idx) => (
          <div
            key={`${title}-${idx}`}
            className={`${panelBg} border border-white text-white rounded-lg flex items-center justify-center text-[30px] font-bold leading-none min-h-[44px]`}
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultPanel;
