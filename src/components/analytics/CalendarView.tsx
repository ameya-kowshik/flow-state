'use client'

/**
 * CalendarView — monthly calendar grid showing focus sessions and due cards.
 *
 * Each day cell shows:
 *   - Total focus minutes (color-coded background intensity)
 *   - Due cards as chips
 *
 * Clicking a day opens a day detail panel listing:
 *   - Sessions (duration, tag, linked card title)
 *   - Cards due that day with their status
 *
 * Clicking a card in the detail panel opens <CardDetailModal />.
 *
 * Requirements: 7.2, 7.3
 */

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, Clock, Tag as TagIcon, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeCalendarMonthView } from '@/lib/analytics'
import { CardDetailModal } from '@/components/boards/CardDetailModal'
import type { PomodoroLog, Tag, Card } from '@/generated/prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarViewProps {
  logs: PomodoroLog[]
  tags: Tag[]
  cards: Pick<Card, 'id' | 'title' | 'status' | 'dueDate' | 'isArchived' | 'boardId'>[]
  className?: string
}

// Card status display helpers
const STATUS_LABELS: Record<string, string> = {
  TODO: 'Todo',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-white/10 text-[oklch(0.65_0.03_265)]',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-400',
  IN_REVIEW: 'bg-amber-500/15 text-amber-400',
  DONE: 'bg-emerald-500/15 text-emerald-400',
  CANCELLED: 'bg-white/8 text-[oklch(0.45_0.03_265)] line-through',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ---------------------------------------------------------------------------
// Color scale for focus minutes
// ---------------------------------------------------------------------------

function minutesToColor(minutes: number): string {
  if (minutes === 0) return 'transparent'
  if (minutes < 30) return 'oklch(0.38 0.12 270 / 0.35)'
  if (minutes < 60) return 'oklch(0.48 0.18 270 / 0.50)'
  if (minutes < 120) return 'oklch(0.58 0.22 270 / 0.65)'
  return 'oklch(0.68 0.26 270 / 0.80)'
}

function formatMinutes(mins: number): string {
  if (mins === 0) return '0m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

export function CalendarView({ logs, tags, cards, className }: CalendarViewProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [detailCardId, setDetailCardId] = useState<string | null>(null)
  const [detailBoardId, setDetailBoardId] = useState<string | null>(null)

  const monthView = computeCalendarMonthView(logs, cards, year, month)

  // Build tag lookup
  const tagMap = new Map(tags.map((t) => [t.id, t]))

  // Navigation
  const prevMonth = useCallback(() => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
    setSelectedDate(null)
  }, [month])

  const nextMonth = useCallback(() => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
    setSelectedDate(null)
  }, [month])

  // Find selected day cell
  const selectedCell = selectedDate
    ? monthView.weeks.flatMap((w) => w.days).find((d) => d.date === selectedDate) ?? null
    : null

  function openCardDetail(cardId: string) {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    setDetailCardId(cardId)
    setDetailBoardId(card.boardId)
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header: month navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className="flex size-8 items-center justify-center rounded-lg text-[oklch(0.56_0.04_265)] transition-colors hover:bg-white/8 hover:text-white"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => {
              setYear(today.getFullYear())
              setMonth(today.getMonth() + 1)
              setSelectedDate(null)
            }}
            className="rounded-lg px-2 py-1 text-xs text-[oklch(0.56_0.04_265)] transition-colors hover:bg-white/8 hover:text-white"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="flex size-8 items-center justify-center rounded-lg text-[oklch(0.56_0.04_265)] transition-colors hover:bg-white/8 hover:text-white"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 text-xs text-[oklch(0.56_0.04_265)]">
        <span>
          <span className="font-medium text-white">{formatMinutes(monthView.totalMinutes)}</span>
          {' '}focus time
        </span>
        <span>
          <span className="font-medium text-white">{monthView.sessionCount}</span>
          {' '}sessions
        </span>
      </div>

      {/* Calendar grid */}
      <div
        role="grid"
        aria-label={`Calendar for ${MONTH_NAMES[month - 1]} ${year}`}
        className="rounded-xl border border-white/8 bg-white/3 overflow-hidden"
      >
        {/* Day headers */}
        <div role="row" className="grid grid-cols-7 border-b border-white/8">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              role="columnheader"
              className="py-2 text-center text-[10px] font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)]"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {monthView.weeks.map((week, wi) => (
          <div
            key={wi}
            role="row"
            className={cn('grid grid-cols-7', wi < monthView.weeks.length - 1 && 'border-b border-white/6')}
          >
            {week.days.map((cell) => {
              const isToday = cell.date === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
              const isSelected = cell.date === selectedDate
              const hasFocus = cell.minutes > 0
              const hasDueCards = cell.dueCards.length > 0

              return (
                <button
                  key={cell.date}
                  role="gridcell"
                  aria-label={`${cell.date}${hasFocus ? `, ${formatMinutes(cell.minutes)} focus` : ''}${hasDueCards ? `, ${cell.dueCards.length} due` : ''}`}
                  aria-selected={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => setSelectedDate(isSelected ? null : cell.date)}
                  className={cn(
                    'relative flex min-h-[72px] flex-col gap-1 p-1.5 text-left transition-colors',
                    'border-r border-white/6 last:border-r-0',
                    !cell.isCurrentMonth && 'opacity-30',
                    isSelected
                      ? 'bg-violet-600/15 ring-1 ring-inset ring-violet-500/40'
                      : 'hover:bg-white/4',
                  )}
                  style={hasFocus && !isSelected ? { background: minutesToColor(cell.minutes) } : undefined}
                >
                  {/* Day number */}
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs font-medium',
                      isToday
                        ? 'bg-violet-600 text-white'
                        : isSelected
                          ? 'text-violet-300'
                          : 'text-[oklch(0.75_0.03_265)]',
                    )}
                  >
                    {cell.day}
                  </span>

                  {/* Focus minutes badge */}
                  {hasFocus && (
                    <span className="text-[10px] tabular-nums text-[oklch(0.75_0.04_270)]">
                      {formatMinutes(cell.minutes)}
                    </span>
                  )}

                  {/* Due card chips (max 2 visible) */}
                  {cell.dueCards.slice(0, 2).map((card) => (
                    <span
                      key={card.id}
                      className="block truncate rounded px-1 py-0.5 text-[10px] leading-tight"
                      style={{
                        background: card.status === 'DONE' || card.status === 'CANCELLED'
                          ? 'oklch(0.25 0.02 265 / 0.6)'
                          : 'oklch(0.35 0.08 270 / 0.5)',
                        color: card.status === 'DONE' || card.status === 'CANCELLED'
                          ? 'oklch(0.45 0.02 265)'
                          : 'oklch(0.82 0.06 270)',
                      }}
                    >
                      {card.title}
                    </span>
                  ))}
                  {cell.dueCards.length > 2 && (
                    <span className="text-[10px] text-[oklch(0.45_0.03_265)]">
                      +{cell.dueCards.length - 2} more
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Day detail panel */}
      {selectedCell && (
        <DayDetailPanel
          cell={selectedCell}
          tagMap={tagMap}
          cards={cards}
          onClose={() => setSelectedDate(null)}
          onOpenCard={openCardDetail}
        />
      )}

      {/* Card detail modal */}
      {detailCardId && detailBoardId && (
        <CardDetailModal
          cardId={detailCardId}
          boardId={detailBoardId}
          onClose={() => { setDetailCardId(null); setDetailBoardId(null) }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DayDetailPanel
// ---------------------------------------------------------------------------

interface DayDetailPanelProps {
  cell: ReturnType<typeof computeCalendarMonthView>['weeks'][number]['days'][number]
  tagMap: Map<string, Tag>
  cards: Pick<Card, 'id' | 'title' | 'status' | 'dueDate' | 'isArchived' | 'boardId'>[]
  onClose: () => void
  onOpenCard: (cardId: string) => void
}

function DayDetailPanel({ cell, tagMap, cards, onClose, onOpenCard }: DayDetailPanelProps) {
  const date = new Date(cell.date + 'T00:00:00')
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // Build card lookup for session linked cards
  const cardMap = new Map(cards.map((c) => [c.id, c]))

  return (
    <div
      className="rounded-xl border border-white/10 bg-[oklch(0.12_0.022_265)] p-4 shadow-xl"
      role="region"
      aria-label={`Details for ${formattedDate}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-white">{formattedDate}</h3>
          <p className="mt-0.5 text-xs text-[oklch(0.56_0.04_265)]">
            {cell.sessions.length > 0
              ? `${cell.sessions.length} session${cell.sessions.length !== 1 ? 's' : ''} · ${formatMinutes(cell.minutes)} focus`
              : 'No focus sessions'}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close day detail"
          className="rounded-lg p-1.5 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/8 hover:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* Sessions */}
        {cell.sessions.length > 0 && (
          <section aria-label="Focus sessions">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
              <Clock className="size-3.5" aria-hidden="true" />
              Sessions
            </h4>
            <ul className="flex flex-col gap-2">
              {cell.sessions.map((session) => {
                const tag = session.tagId ? tagMap.get(session.tagId) : null
                const linkedCard = session.taskId ? cardMap.get(session.taskId) : null

                return (
                  <li
                    key={session.id}
                    className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/3 px-3 py-2.5"
                  >
                    {/* Duration */}
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-semibold tabular-nums text-white">
                        {formatMinutes(session.duration)}
                      </span>
                      <p className="text-[10px] text-[oklch(0.45_0.03_265)]">
                        {formatTime(session.startedAt.toString())}
                      </p>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {/* Tag */}
                      {tag && (
                        <span className="flex items-center gap-1 text-xs text-[oklch(0.75_0.03_265)]">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: tag.color }}
                            aria-hidden="true"
                          />
                          {tag.name}
                        </span>
                      )}

                      {/* Linked card */}
                      {linkedCard && (
                        <button
                          onClick={() => onOpenCard(linkedCard.id)}
                          className="flex items-center gap-1 text-left text-xs text-[oklch(0.65_0.06_270)] transition-colors hover:text-violet-300"
                          aria-label={`Open card: ${linkedCard.title}`}
                        >
                          <CheckSquare className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{linkedCard.title}</span>
                        </button>
                      )}

                      {/* Focus score */}
                      {session.focusScore != null && (
                        <span className="text-[10px] text-[oklch(0.45_0.03_265)]">
                          Score: {session.focusScore}/10
                        </span>
                      )}
                    </div>

                    {/* Session type badge */}
                    <span className={cn(
                      'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                      session.sessionType === 'POMODORO'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-blue-500/15 text-blue-400',
                    )}>
                      {session.sessionType === 'POMODORO' ? 'Pomodoro' : 'Stopwatch'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Due cards */}
        {cell.dueCards.length > 0 && (
          <section aria-label="Cards due">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
              <CheckSquare className="size-3.5" aria-hidden="true" />
              Due cards
            </h4>
            <ul className="flex flex-col gap-1.5">
              {cell.dueCards.map((dueCard) => (
                <li key={dueCard.id}>
                  <button
                    onClick={() => onOpenCard(dueCard.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-white/6 bg-white/3 px-3 py-2 text-left transition-colors hover:bg-white/6"
                    aria-label={`Open card: ${dueCard.title}, status: ${STATUS_LABELS[dueCard.status] ?? dueCard.status}`}
                  >
                    <span className="flex-1 truncate text-sm text-[oklch(0.82_0.04_265)]">
                      {dueCard.title}
                    </span>
                    <span className={cn(
                      'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                      STATUS_COLORS[dueCard.status] ?? 'bg-white/8 text-[oklch(0.56_0.04_265)]',
                    )}>
                      {STATUS_LABELS[dueCard.status] ?? dueCard.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Empty state */}
        {cell.sessions.length === 0 && cell.dueCards.length === 0 && (
          <p className="py-4 text-center text-sm text-[oklch(0.45_0.03_265)]">
            No sessions or due cards on this day.
          </p>
        )}
      </div>
    </div>
  )
}
