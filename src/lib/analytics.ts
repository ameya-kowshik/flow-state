/**
 * Pure analytics computation functions for the Flow State app.
 *
 * All functions are pure — they take PomodoroLog[] (and optionally Tag[]) and
 * return computed values. No side effects, no DB calls, no imports from prisma
 * client runtime.
 *
 * Requirements: 7.1, 7.2, 8.1, 8.2, 9.1, 9.2, 10.1, 10.2, 10.3, 11.1, 11.2
 */

import type { PomodoroLog, Tag } from '@/generated/prisma/client'

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface StreakResult {
  /** Current streak in days */
  current: number
  /** Longest streak in days */
  longest: number
}

export interface TagDistribution {
  tagId: string | null
  tagName: string
  tagColor: string
  minutes: number
  percentage: number
}

export interface CalendarCell {
  /** ISO date string YYYY-MM-DD */
  date: string
  minutes: number
}

export interface DailyBreakdown {
  date: string
  totalMinutes: number
  sessionCount: number
  avgFocusScore: number | null
  tags: TagDistribution[]
  sessions: PomodoroLog[]
}

export interface MonthlyBreakdown {
  year: number
  month: number
  totalMinutes: number
  sessionCount: number
  avgFocusScore: number | null
  tags: TagDistribution[]
  days: DailyBreakdown[]
}

export interface QuarterlyBreakdown {
  year: number
  quarter: number   // 1–4
  totalMinutes: number
  sessionCount: number
}

export interface DateRange {
  start: Date
  end: Date
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a Date as a YYYY-MM-DD string in local time.
 */
function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Return the YYYY-MM-DD string for a session's completedAt date.
 * Handles both Date objects and ISO strings (Prisma can return either).
 */
function sessionDateString(log: PomodoroLog): string {
  return toDateString(new Date(log.completedAt))
}

/**
 * Build a TagDistribution[] from a map of tagId → minutes, given the full
 * tag list. Sessions with no tag are grouped under tagId=null.
 */
function buildTagDistribution(
  minutesByTagId: Map<string | null, number>,
  tags: Tag[],
): TagDistribution[] {
  const tagMap = new Map(tags.map((t) => [t.id, t]))
  const totalMinutes = Array.from(minutesByTagId.values()).reduce((a, b) => a + b, 0)

  const result: TagDistribution[] = []

  for (const [tagId, minutes] of minutesByTagId.entries()) {
    const tag = tagId != null ? tagMap.get(tagId) : undefined
    result.push({
      tagId,
      tagName: tag?.name ?? 'Untagged',
      tagColor: tag?.color ?? '#6b7280',
      minutes,
      percentage: totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0,
    })
  }

  // Sort descending by minutes for a consistent, useful order
  result.sort((a, b) => b.minutes - a.minutes)

  return result
}

// ---------------------------------------------------------------------------
// computeStreaks
// ---------------------------------------------------------------------------

/**
 * Compute the current and longest focus streaks from a list of logs.
 *
 * A "streak day" is any calendar day (local time) on which at least one
 * session was completed. The current streak counts backwards from today;
 * if today has no sessions, it counts backwards from yesterday (so a streak
 * is not broken just because the user hasn't completed a session yet today).
 *
 * Requirements: 7.1
 */
export function computeStreaks(logs: PomodoroLog[]): StreakResult {
  if (logs.length === 0) return { current: 0, longest: 0 }

  // Collect unique session days
  const daySet = new Set<string>()
  for (const log of logs) {
    daySet.add(sessionDateString(log))
  }

  // Sort days ascending
  const days = Array.from(daySet).sort()

  // Compute longest streak by iterating sorted days
  let longest = 1
  let runLength = 1

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T00:00:00')
    const curr = new Date(days[i] + 'T00:00:00')
    const diffMs = curr.getTime() - prev.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      runLength++
      if (runLength > longest) longest = runLength
    } else {
      runLength = 1
    }
  }

  // Compute current streak: walk backwards from today (or yesterday)
  const todayStr = toDateString(new Date())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayStr = toDateString(yesterdayDate)

  // Start anchor: today if there's a session today, otherwise yesterday
  let anchorStr = daySet.has(todayStr) ? todayStr : yesterdayStr

  // If neither today nor yesterday has a session, streak is 0
  if (!daySet.has(anchorStr)) {
    return { current: 0, longest }
  }

  let current = 0
  let checkDate = new Date(anchorStr + 'T00:00:00')

  while (daySet.has(toDateString(checkDate))) {
    current++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return { current, longest }
}

// ---------------------------------------------------------------------------
// computeTagDistribution
// ---------------------------------------------------------------------------

/**
 * Compute focus time distribution by tag across the given logs.
 *
 * Requirements: 8.2, 9.2, 10.3
 */
export function computeTagDistribution(logs: PomodoroLog[], tags: Tag[]): TagDistribution[] {
  if (logs.length === 0) return []

  const minutesByTagId = new Map<string | null, number>()

  for (const log of logs) {
    const key = log.tagId ?? null
    minutesByTagId.set(key, (minutesByTagId.get(key) ?? 0) + log.duration)
  }

  return buildTagDistribution(minutesByTagId, tags)
}

// ---------------------------------------------------------------------------
// computeCalendarData
// ---------------------------------------------------------------------------

/**
 * Compute per-day focus minutes for the trailing `months` calendar months,
 * returning one CalendarCell per calendar day in that range.
 *
 * The range is [today - months*~30 days, today] inclusive, aligned to full
 * calendar days. Specifically: from the same calendar day `months` months ago
 * up to and including today.
 *
 * Requirements: 7.2
 */
export function computeCalendarData(logs: PomodoroLog[], months: number): CalendarCell[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Start date: same day `months` months ago
  const startDate = new Date(today)
  startDate.setMonth(startDate.getMonth() - months)

  // Build a map of date string → minutes from logs
  const minutesByDay = new Map<string, number>()
  for (const log of logs) {
    const completedAt = new Date(log.completedAt)
    if (completedAt >= startDate && completedAt <= today) {
      const dateStr = toDateString(completedAt)
      minutesByDay.set(dateStr, (minutesByDay.get(dateStr) ?? 0) + log.duration)
    }
  }

  // Generate one cell per calendar day in the range
  const cells: CalendarCell[] = []
  const cursor = new Date(startDate)

  while (cursor <= today) {
    const dateStr = toDateString(cursor)
    cells.push({
      date: dateStr,
      minutes: minutesByDay.get(dateStr) ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return cells
}

// ---------------------------------------------------------------------------
// computeDailyBreakdown
// ---------------------------------------------------------------------------

/**
 * Compute a full breakdown for a single calendar day.
 *
 * Requirements: 8.1, 8.2
 */
export function computeDailyBreakdown(
  logs: PomodoroLog[],
  date: Date,
  tags: Tag[],
): DailyBreakdown {
  const dateStr = toDateString(date)

  const daySessions = logs.filter((log) => sessionDateString(log) === dateStr)

  const totalMinutes = daySessions.reduce((sum, log) => sum + log.duration, 0)
  const sessionCount = daySessions.length

  const scoresWithValues = daySessions
    .map((log) => log.focusScore)
    .filter((s): s is number => s != null)

  const avgFocusScore =
    scoresWithValues.length > 0
      ? scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length
      : null

  const tagDist = computeTagDistribution(daySessions, tags)

  return {
    date: dateStr,
    totalMinutes,
    sessionCount,
    avgFocusScore,
    tags: tagDist,
    sessions: daySessions,
  }
}

// ---------------------------------------------------------------------------
// computeMonthlyBreakdown
// ---------------------------------------------------------------------------

/**
 * Compute a full breakdown for a calendar month (1-indexed month).
 *
 * Requirements: 10.1, 10.2, 10.3
 */
export function computeMonthlyBreakdown(
  logs: PomodoroLog[],
  year: number,
  month: number,
  tags: Tag[],
): MonthlyBreakdown {
  // Filter logs to the given month
  const monthLogs = logs.filter((log) => {
    const d = new Date(log.completedAt)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  const totalMinutes = monthLogs.reduce((sum, log) => sum + log.duration, 0)
  const sessionCount = monthLogs.length

  const scoresWithValues = monthLogs
    .map((log) => log.focusScore)
    .filter((s): s is number => s != null)

  const avgFocusScore =
    scoresWithValues.length > 0
      ? scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length
      : null

  const tagDist = computeTagDistribution(monthLogs, tags)

  // Build per-day breakdowns for every day in the month
  const daysInMonth = new Date(year, month, 0).getDate()
  const days: DailyBreakdown[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(computeDailyBreakdown(monthLogs, new Date(year, month - 1, d), tags))
  }

  return {
    year,
    month,
    totalMinutes,
    sessionCount,
    avgFocusScore,
    tags: tagDist,
    days,
  }
}

// ---------------------------------------------------------------------------
// computeQuarterlyBreakdown
// ---------------------------------------------------------------------------

/**
 * Compute per-quarter focus time and session counts for a given year.
 * Returns four QuarterlyBreakdown entries (Q1–Q4).
 *
 * Requirements: 11.2
 */
export function computeQuarterlyBreakdown(
  logs: PomodoroLog[],
  year: number,
): QuarterlyBreakdown[] {
  const quarters: QuarterlyBreakdown[] = [
    { year, quarter: 1, totalMinutes: 0, sessionCount: 0 },
    { year, quarter: 2, totalMinutes: 0, sessionCount: 0 },
    { year, quarter: 3, totalMinutes: 0, sessionCount: 0 },
    { year, quarter: 4, totalMinutes: 0, sessionCount: 0 },
  ]

  for (const log of logs) {
    const d = new Date(log.completedAt)
    if (d.getFullYear() !== year) continue

    const month = d.getMonth() + 1 // 1–12
    const quarterIndex = Math.floor((month - 1) / 3) // 0–3
    quarters[quarterIndex].totalMinutes += log.duration
    quarters[quarterIndex].sessionCount++
  }

  return quarters
}

// ---------------------------------------------------------------------------
// computeGrowthRate
// ---------------------------------------------------------------------------

/**
 * Compute the growth rate of total focus minutes between two periods.
 *
 * Returns a decimal representing the relative change:
 *   - 0.25 means 25% growth
 *   - -0.10 means 10% decline
 *   - 0 when periodA has 0 minutes (no baseline to compare against)
 *
 * Requirements: 11.1 (year-over-year trend)
 */
export function computeGrowthRate(
  logs: PomodoroLog[],
  periodA: DateRange,
  periodB: DateRange,
): number {
  const minutesInRange = (range: DateRange): number => {
    const start = range.start.getTime()
    const end = range.end.getTime()
    return logs
      .filter((log) => {
        const t = new Date(log.completedAt).getTime()
        return t >= start && t <= end
      })
      .reduce((sum, log) => sum + log.duration, 0)
  }

  const minutesA = minutesInRange(periodA)
  const minutesB = minutesInRange(periodB)

  if (minutesA === 0) return 0

  return (minutesB - minutesA) / minutesA
}

// ---------------------------------------------------------------------------
// computeConsistencyScore
// ---------------------------------------------------------------------------

/**
 * Compute a consistency score (0–100) representing the fraction of days in
 * the trailing `days` window that had at least one completed session.
 *
 * Score = (activeDays / days) * 100
 *
 * Requirements: 7.1 (streak / habit tracking)
 */
export function computeConsistencyScore(logs: PomodoroLog[], days: number): number {
  if (days <= 0) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const windowStart = new Date(today)
  windowStart.setDate(windowStart.getDate() - (days - 1))

  // Collect unique active days within the window
  const activeDays = new Set<string>()
  for (const log of logs) {
    const completedAt = new Date(log.completedAt)
    completedAt.setHours(0, 0, 0, 0)
    if (completedAt >= windowStart && completedAt <= today) {
      activeDays.add(toDateString(completedAt))
    }
  }

  return (activeDays.size / days) * 100
}

// ---------------------------------------------------------------------------
// Task-level aggregations (Requirements: 7.1, 8.1, 9.1, 10.1, 11.1)
// ---------------------------------------------------------------------------

export interface TaskTimeBreakdown {
  cardId: string
  cardTitle: string
  totalMinutes: number
  sessionCount: number
  completedPomodoros: number
}

export interface EstimatedVsActual {
  cardId: string
  cardTitle: string
  estimatedMinutes: number
  actualMinutes: number
  /** Positive means over-estimate, negative means under-estimate */
  differenceMinutes: number
}

/**
 * Compute per-card focus time totals from a set of PomodoroLog records and
 * the corresponding Card objects.
 *
 * Only logs with a non-null `taskId` are counted. Cards that have no linked
 * sessions are omitted from the result. Results are sorted descending by
 * `totalMinutes`.
 *
 * Requirements: 7.1, 8.1, 9.1, 10.1, 11.1
 */
export function computeTaskTimeBreakdown(
  logs: PomodoroLog[],
  cards: Array<{ id: string; title: string; completedPomodoros: number }>,
): TaskTimeBreakdown[] {
  // Build a lookup map for card metadata
  const cardMap = new Map(cards.map((c) => [c.id, c]))

  // Accumulate minutes and session counts per card
  const totals = new Map<string, { totalMinutes: number; sessionCount: number }>()
  for (const log of logs) {
    if (!log.taskId) continue
    const existing = totals.get(log.taskId)
    if (existing) {
      existing.totalMinutes += log.duration
      existing.sessionCount += 1
    } else {
      totals.set(log.taskId, { totalMinutes: log.duration, sessionCount: 1 })
    }
  }

  const result: TaskTimeBreakdown[] = []
  for (const [cardId, { totalMinutes, sessionCount }] of totals) {
    const card = cardMap.get(cardId)
    if (!card) continue
    result.push({
      cardId,
      cardTitle: card.title,
      totalMinutes,
      sessionCount,
      completedPomodoros: card.completedPomodoros,
    })
  }

  return result.sort((a, b) => b.totalMinutes - a.totalMinutes)
}

/**
 * Return estimated vs actual time for cards that have both `estimatedMinutes`
 * and `actualMinutes` set (i.e. neither is null/zero for estimated).
 *
 * Results are sorted descending by `actualMinutes`.
 *
 * Requirements: 7.1, 8.1, 9.1, 10.1, 11.1
 */
export function computeEstimatedVsActual(
  cards: Array<{
    id: string
    title: string
    estimatedMinutes: number | null
    actualMinutes: number
  }>,
): EstimatedVsActual[] {
  return cards
    .filter((c) => c.estimatedMinutes != null && c.estimatedMinutes > 0)
    .map((c) => ({
      cardId: c.id,
      cardTitle: c.title,
      estimatedMinutes: c.estimatedMinutes as number,
      actualMinutes: c.actualMinutes,
      differenceMinutes: (c.estimatedMinutes as number) - c.actualMinutes,
    }))
    .sort((a, b) => b.actualMinutes - a.actualMinutes)
}
