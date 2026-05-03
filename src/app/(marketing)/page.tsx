import { use } from 'react'
import { signIn } from '@/lib/auth'
import { cn } from '@/lib/utils'

// Auth.js error codes → user-friendly messages
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
    label: 'Pomodoro timer',
    desc: 'Focus phases with automatic breaks',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
        <rect x="3" y="3" width="7" height="18" rx="1.5" />
        <rect x="14" y="3" width="7" height="11" rx="1.5" />
      </svg>
    ),
    label: 'Kanban boards',
    desc: 'Drag-and-drop task management',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
        <path d="M3 17l4-8 4 5 3-3 4 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: 'Focus analytics',
    desc: 'Streaks, heatmaps, and insights',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
      </svg>
    ),
    label: 'Today view',
    desc: 'Tasks and timer side by side',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
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
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-[oklch(0.1_0.02_265)] px-4 py-16">
      {/* Background glow blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-indigo-600/8 blur-[100px]" />
      </div>

      <main className="relative z-10 flex w-full max-w-sm flex-col items-center gap-10">
        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-7 text-white"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.818a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .845-.143Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Flow State
            </h1>
            <p className="text-[oklch(0.56_0.04_265)] text-sm leading-relaxed">
              Focus deeply. Track what matters.<br />
              Link every session to the work that counts.
            </p>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="w-full rounded-2xl border border-white/8 bg-[oklch(0.14_0.025_265)] p-6 shadow-xl shadow-black/30">
          <p className="mb-5 text-center text-sm font-medium text-[oklch(0.88_0.01_265)]">
            Sign in to get started
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            >
              {errorMessage}
            </div>
          )}

          <form action={signInWithGoogle}>
            <button
              type="submit"
              className={cn(
                'flex w-full items-center justify-center gap-3 rounded-xl',
                'border border-white/10 bg-white/5 px-4 py-3',
                'text-sm font-medium text-[oklch(0.88_0.01_265)]',
                'transition-all duration-150',
                'hover:bg-white/10 hover:border-white/15',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                'active:scale-[0.98]',
              )}
            >
              {/* Google G */}
              <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-[oklch(0.45_0.03_265)]">
            By continuing, you agree to our terms of service and privacy policy.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid w-full grid-cols-2 gap-3">
          {FEATURES.map(({ icon, label, desc, color, bg }) => (
            <div
              key={label}
              className="flex flex-col gap-2.5 rounded-xl border border-white/6 bg-[oklch(0.14_0.025_265)] p-4"
            >
              <div className={cn('flex size-8 items-center justify-center rounded-lg', bg, color)}>
                {icon}
              </div>
              <div>
                <p className="text-xs font-medium text-[oklch(0.88_0.01_265)]">{label}</p>
                <p className="text-xs text-[oklch(0.45_0.03_265)] leading-snug mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
