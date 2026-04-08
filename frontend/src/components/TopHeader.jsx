import React from 'react';
import { Menu, RefreshCw, Wallet } from 'lucide-react';

const TopHeader = ({ now }) => {
  return (
    <div className="bg-black border-b border-[#3f3f3f] px-2 h-[52px] text-[10px]">
      <div className="grid grid-cols-[120px_140px_110px_220px_1fr] gap-2 items-center h-full">
        <div className="text-white text-[24px] leading-none pl-1">Mahalakshmi</div>
        <div className="leading-tight">
          <div className="text-[#e5e5e5] text-[10px]">Time To Draw</div>
          <div className="text-[12px] leading-none mt-[1px]">8:45:00 AM</div>
        </div>
        <div className="leading-tight">
          <div className="text-[#e5e5e5] text-[10px]">DR DATE</div>
          <div className="text-[12px] leading-none mt-[1px]">2026-04-08</div>
        </div>
        <div className="leading-tight text-[11px]">
          <div className="leading-none">Last Tr. GM26032818006025</div>
          <div className="leading-none mt-[2px]">Last Sale. 180</div>
        </div>
        <div className="flex items-center justify-end gap-2 h-full">
          <button type="button" className="bg-[#f28b1d] border border-[#d97816] text-white px-3 h-9 text-[12px] leading-none">
            3D Quiz
          </button>
          <div className="bg-[#0f73b8] border border-[#4aa0d7] px-2 h-9 flex items-center gap-1 min-w-[120px] justify-center text-[12px] leading-none">
            <Wallet size={18} />
            <span>******</span>
          </div>
          <button type="button" className="text-[#40a8f0]"><RefreshCw size={20} /></button>
          <div className="text-right leading-none text-[11px]">
            <div>04/08/2026</div>
            <div className="mt-[2px]">{now}</div>
          </div>
          <button type="button" className="text-[#d63a3a]"><Menu size={22} /></button>
        </div>
      </div>
    </div>
  );
};

export default TopHeader;
