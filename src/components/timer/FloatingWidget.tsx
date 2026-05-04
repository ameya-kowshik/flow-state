'use client'

import { useTimer } from '@/contexts/TimerContext'
import { cn } from '@/lib/utils'
import { Timer } from 'lucide-react'
import type { TimerPhase } from '@/contexts/TimerContext'
import { useEffect, useRef, useState } from 'react'

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '∞'
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const PHASE_COLORS: Record<TimerPhase | 'stopwatch', string> = {
  focus:      'text-amber-400',
  shortBreak: 'text-violet-400',
  longBreak:  'text-indigo-400',
  stopwatch:  'text-cyan-400',
}

/**
 * FloatingWidget — bottom-right fixed overlay.
 * Visible only when timer is running or paused (Requirements 2.4, 2.5).
 * Displays the linked card title when selectedTaskId is set (Requirements 16.4, 16.5).
 */
export function FloatingWidget() {
  const { status, mode, phase, remainingSeconds, totalElapsed, selectedTaskId } = useTimer()

  // Cache of taskId → title to avoid redundant fetches
  const titleCacheRef = useRef<Map<string, string>>(new Map())
  const [linkedCardTitle, setLinkedCardTitle] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedTaskId) {
      setLinkedCardTitle(null)
      return
    }

    // Return cached value immediately if available
    const cached = titleCacheRef.current.get(selectedTaskId)
    if (cached !== undefined) {
      setLinkedCardTitle(cached)
      return
    }

    let cancelled = false

    fetch(`/api/cards/${selectedTaskId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch card')
        return res.json() as Promise<{ title: string }>
      })
      .then((data) => {
        if (cancelled) return
        titleCacheRef.current.set(selectedTaskId, data.title)
        setLinkedCardTitle(data.title)
      })
      .catch(() => {
        if (!cancelled) setLinkedCardTitle(null)
      })

    return () => {
      cancelled = true
    }
  }, [selectedTaskId])

  if (status !== 'running' && status !== 'paused') return null

  const colorKey = mode === 'stopwatch' ? 'stopwatch' : phase
  const color = PHASE_COLORS[colorKey]
  const displayTime =
    mode === 'stopwatch' ? formatTime(totalElapsed) : formatTime(remainingSeconds)

  const phaseLabel =
    mode === 'stopwatch'
      ? 'Stopwatch'
      : phase === 'focus'
      ? 'Focus'
      : phase === 'shortBreak'
      ? 'Short Break'
      : 'Long Break'

  return (
    <div
      role="status"
      aria-live="off"
      aria-label={`Timer: ${displayTime} — ${phaseLabel}`}
      className={cn(
        'fixed bottom-5 right-5 z-50',
        'flex items-center gap-3 rounded-2xl',
        'border border-white/10 bg-[oklch(0.14_0.025_265)]/90 px-4 py-3',
        'shadow-xl shadow-black/40 backdrop-blur-md',
      )}
    >
      {/* Animated dot */}
      <span className="relative flex size-2 shrink-0">
        {status === 'running' && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', color.replace('text-', 'bg-'))} />
        )}
        <span className={cn('relative inline-flex size-2 rounded-full', status === 'running' ? color.replace('text-', 'bg-') : 'bg-white/20')} />
      </span>

      <Timer className={cn('size-3.5 shrink-0', color)} aria-hidden="true" />

      <span className={cn('font-mono text-sm font-semibold tabular-nums leading-none', color)}>
        {displayTime}
      </span>

      <span className="text-xs text-[oklch(0.45_0.03_265)]">
        {phaseLabel}
      </span>

      {linkedCardTitle && (
        <span
          className="max-w-[140px] truncate text-xs text-[oklch(0.72_0.04_265)]"
          title={linkedCardTitle}
        >
          {linkedCardTitle}
        </span>
      )}

      {status === 'paused' && (
        <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] font-medium text-[oklch(0.56_0.04_265)]">
          Paused
        </span>
      )}
    </div>
  )
}
