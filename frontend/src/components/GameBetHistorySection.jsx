import React from 'react';
import BetHistoryCard from './BetHistoryCard';

const GameBetHistorySection = ({ rows = [], loading = false, hasUser = false }) => {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#1B3150]">Game Bet History</h3>
        {!loading && rows.length > 0 ? (
          <span className="text-xs text-gray-500">Showing latest {rows.length} bets</span>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-600 text-sm">
          Loading game bet history...
        </div>
      ) : !hasUser ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-600 text-sm">
          Please login to see your game bet history.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-600 text-sm">
          No game bets found.
        </div>
      ) : (
        <div className="rounded-2xl bg-gray-50 border-2 border-gray-200 p-3 sm:p-4">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
            {rows.map((row, i) => (
              <BetHistoryCard
                key={`${row.key}-${i}`}
                index={i + 1}
                betId={row.betId}
                session={row.session}
                marketTitle={row.marketTitle}
                gameLabel={row.gameLabel}
                betValue={row.betValue}
                betAmount={row.betAmount}
                winPayout={row.winPayout}
                statusLabel={row.statusLabel}
                timeFormatted={row.timeFormatted}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBetHistorySection;
