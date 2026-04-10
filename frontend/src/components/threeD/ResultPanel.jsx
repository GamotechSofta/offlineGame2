import React from 'react';

const panelStyles = {
  A: {
    header:
      'bg-gradient-to-b from-blue-500 via-blue-600 to-indigo-800 shadow-[0_3px_10px_rgba(37,99,235,0.4)] ring-1 ring-white/35',
    cell:
      'bg-gradient-to-b from-blue-600 via-blue-700 to-indigo-900 shadow-[0_2px_6px_rgba(30,64,175,0.32)] ring-1 ring-white/45',
  },
  B: {
    header:
      'bg-gradient-to-b from-rose-500 via-red-600 to-red-800 shadow-[0_3px_10px_rgba(220,38,38,0.38)] ring-1 ring-white/35',
    cell:
      'bg-gradient-to-b from-rose-600 via-red-700 to-red-900 shadow-[0_2px_6px_rgba(185,28,28,0.34)] ring-1 ring-white/45',
  },
  C: {
    header:
      'bg-gradient-to-b from-emerald-500 via-teal-600 to-emerald-800 shadow-[0_3px_10px_rgba(5,150,105,0.38)] ring-1 ring-white/35',
    cell:
      'bg-gradient-to-b from-emerald-600 via-teal-700 to-emerald-900 shadow-[0_2px_6px_rgba(4,120,87,0.34)] ring-1 ring-white/45',
  },
};

const ResultPanel = ({ title, digits, isUpdated }) => {
  const styles = panelStyles[title] || panelStyles.A;

  return (
    <div
      className={`flex h-full min-h-0 flex-col gap-1 rounded-lg p-0.5 transition-shadow ${
        isUpdated
          ? 'shadow-[0_0_18px_rgba(251,191,36,0.4)] ring-2 ring-amber-400/90 ring-offset-1 ring-offset-[#f5f7fc]'
          : ''
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg py-1 text-white transition hover:brightness-[1.03] ${styles.header}`}
      >
        <span className="text-[22px] font-bold leading-none drop-shadow-sm sm:text-[24px]">{title}</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-1">
        {digits.map((digit, idx) => (
          <div
            key={`${title}-${idx}`}
            className={`flex min-h-[32px] items-center justify-center rounded-lg text-[20px] font-bold leading-none text-white transition hover:brightness-[1.04] active:scale-[0.98] sm:min-h-[34px] sm:text-[22px] ${styles.cell}`}
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultPanel;
