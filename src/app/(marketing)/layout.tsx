import Link from 'next/link'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col bg-[oklch(0.1_0.02_265)]">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/6 bg-[oklch(0.1_0.02_265)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow shadow-violet-500/30">
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 text-white" aria-hidden="true">
                <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.818a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .845-.143Z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Flow State</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/tutorial"
              className="rounded-lg px-3 py-1.5 text-sm text-[oklch(0.65_0.04_265)] transition-colors hover:text-white hover:bg-white/5"
            >
              Tutorial
            </Link>
            <Link
              href="/"
              className="ml-2 rounded-lg bg-violet-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-14">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/6 py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600">
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 text-white" aria-hidden="true">
                <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.818a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .845-.143Z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs text-[oklch(0.45_0.03_265)]">Flow State — focus deeply, track what matters.</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[oklch(0.45_0.03_265)]">
            <Link href="/tutorial" className="hover:text-white transition-colors">Tutorial</Link>
            <span>·</span>
            <span>Sign in with Google</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
