import type { ResultSlot } from '../api/results'
import type { GameMode } from '../utils/formatResult'
import { formatResultDigits } from '../utils/formatResult'

type MobileLatestBarProps = {
  mode: GameMode
  slots: ResultSlot[]
  loading: boolean
}

export default function MobileLatestBar({ mode, slots, loading }: MobileLatestBarProps) {
  const latest = slots[0]
  if (loading && !latest) return null
  if (!latest) return null

  const panelResults = latest.results ?? []
  const a = panelResults.find((r) => r.quizId === 1)
  const b = panelResults.find((r) => r.quizId === 2)
  const c = panelResults.find((r) => r.quizId === 3)

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5 lg:hidden">
      <div className="flex items-center gap-2">
        <div className="shrink-0 rounded-lg bg-[#1B3150] px-2 py-1 text-center text-white">
          <p className="text-[8px] font-bold uppercase tracking-wide text-amber-300">Latest</p>
          <p className="text-xs font-bold tabular-nums">{latest.timeLabel}</p>
        </div>

        {mode === '3d' ? (
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
            {[
              { label: 'A', value: a?.result, bg: 'bg-blue-600', light: 'bg-blue-50 border-blue-100' },
              { label: 'B', value: b?.result, bg: 'bg-rose-600', light: 'bg-rose-50 border-rose-100' },
              { label: 'C', value: c?.result, bg: 'bg-emerald-600', light: 'bg-emerald-50 border-emerald-100' },
            ].map((panel) => (
              <div key={panel.label} className={`rounded-lg border px-1 py-1 text-center ${panel.light}`}>
                <span className={`inline-block rounded px-1.5 py-px text-[9px] font-bold text-white ${panel.bg}`}>
                  {panel.label}
                </span>
                <p className="mt-0.5 text-base font-extrabold tabular-nums text-slate-900 sm:text-lg">
                  {formatResultDigits(panel.value, mode)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium text-slate-500">Total draws today</p>
            <p className="text-xl font-extrabold tabular-nums text-[#1B3150]">{slots.length}</p>
          </div>
        )}
      </div>
    </div>
  )
}
