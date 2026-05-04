'use client'

/**
 * Card — renders a single Kanban card.
 * Shows title, due date (overdue highlight), label chips, subtask progress,
 * and completedPomodoros count.
 * Uses useSortable from @dnd-kit/sortable for drag-and-drop.
 * Requirements: 14.1, 14.7, 14.8, 15.1, 15.2
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { CalendarDays, CheckSquare, Timer } from 'lucide-react'

// Terminal statuses — overdue highlight is suppressed for these
const TERMINAL_STATUSES = new Set(['DONE', 'CANCELLED'])

interface Label {
  label: {
    id: string
    name: string
    color: string
  }
}

interface Subtask {
  id: string
  isCompleted: boolean
}

export interface CardData {
  id: string
  title: string
  status: string
  dueDate: string | null
  completedPomodoros: number
  position?: number
  labels?: Label[]
  subtasks?: Subtask[]
}

interface CardProps {
  card: CardData
  onClick?: (id: string) => void
  /** When true the card is being dragged — render a ghost placeholder */
  isDragging?: boolean
}

export function Card({ card, onClick, isDragging }: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dragging = isDragging ?? sortableDragging

  const now = Date.now()
  const isOverdue =
    card.dueDate !== null &&
    new Date(card.dueDate).getTime() < now &&
    !TERMINAL_STATUSES.has(card.status)

  const subtasks = card.subtasks ?? []
  const labels = card.labels ?? []
  const completedSubtasks = subtasks.filter((s) => s.isCompleted).length
  const totalSubtasks = subtasks.length

  function formatDueDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => !dragging && onClick?.(card.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(card.id)
        }
      }}
      aria-label={`Card: ${card.title}`}
      aria-grabbed={dragging}
      className={cn(
        'group flex cursor-grab flex-col gap-2 rounded-xl border border-white/8 bg-[oklch(0.14_0.022_265)] p-3',
        'transition-colors hover:border-white/14 hover:bg-[oklch(0.16_0.025_265)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
        dragging && 'opacity-40',
      )}
    >
      {/* Title */}
      <p className="text-sm font-medium leading-snug text-white">{card.title}</p>

      {/* Label chips */}
      {labels.length > 0 && (
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
      )}

      {/* Footer row */}
      {(card.dueDate || totalSubtasks > 0 || card.completedPomodoros > 0) && (
        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
          {/* Due date */}
          {card.dueDate && (
            <span
              className={cn(
                'flex items-center gap-1 text-[11px]',
                isOverdue ? 'text-red-400' : 'text-[oklch(0.56_0.04_265)]',
              )}
              aria-label={isOverdue ? `Overdue: ${formatDueDate(card.dueDate)}` : `Due ${formatDueDate(card.dueDate)}`}
            >
              <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
              {formatDueDate(card.dueDate)}
            </span>
          )}

          {/* Subtask progress */}
          {totalSubtasks > 0 && (
            <span
              className={cn(
                'flex items-center gap-1 text-[11px]',
                completedSubtasks === totalSubtasks
                  ? 'text-emerald-400'
                  : 'text-[oklch(0.56_0.04_265)]',
              )}
              aria-label={`${completedSubtasks} of ${totalSubtasks} subtasks completed`}
            >
              <CheckSquare className="size-3 shrink-0" aria-hidden="true" />
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}

          {/* Pomodoro count */}
          {card.completedPomodoros > 0 && (
            <span
              className="flex items-center gap-1 text-[11px] text-[oklch(0.56_0.04_265)]"
              aria-label={`${card.completedPomodoros} pomodoros completed`}
            >
              <Timer className="size-3 shrink-0" aria-hidden="true" />
              {card.completedPomodoros}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
