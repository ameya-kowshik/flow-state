'use client'

/**
 * Board detail page — fetches board with columns + cards, renders KanbanView or ListView.
 * View preference is persisted in localStorage keyed by board ID.
 * Requirements: 12.4, 12.5, 13.1, 13.2, 13.3, 14.1, 14.7, 14.8
 *
 * params is a Promise in Next.js 15+ — accessed via React.use().
 */

import { use, useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, LayoutDashboard, LayoutGrid, List } from 'lucide-react'
import { KanbanView, type KanbanViewHandle } from '@/components/boards/KanbanView'
import { ListView } from '@/components/boards/ListView'
import { CardDetailModal } from '@/components/boards/CardDetailModal'
import type { ColumnData } from '@/components/boards/Column'
import { cn } from '@/lib/utils'

type ViewMode = 'kanban' | 'list'

interface BoardDetail {
  id: string
  name: string
  color: string
  isStarred: boolean
  isArchived: boolean
  columns: ColumnData[]
}

function getStoredView(boardId: string): ViewMode {
  try {
    const raw = localStorage.getItem(`board-view:${boardId}`)
    if (raw === 'list' || raw === 'kanban') return raw
  } catch {
    // localStorage unavailable (SSR guard)
  }
  return 'kanban'
}

function setStoredView(boardId: string, view: ViewMode) {
  try {
    localStorage.setItem(`board-view:${boardId}`, view)
  } catch {
    // ignore
  }
}

export default function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [board, setBoard] = useState<BoardDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')

  const kanbanRef = useRef<KanbanViewHandle>(null)

  // N shortcut — open add-card on the first column (boards page only)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        kanbanRef.current?.triggerAddCardFirstColumn()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Load persisted view preference after mount (localStorage is client-only)
  useEffect(() => {
    setViewMode(getStoredView(id))
  }, [id])

  const fetchBoard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/boards/${id}`)
      if (res.status === 404) {
        setError('Board not found.')
        return
      }
      if (!res.ok) throw new Error(`Failed to load board: ${res.status}`)
      const data: BoardDetail = await res.json()
      setBoard(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  function handleViewChange(mode: ViewMode) {
    setViewMode(mode)
    setStoredView(id, mode)
  }

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6" aria-busy="true" aria-label="Loading board">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-pulse rounded bg-white/10" aria-hidden="true" />
          <div className="h-5 w-48 animate-pulse rounded-lg bg-white/10" aria-hidden="true" />
        </div>
        <div className="flex gap-3 overflow-hidden px-0 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-64 w-72 shrink-0 animate-pulse rounded-2xl border border-white/8 bg-white/3"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error || !board) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <LayoutDashboard className="size-10 text-[oklch(0.35_0.02_265)]" aria-hidden="true" />
        <p className="text-sm text-red-400">{error ?? 'Board not found.'}</p>
        <div className="flex gap-3">
          <Link
            href="/boards"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/8"
          >
            Back to boards
          </Link>
          {error && error !== 'Board not found.' && (
            <button
              onClick={fetchBoard}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Board view
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Board header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/7 px-6 py-3">
        <Link
          href="/boards"
          aria-label="Back to boards"
          className="rounded-lg p-1 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/6 hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>

        {/* Color swatch + name */}
        <div
          className="size-3 shrink-0 rounded-full"
          style={{ background: board.color }}
          aria-hidden="true"
        />
        <h1 className="flex-1 text-sm font-semibold text-white">{board.name}</h1>

        {/* View toggle */}
        <div
          className="flex items-center rounded-lg border border-white/10 bg-white/4 p-0.5"
          role="group"
          aria-label="Board view"
        >
          <button
            onClick={() => handleViewChange('kanban')}
            aria-label="Kanban view"
            aria-pressed={viewMode === 'kanban'}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              viewMode === 'kanban'
                ? 'bg-white/10 text-white'
                : 'text-[oklch(0.45_0.03_265)] hover:text-white',
            )}
          >
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            Kanban
          </button>
          <button
            onClick={() => handleViewChange('list')}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              viewMode === 'list'
                ? 'bg-white/10 text-white'
                : 'text-[oklch(0.45_0.03_265)] hover:text-white',
            )}
          >
            <List className="size-3.5" aria-hidden="true" />
            List
          </button>
        </div>
      </div>

      {/* Board content — fills remaining height */}
      <div className="min-h-0 flex-1 overflow-auto">
        {viewMode === 'kanban' ? (
          <KanbanView
            ref={kanbanRef}
            boardId={board.id}
            initialColumns={board.columns}
            onCardClick={(cardId) => setActiveCardId(cardId)}
          />
        ) : (
          <ListView
            columns={board.columns}
            onCardClick={(cardId) => setActiveCardId(cardId)}
          />
        )}
      </div>

      {/* Card detail modal — refetch board on close to reflect any changes */}
      {activeCardId && (
        <CardDetailModal
          cardId={activeCardId}
          boardId={board.id}
          onClose={() => {
            setActiveCardId(null)
            fetchBoard()
          }}
        />
      )}
    </div>
  )
}


