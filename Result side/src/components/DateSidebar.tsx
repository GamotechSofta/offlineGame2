import { useEffect, useMemo, useState } from 'react'
import type { ResultSlot } from '../api/results'
import type { GameMode } from '../utils/formatResult'
import {
  buildMonthCalendarCells,
  formatIstMonthYear,
  getIstMonthKey,
  shiftIstDateKey,
  shiftIstMonth,
} from '../utils/dates'

type DateSidebarProps = {
  mode: GameMode
  dateKey: string
  todayKey: string
  slots: ResultSlot[]
  drawCountByDate: Record<string, number>
  onSelectDate: (date: string) => void
  onJumpToSlot: (slotStartIso: string) => void
  embedded?: boolean
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DateSidebar({
  mode,
  dateKey,
  todayKey,
  slots,
  drawCountByDate,
  onSelectDate,
  onJumpToSlot,
  embedded = false,
}: DateSidebarProps) {
  const [viewMonth, setViewMonth] = useState(() => getIstMonthKey(dateKey))
  const [jumpValue, setJumpValue] = useState('')

  useEffect(() => {
    setViewMonth(getIstMonthKey(dateKey))
  }, [dateKey])

  useEffect(() => {
    setJumpValue(slots[0]?.slotStartIso ?? '')
  }, [dateKey, slots])

  const calendarCells = useMemo(
    () => buildMonthCalendarCells(viewMonth, todayKey),
    [viewMonth, todayKey],
  )

  const canGoNextMonth = viewMonth < getIstMonthKey(todayKey)
  const yesterdayKey = shiftIstDateKey(todayKey, -1)

  const handleJump = (slotStartIso: string) => {
    if (!slotStartIso) return
    onJumpToSlot(slotStartIso)
    setJumpValue(slotStartIso)
  }

  const panel = (
    <>
      {!embedded && (
        <div className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3.5">
          <p className="text-sm font-bold uppercase tracking-wider text-[#1B3150]">Date wise</p>
          <p className="mt-0.5 text-xs text-slate-500">{mode.toUpperCase()} · tap a date</p>
        </div>
      )}

      <div className={`scroll-area p-3 ${embedded ? '' : 'min-h-0 flex-1 overflow-y-auto'}`}>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectDate(todayKey)
              setViewMonth(getIstMonthKey(todayKey))
            }}
            className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
              dateKey === todayKey
                ? 'border-[#1B3150] bg-[#1B3150] text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectDate(yesterdayKey)
              setViewMonth(getIstMonthKey(yesterdayKey))
            }}
            className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
              dateKey === yesterdayKey
                ? 'border-[#1B3150] bg-[#1B3150] text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Yesterday
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block px-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Pick any date
          </span>
          <input
            type="date"
            value={dateKey}
            max={todayKey}
            onChange={(e) => {
              const next = e.target.value
              if (!next || next > todayKey) return
              onSelectDate(next)
              setViewMonth(getIstMonthKey(next))
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800"
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => shiftIstMonth(m, -1))}
              className="rounded-lg px-3 py-1 text-lg font-bold text-slate-600 hover:bg-white"
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-sm font-bold text-[#1B3150]">{formatIstMonthYear(viewMonth)}</p>
            <button
              type="button"
              onClick={() => canGoNextMonth && setViewMonth((m) => shiftIstMonth(m, 1))}
              disabled={!canGoNextMonth}
              className="rounded-lg px-3 py-1 text-lg font-bold text-slate-600 hover:bg-white disabled:opacity-30"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1 text-[11px] font-bold uppercase text-slate-400">
                {day}
              </span>
            ))}
            {calendarCells.map((cell, index) => {
              if (!cell.dateKey) {
                return <span key={`empty-${index}`} className="h-9 sm:h-10" />
              }

              const active = cell.dateKey === dateKey
              const count = drawCountByDate[cell.dateKey]
              const dayNum = parseInt(cell.dateKey.split('-')[2], 10)

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  disabled={cell.isFuture}
                  onClick={() => onSelectDate(cell.dateKey!)}
                  title={count != null ? `${count} draws` : undefined}
                  className={`relative flex h-9 flex-col items-center justify-center rounded-lg text-sm font-bold tabular-nums transition-colors sm:h-10 ${
                    active
                      ? 'bg-[#1B3150] text-white shadow-sm'
                      : cell.isFuture
                        ? 'cursor-not-allowed text-slate-300'
                        : cell.isToday
                          ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200'
                          : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  {dayNum}
                  {count != null && count > 0 && !active && (
                    <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[#1B3150]/50" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {slots.length > 0 && (
          <div className="mt-3">
            <label className="block">
              <span className="mb-1.5 block px-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Jump to draw
              </span>
              <select
                value={jumpValue || slots[0]?.slotStartIso || ''}
                onChange={(e) => handleJump(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800"
              >
                {slots.map((slot, index) => (
                  <option key={slot.slotStartIso} value={slot.slotStartIso}>
                    {index === 0 ? `${slot.timeLabel} · Latest` : slot.timeLabel}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-1.5 px-0.5 text-xs text-slate-500">{slots.length} draws on this date</p>
          </div>
        )}
      </div>
    </>
  )

  if (embedded) {
    return <div className="w-full bg-white">{panel}</div>
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-slate-200/80 bg-white shadow-sm">
      {panel}
    </aside>
  )
}
