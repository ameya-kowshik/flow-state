'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  CalendarDays,
  Timer,
  LayoutDashboard,
  BarChart2,
  Settings,
  Zap,
} from 'lucide-react'

const NAV_LINKS = [
  { href: '/today', label: 'Today', icon: CalendarDays },
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/boards', label: 'Boards', icon: LayoutDashboard },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
] as const

const BOTTOM_LINKS = [
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export function Sidebar() {
  const pathname = usePathname()

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
        <span className="text-sm font-semibold tracking-tight text-white">
          Flow State
        </span>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-white/6" />

      {/* Primary nav */}
      <nav className="flex-1 px-2 py-3">
        <ul className="flex flex-col gap-0.5" role="list">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-100',
                    active
                      ? 'bg-violet-500/15 text-violet-300 font-medium'
                      : 'text-[oklch(0.56_0.04_265)] hover:bg-white/5 hover:text-[oklch(0.88_0.01_265)]',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      active ? 'text-violet-400' : 'text-[oklch(0.45_0.03_265)] group-hover:text-[oklch(0.7_0.04_265)]',
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

      {/* Bottom nav */}
      <div className="mx-3 h-px bg-white/6" />
      <nav className="px-2 py-3">
        <ul className="flex flex-col gap-0.5" role="list">
          {BOTTOM_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-100',
                    active
                      ? 'bg-violet-500/15 text-violet-300 font-medium'
                      : 'text-[oklch(0.56_0.04_265)] hover:bg-white/5 hover:text-[oklch(0.88_0.01_265)]',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      active ? 'text-violet-400' : 'text-[oklch(0.45_0.03_265)] group-hover:text-[oklch(0.7_0.04_265)]',
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
