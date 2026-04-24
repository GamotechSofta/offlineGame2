import React, { useMemo } from 'react';

const AdvanceDrawModal = ({
  open,
  title = 'ADVANCE DRAW',
  currentLabel = '',
  nextLabel = '',
  slotOptions = [],
  selectedSlots = [],
  onToggleSlot,
  onToggleAll,
  onApply,
  onClose,
}) => {
  const selectedCount = useMemo(
    () => (Array.isArray(selectedSlots) ? selectedSlots.length : 0),
    [selectedSlots],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-1.5 sm:p-3">
      <div className="flex h-[94vh] w-full max-w-[1220px] flex-col overflow-hidden rounded-[14px] border border-[#8ca0c2] bg-[#d8d9de] shadow-2xl">
        <div className="flex items-center justify-between bg-[#2447ab] px-3 py-2 text-white sm:px-4 sm:py-2.5">
          <h3 className="text-[18px] font-extrabold tracking-wide md:text-[34px]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-white/18 px-2 py-0.5 text-xl font-bold leading-none hover:bg-white/30 md:text-2xl"
            aria-label="Close advance draw modal"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-y border-[#b8c3d9] bg-[#dcdee2] px-2 py-2 text-[#1f2937] md:gap-3 md:px-4 md:py-3">
          <div className="text-[11px] font-semibold whitespace-nowrap md:text-[30px]">
            Current Draw: <span className="font-black">{currentLabel || '-'}</span>
          </div>
          <div className="text-[11px] font-semibold whitespace-nowrap md:text-[30px]">
            Next Draw: <span className="font-black">{nextLabel || '-'}</span>
          </div>
          <button
            type="button"
            onClick={onToggleAll}
            className="h-9 rounded-lg border border-[#18409f] bg-[#2759d8] px-3 text-[11px] font-extrabold text-white shadow-[0_2px_8px_rgba(30,64,175,0.35)] whitespace-nowrap md:h-11 md:px-4 md:text-[24px]"
          >
            {selectedCount === slotOptions.length && slotOptions.length > 0 ? 'Clear All' : 'Select All'}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#dbe0e8] px-1.5 py-1.5 md:py-2">
          <div className="mb-1 text-[10px] font-semibold text-[#4b5563] md:text-[14px]">
            Select one or more future draw slots.
          </div>
          <div className="grid grid-cols-6 gap-1.5 md:gap-2">
            {slotOptions.map((slot) => {
              const isActive = selectedSlots.includes(slot.slotStartIso);
              return (
                <button
                  key={slot.slotStartIso}
                  type="button"
                  onClick={() => onToggleSlot(slot.slotStartIso)}
                  className={`h-10 rounded-xl border-2 px-1 text-[9px] font-extrabold leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_4px_rgba(0,0,0,0.2)] transition md:h-11 md:text-[20px] ${
                    isActive
                      ? 'border-[#1d4ed8] bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] text-white'
                      : 'border-[#8a4d00] bg-gradient-to-b from-[#d08109] to-[#af6500] text-white'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#b8c3d9] bg-[#dcdee2] px-2.5 py-2 md:px-4 md:py-3">
          <div className="text-[11px] font-extrabold whitespace-nowrap text-[#1f2937] md:text-[28px]">
            Selected: {selectedCount}
          </div>
          <button
            type="button"
            onClick={onApply}
            className="h-9 min-w-[78px] rounded-lg border border-[#18409f] bg-gradient-to-b from-[#2f64ea] to-[#1d4ed8] px-3 text-[10px] font-extrabold text-white shadow-[0_2px_8px_rgba(30,64,175,0.35)] whitespace-nowrap md:h-11 md:min-w-[132px] md:px-4 md:text-[26px]"
          >
            OKAY
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvanceDrawModal;
