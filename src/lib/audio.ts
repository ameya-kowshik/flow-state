/**
 * audio.ts — Web Audio API helpers and browser notification utilities.
 *
 * This module is client-only (uses browser APIs). Do not import from
 * server-side code.
 */

/**
 * Requests browser notification permission from the user.
 * Returns the resulting permission state.
 * Safe to call multiple times — if permission is already granted or denied,
 * the browser will not show a prompt again.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  return Notification.requestPermission()
}

/**
 * Sends a browser notification for a timer phase transition.
 * No-ops if permission is not granted or the browser doesn't support it.
 */
export function sendPhaseNotification(phase: 'focus' | 'shortBreak' | 'longBreak'): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const messages: Record<typeof phase, { title: string; body: string }> = {
    focus: { title: 'Focus time!', body: 'Break is over — time to focus.' },
    shortBreak: { title: 'Short break', body: 'Focus phase complete. Take a short break.' },
    longBreak: { title: 'Long break', body: 'Great work! Time for a longer break.' },
  }

  const { title, body } = messages[phase]
  new Notification(title, { body, icon: '/favicon.ico' })
}

/**
 * Plays a short programmatic tone via the Web Audio API to signal a phase
 * transition. Uses an oscillator with a gain envelope for a clean click-free
 * sound.
 */
export function playTransitionTone(): void {
  if (typeof window === 'undefined') return

  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3)

    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.5)

    oscillator.onended = () => ctx.close()
  } catch {
    // AudioContext may be unavailable in some environments — fail silently.
  }
}
