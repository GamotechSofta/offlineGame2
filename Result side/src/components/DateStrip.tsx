type DateStripProps = {
  dateKey: string
  todayKey: string
  recentDates: string[]
  drawCountByDate: Record<string, number>
  onSelectDate: (date: string) => void
}

export default function DateStrip({
  dateKey,
  todayKey,
  recentDates,
  drawCountByDate,
  onSelectDate,
}: DateStripProps) {
  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-2 py-2 shadow-sm lg:hidden">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Date wise · IST</p>
      <div className="scroll-area flex gap-1.5 overflow-x-auto pb-0.5">
        {recentDates.slice(0, 14).map((d) => {
          const active = d === dateKey
          const [dd, mm] = d.split('-').slice(1).reverse()
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelectDate(d)}
              className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-center text-[10px] font-bold transition-all ${
                active
                  ? 'border-[#1B3150] bg-[#1B3150] text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="block tabular-nums">{dd}/{mm}</span>
              <span className={`block text-[9px] font-semibold ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                {drawCountByDate[d] != null ? `${drawCountByDate[d]} draws` : d === todayKey ? 'Today' : '—'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
