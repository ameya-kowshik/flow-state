'use client'

/**
 * ListView — flat, sortable table of all cards across all columns.
 * Columns: title, column name, due date (overdue highlight), labels,
 * subtask progress, completedPomodoros.
 * Clicking a row opens CardDetailModal.
 * Requirements: 12.4, 12.5
 */

import { useState, useMemo } from 'react'
import { CalendarDays, CheckSquare, Timer, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ColumnData } from './Column'
import type { CardData } from './Card'

// Terminal statuses — overdue highlight suppressed for these
const TERMINAL_STATUSES = new Set(['DONE', 'CANCELLED'])

type SortKey = 'title' | 'column' | 'dueDate' | 'subtasks' | 'pomodoros'
type SortDir = 'asc' | 'desc'

interface FlatCard extends CardData {
  columnId: string
  columnName: string
}

interface ListViewProps {
  columns: ColumnData[]
  onCardClick?: (cardId: string) => void
}

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function isOverdue(card: CardData): boolean {
  return (
    card.dueDate !== null &&
    new Date(card.dueDate).getTime() < Date.now() &&
    !TERMINAL_STATUSES.has(card.status)
  )
}

export function ListView({ columns, onCardClick }: ListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Flatten all cards across columns
  const flatCards: FlatCard[] = useMemo(
    () =>
      columns.flatMap((col) =>
        col.cards.map((card) => ({
          ...card,
          columnId: col.id,
          columnName: col.name,
        })),
      ),
    [columns],
  )

  // Sort
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...flatCards].sort((a, b) => {
      switch (sortKey) {
        case 'title':
          return dir * a.title.localeCompare(b.title)
        case 'column':
          return dir * a.columnName.localeCompare(b.columnName)
        case 'dueDate': {
          const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
          const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
          return dir * (aTime - bTime)
        }
        case 'subtasks': {
          const aTotal = (a.subtasks ?? []).length
          const bTotal = (b.subtasks ?? []).length
          return dir * (aTotal - bTotal)
        }
        case 'pomodoros':
          return dir * (a.completedPomodoros - b.completedPomodoros)
        default:
          return 0
      }
    })
  }, [flatCards, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />
    return sortDir === 'asc' ? (
      <ArrowUp className="size-3 text-violet-400" aria-hidden="true" />
    ) : (
      <ArrowDown className="size-3 text-violet-400" aria-hidden="true" />
    )
  }

  if (flatCards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-sm text-[oklch(0.45_0.03_265)]">No cards yet. Add cards from the Kanban view.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto px-6 py-4">
      <table
        className="w-full min-w-[640px] border-collapse text-sm"
        aria-label="Cards list"
      >
        <thead>
          <tr className="border-b border-white/8">
            <Th label="Title" col="title" onSort={handleSort} SortIcon={SortIcon} />
            <Th label="Column" col="column" onSort={handleSort} SortIcon={SortIcon} />
            <Th label="Due date" col="dueDate" onSort={handleSort} SortIcon={SortIcon} />
            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
              Labels
            </th>
            <Th label="Subtasks" col="subtasks" onSort={handleSort} SortIcon={SortIcon} />
            <Th label="Pomodoros" col="pomodoros" onSort={handleSort} SortIcon={SortIcon} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((card) => (
            <CardRow key={card.id} card={card} onCardClick={onCardClick} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Th — sortable header cell
// ---------------------------------------------------------------------------

function Th({
  label,
  col,
  onSort,
  SortIcon,
}: {
  label: string
  col: SortKey
  onSort: (k: SortKey) => void
  SortIcon: React.FC<{ col: SortKey }>
}) {
  return (
    <th className="px-3 py-2.5 text-left">
      <button
        onClick={() => onSort(col)}
        className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)] transition-colors hover:text-white"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <SortIcon col={col} />
      </button>
    </th>
  )
}

// ---------------------------------------------------------------------------
// CardRow
// ---------------------------------------------------------------------------

function CardRow({
  card,
  onCardClick,
}: {
  card: FlatCard
  onCardClick?: (id: string) => void
}) {
  const overdue = isOverdue(card)
  const subtasks = card.subtasks ?? []
  const labels = card.labels ?? []
  const completedSubtasks = subtasks.filter((s) => s.isCompleted).length
  const totalSubtasks = subtasks.length

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onCardClick?.(card.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onCardClick?.(card.id)
        }
      }}
      aria-label={`Open card: ${card.title}`}
      className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/50"
    >
      {/* Title */}
      <td className="max-w-[240px] px-3 py-3">
        <span className="truncate font-medium text-white">{card.title}</span>
      </td>

      {/* Column name */}
      <td className="px-3 py-3">
        <span className="text-[oklch(0.56_0.04_265)]">{card.columnName}</span>
      </td>

      {/* Due date */}
      <td className="px-3 py-3">
        {card.dueDate ? (
          <span
            className={cn(
              'flex items-center gap-1.5',
              overdue ? 'text-red-400' : 'text-[oklch(0.56_0.04_265)]',
            )}
            aria-label={overdue ? `Overdue: ${formatDueDate(card.dueDate)}` : `Due ${formatDueDate(card.dueDate)}`}
          >
            <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
            {formatDueDate(card.dueDate)}
          </span>
        ) : (
          <span className="text-[oklch(0.35_0.02_265)]">—</span>
        )}
      </td>

      {/* Labels */}
      <td className="px-3 py-3">
        {labels.length > 0 ? (
          <div className="flex flex-wrap gap-1" aria-label="Labels">
            {labels.map(({ label }) => (
              <span
                key={label.id}
                className="inline-flex h-4 items-center rounded-full px-2 text-[10px] font-medium text-white/90"
                style={{ background: label.color + '55', border: `1px solid ${label.color}55` }}
              >
                {label.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[oklch(0.35_0.02_265)]">—</span>
        )}
      </td>

      {/* Subtask progress */}
      <td className="px-3 py-3">
        {totalSubtasks > 0 ? (
          <span
            className={cn(
              'flex items-center gap-1.5',
              completedSubtasks === totalSubtasks
                ? 'text-emerald-400'
                : 'text-[oklch(0.56_0.04_265)]',
            )}
            aria-label={`${completedSubtasks} of ${totalSubtasks} subtasks completed`}
          >
            <CheckSquare className="size-3.5 shrink-0" aria-hidden="true" />
            {completedSubtasks}/{totalSubtasks}
          </span>
        ) : (
          <span className="text-[oklch(0.35_0.02_265)]">—</span>
        )}
      </td>

      {/* Pomodoros */}
      <td className="px-3 py-3">
        {card.completedPomodoros > 0 ? (
          <span
            className="flex items-center gap-1.5 text-[oklch(0.56_0.04_265)]"
            aria-label={`${card.completedPomodoros} pomodoros`}
          >
            <Timer className="size-3.5 shrink-0" aria-hidden="true" />
            {card.completedPomodoros}
          </span>
        ) : (
          <span className="text-[oklch(0.35_0.02_265)]">—</span>
        )}
      </td>
    </tr>
  )
}
