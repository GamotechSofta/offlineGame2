import { getQuizGroups } from '../constants/quizGroups'
import type { ResultSlot } from '../api/results'
import type { GameMode } from '../utils/formatResult'
import { formatResultDigits, pad2 } from '../utils/formatResult'

type ResultSlotCardProps = {
  slot: ResultSlot
  mode: GameMode
  highlight?: boolean
  fillWidth?: boolean
}

function QuizResultLabel({
  quizId,
  result,
  mode,
}: {
  quizId: number
  result: number | null | undefined
  mode: GameMode
}) {
  const q = mode === '3d' ? String(quizId) : pad2(quizId)
  const digits = formatResultDigits(result, mode)

  return (
    <span className="inline-flex items-center justify-center gap-px whitespace-nowrap leading-none">
      <span>Q{q}</span>
      <span>-</span>
      <span>{digits}</span>
    </span>
  )
}

export default function ResultSlotCard({
  slot,
  mode,
  highlight = false,
  fillWidth = false,
}: ResultSlotCardProps) {
  const groups = getQuizGroups(mode)
  const is3d = mode === '3d'

  return (
    <article
      className={`flex w-full max-w-full overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        highlight
          ? 'border-amber-400/80 shadow-md shadow-amber-200/50 ring-2 ring-amber-400/40'
          : 'border-slate-200/90'
      }`}
    >
      <div
        className={`flex shrink-0 flex-col items-center justify-center border-r border-[#152842] bg-gradient-to-b from-[#243d63] to-[#1B3150] px-1 py-2 text-center text-white ${
          is3d ? 'w-12 min-[480px]:w-14' : 'w-10 min-[480px]:w-12 sm:w-14'
        }`}
      >
        {highlight && (
          <span className="mb-1 rounded-full bg-amber-400 px-1 py-px text-[6px] font-extrabold uppercase tracking-wide text-amber-950 min-[480px]:text-[7px]">
            Latest
          </span>
        )}
        <p className="text-[10px] font-bold leading-tight min-[480px]:text-xs">{slot.timeLabel}</p>
      </div>

      <div className={`min-w-0 flex-1 ${is3d && !fillWidth ? 'shrink-0' : 'w-full'}`}>
        {is3d ? (
          <div className={`flex items-stretch gap-1 p-1.5 min-[480px]:gap-1.5 ${fillWidth ? 'w-full' : ''}`}>
            {groups.map((group) => {
              const quizId = group.start
              const row = slot.results.find((r) => r.quizId === quizId)
              return (
                <div
                  key={group.setName}
                  className={`flex flex-col items-center overflow-hidden rounded-lg border border-black/10 ${group.cellBg} ${
                    fillWidth
                      ? 'min-w-0 flex-1'
                      : 'w-[3.75rem] shrink-0 min-[480px]:w-[4.25rem] sm:w-[4.75rem]'
                  }`}
                >
                  <p className={`w-full py-0.5 text-center text-[8px] font-bold tracking-wide text-white min-[480px]:py-1 min-[480px]:text-[9px] ${group.headerBg}`}>
                    {group.setName}
                  </p>
                  <p className="flex flex-1 items-center justify-center py-1.5 text-lg font-extrabold tabular-nums leading-none text-slate-900 min-[480px]:py-2 min-[480px]:text-xl sm:text-2xl">
                    {formatResultDigits(row?.result, mode)}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex w-full flex-col p-0.5 min-[480px]:p-1">
            {groups.map((group) => (
              <div key={group.setName} className="flex w-full border-b border-slate-200/80 last:border-b-0">
                <div
                  className={`flex w-7 shrink-0 items-center justify-center text-[9px] font-bold text-white min-[480px]:w-8 min-[480px]:text-[10px] sm:w-9 ${group.headerBg}`}
                >
                  {group.setName}
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-5 gap-0.5 p-0.5 min-[480px]:grid-cols-10 min-[480px]:gap-1 min-[480px]:p-1">
                  {Array.from({ length: group.end - group.start + 1 }, (_, i) => group.start + i).map((quizId) => {
                    const row = slot.results.find((r) => r.quizId === quizId)
                    return (
                      <div
                        key={quizId}
                        className={`flex min-h-[28px] w-full items-center justify-center rounded border px-0.5 text-[8px] font-bold tabular-nums leading-none shadow-sm min-[400px]:text-[9px] min-[480px]:min-h-[34px] min-[480px]:px-1 min-[480px]:text-[10px] sm:min-h-[36px] sm:text-xs ${group.cellBg}`}
                      >
                        <QuizResultLabel quizId={quizId} result={row?.result} mode={mode} />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
