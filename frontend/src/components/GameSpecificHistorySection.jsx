import React from 'react';
import BetHistoryCard from './BetHistoryCard';

const GameSpecificHistorySection = ({ title, rows = [], hasUser = false }) => {
  return (
    <section className="rounded-2xl border-2 border-gray-200 bg-white p-3 sm:p-4">
      <h3 className="text-base sm:text-lg font-bold text-[#1B3150] mb-3">{title}</h3>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          {hasUser ? `No ${title} records found.` : 'Please login to see your game bet history.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
          {rows.map((row, i) => (
            <BetHistoryCard
              key={row.key}
              index={i + 1}
              betId={row.betValue}
              session={row.session}
              marketTitle={row.marketTitle.toUpperCase()}
              gameLabel={row.gameLabel}
              betValue={row.betValue}
              betAmount={row.betAmount}
              winPayout={row.winPayout}
              statusLabel={row.statusLabel}
              timeFormatted={row.timeFormatted}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default GameSpecificHistorySection;
