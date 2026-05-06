import React from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'X'];

const Keypad = ({ onKey }) => {
  return (
    <div className="grid grid-cols-4 gap-[5px] touch-manipulation select-none">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          className={`${k === 'X' ? 'col-span-2' : ''} h-[80px] border text-[40px] leading-none font-extrabold rounded-[2px] shadow-sm active:scale-[0.98] transition touch-manipulation ${
            k === 'X'
              ? 'border-[#d63f35] bg-[#f04438] text-white hover:bg-[#e83d32]'
              : 'border-[#8a8a8a] bg-[#f4f4f4] text-black hover:bg-[#ececec]'
          }`}
        >
          {k}
        </button>
      ))}
    </div>
  );
};

export default Keypad;
