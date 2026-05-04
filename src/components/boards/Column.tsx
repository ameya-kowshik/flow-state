'use client'

/**
 * Column — renders a Kanban column with header, WIP indicator, collapse toggle,
 * add-card button, and a list of Card components.
 * Uses SortableContext from @dnd-kit/sortable for drag-and-drop.
 * Requirements: 13.1, 13.2, 13.3, 15.1, 15.2
 */

import { useState, useEffect, useRef } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { ChevronDown, Plus, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, type CardData } from './Card'

export interface ColumnData {
  id: string
  name: string
  cardLimit: number | null
  isCollapsed: boolean
  cards: CardData[]
}

interface ColumnProps {
  column: ColumnData
  onAddCard: (columnId: string, title: string) => Promise<void>
  onCardClick?: (cardId: string) => void
  /** Card id currently being dragged (to render ghost placeholder) */
  activeCardId?: string | null
  /** Whether this column is the drag-over target and WIP limit is exceeded */
  isOverLimit?: boolean
  /** Called once on mount so the parent can imperatively trigger add-card (e.g. N shortcut) */
  onRegisterAddCard?: (trigger: () => void) => void
}

export function Column({ column, onAddCard, onCardClick, activeCardId, isOverLimit, onRegisterAddCard }: ColumnProps) {
  const [collapsed, setCollapsed] = useState(column.isCollapsed)
  const [addingCard, setAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const cardCount = column.cards.length
  const atLimit = column.cardLimit !== null && cardCount >= column.cardLimit
  const nearLimit = column.cardLimit !== null && cardCount >= column.cardLimit * 0.8

  // Register the add-card trigger with the parent (used by the N keyboard shortcut)
  // Use a stable ref so the effect only runs once per column mount.
  const onRegisterAddCardRef = useRef(onRegisterAddCard)
  onRegisterAddCardRef.current = onRegisterAddCard
  useEffect(() => {
    onRegisterAddCardRef.current?.(() => {
      if (atLimit) return
      setCollapsed(false)
      setAddingCard(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Make the column a drop target so cards can be dropped into empty columns
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: column.id })

  const cardIds = column.cards.map((c) => c.id)

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault()
    const title = newCardTitle.trim()
    if (!title) return
    setSubmitting(true)
    setAddError(null)
    try {
      await onAddCard(column.id, title)
      setNewCardTitle('')
      setAddingCard(false)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add card')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancelAdd() {
    setAddingCard(false)
    setNewCardTitle('')
    setAddError(null)
  }

  return (
    <div
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-2xl border bg-[oklch(0.12_0.022_265)] transition-colors',
        isOver && isOverLimit
          ? 'border-red-500/40 bg-red-500/5'
          : isOver
            ? 'border-violet-500/40'
            : 'border-white/8',
      )}
      aria-label={`Column: ${column.name}`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand column ${column.name}` : `Collapse column ${column.name}`}
          className="rounded-md p-0.5 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/6 hover:text-white"
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform duration-150', collapsed && '-rotate-90')}
            aria-hidden="true"
          />
        </button>

        {/* Column name */}
        <h2 className="flex-1 truncate text-sm font-medium text-white">{column.name}</h2>

        {/* Card count + WIP indicator */}
        <div className="flex items-center gap-1.5">
          {atLimit && (
            <AlertTriangle
              className="size-3.5 text-amber-400"
              aria-label="WIP limit reached"
            />
          )}
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-xs tabular-nums',
              atLimit
                ? 'bg-amber-500/15 text-amber-400'
                : nearLimit
                  ? 'bg-amber-500/8 text-[oklch(0.65_0.06_80)]'
                  : 'bg-white/6 text-[oklch(0.56_0.04_265)]',
            )}
            aria-label={
              column.cardLimit
                ? `${cardCount} of ${column.cardLimit} cards`
                : `${cardCount} cards`
            }
          >
            {column.cardLimit ? `${cardCount}/${column.cardLimit}` : cardCount}
          </span>
        </div>

        {/* Add card button */}
        <button
          onClick={() => {
            setCollapsed(false)
            setAddingCard(true)
          }}
          disabled={atLimit}
          aria-label={`Add card to ${column.name}`}
          title={atLimit ? 'WIP limit reached' : 'Add card'}
          className="rounded-md p-0.5 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/6 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Cards list — hidden when collapsed */}
      {!collapsed && (
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div
            ref={setDropRef}
            className="flex min-h-[2rem] flex-col gap-2 px-2 pb-2"
          >
            {column.cards.map((card) => (
              <Card
                key={card.id}
                card={card}
                onClick={onCardClick}
                isDragging={activeCardId === card.id}
              />
            ))}

            {/* Inline add-card form */}
            {addingCard ? (
              <form
                onSubmit={handleAddCard}
                className="flex flex-col gap-2 rounded-xl border border-violet-500/30 bg-[oklch(0.14_0.022_265)] p-2"
              >
                <textarea
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  placeholder="Card title…"
                  autoFocus
                  rows={2}
                  maxLength={500}
                  aria-label="New card title"
                  aria-invalid={!!addError}
                  aria-describedby={addError ? 'add-card-error' : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelAdd()
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddCard(e as unknown as React.FormEvent)
                    }
                  }}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white placeholder-[oklch(0.35_0.02_265)] outline-none transition-colors focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
                />
                {addError && (
                  <p id="add-card-error" role="alert" className="text-xs text-red-400">
                    {addError}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={submitting || !newCardTitle.trim()}
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                  >
                    {submitting ? 'Adding…' : 'Add card'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAdd}
                    className="rounded-lg px-3 py-1.5 text-xs text-[oklch(0.56_0.04_265)] transition-colors hover:bg-white/6 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* Ghost add button at bottom of card list */
              !atLimit && (
                <button
                  onClick={() => setAddingCard(true)}
                  className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-xs text-[oklch(0.38_0.02_265)] transition-colors hover:bg-white/4 hover:text-[oklch(0.56_0.04_265)]"
                  aria-label={`Add card to ${column.name}`}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add card
                </button>
              )
            )}
          </div>
        </SortableContext>
      )}
    </div>
  )
}
