import { API_BASE_URL } from '../config/api'
import { getIstDayKeyFromIso } from '../utils/dates'
import type { GameMode } from '../utils/formatResult'

export type SlotQuizResult = {
  quizId: number
  result: number | null
}

export type ResultSlot = {
  slotStartIso: string
  timeLabel: string
  results: SlotQuizResult[]
}

type SlotResultsResponse = {
  success: boolean
  message?: string
  data?: {
    date: string
    gameMode?: GameMode
    slots: ResultSlot[]
    pagination?: { page: number; limit: number; hasMore: boolean }
  }
}

const sortSlotsForDisplay = (slots: ResultSlot[]) =>
  [...slots].sort(
    (a, b) => new Date(b.slotStartIso).getTime() - new Date(a.slotStartIso).getTime(),
  )

const filterSlotsForIstDate = (slots: ResultSlot[], dateKey: string) =>
  slots.filter((slot) => getIstDayKeyFromIso(slot.slotStartIso) === dateKey)

export async function fetchSlotResults(
  date: string,
  mode: GameMode,
  options: { page?: number; limit?: number; signal?: AbortSignal } = {},
) {
  const params = new URLSearchParams({
    date,
    mode,
    limit: String(options.limit ?? 96),
    page: String(options.page ?? 1),
  })

  const res = await fetch(`${API_BASE_URL}/quiz/slot-results?${params.toString()}`, {
    signal: options.signal,
  })
  const json = (await res.json().catch(() => ({}))) as SlotResultsResponse

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to load results (${res.status})`)
  }

  const apiDate = json.data?.date || date
  const slots = sortSlotsForDisplay(
    filterSlotsForIstDate(json.data?.slots || [], apiDate),
  )

  return {
    date: apiDate,
    slots,
    hasMore: Boolean(json.data?.pagination?.hasMore),
    page: json.data?.pagination?.page || options.page || 1,
  }
}
