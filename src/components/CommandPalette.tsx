'use client'

/**
 * CommandPalette — modal overlay for global search and navigation.
 *
 * Opens on Cmd+K / Ctrl+K (wired in the app layout).
 * Searches boards, cards, and navigation destinations by name.
 * Selecting a result navigates or triggers the associated action.
 * Escape closes the palette.
 *
 * Requirements: 20.1, 20.2, 20.3, 20.4
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, CreditCard, Compass, Search, X, Keyboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildCommandIndex,
  searchCommands,
  type CommandBoard,
  type CommandCard,
  type CommandItem,
  type NavItem,
} from '@/lib/command-palette'
import { useCommandPalette } from '@/contexts/CommandPaletteContext'
import { SHORTCUTS } from '@/lib/shortcuts'

// ---------------------------------------------------------------------------
// Static nav items — mirrors the sidebar
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  { label: 'Today',     href: '/today' },
  { label: 'Focus',     href: '/focus' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Settings',  href: '/settings' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function itemIcon(type: CommandItem['type']) {
  switch (type) {
    case 'board': return <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
    case 'card':  return <CreditCard      className="size-4 shrink-0" aria-hidden="true" />
    case 'nav':   return <Compass         className="size-4 shrink-0" aria-hidden="true" />
  }
}

function itemLabel(type: CommandItem['type']) {
  switch (type) {
    case 'board': return 'Board'
    case 'card':  return 'Card'
    case 'nav':   return 'Navigate'
  }
}

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const router = useRouter()
  const { open, closePalette } = useCommandPalette()

  const [query, setQuery] = useState('')
  const [boards, setBoards] = useState<CommandBoard[]>([])
  const [cards, setCards] = useState<CommandCard[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // -------------------------------------------------------------------------
  // Fetch boards + cards once on mount; re-fetch when palette opens
  // -------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    try {
      const [boardsRes, cardsRes] = await Promise.all([
        fetch('/api/boards'),
        fetch('/api/cards/tasks'),
      ])
      if (boardsRes.ok) {
        const data = await boardsRes.json()
        setBoards(
          (data as Array<{ id: string; name: string }>).map((b) => ({
            id: b.id,
            name: b.name,
          })),
        )
      }
      if (cardsRes.ok) {
        const data = await cardsRes.json()
        setCards(
          (
            data as Array<{
              id: string
              title: string
              board: { id: string; name: string }
              column: { id: string; name: string }
            }>
          ).map((c) => ({
            id: c.id,
            title: c.title,
            boardId: c.board.id,
            boardName: c.board.name,
            columnName: c.column.name,
          })),
        )
      }
    } catch {
      // Non-fatal — palette still works with stale/empty data
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Re-fetch whenever the palette opens so results stay fresh
  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open, fetchData])

  // -------------------------------------------------------------------------
  // Focus input and reset state when palette opens
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      // Defer focus so the element is visible first
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // -------------------------------------------------------------------------
  // Build search index + filter results
  // -------------------------------------------------------------------------
  const index = buildCommandIndex(boards, cards, NAV_ITEMS)
  const results = searchCommands(index, query)

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'Escape':
          closePalette()
          break
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((i) => Math.min(i + 1, results.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter': {
          e.preventDefault()
          const item = results[activeIndex]
          if (item) selectItem(item)
          break
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, activeIndex, closePalette],
  )

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector<HTMLLIElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // -------------------------------------------------------------------------
  // Select an item
  // -------------------------------------------------------------------------
  const selectItem = useCallback(
    (item: CommandItem) => {
      closePalette()
      if (item.action) {
        item.action()
      } else if (item.href) {
        router.push(item.href)
      }
    },
    [closePalette, router],
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closePalette}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-xl rounded-2xl border border-white/10',
          'bg-[oklch(0.13_0.022_265)] shadow-2xl shadow-black/60',
          'flex flex-col overflow-hidden',
        )}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
          <Search className="size-4 shrink-0 text-[oklch(0.45_0.03_265)]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={true}
            aria-controls="command-palette-results"
            aria-activedescendant={
              results[activeIndex] ? `cp-item-${results[activeIndex].id}` : undefined
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search boards, cards, pages…"
            className={cn(
              'flex-1 bg-transparent text-sm text-white',
              'placeholder:text-[oklch(0.38_0.02_265)] outline-none',
            )}
            aria-label="Search command palette"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-[oklch(0.45_0.03_265)] transition-colors hover:text-white"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
          <kbd
            className={cn(
              'hidden sm:inline-flex items-center gap-1 rounded border border-white/10',
              'bg-white/5 px-1.5 py-0.5 text-[10px] text-[oklch(0.45_0.03_265)]',
            )}
            aria-label="Press Escape to close"
          >
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <ul
          id="command-palette-results"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="max-h-[360px] overflow-y-auto py-2"
        >
          {results.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-[oklch(0.38_0.02_265)]">
              {query ? `No results for "${query}"` : 'No items found'}
            </li>
          )}

          {results.map((item, idx) => {
            const isActive = idx === activeIndex
            return (
              <li
                key={item.id}
                id={`cp-item-${item.id}`}
                role="option"
                aria-selected={isActive}
                data-active={isActive}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => selectItem(item)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm',
                  'transition-colors duration-75',
                  isActive
                    ? 'bg-violet-500/15 text-white'
                    : 'text-[oklch(0.75_0.02_265)] hover:bg-white/5',
                )}
              >
                {/* Type icon */}
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-lg',
                    isActive ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-[oklch(0.45_0.03_265)]',
                  )}
                >
                  {itemIcon(item.type)}
                </span>

                {/* Name */}
                <span className="flex-1 truncate">{item.name}</span>

                {/* Type badge */}
                <span
                  className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                    isActive
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'bg-white/5 text-[oklch(0.38_0.02_265)]',
                  )}
                >
                  {itemLabel(item.type)}
                </span>
              </li>
            )
          })}
        </ul>

        {/* Footer hint — shown while searching */}
        {query && results.length > 0 && (
          <div className="flex items-center gap-3 border-t border-white/6 px-4 py-2 text-[10px] text-[oklch(0.35_0.02_265)]">
            <span><kbd className="font-sans">↑↓</kbd> navigate</span>
            <span><kbd className="font-sans">↵</kbd> select</span>
            <span><kbd className="font-sans">Esc</kbd> close</span>
          </div>
        )}

        {/* Shortcuts help — shown when query is empty */}
        {!query && (
          <div className="border-t border-white/6 px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.35_0.02_265)]">
              <Keyboard className="size-3" aria-hidden="true" />
              Keyboard shortcuts
            </div>
            <ul className="flex flex-col gap-1" aria-label="Keyboard shortcuts">
              {SHORTCUTS.map((s) => (
                <li key={s.keys} className="flex items-center justify-between gap-4">
                  <span className="text-[11px] text-[oklch(0.45_0.03_265)]">{s.description}</span>
                  <kbd className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] text-[oklch(0.38_0.02_265)]">
                    {s.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
