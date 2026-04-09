import React from 'react';

const colorMap = {
  A: 'from-[#2346a5] to-[#1d3274]',
  B: 'from-[#c7461e] to-[#8e2f10]',
  C: 'from-[#1f7a57] to-[#14513a]',
};

const ResultPanel = ({ title, digits, isUpdated, lastResultText }) => {
  return (
    <div
      className={`rounded-lg bg-gradient-to-r ${colorMap[title] || colorMap.A} text-white border border-white/20 p-2 shadow-sm transition-all duration-300 ${
        isUpdated ? 'ring-2 ring-yellow-300/90 scale-[1.01]' : ''
      }`}
    >
      <div className="text-center text-[28px] font-bold leading-none">{title}</div>
      <div className="text-center text-[11px] mt-1 text-white/85">Last Result: {lastResultText}</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {digits.map((digit, idx) => (
          <div
            key={`${title}-${idx}`}
            className={`bg-white/10 border border-white/20 rounded text-center text-[30px] font-bold leading-none py-2 transition-opacity duration-300 ${
              isUpdated ? 'opacity-100' : 'opacity-95'
            }`}
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultPanel;
