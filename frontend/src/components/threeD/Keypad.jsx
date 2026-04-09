import React from 'react';

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const Keypad = ({ onDigit, onClear, onDelete, onIncreasePoint, onDecreasePoint, onNext, points }) => {
  return (
    <div className="bg-white border-2 border-[#d9d9d9] rounded-lg p-2 shadow-sm">
      <div className="grid grid-cols-[44px_1fr_44px] gap-2 mb-2">
        <button
          type="button"
          onClick={onDecreasePoint}
          className="h-10 bg-[#ef3f34] border border-[#d4372f] rounded text-[24px] font-bold text-white leading-none"
        >
          -
        </button>
        <div className="h-10 border border-[#d0d0d0] rounded bg-white flex items-center justify-center text-[20px] font-semibold">
          {points}
        </div>
        <button
          type="button"
          onClick={onIncreasePoint}
          className="h-10 bg-[#ef3f34] border border-[#d4372f] rounded text-[24px] font-bold text-white leading-none"
        >
          +
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onDigit(key)}
            className="h-10 bg-[#f8f8f8] border border-[#d0d0d0] rounded text-[20px] font-semibold text-[#222]"
          >
            {key}
          </button>
        ))}
        <button type="button" onClick={onClear} className="h-10 bg-[#ef3f34] border border-[#d4372f] rounded text-[18px] font-semibold text-white">
          C
        </button>
        <button type="button" onClick={onDelete} className="h-10 bg-[#ef3f34] border border-[#d4372f] rounded text-[18px] font-semibold text-white">
          X
        </button>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mt-2 w-full h-11 bg-[#ef3f34] border border-[#d4372f] rounded text-[22px] font-semibold text-white leading-none"
      >
        NEXT
      </button>
    </div>
  );
};

export default Keypad;
