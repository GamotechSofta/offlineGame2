import { useRef, useState } from 'react'
import type { ResultSlot } from '../api/results'
import type { GameMode } from '../utils/formatResult'
import { formatIstDateShort, formatIstWeekday } from '../utils/dates'
import DateSidebar from './DateSidebar'

type MobileDateBarProps = {
  mode: GameMode
  dateKey: string
  todayKey: string
  recentDates: string[]
  slots: ResultSlot[]
  drawCountByDate: Record<string, number>
  drawCount: number
  isToday: boolean
  refreshing: boolean
  onSelectDate: (date: string) => void
  onJumpToSlot: (slotStartIso: string) => void
}

export default function MobileDateBar({
  mode,
  dateKey,
  todayKey,
  recentDates,
  slots,
  drawCountByDate,
  drawCount,
  isToday,
  refreshing,
  onSelectDate,
  onJumpToSlot,
}: MobileDateBarProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const selectDate = (next: string) => {
    if (!next || next > todayKey) return
    onSelectDate(next)
    setCalendarOpen(false)
  }

  const openNativePicker = () => {
    const input = dateInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      void input.showPicker()
      return
    }
    input.click()
  }

  const chipClass = (active: boolean) =>
    `flex min-h-10 shrink-0 items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors active:scale-[0.98] ${
      active
        ? 'border-[#1B3150] bg-[#1B3150] text-white shadow-sm'
        : 'border-slate-200 bg-white text-slate-800 active:bg-slate-50'
    }`

  return (
    <>
      <div className="shrink-0 border-b border-slate-200 bg-white shadow-sm lg:hidden">
        <p className="border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Select date · swipe for more
        </p>
        <div className="scroll-area flex items-stretch gap-2 overflow-x-auto px-3 py-2.5">
          <button type="button" onClick={() => selectDate(todayKey)} className={chipClass(dateKey === todayKey)}>
            Today
          </button>

          {recentDates
            .filter((d) => d !== todayKey)
            .map((d) => {
              const active = d === dateKey
              const [dd, mm] = d.split('-').slice(1).reverse()
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => selectDate(d)}
                  className={`flex min-h-10 min-w-[3.5rem] shrink-0 flex-col items-center justify-center rounded-xl border px-2.5 text-center active:scale-[0.98] ${
                    active
                      ? 'border-[#1B3150] bg-[#1B3150] text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-800 active:bg-white'
                  }`}
                >
                  <span className={`text-[9px] font-semibold uppercase leading-none ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                    {formatIstWeekday(d).slice(0, 3)}
                  </span>
                  <span className="mt-0.5 text-sm font-bold tabular-nums leading-none">
                    {dd}/{mm}
                  </span>
                </button>
              )
            })}

          <button
            type="button"
            onClick={openNativePicker}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-base active:bg-white"
            aria-label="Pick date"
          >
            📅
          </button>
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1B3150]/25 bg-[#1B3150]/8 text-lg font-bold leading-none text-[#1B3150] active:bg-[#1B3150]/15"
            aria-label="Open calendar"
          >
            ⋯
          </button>

          <input
            ref={dateInputRef}
            type="date"
            value={dateKey}
            max={todayKey}
            onChange={(e) => selectDate(e.target.value)}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/90 px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1B3150]">All draws</p>
            <p className="truncate text-xs font-medium text-slate-600">
              {mode.toUpperCase()} · {formatIstDateShort(dateKey)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {refreshing && (
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                Updating…
              </span>
            )}
            {isToday && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <span className="rs-live-dot h-2 w-2 rounded-full bg-emerald-500" />
                Live
              </span>
            )}
            {drawCount > 0 && (
              <span className="rounded-full bg-[#1B3150] px-3 py-1 text-sm font-bold tabular-nums text-white shadow-sm">
                {drawCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {calendarOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close calendar"
            onClick={() => setCalendarOpen(false)}
          />
          <div className="relative max-h-[88vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-[#1B3150]">Choose date</p>
                <p className="text-xs text-slate-500">{mode.toUpperCase()} · IST</p>
              </div>
              <button
                type="button"
                onClick={() => setCalendarOpen(false)}
                className="min-h-10 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700"
              >
                Done
              </button>
            </div>
            <div className="scroll-area max-h-[calc(88vh-3.5rem)] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
              <DateSidebar
                embedded
                mode={mode}
                dateKey={dateKey}
                todayKey={todayKey}
                slots={slots}
                drawCountByDate={drawCountByDate}
                onSelectDate={selectDate}
                onJumpToSlot={(iso) => {
                  onJumpToSlot(iso)
                  setCalendarOpen(false)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
