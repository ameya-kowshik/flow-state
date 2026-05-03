'use client'

import { useState, useCallback } from 'react'
import { useTimer } from '@/contexts/TimerContext'
import { TagSelector } from '@/components/tags/TagSelector'
import { cn } from '@/lib/utils'
import { CheckCircle, AlertCircle, Loader2, Star } from 'lucide-react'

// ---------------------------------------------------------------------------
// SessionCompleteModal
// ---------------------------------------------------------------------------
// Shown when a focus phase (Pomodoro or Stopwatch) completes.
// Collects focusScore (1–10) and optional notes, then POSTs to
// /api/focus-sessions. Session data is preserved in TimerContext state until
// successfully submitted so the user can retry on failure.
// Requirements: 3.10, 3.11, 6.1, 6.5, 16.2, 16.3

export function SessionCompleteModal() {
  const { pendingSession, clearPendingSession, selectedTagId } = useTimer()

  const [focusScore, setFocusScore] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!pendingSession) return

    setSubmitStatus('submitting')
    setErrorMessage(null)

    try {
      const res = await fetch('/api/focus-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType: pendingSession.sessionType,
          duration: pendingSession.duration,
          startedAt: pendingSession.startedAt.toISOString(),
          completedAt: pendingSession.completedAt.toISOString(),
          focusScore: focusScore ?? undefined,
          notes: notes.trim() || undefined,
          tagId: selectedTagId ?? undefined,
          taskId: pendingSession.taskId ?? undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg =
          typeof data?.error === 'string'
            ? data.error
            : `Failed to save session (${res.status})`
        setErrorMessage(msg)
        setSubmitStatus('error')
        return
      }

      // Success — clear the pending session and reset local form state.
      clearPendingSession()
      setFocusScore(null)
      setNotes('')
      setSubmitStatus('idle')
    } catch {
      setErrorMessage('Network error — please try again.')
      setSubmitStatus('error')
    }
  }, [pendingSession, focusScore, notes, selectedTagId, clearPendingSession])

  const handleSkip = useCallback(() => {
    clearPendingSession()
    setFocusScore(null)
    setNotes('')
    setSubmitStatus('idle')
    setErrorMessage(null)
  }, [clearPendingSession])

  // Only render when there is a pending session.
  if (!pendingSession) return null

  const isSubmitting = submitStatus === 'submitting'
  const durationLabel =
    pendingSession.duration === 1
      ? '1 minute'
      : `${pendingSession.duration} minutes`
  const typeLabel =
    pendingSession.sessionType === 'POMODORO' ? 'Pomodoro' : 'Stopwatch'

  return (
    // Backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-complete-title"
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-black/60 backdrop-blur-sm',
        'animate-in fade-in duration-200',
      )}
    >
      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-md mx-4',
          'rounded-2xl border border-white/10',
          'bg-[oklch(0.14_0.025_265)]',
          'shadow-2xl shadow-black/60',
          'animate-in zoom-in-95 duration-200',
        )}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/15">
            <CheckCircle className="size-7 text-amber-400" aria-hidden="true" />
          </div>
          <h2
            id="session-complete-title"
            className="text-xl font-semibold text-white"
          >
            Session complete!
          </h2>
          <p className="text-sm text-[oklch(0.56_0.04_265)]">
            {typeLabel} · {durationLabel}
          </p>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 pb-6">
          {/* Tag selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[oklch(0.88_0.01_265)]">
              Tag
              <span className="ml-1 text-xs font-normal text-[oklch(0.45_0.03_265)]">
                (optional)
              </span>
            </label>
            <TagSelector />
          </div>

          {/* Focus score */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[oklch(0.88_0.01_265)]">
              How focused were you?
              <span className="ml-1 text-xs font-normal text-[oklch(0.45_0.03_265)]">
                (optional)
              </span>
            </label>
            <div
              role="group"
              aria-label="Focus score 1 to 10"
              className="flex gap-1.5"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
                <button
                  key={score}
                  type="button"
                  aria-pressed={focusScore === score}
                  aria-label={`Focus score ${score}`}
                  onClick={() =>
                    setFocusScore((prev) => (prev === score ? null : score))
                  }
                  className={cn(
                    'flex flex-1 items-center justify-center rounded-lg py-2',
                    'text-xs font-semibold transition-all duration-100',
                    'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
                    focusScore === score
                      ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                      : 'border-white/8 bg-white/4 text-[oklch(0.56_0.04_265)] hover:bg-white/8 hover:text-[oklch(0.88_0.01_265)]',
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
            {focusScore !== null && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-400">
                <Star className="size-3" aria-hidden="true" />
                {SCORE_LABELS[focusScore - 1]}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="session-notes"
              className="mb-2 block text-sm font-medium text-[oklch(0.88_0.01_265)]"
            >
              Notes
              <span className="ml-1 text-xs font-normal text-[oklch(0.45_0.03_265)]">
                (optional)
              </span>
            </label>
            <textarea
              id="session-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you work on?"
              rows={3}
              className={cn(
                'w-full resize-none rounded-xl border border-white/10 bg-white/5',
                'px-3 py-2.5 text-sm text-white placeholder:text-[oklch(0.35_0.02_265)]',
                'outline-none transition-colors',
                'focus:border-violet-500/40 focus:bg-white/8 focus:ring-2 focus:ring-violet-500/20',
              )}
            />
          </div>

          {/* Error message */}
          {submitStatus === 'error' && errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSkip}
              disabled={isSubmitting}
              className={cn(
                'flex-1 rounded-xl border border-white/8 bg-white/4 px-4 py-2.5',
                'text-sm font-medium text-[oklch(0.56_0.04_265)]',
                'transition-all duration-150 hover:bg-white/8 hover:text-[oklch(0.88_0.01_265)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5',
                'bg-gradient-to-r from-violet-600 to-indigo-600 text-white',
                'text-sm font-semibold shadow-lg shadow-violet-500/20',
                'transition-all duration-150 hover:from-violet-500 hover:to-indigo-500',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                'disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]',
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : submitStatus === 'error' ? (
                'Retry'
              ) : (
                'Save session'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score label helpers
// ---------------------------------------------------------------------------

const SCORE_LABELS: string[] = [
  'Very distracted',
  'Mostly distracted',
  'Somewhat distracted',
  'Below average',
  'Average',
  'Slightly above average',
  'Good focus',
  'Great focus',
  'Excellent focus',
  'Perfect flow',
]
