'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SIDEBAR_BOARDS_ID } from '@/components/CommandPaletteShell'
import {
  CalendarDays,
  Timer,
  LayoutDashboard,
  BarChart2,
  Settings,
  Zap,
  ChevronDown,
  Circle,
} from 'lucide-react'

interface Board {
  id: string
  name: string
  color: string
  isStarred: boolean
}

const TOP_NAV = [
  { href: '/today',     label: 'Today',     icon: CalendarDays },
  { href: '/focus',     label: 'Focus',     icon: Timer },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
] as const

const BOTTOM_NAV = [
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const boardsActive = pathname === '/boards' || pathname.startsWith('/boards/')

  // Boards section — expanded when on a boards route, collapsed otherwise
  const [boardsOpen, setBoardsOpen] = useState(boardsActive)
  const [boards, setBoards] = useState<Board[]>([])

  // Fetch boards whenever the section is opened
  useEffect(() => {
    if (!boardsOpen) return
    fetch('/api/boards')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Board[]) => setBoards(data))
      .catch(() => setBoards([]))
  }, [boardsOpen])

  // Re-expand if navigating into a boards route
  useEffect(() => {
    if (boardsActive) setBoardsOpen(true)
  }, [boardsActive])

  return (
    <aside
      className="flex h-full w-52 shrink-0 flex-col border-r border-white/7 bg-[oklch(0.12_0.022_265)]"
      aria-label="Main navigation"
    >
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm shadow-violet-500/30">
          <Zap className="size-3.5 text-white" aria-hidden="true" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">Flow State</span>
      </div>

      <div className="mx-3 h-px bg-white/6" />

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5" role="list">
          {/* Standard nav items above Boards */}
          {TOP_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-100',
                    active
                      ? 'bg-violet-500/15 font-medium text-violet-300'
                      : 'text-[oklch(0.56_0.04_265)] hover:bg-white/5 hover:text-[oklch(0.88_0.01_265)]',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      active
                        ? 'text-violet-400'
                        : 'text-[oklch(0.45_0.03_265)] group-hover:text-[oklch(0.7_0.04_265)]',
                    )}
                    aria-hidden="true"
                  />
                  {label}
                </Link>
              </li>
            )
          })}

          {/* Boards — expandable section (Requirement 2.3) */}
          <li>
            <div className="flex items-center">
              <Link
                href="/boards"
                id={SIDEBAR_BOARDS_ID}
                className={cn(
                  'group flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-100',
                  boardsActive
                    ? 'bg-violet-500/15 font-medium text-violet-300'
                    : 'text-[oklch(0.56_0.04_265)] hover:bg-white/5 hover:text-[oklch(0.88_0.01_265)]',
                )}
                aria-current={pathname === '/boards' ? 'page' : undefined}
              >
                <LayoutDashboard
                  className={cn(
                    'size-4 shrink-0 transition-colors',
                    boardsActive
                      ? 'text-violet-400'
                      : 'text-[oklch(0.45_0.03_265)] group-hover:text-[oklch(0.7_0.04_265)]',
                  )}
                  aria-hidden="true"
                />
                Boards
              </Link>
              <button
                onClick={() => setBoardsOpen((o) => !o)}
                aria-expanded={boardsOpen}
                aria-label={boardsOpen ? 'Collapse boards list' : 'Expand boards list'}
                className="mr-1 rounded p-1 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/5 hover:text-white"
              >
                <ChevronDown
                  className={cn('size-3.5 transition-transform duration-150', boardsOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Board list */}
            {boardsOpen && (
              <ul className="mt-0.5 flex flex-col gap-0.5 pl-4" role="list" aria-label="Your boards">
                {boards.length === 0 && (
                  <li className="px-2.5 py-1.5 text-xs text-[oklch(0.38_0.02_265)]">
                    No boards yet
                  </li>
                )}
                {boards.map((board) => {
                  const active = pathname === `/boards/${board.id}` || pathname.startsWith(`/boards/${board.id}/`)
                  return (
                    <li key={board.id}>
                      <Link
                        href={`/boards/${board.id}`}
                        className={cn(
                          'group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-100',
                          active
                            ? 'bg-violet-500/15 font-medium text-violet-300'
                            : 'text-[oklch(0.56_0.04_265)] hover:bg-white/5 hover:text-[oklch(0.88_0.01_265)]',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Circle
                          className="size-2 shrink-0 fill-current"
                          style={{ color: board.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{board.name}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        </ul>
      </nav>

      <div className="mx-3 h-px bg-white/6" />

      {/* Bottom nav */}
      <nav className="px-2 py-3">
        <ul className="flex flex-col gap-0.5" role="list">
          {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-100',
                    active
                      ? 'bg-violet-500/15 font-medium text-violet-300'
                      : 'text-[oklch(0.56_0.04_265)] hover:bg-white/5 hover:text-[oklch(0.88_0.01_265)]',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      active
                        ? 'text-violet-400'
                        : 'text-[oklch(0.45_0.03_265)] group-hover:text-[oklch(0.7_0.04_265)]',
                    )}
                    aria-hidden="true"
                  />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
