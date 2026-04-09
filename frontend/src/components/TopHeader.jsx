import React from 'react';
import { Wallet } from 'lucide-react';

const TopHeader = ({ now, walletBalance = 0, onOpenThreeD }) => {
  const formattedBalance = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(walletBalance) || 0);
  const dateValue = now instanceof Date ? now : new Date();
  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateValue);
  const formattedTime = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
    .format(dateValue)
    .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
  const nextDrawDate = (() => {
    const next = new Date(dateValue);
    next.setMilliseconds(0);
    next.setSeconds(0);
    const currentMinutes = next.getHours() * 60 + next.getMinutes();
    const nextQuarterMinutes = (Math.floor(currentMinutes / 15) + 1) * 15;
    const dayMinutes = 24 * 60;
    const wrappedMinutes = nextQuarterMinutes % dayMinutes;
    next.setHours(Math.floor(wrappedMinutes / 60), wrappedMinutes % 60, 0, 0);
    if (nextQuarterMinutes >= dayMinutes) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  })();
  const formattedTimeToDraw = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
    .format(nextDrawDate)
    .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);

  return (
    <div className="bg-black border-b border-[#3f3f3f] px-2 h-[58px] text-[10px]">
      <div className="grid grid-cols-[120px_160px_240px_1fr] gap-2 items-center h-full">
        <div className="leading-tight">
          <div className="text-[#e5e5e5] text-[12px]">DR DATE</div>
          <div className="text-[14px] leading-none mt-[1px]">{formattedDate}</div>
        </div>
        <div className="leading-tight">
          <div className="text-[#e5e5e5] text-[12px]">Time To Draw</div>
          <div className="text-[14px] leading-none mt-[1px]">{formattedTimeToDraw}</div>
        </div>
        <div className="leading-tight text-[13px]">
          <div className="leading-none">Last Tr. GM26032818006025</div>
          <div className="leading-none mt-[2px]">Last Sale. 180</div>
        </div>
        <div className="flex items-center justify-end gap-2 h-full">
          <button
            type="button"
            onClick={onOpenThreeD}
            className="bg-[#f28b1d] border border-[#d97816] text-white px-3 h-10 text-[16px] font-semibold leading-none"
          >
            3D Quiz
          </button>
          <button
            type="button"
            className="h-10 min-w-[132px] px-3 bg-[#0f0f0f] border border-[#3f3f3f] rounded-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] flex items-center justify-center gap-2 text-[24px] font-semibold leading-none tracking-[0.2px] text-white"
            aria-label="Wallet balance"
          >
            <Wallet size={16} strokeWidth={2.25} className="text-[#f3c36b]" />
            <span>{formattedBalance}</span>
          </button>
          <div className="text-right leading-none text-[13px]">
            <div>{formattedDate}</div>
            <div className="mt-[2px]">{formattedTime}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopHeader;
