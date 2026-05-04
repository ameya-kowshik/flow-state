'use client'

/**
 * Today page — two-column layout: task list (left) + timer (right).
 *
 * Task list shows cards that are:
 *   - due today
 *   - overdue with non-terminal status
 *   - status === 'IN_PROGRESS'
 *
 * Selecting a card links it to the timer via setSelectedTaskId.
 * Clicking a card title opens CardDetailModal.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4
 */

import { useEffect, useState, useCallback } from 'react'
import { CalendarDays, AlertCircle, RefreshCw, Clock, Layers } from 'lucide-react'
import { TimerDisplay } from '@/components/timer/TimerDisplay'
import { CardDetailModal } from '@/components/boards/CardDetailModal'
import { useTimer } from '@/contexts/TimerContext'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TodayCard {
  id: string
  title: string
  status: string
  dueDate: string | null
  board: { id: string; name: string }
  column: { id: string; name: string }
  subtasks: { id: string; isCompleted: boolean }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = ['DONE', 'CANCELLED']

function isOverdue(card: TodayCard): boolean {
  if (!card.dueDate) return false
  if (TERMINAL_STATUSES.includes(card.status)) return false
  return new Date(card.dueDate).getTime() < Date.now()
}

function formatDueDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const dDay = new Date(d)
  dDay.setHours(0, 0, 0, 0)

  if (dDay.getTime() === today.getTime()) return 'Today'
  if (dDay.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Task list item
// ---------------------------------------------------------------------------

function TaskItem({
  card,
  isSelected,
  onSelect,
  onOpenDetail,
}: {
  card: TodayCard
  isSelected: boolean
  onSelect: () => void
  onOpenDetail: () => void
}) {
  const overdue = isOverdue(card)
  const completedSubtasks = card.subtasks.filter((s) => s.isCompleted).length
  const totalSubtasks = card.subtasks.length

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-150 cursor-pointer',
        isSelected
          ? 'border-violet-500/40 bg-violet-500/10'
          : 'border-white/8 bg-white/3 hover:border-white/12 hover:bg-white/5',
      )}
      onClick={onSelect}
      role="button"
      aria-pressed={isSelected}
      aria-label={`Select task: ${card.title}`}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          'mt-0.5 size-4 shrink-0 rounded-full border-2 transition-colors',
          isSelected
            ? 'border-violet-400 bg-violet-400'
            : 'border-white/20 group-hover:border-white/40',
        )}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        {/* Title — clicking opens detail modal */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenDetail() }}
          className="text-left text-sm font-medium text-white hover:text-violet-300 transition-colors"
          aria-label={`Open card detail: ${card.title}`}
        >
          {card.title}
        </button>

        {/* Context: board / column */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[oklch(0.45_0.03_265)]">
          <span className="flex items-center gap-1">
            <Layers className="size-3" aria-hidden="true" />
            {card.board.name}
          </span>
          <span aria-hidden="true">·</span>
          <span>{card.column.name}</span>
        </div>

        {/* Due date + subtask progress */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {card.dueDate && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                overdue ? 'text-red-400' : 'text-[oklch(0.56_0.04_265)]',
              )}
              aria-label={overdue ? `Overdue: ${formatDueDate(card.dueDate)}` : `Due: ${formatDueDate(card.dueDate)}`}
            >
              {overdue ? (
                <AlertCircle className="size-3" aria-hidden="true" />
              ) : (
                <CalendarDays className="size-3" aria-hidden="true" />
              )}
              {formatDueDate(card.dueDate)}
            </span>
          )}
          {totalSubtasks > 0 && (
            <span
              className={cn(
                'text-xs tabular-nums',
                completedSubtasks === totalSubtasks
                  ? 'text-emerald-400'
                  : 'text-[oklch(0.45_0.03_265)]',
              )}
              aria-label={`${completedSubtasks} of ${totalSubtasks} subtasks completed`}
            >
              {completedSubtasks}/{totalSubtasks} subtasks
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Today page
// ---------------------------------------------------------------------------

export default function TodayPage() {
  const { selectedTaskId, setSelectedTaskId, start, status } = useTimer()

  const [cards, setCards] = useState<TodayCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)

  const fetchCards = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cards/today')
      if (!res.ok) throw new Error(`Failed to load tasks (${res.status})`)
      const data: TodayCard[] = await res.json()
      setCards(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  function handleSelectCard(card: TodayCard) {
    // Toggle selection — deselect if already selected
    if (selectedTaskId === card.id) {
      setSelectedTaskId(null)
    } else {
      setSelectedTaskId(card.id)
    }
  }

  function handleStartWithCard(card: TodayCard) {
    setSelectedTaskId(card.id)
    if (status === 'idle') {
      start()
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full min-h-screen flex-col lg:flex-row">
      {/* ------------------------------------------------------------------ */}
      {/* Left panel — task list                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex w-full flex-col border-b border-white/7 lg:w-[420px] lg:shrink-0 lg:border-b-0 lg:border-r lg:overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/7 px-6 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-violet-400" aria-hidden="true" />
            <h1 className="text-sm font-semibold text-white">Today</h1>
            {!loading && (
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-xs tabular-nums text-[oklch(0.56_0.04_265)]">
                {cards.length}
              </span>
            )}
          </div>
          <button
            onClick={fetchCards}
            aria-label="Refresh task list"
            disabled={loading}
            className="rounded-lg p-1.5 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/6 hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Task list body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading tasks">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl border border-white/6 bg-white/3"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="size-8 text-red-400" aria-hidden="true" />
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={fetchCards}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500"
              >
                <RefreshCw className="size-3" aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/15">
                <CalendarDays className="size-5 text-emerald-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">All clear</p>
                <p className="mt-0.5 text-xs text-[oklch(0.45_0.03_265)]">
                  No tasks due today or overdue.
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Today's tasks">
              {cards.map((card) => (
                <li key={card.id}>
                  <TaskItem
                    card={card}
                    isSelected={selectedTaskId === card.id}
                    onSelect={() => handleSelectCard(card)}
                    onOpenDetail={() => setActiveCardId(card.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Start with selected task CTA */}
        {selectedTaskId && status === 'idle' && (
          <div className="border-t border-white/7 px-4 py-3">
            <button
              onClick={() => {
                const card = cards.find((c) => c.id === selectedTaskId)
                if (card) handleStartWithCard(card)
              }}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold',
                'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25',
                'transition-all duration-150 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98]',
              )}
            >
              <Clock className="size-4" aria-hidden="true" />
              Start timer with selected task
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right panel — timer                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <TimerDisplay />

        {/* Selected task indicator */}
        {selectedTaskId && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-2">
            <div className="size-1.5 rounded-full bg-violet-400" aria-hidden="true" />
            <span className="text-xs text-violet-300">
              {cards.find((c) => c.id === selectedTaskId)?.title ?? 'Task selected'}
            </span>
            <button
              onClick={() => setSelectedTaskId(null)}
              aria-label="Deselect task"
              className="ml-1 rounded p-0.5 text-violet-400/60 transition-colors hover:text-violet-300"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Card detail modal */}
      {activeCardId && (
        <CardDetailModal
          cardId={activeCardId}
          boardId={cards.find((c) => c.id === activeCardId)?.board.id ?? ''}
          onClose={() => {
            setActiveCardId(null)
            fetchCards()
          }}
        />
      )}
    </div>
  )
}
