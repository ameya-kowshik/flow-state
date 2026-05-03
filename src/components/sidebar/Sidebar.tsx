import Link from 'next/link'

/**
 * Sidebar — stub for Phase 1.
 *
 * Renders a dark navigation panel with links for all authenticated routes
 * (Requirement 2.1). Active-link highlighting and board listing will be
 * added in later tasks.
 */

const NAV_LINKS = [
  { href: '/today', label: 'Today', icon: '📅' },
  { href: '/focus', label: 'Focus', icon: '⏱' },
  { href: '/boards', label: 'Boards', icon: '📋' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
] as const

export function Sidebar() {
  return (
    <aside
      className="flex h-full w-56 shrink-0 flex-col gap-1 bg-[#0d0d0d] px-3 py-4"
      aria-label="Main navigation"
    >
      {/* App wordmark */}
      <div className="mb-4 px-2 text-sm font-semibold tracking-tight text-white">
        Flow State
      </div>

      <nav>
        <ul className="flex flex-col gap-0.5" role="list">
          {NAV_LINKS.map(({ href, label, icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
