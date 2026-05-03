'use client'

import { useTimer } from '@/contexts/TimerContext'
import { cn } from '@/lib/utils'
import { Play, Pause, Square, RotateCcw, SkipForward } from 'lucide-react'
import type { TimerMode, TimerPhase } from '@/contexts/TimerContext'

// ---------------------------------------------------------------------------
// SVG ring constants
// ---------------------------------------------------------------------------
const SIZE = 260
const STROKE_WIDTH = 8
const RADIUS = (SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const CENTER = SIZE / 2

// ---------------------------------------------------------------------------
// Phase → color mapping
// ---------------------------------------------------------------------------
const PHASE_COLORS: Record<TimerPhase | 'stopwatch', { ring: string; glow: string; label: string }> = {
  focus:      { ring: 'text-amber-400',  glow: 'shadow-amber-500/20',  label: 'Focus' },
  shortBreak: { ring: 'text-violet-400', glow: 'shadow-violet-500/20', label: 'Short Break' },
  longBreak:  { ring: 'text-indigo-400', glow: 'shadow-indigo-500/20', label: 'Long Break' },
  stopwatch:  { ring: 'text-cyan-400',   glow: 'shadow-cyan-500/20',   label: 'Stopwatch' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '∞'
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimerDisplay() {
  const {
    mode,
    phase,
    status,
    currentDuration,
    totalElapsed,
    remainingSeconds,
    start,
    pause,
    resume,
    stop,
    reset,
    skipPhase,
    setMode,
  } = useTimer()

  const colorKey = mode === 'stopwatch' ? 'stopwatch' : phase
  const colors = PHASE_COLORS[colorKey]

  const proportion =
    isFinite(currentDuration) && currentDuration > 0
      ? Math.min(totalElapsed / currentDuration, 1)
      : 0

  const dashOffset = CIRCUMFERENCE * (1 - proportion)

  const isRunning = status === 'running'
  const isPaused = status === 'paused'
  const isIdle = status === 'idle'

  const displayTime =
    mode === 'stopwatch' ? formatTime(totalElapsed) : formatTime(remainingSeconds)

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Mode toggle */}
      <div className="flex rounded-xl border border-white/8 bg-white/4 p-1 text-sm">
        {(['pomodoro', 'stopwatch'] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-150 capitalize',
              mode === m
                ? 'bg-violet-500/20 text-violet-300 shadow-sm'
                : 'text-[oklch(0.56_0.04_265)] hover:text-[oklch(0.88_0.01_265)]',
            )}
          >
            {m === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}
          </button>
        ))}
      </div>

      {/* SVG ring */}
      <div
        className={cn('relative rounded-full shadow-2xl', colors.glow)}
        style={{ width: SIZE, height: SIZE }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-label={`Timer: ${displayTime} remaining`}
          role="img"
        >
          {/* Track */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className="text-white/6"
          />
          {/* Progress arc */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
            className={cn(colors.ring, 'transition-[stroke-dashoffset] duration-1000 ease-linear')}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 select-none">
          <span className="font-mono text-6xl font-semibold tabular-nums leading-none tracking-tight text-white">
            {displayTime}
          </span>
          <span className={cn('text-sm font-medium', colors.ring)}>
            {colors.label}
          </span>
          {isRunning && (
            <span className="mt-1 flex items-center gap-1.5 text-xs text-[oklch(0.45_0.03_265)]">
              <span className="size-1.5 rounded-full bg-current animate-pulse" />
              Running
            </span>
          )}
          {isPaused && (
            <span className="mt-1 text-xs text-[oklch(0.45_0.03_265)]">Paused</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {isIdle && (
          <button
            onClick={start}
            className={cn(
              'flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold',
              'bg-gradient-to-r from-violet-600 to-indigo-600',
              'text-white shadow-lg shadow-violet-500/25',
              'transition-all duration-150 hover:from-violet-500 hover:to-indigo-500',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
              'active:scale-[0.97]',
            )}
          >
            <Play className="size-4" aria-hidden="true" />
            Start
          </button>
        )}

        {isRunning && (
          <>
            <button
              onClick={pause}
              className={cn(
                'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium',
                'border border-white/10 bg-white/6 text-[oklch(0.88_0.01_265)]',
                'transition-all duration-150 hover:bg-white/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                'active:scale-[0.97]',
              )}
            >
              <Pause className="size-4" aria-hidden="true" />
              Pause
            </button>
            <IconButton onClick={stop} label="Stop" icon={<Square className="size-4" />} />
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={resume}
              className={cn(
                'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold',
                'bg-gradient-to-r from-violet-600 to-indigo-600',
                'text-white shadow-lg shadow-violet-500/25',
                'transition-all duration-150 hover:from-violet-500 hover:to-indigo-500',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                'active:scale-[0.97]',
              )}
            >
              <Play className="size-4" aria-hidden="true" />
              Resume
            </button>
            <IconButton onClick={stop} label="Stop" icon={<Square className="size-4" />} />
          </>
        )}

        {!isIdle && (
          <IconButton onClick={reset} label="Reset" icon={<RotateCcw className="size-4" />} />
        )}

        {mode === 'pomodoro' && (
          <IconButton onClick={skipPhase} label="Skip phase" icon={<SkipForward className="size-4" />} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Icon button
// ---------------------------------------------------------------------------

function IconButton({
  onClick,
  label,
  icon,
}: {
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-11 items-center justify-center rounded-xl',
        'border border-white/8 bg-white/4 text-[oklch(0.56_0.04_265)]',
        'transition-all duration-150 hover:bg-white/8 hover:text-[oklch(0.88_0.01_265)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
        'active:scale-[0.95]',
      )}
    >
      {icon}
    </button>
  )
}
