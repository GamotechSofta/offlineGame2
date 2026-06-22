export const istTodayKey = (date = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return ''
  }
}

export const getIstDayKeyFromIso = (iso: string) => {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export const shiftIstDateKey = (dateKey: string, deltaDays: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey
  const [y, m, d] = dateKey.split('-').map((x) => parseInt(x, 10))
  const anchor = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00+05:30`)
  anchor.setTime(anchor.getTime() + deltaDays * 86_400_000)
  return istTodayKey(anchor)
}

export const formatIstDateLabel = (dateKey: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey
  const [y, m, d] = dateKey.split('-')
  const date = new Date(`${y}-${m}-${d}T12:00:00+05:30`)
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

export const formatIstDateShort = (dateKey: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey
  const [y, m, d] = dateKey.split('-')
  return `${d}/${m}/${y}`
}

export const formatIstWeekday = (dateKey: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return ''
  const [y, m, d] = dateKey.split('-')
  const date = new Date(`${y}-${m}-${d}T12:00:00+05:30`)
  return date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })
}

/** Last N IST calendar days including today. */
export const buildRecentIstDates = (count = 30, fromKey = istTodayKey()) => {
  const out: string[] = []
  let key = fromKey
  for (let i = 0; i < count; i += 1) {
    out.push(key)
    key = shiftIstDateKey(key, -1)
  }
  return out
}

export const getIstMonthKey = (dateKey: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey.slice(0, 7)
  return dateKey.slice(0, 7)
}

export const shiftIstMonth = (monthKey: string, deltaMonths: number) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey
  const [y, m] = monthKey.split('-').map((x) => parseInt(x, 10))
  let month = m + deltaMonths
  let year = y
  while (month > 12) {
    month -= 12
    year += 1
  }
  while (month < 1) {
    month += 12
    year -= 1
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

export const formatIstMonthYear = (monthKey: string) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey
  const [y, m] = monthKey.split('-')
  const date = new Date(`${y}-${m}-01T12:00:00+05:30`)
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

export const istWeekdayIndex = (dateKey: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return 0
  const [y, m, d] = dateKey.split('-')
  const date = new Date(`${y}-${m}-${d}T12:00:00+05:30`)
  const day = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' })
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)
}

const daysInIstMonth = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map((x) => parseInt(x, 10))
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  const lastDayKey = shiftIstDateKey(`${nextMonth}-01`, -1)
  return parseInt(lastDayKey.split('-')[2], 10)
}

export type CalendarCell = {
  dateKey: string | null
  isToday: boolean
  isFuture: boolean
}

export const buildMonthCalendarCells = (monthKey: string, todayKey: string): CalendarCell[] => {
  const padStart = istWeekdayIndex(`${monthKey}-01`)
  const totalDays = daysInIstMonth(monthKey)
  const cells: CalendarCell[] = []

  for (let i = 0; i < padStart; i += 1) {
    cells.push({ dateKey: null, isToday: false, isFuture: false })
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`
    cells.push({
      dateKey,
      isToday: dateKey === todayKey,
      isFuture: dateKey > todayKey,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, isToday: false, isFuture: false })
  }

  return cells
}

