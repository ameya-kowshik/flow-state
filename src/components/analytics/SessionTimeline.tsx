'use client'

import { cn } from '@/lib/utils'
import type { PomodoroLog } from '@/generated/prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionTimelineProps {
  sessions: PomodoroLog[]
  date: Date
  className?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_HEIGHT = 48 // px per hour
const TIMELINE_START_HOUR = 6  // 6 AM
const TIMELINE_END_HOUR = 24   // midnight
const VISIBLE_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR
const TIMELINE_HEIGHT = VISIBLE_HOURS * HOUR_HEIGHT
const LABEL_WIDTH = 44

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getSessionColor(sessionType: string): string {
  switch (sessionType) {
    case 'POMODORO': return 'bg-violet-500/30 border-violet-500/60 text-violet-300'
    case 'STOPWATCH': return 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
    default: return 'bg-white/10 border-white/20 text-white/70'
  }
}

function getSessionLabel(sessionType: string): string {
  switch (sessionType) {
    case 'POMODORO': return 'Focus'
    case 'STOPWATCH': return 'Stopwatch'
    default: return sessionType
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionTimeline({ sessions, date, className }: SessionTimelineProps) {
  const dateStr = date.toISOString().slice(0, 10)

  // Filter sessions for this date
  const daySessions = sessions.filter((s) => {
    const sessionDate = new Date(s.startedAt).toISOString().slice(0, 10)
    return sessionDate === dateStr
  })

  if (daySessions.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <p className="text-sm text-muted-foreground">No sessions on this day</p>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <div className="flex">
        {/* Hour labels */}
        <div className="flex-shrink-0" style={{ width: LABEL_WIDTH }}>
          {Array.from({ length: VISIBLE_HOURS + 1 }, (_, i) => {
            const hour = TIMELINE_START_HOUR + i
            return (
              <div
                key={hour}
                className="flex items-start justify-end pr-2"
                style={{ height: i < VISIBLE_HOURS ? HOUR_HEIGHT : 0 }}
              >
                <span className="text-[10px] text-muted-foreground/60 -translate-y-2">
                  {formatHour(hour)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Timeline grid + sessions */}
        <div className="relative flex-1" style={{ height: TIMELINE_HEIGHT }}>
          {/* Hour grid lines */}
          {Array.from({ length: VISIBLE_HOURS + 1 }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-white/5"
              style={{ top: i * HOUR_HEIGHT }}
            />
          ))}

          {/* Half-hour grid lines */}
          {Array.from({ length: VISIBLE_HOURS }, (_, i) => (
            <div
              key={`half-${i}`}
              className="absolute left-0 right-0 border-t border-white/3"
              style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
            />
          ))}

          {/* Session blocks */}
          {daySessions.map((session) => {
            const startTime = new Date(session.startedAt)
            const startHour = startTime.getHours() + startTime.getMinutes() / 60
            const durationMinutes = session.duration
            const durationHours = durationMinutes / 60

            const topPx = (startHour - TIMELINE_START_HOUR) * HOUR_HEIGHT
            const heightPx = Math.max(durationHours * HOUR_HEIGHT, 20) // min 20px

            // Clamp to visible range
            const clampedTop = Math.max(0, Math.min(topPx, TIMELINE_HEIGHT))
            const clampedHeight = Math.min(heightPx, TIMELINE_HEIGHT - clampedTop)

            if (clampedTop >= TIMELINE_HEIGHT || clampedTop < 0) return null

            const colorClass = getSessionColor(session.sessionType)

            return (
              <div
                key={session.id}
                className={cn(
                  'absolute left-1 right-1 rounded border px-2 py-1 overflow-hidden',
                  'transition-opacity duration-150 hover:opacity-90',
                  colorClass,
                )}
                style={{ top: clampedTop, height: clampedHeight }}
                title={`${getSessionLabel(session.sessionType)} — ${formatDuration(durationMinutes)}`}
              >
                {clampedHeight >= 28 && (
                  <p className="text-[11px] font-medium leading-tight truncate">
                    {getSessionLabel(session.sessionType)}
                  </p>
                )}
                {clampedHeight >= 40 && (
                  <p className="text-[10px] opacity-70 leading-tight">
                    {formatDuration(durationMinutes)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
