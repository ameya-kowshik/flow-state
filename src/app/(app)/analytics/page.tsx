'use client'

/**
 * Analytics page — all 5 tabs (Overview, Day, Week, Month, Year).
 * Fetches all sessions and tags for the user on mount, then passes raw arrays
 * to pure analytics functions for client-side computation.
 * Requirements: 7.1, 7.2, 7.3, 8.1–8.3, 9.1–9.3, 10.1–10.4, 11.1–11.4
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, BarChart2 } from 'lucide-react'
import {
  computeStreaks,
  computeTagDistribution,
  computeCalendarData,
  computeDailyBreakdown,
  computeMonthlyBreakdown,
  computeQuarterlyBreakdown,
  computeTaskTimeBreakdown,
  computeEstimatedVsActual,
} from '@/lib/analytics'
import { CalendarHeatmap } from '@/components/analytics/CalendarHeatmap'
import { CalendarView } from '@/components/analytics/CalendarView'
import { DonutChart } from '@/components/analytics/DonutChart'
import { SessionTimeline } from '@/components/analytics/SessionTimeline'
import { BarChart } from '@/components/analytics/BarChart'
import { LineChart } from '@/components/analytics/LineChart'
import type { PomodoroLog, Tag, Card } from '@/generated/prisma/client'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Card type for analytics (subset of Card model)
// ---------------------------------------------------------------------------
interface AnalyticsCard {
  id: string
  title: string
  estimatedMinutes: number | null
  actualMinutes: number
  completedPomodoros: number
}

// Card type for calendar view (needs board/status/due date context)
type CalendarCard = Pick<Card, 'id' | 'title' | 'status' | 'dueDate' | 'isArchived' | 'boardId'>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'day' | 'week' | 'month' | 'year' | 'calendar'

interface FetchState {
  logs: PomodoroLog[]
  tags: Tag[]
  cards: AnalyticsCard[]
  calendarCards: CalendarCard[]
  loading: boolean
  error: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatMinutes(mins: number): string {
  if (mins === 0) return '0m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function heatmapColor(minutes: number): string {
  if (minutes === 0) return 'oklch(0.18 0.02 265)'
  if (minutes < 30) return 'oklch(0.38 0.12 270)'
  if (minutes < 60) return 'oklch(0.48 0.18 270)'
  if (minutes < 120) return 'oklch(0.58 0.22 270)'
  return 'oklch(0.68 0.26 270)'
}

/** Get ISO week number (Mon–Sun) */
function getISOWeek(d: Date): number {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  )
}

/** Monday of the week containing d */
function weekStart(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
      <p className="text-xs text-[oklch(0.45_0.03_265)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[oklch(0.45_0.03_265)]">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-white/6', className)} />
  )
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-48" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-red-500/10">
        <BarChart2 className="size-6 text-red-400" />
      </div>
      <div>
        <p className="font-medium text-white">Failed to load analytics</p>
        <p className="mt-1 text-sm text-[oklch(0.45_0.03_265)]">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/8"
      >
        <RefreshCw className="size-4" />
        Retry
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'day',       label: 'Day' },
  { id: 'week',      label: 'Week' },
  { id: 'month',     label: 'Month' },
  { id: 'year',      label: 'Year' },
  { id: 'calendar',  label: 'Calendar' },
]

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Analytics tabs"
      className="flex gap-1 rounded-xl border border-white/8 bg-white/3 p-1"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          id={`tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
            active === tab.id
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-[oklch(0.56_0.04_265)] hover:text-white',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Date picker helpers
// ---------------------------------------------------------------------------

function DateInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-[oklch(0.45_0.03_265)]">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 [color-scheme:dark]"
      />
    </div>
  )
}

function WeekInput({
  monday,
  onChange,
}: {
  monday: Date
  onChange: (d: Date) => void
}) {
  const isoWeek = getISOWeek(monday)
  const year = monday.getFullYear()
  // HTML week input value format: YYYY-Www
  const weekValue = `${year}-W${String(isoWeek).padStart(2, '0')}`

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-[oklch(0.45_0.03_265)]">Week</label>
      <input
        type="week"
        value={weekValue}
        onChange={(e) => {
          const [y, w] = e.target.value.split('-W').map(Number)
          // Compute Monday of that ISO week
          const jan4 = new Date(y, 0, 4)
          const jan4Day = jan4.getDay() || 7
          const mon = new Date(jan4)
          mon.setDate(jan4.getDate() - jan4Day + 1 + (w - 1) * 7)
          onChange(mon)
        }}
        aria-label="Select week"
        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 [color-scheme:dark]"
      />
    </div>
  )
}

function MonthInput({
  year,
  month,
  onChange,
}: {
  year: number
  month: number
  onChange: (year: number, month: number) => void
}) {
  const value = `${year}-${String(month).padStart(2, '0')}`
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-[oklch(0.45_0.03_265)]">Month</label>
      <input
        type="month"
        value={value}
        onChange={(e) => {
          const [y, m] = e.target.value.split('-').map(Number)
          onChange(y, m)
        }}
        aria-label="Select month"
        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 [color-scheme:dark]"
      />
    </div>
  )
}

function YearInput({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-[oklch(0.45_0.03_265)]">Year</label>
      <input
        type="number"
        value={year}
        min={2020}
        max={new Date().getFullYear()}
        onChange={(e) => {
          const y = parseInt(e.target.value, 10)
          if (!isNaN(y)) onChange(y)
        }}
        aria-label="Select year"
        className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function OverviewTab({ logs, tags, cards }: { logs: PomodoroLog[]; tags: Tag[]; cards: AnalyticsCard[] }) {
  const today = new Date()
  const todayStr = toDateStr(today)

  const todayLogs = logs.filter((l) => toDateStr(new Date(l.completedAt)) === todayStr)
  const todayMinutes = todayLogs.reduce((s, l) => s + l.duration, 0)
  const lifetimeMinutes = logs.reduce((s, l) => s + l.duration, 0)
  const streaks = computeStreaks(logs)
  const calendarCells = computeCalendarData(logs, 12)

  // Top tasks by focus time (top 5)
  const taskBreakdown = computeTaskTimeBreakdown(logs, cards).slice(0, 5)

  return (
    <div
      id="tabpanel-overview"
      role="tabpanel"
      aria-labelledby="tab-overview"
      className="flex flex-col gap-6"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Focus today" value={formatMinutes(todayMinutes)} />
        <StatCard label="Sessions today" value={String(todayLogs.length)} />
        <StatCard label="Current streak" value={`${streaks.current}d`} />
        <StatCard label="Longest streak" value={`${streaks.longest}d`} sub={`Lifetime: ${formatMinutes(lifetimeMinutes)}`} />
      </div>

      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
          Activity — last 12 months
        </p>
        <div className="overflow-x-auto">
          <CalendarHeatmap cells={calendarCells} colorScale={heatmapColor} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-[oklch(0.45_0.03_265)]">Less</span>
          {[0, 20, 60, 120, 180].map((m) => (
            <div
              key={m}
              className="size-3 rounded-sm"
              style={{ background: heatmapColor(m) }}
              aria-hidden="true"
            />
          ))}
          <span className="text-xs text-[oklch(0.45_0.03_265)]">More</span>
        </div>
      </div>

      {/* Top tasks by focus time */}
      {taskBreakdown.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
            Top tasks by focus time
          </p>
          <ul className="space-y-2">
            {taskBreakdown.map((task, i) => (
              <li key={task.cardId} className="flex items-center gap-3 text-sm">
                <span className="w-4 shrink-0 text-right text-xs text-[oklch(0.45_0.03_265)]">{i + 1}</span>
                <span className="flex-1 truncate text-[oklch(0.82_0.04_265)]">{task.cardTitle}</span>
                <span className="tabular-nums text-white">{formatMinutes(task.totalMinutes)}</span>
                <span className="text-xs text-[oklch(0.45_0.03_265)]">{task.sessionCount} sessions</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task breakdown table (shared across Day/Week/Month tabs)
// ---------------------------------------------------------------------------

function TaskBreakdownTable({
  logs,
  cards,
}: {
  logs: PomodoroLog[]
  cards: AnalyticsCard[]
}) {
  // Only include cards that have sessions in the given log set
  const breakdown = computeTaskTimeBreakdown(logs, cards)
  if (breakdown.length === 0) return null

  // Build estimated vs actual for cards that have estimatedMinutes
  const evMap = new Map(
    computeEstimatedVsActual(cards).map((e) => [e.cardId, e]),
  )

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
        Tasks
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/8 text-left text-[oklch(0.45_0.03_265)]">
              <th className="pb-2 pr-4 font-medium">Task</th>
              <th className="pb-2 pr-4 text-right font-medium">Focus time</th>
              <th className="pb-2 pr-4 text-right font-medium">Estimated</th>
              <th className="pb-2 text-right font-medium">Sessions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {breakdown.map((task) => {
              const ev = evMap.get(task.cardId)
              return (
                <tr key={task.cardId}>
                  <td className="py-2 pr-4 text-[oklch(0.82_0.04_265)]">
                    <span className="block max-w-[200px] truncate">{task.cardTitle}</span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-white">
                    {formatMinutes(task.totalMinutes)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[oklch(0.56_0.04_265)]">
                    {ev ? formatMinutes(ev.estimatedMinutes) : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[oklch(0.56_0.04_265)]">
                    {task.sessionCount}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day tab
// ---------------------------------------------------------------------------

function DayTab({ logs, tags, cards }: { logs: PomodoroLog[]; tags: Tag[]; cards: AnalyticsCard[] }) {
  const [dateStr, setDateStr] = useState(toDateStr(new Date()))
  const date = new Date(dateStr + 'T00:00:00')
  const breakdown = computeDailyBreakdown(logs, date, tags)

  const donutSegments = breakdown.tags.map((t) => ({
    value: t.minutes,
    color: t.tagColor,
    label: t.tagName,
  }))

  return (
    <div
      id="tabpanel-day"
      role="tabpanel"
      aria-labelledby="tab-day"
      className="flex flex-col gap-6"
    >
      <DateInput label="Date" value={dateStr} onChange={setDateStr} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Focus time" value={formatMinutes(breakdown.totalMinutes)} />
        <StatCard label="Sessions" value={String(breakdown.sessionCount)} />
        <StatCard
          label="Avg focus score"
          value={breakdown.avgFocusScore != null ? breakdown.avgFocusScore.toFixed(1) : '—'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
            By tag
          </p>
          <div className="flex items-center justify-center">
            <DonutChart
              segments={donutSegments}
              size={180}
              totalLabel="min"
              showTotal={breakdown.totalMinutes > 0}
            />
          </div>
          {breakdown.tags.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {breakdown.tags.map((t) => (
                <li key={t.tagId ?? 'untagged'} className="flex items-center gap-2 text-xs">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.tagColor }} />
                  <span className="flex-1 text-[oklch(0.75_0.02_265)]">{t.tagName}</span>
                  <span className="tabular-nums text-white">{formatMinutes(t.minutes)}</span>
                  <span className="w-10 text-right text-[oklch(0.45_0.03_265)]">{t.percentage.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
            Session timeline
          </p>
          <SessionTimeline sessions={breakdown.sessions} date={date} />
        </div>
      </div>

      <TaskBreakdownTable logs={breakdown.sessions} cards={cards} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Week tab
// ---------------------------------------------------------------------------

function WeekTab({ logs, tags, cards }: { logs: PomodoroLog[]; tags: Tag[]; cards: AnalyticsCard[] }) {
  const [monday, setMonday] = useState(() => weekStart(new Date()))

  // Build 7-day breakdown
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const weekLogs = logs.filter((l) => {
    const d = new Date(l.completedAt)
    return d >= monday && d < new Date(monday.getTime() + 7 * 86400000)
  })

  const totalMinutes = weekLogs.reduce((s, l) => s + l.duration, 0)
  const scores = weekLogs.map((l) => l.focusScore).filter((s): s is number => s != null)
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  const tagDist = computeTagDistribution(weekLogs, tags)
  const donutSegments = tagDist.map((t) => ({ value: t.minutes, color: t.tagColor, label: t.tagName }))

  const barBars = days.map((d, i) => {
    const dayLogs = logs.filter((l) => toDateStr(new Date(l.completedAt)) === toDateStr(d))
    return {
      label: DAY_NAMES[i],
      value: dayLogs.reduce((s, l) => s + l.duration, 0),
    }
  })

  return (
    <div
      id="tabpanel-week"
      role="tabpanel"
      aria-labelledby="tab-week"
      className="flex flex-col gap-6"
    >
      <WeekInput monday={monday} onChange={setMonday} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Focus time" value={formatMinutes(totalMinutes)} />
        <StatCard label="Sessions" value={String(weekLogs.length)} />
        <StatCard label="Avg focus score" value={avgScore != null ? avgScore.toFixed(1) : '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
            By tag
          </p>
          <div className="flex items-center justify-center">
            <DonutChart segments={donutSegments} size={180} totalLabel="min" showTotal={totalMinutes > 0} />
          </div>
          {tagDist.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {tagDist.map((t) => (
                <li key={t.tagId ?? 'untagged'} className="flex items-center gap-2 text-xs">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.tagColor }} />
                  <span className="flex-1 text-[oklch(0.75_0.02_265)]">{t.tagName}</span>
                  <span className="tabular-nums text-white">{formatMinutes(t.minutes)}</span>
                  <span className="w-10 text-right text-[oklch(0.45_0.03_265)]">{t.percentage.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
            Daily breakdown
          </p>
          <BarChart bars={barBars} height={200} />
        </div>
      </div>

      <TaskBreakdownTable logs={weekLogs} cards={cards} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Month tab
// ---------------------------------------------------------------------------

function generateMonthInsight(breakdown: ReturnType<typeof computeMonthlyBreakdown>): string {
  if (breakdown.sessionCount === 0) return 'No sessions recorded this month.'

  // Most productive day of week
  const minutesByDow: number[] = Array(7).fill(0)
  for (const day of breakdown.days) {
    const dow = new Date(day.date + 'T00:00:00').getDay() // 0=Sun
    minutesByDow[dow] += day.totalMinutes
  }
  const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const bestDow = minutesByDow.indexOf(Math.max(...minutesByDow))

  const activeDays = breakdown.days.filter((d) => d.sessionCount > 0).length
  const daysInMonth = breakdown.days.length

  return `Most productive day: ${dowNames[bestDow]}. Active ${activeDays} of ${daysInMonth} days (${Math.round((activeDays / daysInMonth) * 100)}% consistency).`
}

function MonthTab({ logs, tags, cards }: { logs: PomodoroLog[]; tags: Tag[]; cards: AnalyticsCard[] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const breakdown = computeMonthlyBreakdown(logs, year, month, tags)
  const donutSegments = breakdown.tags.map((t) => ({ value: t.minutes, color: t.tagColor, label: t.tagName }))
  const insight = generateMonthInsight(breakdown)

  // Sessions for this month (for task breakdown)
  const monthLogs = logs.filter((l) => {
    const d = new Date(l.completedAt)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  return (
    <div
      id="tabpanel-month"
      role="tabpanel"
      aria-labelledby="tab-month"
      className="flex flex-col gap-6"
    >
      <MonthInput year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Focus time" value={formatMinutes(breakdown.totalMinutes)} />
        <StatCard label="Sessions" value={String(breakdown.sessionCount)} />
        <StatCard label="Avg focus score" value={breakdown.avgFocusScore != null ? breakdown.avgFocusScore.toFixed(1) : '—'} />
      </div>

      {/* Insight */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Insight</p>
        <p className="mt-1 text-sm text-[oklch(0.82_0.04_265)]">{insight}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly heatmap */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
            Daily activity
          </p>
          <div className="grid grid-cols-7 gap-1">
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] text-[oklch(0.45_0.03_265)]">{d}</div>
            ))}
            {/* Offset for first day of month */}
            {Array.from({ length: (new Date(year, month - 1, 1).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {breakdown.days.map((day) => (
              <div
                key={day.date}
                className="aspect-square rounded-sm"
                style={{ background: heatmapColor(day.totalMinutes) }}
                title={`${day.date}: ${formatMinutes(day.totalMinutes)}`}
                aria-label={`${day.date}: ${formatMinutes(day.totalMinutes)}`}
              />
            ))}
          </div>
        </div>

        {/* Donut by tag */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
            By tag
          </p>
          <div className="flex items-center justify-center">
            <DonutChart segments={donutSegments} size={180} totalLabel="min" showTotal={breakdown.totalMinutes > 0} />
          </div>
          {breakdown.tags.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {breakdown.tags.map((t) => (
                <li key={t.tagId ?? 'untagged'} className="flex items-center gap-2 text-xs">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.tagColor }} />
                  <span className="flex-1 text-[oklch(0.75_0.02_265)]">{t.tagName}</span>
                  <span className="tabular-nums text-white">{formatMinutes(t.minutes)}</span>
                  <span className="w-10 text-right text-[oklch(0.45_0.03_265)]">{t.percentage.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <TaskBreakdownTable logs={monthLogs} cards={cards} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Year tab
// ---------------------------------------------------------------------------

function YearTab({ logs, tags, cards }: { logs: PomodoroLog[]; tags: Tag[]; cards: AnalyticsCard[] }) {
  const [year, setYear] = useState(new Date().getFullYear())

  const yearLogs = logs.filter((l) => new Date(l.completedAt).getFullYear() === year)
  const totalMinutes = yearLogs.reduce((s, l) => s + l.duration, 0)
  const quarters = computeQuarterlyBreakdown(logs, year)

  // Monthly trend line
  const monthlyPoints = MONTH_NAMES.map((label, i) => {
    const m = i + 1
    const mins = yearLogs
      .filter((l) => new Date(l.completedAt).getMonth() + 1 === m)
      .reduce((s, l) => s + l.duration, 0)
    return { label, value: mins }
  })

  // Yearly highlights
  const mostProductiveMonth = monthlyPoints.reduce(
    (best, p, i) => (p.value > best.value ? { value: p.value, index: i } : best),
    { value: 0, index: 0 },
  )

  const { longest: longestStreak } = computeStreaks(yearLogs)

  // Most worked-on tasks for the year (top 5)
  const topYearTasks = computeTaskTimeBreakdown(yearLogs, cards).slice(0, 5)

  return (
    <div
      id="tabpanel-year"
      role="tabpanel"
      aria-labelledby="tab-year"
      className="flex flex-col gap-6"
    >
      <YearInput year={year} onChange={setYear} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Focus time" value={formatMinutes(totalMinutes)} />
        <StatCard label="Sessions" value={String(yearLogs.length)} />
        <StatCard label="Best streak" value={`${longestStreak}d`} />
        <StatCard
          label="Best month"
          value={totalMinutes > 0 ? MONTH_NAMES[mostProductiveMonth.index] : '—'}
          sub={totalMinutes > 0 ? formatMinutes(mostProductiveMonth.value) : undefined}
        />
      </div>

      {/* Quarterly breakdown */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
          Quarterly breakdown
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quarters.map((q) => (
            <div key={q.quarter} className="rounded-lg border border-white/6 bg-white/3 px-3 py-2">
              <p className="text-xs text-[oklch(0.45_0.03_265)]">Q{q.quarter}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                {formatMinutes(q.totalMinutes)}
              </p>
              <p className="text-xs text-[oklch(0.45_0.03_265)]">{q.sessionCount} sessions</p>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly trend */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
          Monthly trend
        </p>
        <LineChart points={monthlyPoints} height={200} />
      </div>

      {/* Yearly highlights */}
      {totalMinutes > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
            Highlights
          </p>
          <ul className="space-y-2 text-sm text-[oklch(0.75_0.02_265)]">
            <li>Most productive month: <span className="text-white">{MONTH_NAMES[mostProductiveMonth.index]} ({formatMinutes(mostProductiveMonth.value)})</span></li>
            <li>Longest streak in year: <span className="text-white">{longestStreak} days</span></li>
            <li>Total sessions: <span className="text-white">{yearLogs.length}</span></li>
            <li>Daily average: <span className="text-white">{formatMinutes(Math.round(totalMinutes / 365))}</span></li>
          </ul>
        </div>
      )}

      {/* Most worked-on tasks */}
      {topYearTasks.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
            Most worked-on tasks
          </p>
          <ul className="space-y-2">
            {topYearTasks.map((task, i) => (
              <li key={task.cardId} className="flex items-center gap-3 text-sm">
                <span className="w-4 shrink-0 text-right text-xs text-[oklch(0.45_0.03_265)]">{i + 1}</span>
                <span className="flex-1 truncate text-[oklch(0.82_0.04_265)]">{task.cardTitle}</span>
                <span className="tabular-nums text-white">{formatMinutes(task.totalMinutes)}</span>
                <span className="text-xs text-[oklch(0.45_0.03_265)]">{task.sessionCount} sessions</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page — data fetching + tab orchestration
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [state, setState] = useState<FetchState>({
    logs: [],
    tags: [],
    cards: [],
    calendarCards: [],
    loading: true,
    error: null,
  })

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      // Fetch all sessions (up to 1000), all tags, analytics cards, and calendar cards in parallel
      const [sessionsRes, tagsRes, cardsRes, calendarCardsRes] = await Promise.all([
        fetch('/api/focus-sessions?pageSize=1000'),
        fetch('/api/tags'),
        fetch('/api/cards/analytics'),
        fetch('/api/cards/calendar'),
      ])

      if (!sessionsRes.ok) throw new Error(`Sessions fetch failed: ${sessionsRes.status}`)
      if (!tagsRes.ok) throw new Error(`Tags fetch failed: ${tagsRes.status}`)
      if (!cardsRes.ok) throw new Error(`Cards fetch failed: ${cardsRes.status}`)

      const sessionsJson = await sessionsRes.json()
      const tagsJson = await tagsRes.json()
      const cardsJson = await cardsRes.json()
      const calendarCardsJson = calendarCardsRes.ok ? await calendarCardsRes.json() : []

      setState({
        logs: sessionsJson.data ?? [],
        tags: tagsJson ?? [],
        cards: cardsJson ?? [],
        calendarCards: calendarCardsJson ?? [],
        loading: false,
        error: null,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        {!state.loading && !state.error && (
          <button
            onClick={fetchData}
            aria-label="Refresh analytics data"
            className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-xs text-[oklch(0.56_0.04_265)] transition-colors hover:bg-white/6 hover:text-white"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
        )}
      </div>

      {state.loading && <PageSkeleton />}

      {!state.loading && state.error && (
        <ErrorState message={state.error} onRetry={fetchData} />
      )}

      {!state.loading && !state.error && (
        <>
          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === 'overview'  && <OverviewTab  logs={state.logs} tags={state.tags} cards={state.cards} />}
          {activeTab === 'day'       && <DayTab       logs={state.logs} tags={state.tags} cards={state.cards} />}
          {activeTab === 'week'      && <WeekTab      logs={state.logs} tags={state.tags} cards={state.cards} />}
          {activeTab === 'month'     && <MonthTab     logs={state.logs} tags={state.tags} cards={state.cards} />}
          {activeTab === 'year'      && <YearTab      logs={state.logs} tags={state.tags} cards={state.cards} />}
          {activeTab === 'calendar'  && (
            <CalendarView
              logs={state.logs}
              tags={state.tags}
              cards={state.calendarCards}
            />
          )}
        </>
      )}
    </div>
  )
}
