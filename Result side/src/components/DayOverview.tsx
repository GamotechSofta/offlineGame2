import type { ResultSlot } from '../api/results'
import { getQuizGroups } from '../constants/quizGroups'
import type { GameMode } from '../utils/formatResult'
import { formatResultDigits } from '../utils/formatResult'
import { formatIstDateLabel, formatIstWeekday } from '../utils/dates'

type DayOverviewProps = {
  mode: GameMode
  dateKey: string
  todayKey: string
  slots: ResultSlot[]
  loading: boolean
}

export default function DayOverview({ mode, dateKey, todayKey, slots, loading }: DayOverviewProps) {
  const latest = slots[0]
  const oldest = slots.length > 1 ? slots[slots.length - 1] : null
  const isToday = dateKey === todayKey

  const panelResults = latest?.results ?? []
  const a = panelResults.find((r) => r.quizId === 1)
  const b = panelResults.find((r) => r.quizId === 2)
  const c = panelResults.find((r) => r.quizId === 3)

  return (
    <section className="hidden min-h-0 w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-sm transition-opacity duration-300 lg:flex xl:w-72 2xl:w-80">
      <div className="relative overflow-hidden border-b border-[#152842] bg-gradient-to-br from-[#243d63] via-[#1B3150] to-[#152842] px-4 py-4 text-white">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-200/90">Selected date</p>
        <p className="mt-1.5 text-lg font-bold leading-tight">{formatIstDateLabel(dateKey)}</p>
        <p className="mt-0.5 text-xs text-blue-100/90">
          {formatIstWeekday(dateKey)} · {mode.toUpperCase()} · IST
        </p>
        {isToday && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100 ring-1 ring-emerald-400/30">
            <span className="rs-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live today
          </span>
        )}
      </div>

      <div className="scroll-area flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {loading && (
          <div className="space-y-3">
            <div className="rs-skeleton mx-auto h-8 w-32 rounded-lg" />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rs-skeleton h-24 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {!loading && slots.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-slate-600">No draws yet</p>
            <p className="mt-1 text-xs text-slate-400">Pick another date from the sidebar</p>
          </div>
        )}

        {!loading && latest && (
          <div className="mx-auto w-full">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm">
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Latest draw</p>
              <p className="mt-1 text-center text-2xl font-extrabold tabular-nums text-[#1B3150]">{latest.timeLabel}</p>

              {mode === '3d' ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: 'A', value: a?.result, bg: 'bg-blue-600', light: 'from-blue-50 to-white border-blue-100' },
                    { label: 'B', value: b?.result, bg: 'bg-rose-600', light: 'from-rose-50 to-white border-rose-100' },
                    { label: 'C', value: c?.result, bg: 'bg-emerald-600', light: 'from-emerald-50 to-white border-emerald-100' },
                  ].map((panel) => (
                    <div
                      key={panel.label}
                      className={`rounded-xl border bg-gradient-to-b p-2.5 text-center ${panel.light}`}
                    >
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold text-white ${panel.bg}`}>
                        {panel.label}
                      </span>
                      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-wider text-slate-900">
                        {formatResultDigits(panel.value, mode)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 space-y-1.5">
                  {getQuizGroups('2d').map((group) => (
                    <div key={group.setName} className="flex items-stretch gap-1">
                      <span
                        className={`flex w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white ${group.headerBg}`}
                      >
                        {group.setName}
                      </span>
                      <div className="grid min-w-0 flex-1 grid-cols-5 gap-0.5">
                        {Array.from({ length: group.end - group.start + 1 }, (_, i) => group.start + i).map(
                          (quizId) => {
                            const row = panelResults.find((r) => r.quizId === quizId)
                            return (
                              <span
                                key={quizId}
                                className={`rounded px-0.5 py-1 text-center text-[8px] font-bold tabular-nums leading-none ${group.cellBg}`}
                              >
                                {formatResultDigits(row?.result, '2d')}
                              </span>
                            )
                          },
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-800">{slots.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">First draw</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">{oldest?.timeLabel ?? latest.timeLabel}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
