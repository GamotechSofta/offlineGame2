import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchSlotResults, type ResultSlot } from './api/results'
import DateSidebar from './components/DateSidebar'
import DayOverview from './components/DayOverview'
import MobileDateBar from './components/MobileDateBar'
import ModeToggle from './components/ModeToggle'
import ResultSlotCard from './components/ResultSlotCard'
import {
  buildRecentIstDates,
  formatIstDateLabel,
  formatIstDateShort,
  formatIstWeekday,
  istTodayKey,
  shiftIstDateKey,
} from './utils/dates'
import type { GameMode } from './utils/formatResult'

const RESULTS_GRID_3D =
  'grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]'

const SKELETON_GRID_3D =
  'grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))]'

function LoadingSkeleton({ mode }: { mode: GameMode }) {
  if (mode === '3d') {
    return (
      <div className={SKELETON_GRID_3D}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="rs-skeleton w-12 shrink-0 min-[480px]:w-14" />
            <div className="flex flex-1 gap-1.5 p-1.5">
              {[0, 1, 2].map((j) => (
                <div key={j} className="rs-skeleton h-14 flex-1 rounded-lg min-[480px]:h-16" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-2.5">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rs-skeleton h-24 rounded-xl min-[480px]:h-28" />
      ))}
    </div>
  )
}

const FADE_OUT_MS = 200
const FADE_IN_MS = 50

type DisplayView = {
  queryKey: string
  mode: GameMode
  slots: ResultSlot[]
}

function App() {
  const [mode, setMode] = useState<GameMode>('2d')
  const [dateKey, setDateKey] = useState(() => istTodayKey())
  const [fetchedDate, setFetchedDate] = useState('')
  const [slots, setSlots] = useState<ResultSlot[]>([])
  const [displayView, setDisplayView] = useState<DisplayView>({ queryKey: '', mode: '2d', slots: [] })
  const [contentVisible, setContentVisible] = useState(false)
  const [drawCountByDate, setDrawCountByDate] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const slotRefs = useRef<Record<string, HTMLElement | null>>({})
  const activeQueryRef = useRef('')
  const slotsCacheRef = useRef<Record<string, { slots: ResultSlot[]; date: string }>>({})
  const prefetchAbortRef = useRef<AbortController | null>(null)
  const displayViewKeyRef = useRef('')

  const todayKey = istTodayKey()
  const isToday = dateKey === todayKey
  const recentDates = useMemo(() => buildRecentIstDates(30, todayKey), [todayKey])
  const queryKey = `${dateKey}:${mode}`
  const hasVisibleResults = displayView.slots.length > 0
  const isViewPending = displayView.queryKey !== queryKey
  const panelSlots = isViewPending ? displayView.slots : slots
  const panelMode = isViewPending ? displayView.mode : mode

  const loadResults = useCallback(async () => {
    if (!dateKey) return

    const isQueryChange = activeQueryRef.current !== queryKey
    activeQueryRef.current = queryKey

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    if (isQueryChange) {
      setError('')
      const cached = slotsCacheRef.current[queryKey]
      if (cached) {
        setSlots(cached.slots)
        setFetchedDate(cached.date)
        setLoading(false)
        setRefreshing(true)
      } else {
        setLoading(true)
        if (displayViewKeyRef.current && displayViewKeyRef.current !== queryKey) {
          setContentVisible(false)
        }
      }
    } else {
      setRefreshing(true)
    }

    try {
      const data = await fetchSlotResults(dateKey, mode, {
        limit: 96,
        page: 1,
        signal: controller.signal,
      })

      if (requestId !== requestIdRef.current) return

      slotsCacheRef.current[queryKey] = { slots: data.slots, date: data.date }
      setFetchedDate(data.date)
      setSlots(data.slots)
      setDrawCountByDate((prev) => ({ ...prev, [data.date]: data.slots.length }))
      setError('')
    } catch (err) {
      if (controller.signal.aborted) return
      if (requestId !== requestIdRef.current) return
      if (isQueryChange) {
        setError(err instanceof Error ? err.message : 'Failed to load results')
        setSlots([])
        setFetchedDate('')
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [dateKey, mode, queryKey])

  useEffect(() => {
    displayViewKeyRef.current = displayView.queryKey
  }, [displayView.queryKey])

  useEffect(() => {
    void loadResults()
    return () => abortRef.current?.abort()
  }, [loadResults])

  useEffect(() => {
    if (!isToday) return undefined
    const timer = window.setInterval(() => void loadResults(), 30_000)
    return () => window.clearInterval(timer)
  }, [isToday, loadResults])

  useEffect(() => {
    if (displayView.queryKey === queryKey) return
    if (!displayView.queryKey) return
    setContentVisible(false)
  }, [queryKey, displayView.queryKey])

  useEffect(() => {
    if (loading) return
    if (activeQueryRef.current !== queryKey) return

    const readySlots = slotsCacheRef.current[queryKey]?.slots ?? slots

    if (displayView.queryKey === queryKey) {
      setDisplayView((prev) => {
        if (prev.slots === readySlots && prev.mode === mode) return prev
        return { queryKey, mode, slots: readySlots }
      })
      setContentVisible(true)
      return
    }

    const cached = slotsCacheRef.current[queryKey]
    const delay = displayView.queryKey ? (cached ? 90 : FADE_OUT_MS) : 0
    const timer = window.setTimeout(() => {
      setDisplayView({ queryKey, mode, slots: readySlots })
      window.setTimeout(() => setContentVisible(true), FADE_IN_MS)
    }, delay)

    return () => window.clearTimeout(timer)
  }, [loading, queryKey, mode, slots, displayView.queryKey])

  useEffect(() => {
    if (loading || !dateKey) return

    const otherMode: GameMode = mode === '2d' ? '3d' : '2d'
    const otherKey = `${dateKey}:${otherMode}`
    if (slotsCacheRef.current[otherKey]) return

    prefetchAbortRef.current?.abort()
    const controller = new AbortController()
    prefetchAbortRef.current = controller

    void fetchSlotResults(dateKey, otherMode, {
      limit: 96,
      page: 1,
      signal: controller.signal,
    })
      .then((data) => {
        slotsCacheRef.current[otherKey] = { slots: data.slots, date: data.date }
        setDrawCountByDate((prev) => ({ ...prev, [data.date]: data.slots.length }))
      })
      .catch(() => {})

    return () => controller.abort()
  }, [dateKey, mode, loading, queryKey])

  const goToToday = () => setDateKey(istTodayKey())

  const goPrevDay = () => setDateKey((prev) => shiftIstDateKey(prev, -1))

  const goNextDay = () => {
    if (dateKey >= todayKey) return
    const next = shiftIstDateKey(dateKey, 1)
    setDateKey(next > todayKey ? todayKey : next)
  }

  const jumpToSlot = (slotStartIso: string) => {
    const el = slotRefs.current[slotStartIso]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const displayDate = fetchedDate || dateKey

  const handleModeChange = (next: GameMode) => {
    if (next === mode) return
    setMode(next)
  }

  const dateNav = (
    <div className="flex items-center overflow-hidden rounded-xl border border-white/25 bg-white/10">
      <button
        type="button"
        onClick={goPrevDay}
        className="px-4 py-2.5 text-lg font-bold transition-colors hover:bg-white/10"
        aria-label="Previous day"
      >
        ‹
      </button>
      <div className="min-w-[6.5rem] border-x border-white/20 px-4 py-1.5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-200">IST date</p>
        <p className="text-sm font-bold tabular-nums leading-tight">{formatIstDateShort(dateKey)}</p>
        <p className="text-[10px] font-medium text-blue-100/90">{formatIstWeekday(dateKey)}</p>
      </div>
      <button
        type="button"
        onClick={goNextDay}
        disabled={dateKey >= todayKey}
        className="px-4 py-2.5 text-lg font-bold transition-colors hover:bg-white/10 disabled:opacity-35"
        aria-label="Next day"
      >
        ›
      </button>
    </div>
  )

  return (
    <div className="rs-app flex h-dvh flex-col overflow-hidden text-slate-900">
      <header className="shrink-0 border-b border-[#152842] bg-gradient-to-r from-[#1B3150] via-[#1f3a5c] to-[#1B3150] text-white shadow-md">
        {/* Mobile — simple: brand, mode, refresh. Dates are in the bar below. */}
        <div className="px-3 py-2.5 lg:hidden">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/25"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold leading-tight">Result Side</h1>
              <p className="mt-0.5 truncate text-xs text-blue-100/90">
                {mode.toUpperCase()} results · {formatIstDateShort(dateKey)} · IST
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadResults()}
              disabled={loading || refreshing}
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-bold transition-colors active:bg-white/20 disabled:opacity-50"
            >
              <span className={refreshing ? 'inline-block animate-spin' : ''}>↻</span>
              Refresh
            </button>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200/80">Select game</p>
            <ModeToggle mode={mode} onChange={handleModeChange} />
          </div>
        </div>

        {/* Desktop — labeled sections: brand · game · date · actions */}
        <div className="hidden px-5 py-3 lg:block">
          <div className="flex items-center gap-5">
            <div className="flex shrink-0 items-center gap-3 border-r border-white/15 pr-5">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-white/25"
              />
              <div>
                <h1 className="text-lg font-bold leading-tight">Result Side</h1>
                <p className="mt-0.5 text-xs text-blue-100/90">Live draw results · IST timezone</p>
              </div>
            </div>

            <div className="shrink-0 border-r border-white/15 pr-5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-200/80">Select game</p>
              <ModeToggle mode={mode} onChange={handleModeChange} />
            </div>

            <div className="shrink-0">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-200/80">Change date</p>
              <div className="flex items-center gap-2">
                {dateNav}
                <button
                  type="button"
                  onClick={goToToday}
                  disabled={isToday}
                  className="min-h-10 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-bold transition-colors hover:bg-white/15 disabled:opacity-45"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => void loadResults()}
                disabled={loading || refreshing}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-bold transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                <span className={refreshing ? 'inline-block animate-spin' : ''}>↻</span>
                Refresh
              </button>

              {isToday && (
                <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500/20 px-3 text-sm font-bold text-emerald-100 ring-1 ring-emerald-400/25">
                  <span className="rs-live-dot h-2 w-2 rounded-full bg-emerald-400" />
                  Auto-refresh on
                </span>
              )}

              <div className="rounded-xl bg-white/12 px-4 py-2 text-center ring-1 ring-white/15">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-100">Draws</p>
                <p className="text-xl font-extrabold tabular-nums leading-tight">{panelSlots.length}</p>
                <p className="text-[10px] text-blue-100/90">{formatIstDateLabel(displayDate)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <DayOverview
          mode={panelMode}
          dateKey={dateKey}
          todayKey={todayKey}
          slots={panelSlots}
          loading={loading && !displayView.queryKey}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--rs-surface)] lg:border-r lg:border-slate-200/80">
          <MobileDateBar
            mode={panelMode}
            dateKey={dateKey}
            todayKey={todayKey}
            recentDates={recentDates}
            slots={panelSlots}
            drawCountByDate={drawCountByDate}
            drawCount={panelSlots.length}
            isToday={isToday}
            refreshing={refreshing}
            onSelectDate={setDateKey}
            onJumpToSlot={jumpToSlot}
          />

          <div className="hidden shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-2 lg:flex">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1B3150]">All draws</p>
              <p className="truncate text-xs text-slate-500">
                {mode.toUpperCase()} · {formatIstDateLabel(displayDate)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {refreshing && (
                <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  Updating…
                </span>
              )}
              {hasVisibleResults && (
                <span className="rounded-full bg-[#1B3150]/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-[#1B3150]">
                  {panelSlots.length} total
                </span>
              )}
            </div>
          </div>

          <div className="scroll-area relative min-h-0 flex-1 overflow-y-auto p-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-3 lg:p-4">
            {loading && isViewPending && displayView.queryKey && (
              <div className="rs-mode-progress" aria-hidden />
            )}

            {loading && !displayView.queryKey && (
              <div className="rs-mode-enter">
                <LoadingSkeleton mode={mode} />
              </div>
            )}

            {error && !loading && displayView.queryKey === queryKey && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-center text-xs text-red-800 shadow-sm sm:text-sm">
                {error}
                <button
                  type="button"
                  onClick={() => void loadResults()}
                  className="ml-2 font-bold text-red-900 underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && displayView.queryKey === queryKey && displayView.slots.length === 0 && !refreshing && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-12 text-center">
                <p className="text-sm font-medium text-slate-600">No {mode.toUpperCase()} results</p>
                <p className="mt-1 text-xs text-slate-400">{formatIstDateLabel(dateKey)}</p>
              </div>
            )}

            {hasVisibleResults && !error && (
              <div className={`rs-results-view ${contentVisible ? 'is-visible' : 'is-hidden'}`}>
                <div className={displayView.mode === '3d' ? RESULTS_GRID_3D : 'grid w-full grid-cols-1 gap-2.5'}>
                  {displayView.slots.map((slot, index) => (
                    <div
                      key={slot.slotStartIso}
                      ref={(el) => {
                        slotRefs.current[slot.slotStartIso] = el
                      }}
                      className="min-w-0 w-full"
                    >
                      <ResultSlotCard
                        slot={slot}
                        mode={displayView.mode}
                        highlight={index === 0}
                        fillWidth
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        <div className="hidden h-full min-h-0 w-72 shrink-0 lg:block xl:w-80">
          <DateSidebar
            mode={panelMode}
            dateKey={dateKey}
            todayKey={todayKey}
            slots={panelSlots}
            drawCountByDate={drawCountByDate}
            onSelectDate={setDateKey}
            onJumpToSlot={jumpToSlot}
          />
        </div>
      </div>
    </div>
  )
}

export default App
