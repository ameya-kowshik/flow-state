'use client'

/**
 * BoardCard — displays a single board in the boards grid.
 * Shows board name, color swatch, star toggle, and archive action.
 * Requirements: 12.1, 12.2, 12.3
 */

import { useState } from 'react'
import Link from 'next/link'
import { Star, Archive, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Board {
  id: string
  name: string
  color: string
  isStarred: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

interface BoardCardProps {
  board: Board
  onStarToggle: (id: string, starred: boolean) => void
  onArchive: (id: string) => void
}

export function BoardCard({ board, onStarToggle, onArchive }: BoardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [starPending, setStarPending] = useState(false)

  async function handleStarToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (starPending) return
    setStarPending(true)
    try {
      const res = await fetch(`/api/boards/${board.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: !board.isStarred }),
      })
      if (res.ok) {
        onStarToggle(board.id, !board.isStarred)
      }
    } finally {
      setStarPending(false)
    }
  }

  async function handleArchive(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    const res = await fetch(`/api/boards/${board.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived: true }),
    })
    if (res.ok) {
      onArchive(board.id)
    }
  }

  return (
    <Link
      href={`/boards/${board.id}`}
      className="group relative flex flex-col gap-3 rounded-xl border border-white/8 bg-white/3 p-4 transition-colors hover:border-white/14 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
    >
      {/* Color swatch */}
      <div
        className="h-1.5 w-full rounded-full"
        style={{ background: board.color }}
        aria-hidden="true"
      />

      {/* Name */}
      <p className="flex-1 text-sm font-medium text-white">{board.name}</p>

      {/* Actions row */}
      <div className="flex items-center justify-between">
        {/* Star toggle */}
        <button
          onClick={handleStarToggle}
          disabled={starPending}
          aria-label={board.isStarred ? 'Unstar board' : 'Star board'}
          aria-pressed={board.isStarred}
          className={cn(
            'flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors',
            board.isStarred
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-[oklch(0.45_0.03_265)] hover:text-amber-400',
          )}
        >
          <Star
            className={cn('size-3.5', board.isStarred && 'fill-amber-400')}
            aria-hidden="true"
          />
          {board.isStarred ? 'Starred' : 'Star'}
        </button>

        {/* More menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenuOpen((o) => !o)
            }}
            aria-label="Board options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className="rounded-md p-1 text-[oklch(0.45_0.03_265)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/8 hover:text-white focus-visible:opacity-100"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenuOpen(false)
                }}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 min-w-[140px] rounded-xl border border-white/10 bg-[oklch(0.14_0.022_265)] py-1 shadow-xl"
              >
                <button
                  role="menuitem"
                  onClick={handleArchive}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[oklch(0.65_0.03_265)] transition-colors hover:bg-white/6 hover:text-white"
                >
                  <Archive className="size-3.5" aria-hidden="true" />
                  Archive board
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
