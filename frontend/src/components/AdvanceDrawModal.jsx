import React, { useEffect, useMemo, useState } from 'react';

const AdvanceDrawModal = ({
  open,
  title = 'ADVANCE DRAW',
  nextLabel = '',
  slotOptions = [],
  selectedSlots = [],
  onSelectCount,
  onToggleSlot,
  onToggleAll,
  onApply,
  onClose,
}) => {
  const selectedCount = useMemo(
    () => (Array.isArray(selectedSlots) ? selectedSlots.length : 0),
    [selectedSlots],
  );
  const totalSlots = Array.isArray(slotOptions) ? slotOptions.length : 0;
  const remainingSlots = Math.max(0, totalSlots - selectedCount);
  const [selectionDraft, setSelectionDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectionDraft(selectedCount > 0 ? String(selectedCount) : '');
  }, [open, selectedCount]);

  const handleSelectionCountChange = (value) => {
    const cleaned = String(value || '').replace(/\D/g, '');
    if (cleaned === '') {
      setSelectionDraft('');
      if (typeof onSelectCount === 'function') onSelectCount(0);
      return;
    }
    const parsed = Number.parseInt(cleaned, 10);
    const clampedCount = Math.max(0, Math.min(totalSlots, Number.isFinite(parsed) ? parsed : 0));
    setSelectionDraft(String(clampedCount));
    if (typeof onSelectCount === 'function') onSelectCount(clampedCount);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-0 md:p-1">
      <div className="flex h-[100dvh] w-full max-w-[1500px] flex-col overflow-hidden rounded-none border border-[#c9c9c9] bg-[#f7f7f7] shadow-2xl md:h-[96dvh] md:rounded-md">
        <div className="relative flex items-center justify-center border-b border-[#d8d8d8] bg-[#f5f5f5] px-2 py-0.5 text-black md:py-2">
          <h3 className="text-[14px] font-bold tracking-wide md:text-[34px]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-1 top-0.5 inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#7c3f00] bg-[#a85a00] text-[22px] font-black leading-none text-black hover:brightness-110 md:top-1 md:h-10 md:w-10 md:text-[30px]"
            aria-label="Close advance draw modal"
          >
            ×
          </button>
        </div>

        <div className="border-b border-[#d8d8d8] bg-[#f1f1f1] px-2 py-0.5 text-[#1f2937] md:py-2">
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <div className="text-[9px] font-medium md:text-[14px]">
              Remaining Draw: <span className="font-semibold">{remainingSlots}</span>
            </div>
            <div className="text-[9px] font-medium md:text-[14px]">
              Next Draw in: <span className="font-semibold">{nextLabel || '-'}</span>
            </div>
          </div>

          <div className="mt-0.5 grid grid-cols-[1fr_auto] items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={selectionDraft}
              onChange={(e) => handleSelectionCountChange(e.target.value)}
              placeholder="Selection"
              className="h-8 rounded-sm border border-[#2ca44f] bg-[#f3fff6] px-2 text-center text-[18px] font-bold text-[#0f172a] md:h-10 md:px-3 md:text-[22px]"
            />
            <button
              type="button"
              onClick={onToggleAll}
              className="h-6 rounded-sm border border-[#7c3f00] bg-[#a85a00] px-2 text-[9px] font-semibold text-white md:h-9 md:px-3 md:text-[12px]"
            >
              {selectedCount === totalSlots && totalSlots > 0 ? 'Clear All' : 'Select All'}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f5f5] px-1 py-0.5 md:px-2 md:py-2">
          <div className="grid grid-cols-12 gap-1 md:grid-cols-10">
            {slotOptions.map((slot) => {
              const isActive = selectedSlots.includes(slot.slotStartIso);
              return (
                <button
                  key={slot.slotStartIso}
                  type="button"
                  onClick={() => onToggleSlot(slot.slotStartIso)}
                  className={`h-11 rounded-md border-2 px-1 text-[17px] font-extrabold leading-tight text-white shadow-sm transition md:h-12 md:text-[20px] ${
                    isActive
                      ? 'border-[#0d2be3] bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8]'
                      : 'border-[#7c3f00] bg-gradient-to-b from-[#b56a07] to-[#9a5600]'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#d8d8d8] bg-[#f1f1f1] px-2 py-0.5 md:px-2.5 md:py-2">
          <div className="text-[9px] font-semibold text-[#1f2937] md:text-[12px]">Selected: {selectedCount}</div>
          <button
            type="button"
            onClick={onApply}
            className="h-6 min-w-[70px] rounded-sm border border-[#1748b7] bg-[#0d2be3] px-2 text-[9px] font-semibold text-white md:h-9 md:min-w-[88px] md:px-3 md:text-[12px]"
          >
            OKAY
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvanceDrawModal;
