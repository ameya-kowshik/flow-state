'use client'

/**
 * KanbanView — horizontal scroll container of Column components with
 * full @dnd-kit drag-and-drop support.
 *
 * - DndContext wraps all columns
 * - onDragOver: checks WIP limit; cancels drag + shows toast if exceeded
 * - onDragEnd: computes fractional position, optimistically updates state,
 *   calls POST /api/cards/[id]/move, reverts on error
 * - DragOverlay: renders dragged card title while dragging
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 12.4, 13.1
 */

import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { Plus, X } from 'lucide-react'
import { Column, type ColumnData } from './Column'
import { CardDragOverlay } from './DragOverlay'
import { useToast } from '@/components/ui/toast'
import type { CardData } from './Card'

export interface KanbanViewHandle {
  /** Programmatically open the add-card form on the first column (for the N shortcut). */
  triggerAddCardFirstColumn: () => void
}

interface KanbanViewProps {
  boardId: string
  initialColumns: ColumnData[]
  onCardClick?: (cardId: string) => void
}

export const KanbanView = forwardRef<KanbanViewHandle, KanbanViewProps>(
function KanbanView({ boardId, initialColumns, onCardClick }: KanbanViewProps, ref) {
  const [columns, setColumns] = useState<ColumnData[]>(initialColumns)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [columnSubmitting, setColumnSubmitting] = useState(false)
  const [columnError, setColumnError] = useState<string | null>(null)

  // DnD state
  const [activeCard, setActiveCard] = useState<CardData | null>(null)
  // Track which column the card is hovering over and whether it's over-limit
  const overLimitColumnId = useRef<string | null>(null)

  const { toast } = useToast()

  // Ref map so the N shortcut can imperatively open the first column's add-card form
  const columnAddCardRefs = useRef<Map<string, () => void>>(new Map())

  useImperativeHandle(ref, () => ({
    triggerAddCardFirstColumn: () => {
      const firstColId = columns[0]?.id
      if (!firstColId) return
      const trigger = columnAddCardRefs.current.get(firstColId)
      trigger?.()
    },
  }))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Find which column owns a given card id */
  function findColumnByCardId(cardId: string): ColumnData | undefined {
    return columns.find((col) => col.cards.some((c) => c.id === cardId))
  }

  /** Find a column by its own id */
  function findColumnById(colId: string): ColumnData | undefined {
    return columns.find((col) => col.id === colId)
  }

  /**
   * Compute a fractional position for a card inserted between two neighbors.
   * If no prev, use neighbor - 1. If no next, use neighbor + 1.
   */
  function computePosition(prev: CardData | undefined, next: CardData | undefined): number {
    // We don't have position on CardData directly, so we use index-based
    // fractional values. The server stores Float positions; we send a value
    // that slots between the neighbors based on their array indices.
    // The server's rebalance logic handles gaps < 0.001.
    if (!prev && !next) return 1
    if (!prev) return (next!.position ?? 1) - 1
    if (!next) return (prev.position ?? 1) + 1
    return ((prev.position ?? 0) + (next.position ?? 0)) / 2
  }

  // ---------------------------------------------------------------------------
  // DnD handlers
  // ---------------------------------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    const cardId = event.active.id as string
    const col = findColumnByCardId(cardId)
    const card = col?.cards.find((c) => c.id === cardId) ?? null
    setActiveCard(card)
    overLimitColumnId.current = null
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Determine destination column: over could be a column id or a card id
    const destCol =
      findColumnById(overId) ?? findColumnByCardId(overId)
    if (!destCol) return

    const sourceCol = findColumnByCardId(activeId)
    if (!sourceCol) return

    // Check WIP limit when moving to a different column
    if (destCol.id !== sourceCol.id && destCol.cardLimit !== null) {
      if (destCol.cards.length >= destCol.cardLimit) {
        overLimitColumnId.current = destCol.id
        return // don't update state — block the move visually
      }
    }
    overLimitColumnId.current = null

    // Optimistically move the card in local state for visual feedback
    if (destCol.id === sourceCol.id) return // reorder handled in onDragEnd

    setColumns((prev) => {
      const card = sourceCol.cards.find((c) => c.id === activeId)
      if (!card) return prev
      return prev.map((col) => {
        if (col.id === sourceCol.id) {
          return { ...col, cards: col.cards.filter((c) => c.id !== activeId) }
        }
        if (col.id === destCol.id) {
          return { ...col, cards: [...col.cards, card] }
        }
        return col
      })
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCard(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Determine destination column
    const destCol = findColumnById(overId) ?? findColumnByCardId(overId)
    if (!destCol) return

    const sourceCol = findColumnByCardId(activeId)
    if (!sourceCol) return

    // WIP limit check — show toast and revert if exceeded
    if (destCol.id !== sourceCol.id && destCol.cardLimit !== null) {
      // Re-read current state to get accurate count
      const currentDestCol = columns.find((c) => c.id === destCol.id)
      const currentCount = currentDestCol?.cards.filter((c) => c.id !== activeId).length ?? 0
      if (currentCount >= destCol.cardLimit) {
        toast(
          `Column "${destCol.name}" has reached its WIP limit of ${destCol.cardLimit}`,
          'destructive',
        )
        overLimitColumnId.current = null
        return
      }
    }
    overLimitColumnId.current = null

    // Snapshot state before optimistic update for potential revert
    const snapshot = columns

    setColumns((prev) => {
      const updatedCols = prev.map((col) => ({ ...col, cards: [...col.cards] }))

      const srcColIdx = updatedCols.findIndex((c) => c.id === sourceCol.id)
      const dstColIdx = updatedCols.findIndex((c) => c.id === destCol.id)
      if (srcColIdx === -1 || dstColIdx === -1) return prev

      const srcCards = updatedCols[srcColIdx].cards
      const dstCards = updatedCols[dstColIdx].cards

      const activeIdx = srcCards.findIndex((c) => c.id === activeId)
      if (activeIdx === -1) return prev

      if (srcColIdx === dstColIdx) {
        // Reorder within same column
        const overIdx = srcCards.findIndex((c) => c.id === overId)
        if (overIdx === -1 || activeIdx === overIdx) return prev
        updatedCols[srcColIdx].cards = arrayMove(srcCards, activeIdx, overIdx)
      } else {
        // Move to different column — card may already be there from onDragOver
        const alreadyInDest = dstCards.some((c) => c.id === activeId)
        const card = alreadyInDest
          ? dstCards.find((c) => c.id === activeId)!
          : srcCards[activeIdx]

        if (!alreadyInDest) {
          updatedCols[srcColIdx].cards = srcCards.filter((c) => c.id !== activeId)
        }

        // Insert at the position of the over item, or append
        const overIdx = dstCards.findIndex((c) => c.id === overId)
        const insertIdx = overIdx === -1 ? dstCards.length : overIdx
        const newDstCards = dstCards.filter((c) => c.id !== activeId)
        newDstCards.splice(insertIdx, 0, card)
        updatedCols[dstColIdx].cards = newDstCards
      }

      return updatedCols
    })

    // Compute position for the API call
    // We need to read the updated columns after setState — use a callback approach
    // by computing from the current columns synchronously before setState resolves.
    // We'll compute based on the over position in the destination column.
    const currentDstCards = columns.find((c) => c.id === destCol.id)?.cards ?? []
    const overIdx = currentDstCards.findIndex((c) => c.id === overId)
    const prevCard = overIdx > 0 ? currentDstCards[overIdx - 1] : undefined
    const nextCard = overIdx >= 0 ? currentDstCards[overIdx] : undefined
    const newPosition = computePosition(prevCard, nextCard)

    // Fire API call
    moveCardOnServer(activeId, destCol.id, newPosition, snapshot)
  }

  const moveCardOnServer = useCallback(
    async (
      cardId: string,
      columnId: string,
      position: number,
      snapshot: ColumnData[],
    ) => {
      try {
        const res = await fetch(`/api/cards/${cardId}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnId, position }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const msg =
            (data as { fields?: { columnId?: string }; error?: string })?.fields?.columnId ??
            (data as { error?: string })?.error ??
            'Failed to move card'
          throw new Error(msg)
        }
      } catch (err) {
        // Revert optimistic update
        setColumns(snapshot)
        toast(err instanceof Error ? err.message : 'Failed to move card', 'destructive')
      }
    },
    [toast],
  )

  // ---------------------------------------------------------------------------
  // Add column
  // ---------------------------------------------------------------------------
  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault()
    const name = newColumnName.trim()
    if (!name) return
    setColumnSubmitting(true)
    setColumnError(null)
    try {
      const res = await fetch(`/api/boards/${boardId}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json()
        setColumnError(data.fields?.name ?? data.error ?? 'Failed to create column')
        return
      }
      const newCol = await res.json()
      setColumns((prev) => [...prev, { ...newCol, cards: [] }])
      setNewColumnName('')
      setAddingColumn(false)
    } catch {
      setColumnError('Network error — please try again')
    } finally {
      setColumnSubmitting(false)
    }
  }

  function handleCancelAddColumn() {
    setAddingColumn(false)
    setNewColumnName('')
    setColumnError(null)
  }

  // ---------------------------------------------------------------------------
  // Add card to a column
  // ---------------------------------------------------------------------------
  async function handleAddCard(columnId: string, title: string) {
    const res = await fetch(`/api/columns/${columnId}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.fields?.columnId ?? data.error ?? 'Failed to add card')
    }
    const newCard = await res.json()
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId
          ? { ...col, cards: [...col.cards, { ...newCard, labels: [], subtasks: [] }] }
          : col,
      ),
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex h-full min-h-0 gap-3 overflow-x-auto px-6 py-4 pb-6"
        aria-label="Kanban board"
      >
        {/* Columns */}
        {columns.map((col) => (
          <Column
            key={col.id}
            column={col}
            onAddCard={handleAddCard}
            onCardClick={onCardClick}
            activeCardId={activeCard?.id}
            isOverLimit={overLimitColumnId.current === col.id}
            onRegisterAddCard={(trigger) => {
              columnAddCardRefs.current.set(col.id, trigger)
            }}
          />
        ))}

        {/* Add column */}
        {addingColumn ? (
          <form
            onSubmit={handleAddColumn}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-2xl border border-violet-500/30 bg-[oklch(0.12_0.022_265)] p-3"
            aria-label="Add column form"
          >
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Column name…"
              autoFocus
              maxLength={100}
              aria-label="New column name"
              aria-invalid={!!columnError}
              aria-describedby={columnError ? 'add-col-error' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelAddColumn()
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-[oklch(0.35_0.02_265)] outline-none transition-colors focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
            />
            {columnError && (
              <p id="add-col-error" role="alert" className="text-xs text-red-400">
                {columnError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={columnSubmitting || !newColumnName.trim()}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                {columnSubmitting ? 'Adding…' : 'Add column'}
              </button>
              <button
                type="button"
                onClick={handleCancelAddColumn}
                aria-label="Cancel adding column"
                className="rounded-lg p-1.5 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/6 hover:text-white"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddingColumn(true)}
            className="flex h-fit w-72 shrink-0 items-center gap-2 rounded-2xl border border-dashed border-white/12 px-4 py-3 text-sm text-[oklch(0.38_0.02_265)] transition-colors hover:border-white/20 hover:bg-white/3 hover:text-[oklch(0.56_0.04_265)]"
            aria-label="Add column"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Add column
          </button>
        )}
      </div>

      {/* Drag overlay — renders the card being dragged */}
      <DragOverlay>
        {activeCard ? <CardDragOverlay title={activeCard.title} /> : null}
      </DragOverlay>
    </DndContext>
  )
})
