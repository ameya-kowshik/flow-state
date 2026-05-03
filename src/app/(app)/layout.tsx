import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TimerProvider } from '@/contexts/TimerContext'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { FloatingWidget } from '@/components/timer/FloatingWidget'

/**
 * (app) layout — Server Component.
 *
 * Protects all routes under this group from unauthenticated access
 * (Requirement 1.7). Calls auth() from Auth.js; redirects to `/` when
 * there is no active session.
 *
 * Fetches the user's persisted settings from the DB and passes them to
 * TimerProvider as initial values so that server-fetched settings take
 * precedence over any stale localStorage values (Requirement 18.5).
 *
 * Wraps children with TimerProvider so that the floating widget and any
 * page-level timer components share a single timer state (Requirements 2.4,
 * 2.5). Renders the persistent Sidebar (Requirement 2.1) and the
 * FloatingWidget overlay (Requirement 2.4).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/')
  }

  // Fetch persisted settings — server-fetched values take precedence over
  // localStorage (Requirement 18.5). Fall back gracefully if the query fails.
  let userSettings: {
    focusDuration: number
    shortBreakDuration: number
    longBreakDuration: number
    longBreakInterval: number
    soundEnabled: boolean
    notificationsEnabled: boolean
  } | null = null

  try {
    userSettings = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        focusDuration: true,
        shortBreakDuration: true,
        longBreakDuration: true,
        longBreakInterval: true,
        soundEnabled: true,
        notificationsEnabled: true,
      },
    })
  } catch {
    // Non-fatal — TimerProvider will use its defaults
  }

  return (
    <TimerProvider
      initialSettings={
        userSettings
          ? {
              focusDuration: userSettings.focusDuration,
              shortBreakDuration: userSettings.shortBreakDuration,
              longBreakDuration: userSettings.longBreakDuration,
              longBreakInterval: userSettings.longBreakInterval,
            }
          : undefined
      }
      initialSoundEnabled={userSettings?.soundEnabled}
      initialNotificationsEnabled={userSettings?.notificationsEnabled}
    >
      <div className="flex h-full min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <FloatingWidget />
      </div>
    </TimerProvider>
  )
}
