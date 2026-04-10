import React from 'react';

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const Keypad = ({ onDigit, onClear, onDelete, onIncreasePoint, onDecreasePoint, onNext, onSelectPointBox, points, isPointBoxActive }) => {
  return (
    <div className="bg-white border-2 border-[#d9d9d9] rounded-lg p-4 shadow-sm">
      <div className="grid grid-cols-[64px_1fr_64px] gap-3 mb-3">
        <button
          type="button"
          onClick={onDecreasePoint}
          className="h-14 bg-[#ef3f34] border border-[#d4372f] rounded text-[32px] font-bold text-white leading-none"
        >
          -
        </button>
        <button
          type="button"
          onClick={onSelectPointBox}
          className={`h-14 border rounded bg-white flex items-center justify-center text-[30px] font-semibold ${
            isPointBoxActive ? 'border-[#2e59c6] ring-2 ring-[#2e59c6]/20' : 'border-[#d0d0d0]'
          }`}
        >
          {Number.isFinite(Number(points)) ? Number(points) : 0}
        </button>
        <button
          type="button"
          onClick={onIncreasePoint}
          className="h-14 bg-[#ef3f34] border border-[#d4372f] rounded text-[32px] font-bold text-white leading-none"
        >
          +
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3.5">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onDigit(key)}
            className="h-14 bg-[#f8f8f8] border border-[#d0d0d0] rounded text-[32px] font-semibold text-[#222]"
          >
            {key}
          </button>
        ))}
        <button type="button" onClick={onClear} className="h-14 bg-[#ef3f34] border border-[#d4372f] rounded text-[28px] font-semibold text-white">
          C
        </button>
        <button type="button" onClick={onDelete} className="h-14 bg-[#ef3f34] border border-[#d4372f] rounded text-[28px] font-semibold text-white">
          X
        </button>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mt-3 w-full h-16 bg-[#ef3f34] border border-[#d4372f] rounded text-[34px] font-semibold text-white leading-none"
      >
        NEXT
      </button>
    </div>
  );
};

export default Keypad;
