import React from 'react';

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const digitKeyClass =
  'h-14 rounded-xl bg-gradient-to-b from-white to-slate-100/95 text-[30px] font-bold leading-none text-slate-800 shadow-[0_2px_10px_rgba(15,23,42,0.09)] ring-1 ring-slate-200/80 transition hover:brightness-[1.03] hover:shadow-[0_4px_14px_rgba(15,23,42,0.12)] active:scale-[0.97]';

const Keypad = ({ onDigit, onClear, onDelete, onIncreasePoint, onDecreasePoint, onNext, onSelectPointBox, points, isPointBoxActive }) => {
  return (
    <div className="rounded-xl border-2 border-slate-400/80 bg-gradient-to-b from-slate-50/95 via-white to-slate-50/80 p-3 shadow-[0_10px_36px_rgba(15,23,42,0.1)] ring-1 ring-slate-500/20 sm:p-4">
      <div className="mb-3 grid grid-cols-[3.25rem_1fr_3.25rem] gap-2 sm:grid-cols-[3.5rem_1fr_3.5rem] sm:gap-3">
        <button
          type="button"
          onClick={onDecreasePoint}
          className="h-14 rounded-xl bg-gradient-to-b from-rose-500 via-rose-600 to-red-700 text-[30px] font-bold leading-none text-white shadow-[0_4px_14px_rgba(225,29,72,0.38)] ring-1 ring-white/30 transition hover:brightness-110 active:scale-[0.97] sm:text-[32px]"
        >
          −
        </button>
        <button
          type="button"
          onClick={onSelectPointBox}
          className={`flex h-14 items-center justify-center rounded-xl text-[28px] font-bold tabular-nums transition sm:text-[30px] ${
            isPointBoxActive
              ? 'border-2 border-indigo-500 bg-gradient-to-b from-indigo-50 to-white text-indigo-950 shadow-[inset_0_2px_8px_rgba(79,70,229,0.12),0_4px_16px_rgba(79,70,229,0.2)] ring-2 ring-indigo-400/35'
              : 'border border-slate-200/90 bg-gradient-to-b from-white to-slate-100/90 text-slate-800 shadow-[inset_0_2px_6px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70 hover:brightness-[1.02]'
          }`}
        >
          {Number.isFinite(Number(points)) ? Number(points) : 0}
        </button>
        <button
          type="button"
          onClick={onIncreasePoint}
          className="h-14 rounded-xl bg-gradient-to-b from-rose-500 via-rose-600 to-red-700 text-[30px] font-bold leading-none text-white shadow-[0_4px_14px_rgba(225,29,72,0.38)] ring-1 ring-white/30 transition hover:brightness-110 active:scale-[0.97] sm:text-[32px]"
        >
          +
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {keys.map((key) => (
          <button key={key} type="button" onClick={() => onDigit(key)} className={digitKeyClass}>
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={onClear}
          className="h-14 rounded-xl bg-gradient-to-b from-orange-500 via-amber-600 to-orange-700 text-[26px] font-bold text-white shadow-[0_4px_14px_rgba(234,88,12,0.38)] ring-1 ring-amber-100/40 transition hover:brightness-110 active:scale-[0.97] sm:text-[28px]"
        >
          C
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="h-14 rounded-xl bg-gradient-to-b from-rose-600 via-red-600 to-red-800 text-[26px] font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,0.4)] ring-1 ring-white/25 transition hover:brightness-110 active:scale-[0.97] sm:text-[28px]"
        >
          X
        </button>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mt-3 h-16 w-full rounded-xl bg-gradient-to-b from-violet-500 via-indigo-600 to-indigo-800 text-[28px] font-bold leading-none tracking-wide text-white shadow-[0_6px_22px_rgba(79,70,229,0.42)] ring-1 ring-white/35 transition hover:brightness-110 active:scale-[0.99] sm:text-[32px]"
      >
        NEXT
      </button>
    </div>
  );
};

export default Keypad;
