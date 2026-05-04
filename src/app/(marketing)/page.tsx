import { use } from 'react'
import Link from 'next/link'
import { signIn } from '@/lib/auth'
import { cn } from '@/lib/utils'

const AUTH_ERRORS: Record<string, string> = {
  OAuthSignin: 'Could not start Google sign-in. Please try again.',
  OAuthCallback: 'Something went wrong during Google sign-in. Please try again.',
  OAuthCreateAccount: 'Could not create your account with Google. Please try again.',
  EmailCreateAccount: 'Could not create your account. Please try again.',
  Callback: 'An error occurred during sign-in. Please try again.',
  OAuthAccountNotLinked: 'This email is already linked to a different sign-in method.',
  EmailSignin: 'Could not send the sign-in email. Please try again.',
  CredentialsSignin: 'Invalid credentials. Please check your details.',
  SessionRequired: 'Please sign in to access that page.',
  Default: 'An unexpected error occurred. Please try again.',
}

function getErrorMessage(code: string | undefined): string | null {
  if (!code) return null
  return AUTH_ERRORS[code] ?? AUTH_ERRORS.Default
}

async function signInWithGoogle() {
  'use server'
  await signIn('google', { redirectTo: '/today' })
}

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: 'Pomodoro & Stopwatch',
    desc: 'Two timer modes with automatic phase transitions, sound cues, and browser notifications. Every session is saved to your history.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/15',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
        <rect x="3" y="3" width="7" height="18" rx="1.5" />
        <rect x="14" y="3" width="7" height="11" rx="1.5" />
      </svg>
    ),
    label: 'Kanban Boards',
    desc: 'Drag-and-drop task boards with columns, WIP limits, labels, subtasks, and a full card detail view with Markdown descriptions.',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/15',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
        <path d="M3 17l4-8 4 5 3-3 4 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: 'Focus Analytics',
    desc: 'Day, week, month, and year views with heatmaps, streaks, donut charts, and bar charts — all computed from your real session data.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/15',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
      </svg>
    ),
    label: 'Today View',
    desc: "See today's due tasks and overdue work alongside your timer. One click links a task to your session so time is tracked automatically.",
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/15',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
        <path d="M7 7h10M7 12h6" strokeLinecap="round" />
        <rect x="3" y="3" width="18" height="18" rx="3" />
      </svg>
    ),
    label: 'Tags & Sessions',
    desc: 'Create color-coded tags to categorize your focus sessions. Filter analytics by tag to see where your time actually goes.',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/15',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
        <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" strokeLinecap="round" />
      </svg>
    ),
    label: 'Command Palette',
    desc: 'Press Ctrl+K anywhere to search boards, cards, and navigate the app instantly — no mouse required.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    border: 'border-indigo-400/15',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Create a board and add tasks',
    desc: 'Set up a Kanban board for your project. Add cards for each task, set due dates, and break them into subtasks.',
    color: 'text-violet-400',
  },
  {
    step: '02',
    title: 'Open the Focus page and pick a task',
    desc: 'Choose Pomodoro or Stopwatch mode. Select the task you want to work on from the task picker — it links the session to that card.',
    color: 'text-amber-400',
  },
  {
    step: '03',
    title: 'Work through your sessions',
    desc: 'The timer runs in the background across all pages. A floating widget keeps you on track. When a focus phase ends, rate your session and add notes.',
    color: 'text-cyan-400',
  },
  {
    step: '04',
    title: 'Review your analytics',
    desc: 'Check the Analytics page to see streaks, heatmaps, and time-per-tag breakdowns. Watch your actual minutes accumulate on each task card.',
    color: 'text-emerald-400',
  },
]

export default function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = use(searchParams)
  const errorMessage = getErrorMessage(error)

  return (
    <div className="relative overflow-hidden">
      {/* Background glows */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[700px] rounded-full bg-violet-600/10 blur-[140px]" />
        <div className="absolute top-1/2 right-0 h-[500px] w-[500px] rounded-full bg-indigo-600/8 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-cyan-600/6 blur-[100px]" />
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300 mb-8">
          <span className="size-1.5 rounded-full bg-violet-400 animate-pulse" />
          Free to use · Sign in with Google
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.08] mb-6">
          Focus deeply.<br />
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Track what matters.
          </span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg text-[oklch(0.56_0.04_265)] leading-relaxed mb-10">
          Flow State combines a Pomodoro timer, Kanban boards, and focus analytics into one app.
          Every session links to a task — so you always know where your time went.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <form action={signInWithGoogle}>
            {errorMessage && (
              <div role="alert" className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {errorMessage}
              </div>
            )}
            <button
              type="submit"
              className={cn(
                'flex items-center justify-center gap-3 rounded-xl',
                'bg-violet-600 px-6 py-3',
                'text-sm font-semibold text-white',
                'transition-all duration-150',
                'hover:bg-violet-500',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                'active:scale-[0.98] shadow-lg shadow-violet-500/20',
              )}
            >
              <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </form>
          <Link
            href="/tutorial"
            className={cn(
              'flex items-center gap-2 rounded-xl px-6 py-3',
              'border border-white/10 bg-white/5',
              'text-sm font-medium text-[oklch(0.88_0.01_265)]',
              'transition-all hover:bg-white/10 hover:border-white/15',
            )}
          >
            See how it works
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">How it works</h2>
          <p className="text-[oklch(0.56_0.04_265)]">Four steps from zero to a productive flow.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map(({ step, title, desc, color }) => (
            <div key={step} className="relative rounded-2xl border border-white/6 bg-[oklch(0.14_0.025_265)] p-6">
              <div className={cn('text-4xl font-black mb-4 opacity-20', color)}>{step}</div>
              <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
              <p className="text-xs text-[oklch(0.52_0.04_265)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Everything in one place</h2>
          <p className="text-[oklch(0.56_0.04_265)]">No more switching between a timer app, a task manager, and a spreadsheet.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon, label, desc, color, bg, border }) => (
            <div
              key={label}
              className={cn('rounded-2xl border bg-[oklch(0.14_0.025_265)] p-6', border)}
            >
              <div className={cn('flex size-10 items-center justify-center rounded-xl mb-4', bg, color)}>
                {icon}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{label}</h3>
              <p className="text-xs text-[oklch(0.52_0.04_265)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Timer detail callout ──────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <div className="rounded-3xl border border-amber-400/15 bg-gradient-to-br from-amber-400/5 to-transparent p-8 sm:p-12 flex flex-col lg:flex-row gap-10 items-center">
          {/* SVG timer illustration */}
          <div className="shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="size-40 sm:size-48" aria-hidden="true">
              <circle cx="100" cy="100" r="88" fill="none" stroke="oklch(0.88 0.01 265 / 5%)" strokeWidth="12" />
              <circle
                cx="100" cy="100" r="88"
                fill="none"
                stroke="oklch(0.78 0.18 75)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="553"
                strokeDashoffset="138"
                transform="rotate(-90 100 100)"
                opacity="0.8"
              />
              <text x="100" y="95" textAnchor="middle" fill="white" fontSize="28" fontWeight="700" fontFamily="system-ui">24:00</text>
              <text x="100" y="118" textAnchor="middle" fill="oklch(0.56 0.04 265)" fontSize="11" fontFamily="system-ui">Focus</text>
            </svg>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 px-3 py-1 text-xs font-medium text-amber-300 mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Timer
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              The timer that stays with you
            </h2>
            <p className="text-[oklch(0.56_0.04_265)] leading-relaxed mb-6">
              The timer runs in the background as you navigate the app. A floating widget in the bottom-right corner always shows your remaining time and the task you&apos;re working on — no matter which page you&apos;re on.
            </p>
            <ul className="space-y-2 text-sm text-[oklch(0.65_0.04_265)]">
              {[
                'Pomodoro mode with configurable focus, short break, and long break durations',
                'Stopwatch mode with optional max duration',
                'Survives page navigation and browser refreshes via localStorage',
                'Sound and browser notification alerts at each phase transition',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="size-4 mt-0.5 shrink-0 text-amber-400">
                    <path d="M3 8l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Analytics callout ─────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <div className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/5 to-transparent p-8 sm:p-12 flex flex-col lg:flex-row-reverse gap-10 items-center">
          {/* Mini heatmap illustration */}
          <div className="shrink-0">
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {Array.from({ length: 35 }).map((_, i) => {
                const intensity = [0, 0.2, 0.5, 0.8, 1, 0.6, 0.3, 0, 0.4, 0.9, 0.7, 0.2, 0, 0, 0.1, 0.5, 1, 0.8, 0.3, 0, 0.6, 0.4, 0.2, 0.7, 0.9, 0.5, 0, 0, 0.3, 0.6, 1, 0.8, 0.4, 0.1, 0][i] ?? 0
                const opacity = 0.1 + intensity * 0.9
                return (
                  <div
                    key={i}
                    className="size-7 rounded"
                    style={{ backgroundColor: `oklch(0.65 0.18 200 / ${opacity})` }}
                  />
                )
              })}
            </div>
            <p className="text-center text-xs text-[oklch(0.45_0.03_265)] mt-3">Calendar heatmap — 35 days</p>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 px-3 py-1 text-xs font-medium text-cyan-300 mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5">
                <path d="M3 17l4-8 4 5 3-3 4 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Analytics
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              See your focus patterns clearly
            </h2>
            <p className="text-[oklch(0.56_0.04_265)] leading-relaxed mb-6">
              Six analytics tabs — Overview, Day, Week, Month, Year, and Calendar — give you a complete picture of your productivity. All charts are built from your real session data, no estimates.
            </p>
            <ul className="space-y-2 text-sm text-[oklch(0.65_0.04_265)]">
              {[
                'Streak tracking: current streak and all-time best',
                'Calendar heatmap showing 12 months of focus activity',
                'Tag-based donut charts to see where your time goes',
                'Per-task breakdown: actual vs estimated minutes',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="size-4 mt-0.5 shrink-0 text-cyan-400">
                    <path d="M3 8l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-24 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          Ready to get into flow?
        </h2>
        <p className="text-[oklch(0.56_0.04_265)] mb-10 max-w-md mx-auto">
          Sign in with Google and start your first focus session in under a minute.
        </p>
        <form action={signInWithGoogle} className="flex justify-center">
          <button
            type="submit"
            className={cn(
              'flex items-center justify-center gap-3 rounded-xl',
              'bg-violet-600 px-8 py-3.5',
              'text-sm font-semibold text-white',
              'transition-all hover:bg-violet-500 active:scale-[0.98]',
              'shadow-xl shadow-violet-500/20',
            )}
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Get started free
          </button>
        </form>
        <p className="mt-4 text-xs text-[oklch(0.45_0.03_265)]">
          No credit card. No email/password. Just Google.
        </p>
      </section>
    </div>
  )
}
