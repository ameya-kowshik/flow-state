'use client'

/**
 * Boards page — lists all active boards for the user.
 * Starred boards appear first. "New Board" button opens a creation dialog.
 * Requirements: 2.3, 12.1, 12.2, 12.3, 12.6
 */

import { useState, useEffect, useCallback } from 'react'
import { Plus, LayoutDashboard, X } from 'lucide-react'
import { BoardCard } from '@/components/boards/BoardCard'

interface Board {
  id: string
  name: string
  color: string
  isStarred: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

// Preset colors for the board color picker
const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#a855f7', '#64748b',
]

// ---------------------------------------------------------------------------
// New Board Dialog
// ---------------------------------------------------------------------------

interface NewBoardDialogProps {
  onClose: () => void
  onCreate: (board: Board) => void
}

function NewBoardDialog({ onClose, onCreate }: NewBoardDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Board name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.fields?.name ?? data.error ?? 'Failed to create board')
        return
      }
      const board: Board = await res.json()
      onCreate(board)
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-board-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[oklch(0.13_0.022_265)] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="new-board-title" className="text-base font-semibold text-white">
            New board
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/8 hover:text-white"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="board-name" className="text-xs text-[oklch(0.56_0.04_265)]">
              Board name
            </label>
            <input
              id="board-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Product Roadmap"
              autoFocus
              maxLength={100}
              aria-invalid={!!error}
              aria-describedby={error ? 'board-name-error' : undefined}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-[oklch(0.35_0.02_265)] outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
            {error && (
              <p id="board-name-error" role="alert" className="text-xs text-red-400">
                {error}
              </p>
            )}
          </div>

          {/* Color */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[oklch(0.56_0.04_265)]">Color</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Board color">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className="size-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  style={{
                    background: c,
                    outline: color === c ? `2px solid white` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div
            className="h-1 w-full rounded-full"
            style={{ background: color }}
            aria-hidden="true"
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create board'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15">
        <LayoutDashboard className="size-6 text-violet-400" aria-hidden="true" />
      </div>
      <div>
        <p className="font-medium text-white">No boards yet</p>
        <p className="mt-1 text-sm text-[oklch(0.45_0.03_265)]">
          Create your first board to start organizing your work.
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
      >
        <Plus className="size-4" aria-hidden="true" />
        New board
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const fetchBoards = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/boards')
      if (!res.ok) throw new Error(`Failed to load boards: ${res.status}`)
      const data: Board[] = await res.json()
      setBoards(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  function handleBoardCreated(board: Board) {
    // Insert starred boards before non-starred, maintaining server ordering
    setBoards((prev) => {
      const updated = [...prev, board]
      return updated.sort((a, b) => {
        if (a.isStarred === b.isStarred) return 0
        return a.isStarred ? -1 : 1
      })
    })
  }

  function handleStarToggle(id: string, starred: boolean) {
    setBoards((prev) => {
      const updated = prev.map((b) => (b.id === id ? { ...b, isStarred: starred } : b))
      return updated.sort((a, b) => {
        if (a.isStarred === b.isStarred) return 0
        return a.isStarred ? -1 : 1
      })
    })
  }

  function handleArchive(id: string) {
    setBoards((prev) => prev.filter((b) => b.id !== id))
  }

  const starred = boards.filter((b) => b.isStarred)
  const regular = boards.filter((b) => !b.isStarred)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Boards</h1>
        {!loading && !error && (
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            <Plus className="size-4" aria-hidden="true" />
            New board
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-white/8 bg-white/3"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={fetchBoards}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/8"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && boards.length === 0 && (
        <EmptyState onNew={() => setShowDialog(true)} />
      )}

      {/* Board grid */}
      {!loading && !error && boards.length > 0 && (
        <div className="flex flex-col gap-6">
          {starred.length > 0 && (
            <section aria-labelledby="starred-heading">
              <h2
                id="starred-heading"
                className="mb-3 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]"
              >
                Starred
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {starred.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    onStarToggle={handleStarToggle}
                    onArchive={handleArchive}
                  />
                ))}
              </div>
            </section>
          )}

          {regular.length > 0 && (
            <section aria-labelledby="all-boards-heading">
              {starred.length > 0 && (
                <h2
                  id="all-boards-heading"
                  className="mb-3 text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]"
                >
                  All boards
                </h2>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {regular.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    onStarToggle={handleStarToggle}
                    onArchive={handleArchive}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* New board dialog */}
      {showDialog && (
        <NewBoardDialog
          onClose={() => setShowDialog(false)}
          onCreate={handleBoardCreated}
        />
      )}
    </div>
  )
}
