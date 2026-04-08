import React from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'C', 'X'];

const Keypad = ({ onKey }) => {
  return (
    <div className="grid grid-cols-4 gap-[3px]">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          className={`h-11 border border-[#7e7e7e] text-[16px] leading-none font-semibold rounded-none ${k === 'C' || k === 'X' ? 'bg-[#f04438] text-white' : 'bg-[#f3f3f3] text-black'}`}
        >
          {k}
        </button>
      ))}
    </div>
  );
};

export default Keypad;
