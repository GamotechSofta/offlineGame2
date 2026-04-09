import React from 'react';

const BetList = ({ bets, onRemove, totalPoints }) => {
  const getDisplayBetNumber = (bet) =>
    String(bet?.mode || '').toLowerCase() === 'fp'
      ? String(bet?.number || '').slice(0, 2)
      : bet?.number;

  if (!bets.length) {
    return (
      <div className="bg-white border border-[#d8d8d8] rounded p-6 text-center text-[#888] text-[24px]">
        No bets placed yet
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#d8d8d8] rounded overflow-hidden">
      <div className="h-8 px-3 bg-[#f4c12d] border-b border-[#d9a91a] text-[13px] font-semibold text-[#222] flex items-center justify-between">
        <span>Total Bets: {bets.length}</span>
        <span>Total Points: {totalPoints}</span>
      </div>
      <div className="hidden md:grid grid-cols-[1fr_120px_100px_80px] bg-[#f4f6fa] border-b border-[#d8d8d8] text-[13px] font-semibold text-[#223]">
        <div className="px-3 py-2">Number</div>
        <div className="px-3 py-2">Type</div>
        <div className="px-3 py-2 text-right">Points</div>
        <div className="px-3 py-2 text-right">Action</div>
      </div>
      {bets.map((bet) => (
        <div
          key={bet.id}
          className={`grid grid-cols-2 md:grid-cols-[1fr_120px_100px_80px] border-b border-[#ededed] last:border-b-0 text-[14px] transition-colors duration-300 ${
            bet.outcome === 'win' ? 'bg-[#eaf8ea]' : bet.outcome === 'loss' ? 'bg-[#ffecec]' : ''
          } ${bet.justAdded ? 'animate-pulse' : ''}`}
        >
          <div className="px-3 py-2 font-semibold"><span className="md:hidden text-[12px] text-[#666] mr-2">No:</span>{getDisplayBetNumber(bet)}</div>
          <div className="px-3 py-2 uppercase text-right md:text-left"><span className="md:hidden text-[12px] text-[#666] mr-2">Type:</span>{bet.mode}</div>
          <div className="px-3 py-2"><span className="md:hidden text-[12px] text-[#666] mr-2">Pts:</span>{bet.points}</div>
          <div className="px-3 py-2 text-right">
            <button type="button" onClick={() => onRemove(bet.id)} className="text-[#d23a2f] font-semibold">
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BetList;
