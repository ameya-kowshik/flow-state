'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react'
import { playTransitionTone, sendPhaseNotification } from '@/lib/audio'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimerMode = 'pomodoro' | 'stopwatch'
export type TimerPhase = 'focus' | 'shortBreak' | 'longBreak'
export type TimerStatus = 'idle' | 'running' | 'paused'

export interface PomodoroSettings {
  focusDuration: number         // minutes
  shortBreakDuration: number    // minutes
  longBreakDuration: number     // minutes
  longBreakInterval: number     // focus phases before long break
  maxStopwatchDuration: number | null  // seconds; null = unlimited
}

export interface TimerState {
  mode: TimerMode
  phase: TimerPhase
  status: TimerStatus
  /** Date.now() timestamp when the timer was last started or resumed */
  startedAt: number | null
  /** Seconds accumulated before the last pause */
  elapsed: number
  settings: PomodoroSettings
  soundEnabled: boolean
  notificationsEnabled: boolean
  selectedTagId: string | null
  selectedTaskId: string | null
  /** Number of completed focus phases in the current cycle */
  cycleCount: number
}

/**
 * Data captured at the moment a focus phase completes.
 * Preserved in state until the session is successfully submitted.
 */
export interface CompletedSessionData {
  sessionType: 'POMODORO' | 'STOPWATCH'
  /** Duration in minutes */
  duration: number
  startedAt: Date
  completedAt: Date
  tagId: string | null
  taskId: string | null
}

export interface TimerContextValue extends TimerState {
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  reset: () => void
  skipPhase: () => void
  setMode: (mode: TimerMode) => void
  setSettings: (settings: Partial<PomodoroSettings>) => void
  setSoundEnabled: (enabled: boolean) => void
  setNotificationsEnabled: (enabled: boolean) => void
  setSelectedTagId: (id: string | null) => void
  setSelectedTaskId: (id: string | null) => void
  /** Seconds for the current phase / mode */
  currentDuration: number
  /** Computed: currentDuration - totalElapsed (clamped to 0) */
  remainingSeconds: number
  /** elapsed + (running ? (Date.now() - startedAt) / 1000 : 0) */
  totalElapsed: number
  /** Non-null when the Session Complete Modal should be shown */
  pendingSession: CompletedSessionData | null
  /** Called by SessionCompleteModal after a successful POST */
  clearPendingSession: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'flow-state:timer'

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  maxStopwatchDuration: null,
}

const INITIAL_STATE: TimerState = {
  mode: 'pomodoro',
  phase: 'focus',
  status: 'idle',
  startedAt: null,
  elapsed: 0,
  settings: DEFAULT_SETTINGS,
  soundEnabled: true,
  notificationsEnabled: false,
  selectedTagId: null,
  selectedTaskId: null,
  cycleCount: 0,
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

/**
 * Serializes a TimerState to a plain JSON-safe object for localStorage.
 * All fields are included verbatim — they are all JSON-serializable primitives
 * or nested objects of primitives.
 */
export function serializeTimerState(state: TimerState): Record<string, unknown> {
  return {
    mode: state.mode,
    phase: state.phase,
    status: state.status,
    startedAt: state.startedAt,
    elapsed: state.elapsed,
    settings: { ...state.settings },
    soundEnabled: state.soundEnabled,
    notificationsEnabled: state.notificationsEnabled,
    selectedTagId: state.selectedTagId,
    selectedTaskId: state.selectedTaskId,
    cycleCount: state.cycleCount,
  }
}

/**
 * Deserializes a raw JSON object (from localStorage) back into a TimerState.
 * Unknown or malformed fields fall back to INITIAL_STATE defaults so that
 * schema changes don't break existing persisted data.
 */
export function deserializeTimerState(raw: Record<string, unknown>): TimerState {
  const settings: PomodoroSettings = {
    focusDuration:
      typeof (raw.settings as Record<string, unknown>)?.focusDuration === 'number'
        ? ((raw.settings as Record<string, unknown>).focusDuration as number)
        : DEFAULT_SETTINGS.focusDuration,
    shortBreakDuration:
      typeof (raw.settings as Record<string, unknown>)?.shortBreakDuration === 'number'
        ? ((raw.settings as Record<string, unknown>).shortBreakDuration as number)
        : DEFAULT_SETTINGS.shortBreakDuration,
    longBreakDuration:
      typeof (raw.settings as Record<string, unknown>)?.longBreakDuration === 'number'
        ? ((raw.settings as Record<string, unknown>).longBreakDuration as number)
        : DEFAULT_SETTINGS.longBreakDuration,
    longBreakInterval:
      typeof (raw.settings as Record<string, unknown>)?.longBreakInterval === 'number'
        ? ((raw.settings as Record<string, unknown>).longBreakInterval as number)
        : DEFAULT_SETTINGS.longBreakInterval,
    maxStopwatchDuration:
      (raw.settings as Record<string, unknown>)?.maxStopwatchDuration === null ||
      typeof (raw.settings as Record<string, unknown>)?.maxStopwatchDuration === 'number'
        ? ((raw.settings as Record<string, unknown>).maxStopwatchDuration as number | null)
        : DEFAULT_SETTINGS.maxStopwatchDuration,
  }

  return {
    mode: raw.mode === 'pomodoro' || raw.mode === 'stopwatch' ? raw.mode : INITIAL_STATE.mode,
    phase:
      raw.phase === 'focus' || raw.phase === 'shortBreak' || raw.phase === 'longBreak'
        ? raw.phase
        : INITIAL_STATE.phase,
    status:
      raw.status === 'idle' || raw.status === 'running' || raw.status === 'paused'
        ? raw.status
        : INITIAL_STATE.status,
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : null,
    elapsed: typeof raw.elapsed === 'number' ? raw.elapsed : 0,
    settings,
    soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : true,
    notificationsEnabled:
      typeof raw.notificationsEnabled === 'boolean' ? raw.notificationsEnabled : false,
    selectedTagId: typeof raw.selectedTagId === 'string' ? raw.selectedTagId : null,
    selectedTaskId: typeof raw.selectedTaskId === 'string' ? raw.selectedTaskId : null,
    cycleCount: typeof raw.cycleCount === 'number' ? raw.cycleCount : 0,
  }
}

// ---------------------------------------------------------------------------
// Phase transition helpers
// ---------------------------------------------------------------------------

/**
 * Returns the duration in seconds for a given phase/mode combination.
 */
export function getCurrentDuration(
  mode: TimerMode,
  phase: TimerPhase,
  settings: PomodoroSettings,
): number {
  if (mode === 'stopwatch') {
    return settings.maxStopwatchDuration ?? Infinity
  }
  switch (phase) {
    case 'focus':
      return settings.focusDuration * 60
    case 'shortBreak':
      return settings.shortBreakDuration * 60
    case 'longBreak':
      return settings.longBreakDuration * 60
  }
}

/**
 * Computes the next phase after the current one completes.
 * Also returns whether cycleCount should be incremented (only on focus completion).
 */
function computeNextPhase(
  mode: TimerMode,
  phase: TimerPhase,
  cycleCount: number,
  longBreakInterval: number,
): { nextPhase: TimerPhase; incrementCycle: boolean } {
  if (mode === 'stopwatch') {
    // Stopwatch has no phases — just stop.
    return { nextPhase: 'focus', incrementCycle: false }
  }

  if (phase === 'focus') {
    const newCycleCount = cycleCount + 1
    const nextPhase =
      newCycleCount % longBreakInterval === 0 ? 'longBreak' : 'shortBreak'
    return { nextPhase, incrementCycle: true }
  }

  // shortBreak or longBreak → back to focus
  return { nextPhase: 'focus', incrementCycle: false }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TimerContext = createContext<TimerContextValue>({
  ...INITIAL_STATE,
  start: () => {},
  pause: () => {},
  resume: () => {},
  stop: () => {},
  reset: () => {},
  skipPhase: () => {},
  setMode: () => {},
  setSettings: () => {},
  setSoundEnabled: () => {},
  setNotificationsEnabled: () => {},
  setSelectedTagId: () => {},
  setSelectedTaskId: () => {},
  currentDuration: DEFAULT_SETTINGS.focusDuration * 60,
  remainingSeconds: DEFAULT_SETTINGS.focusDuration * 60,
  totalElapsed: 0,
  pendingSession: null,
  clearPendingSession: () => {},
})

export function useTimer(): TimerContextValue {
  return useContext(TimerContext)
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TimerProviderProps {
  children: React.ReactNode
  /**
   * Server-fetched initial settings. When provided these take precedence over
   * localStorage values (Requirement 18.5).
   */
  initialSettings?: Partial<Omit<PomodoroSettings, 'maxStopwatchDuration'>>
  initialSoundEnabled?: boolean
  initialNotificationsEnabled?: boolean
}

export function TimerProvider({
  children,
  initialSettings,
  initialSoundEnabled,
  initialNotificationsEnabled,
}: TimerProviderProps) {
  // -------------------------------------------------------------------------
  // Pending session — set when a focus phase completes, cleared after submit
  // -------------------------------------------------------------------------
  const [pendingSession, setPendingSession] = useState<CompletedSessionData | null>(null)

  const clearPendingSession = useCallback(() => {
    setPendingSession(null)
  }, [])

  // -------------------------------------------------------------------------
  // Core timer state
  // -------------------------------------------------------------------------
  const [timerState, setTimerState] = useState<TimerState>(() => {
    // On the server (SSR) there is no localStorage — start with defaults.
    if (typeof window === 'undefined') {
      return {
        ...INITIAL_STATE,
        settings: { ...DEFAULT_SETTINGS, ...initialSettings },
        soundEnabled: initialSoundEnabled ?? true,
        notificationsEnabled: initialNotificationsEnabled ?? false,
      }
    }

    // On the client, attempt to rehydrate from localStorage.
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const restored = deserializeTimerState(parsed)

        // Server-fetched settings always win over persisted ones.
        const mergedSettings: PomodoroSettings = {
          ...restored.settings,
          ...initialSettings,
        }

        // Recalculate elapsed for the "page closed while running" case.
        // If the timer was running when the page closed, startedAt is still
        // set. We add the time that passed since then to elapsed.
        let recalcElapsed = restored.elapsed
        if (restored.status === 'running' && restored.startedAt !== null) {
          const additionalSeconds = (Date.now() - restored.startedAt) / 1000
          recalcElapsed = restored.elapsed + additionalSeconds
        }

        return {
          ...restored,
          settings: mergedSettings,
          soundEnabled: initialSoundEnabled ?? restored.soundEnabled,
          notificationsEnabled: initialNotificationsEnabled ?? restored.notificationsEnabled,
          elapsed: recalcElapsed,
          // Keep startedAt as null now — the tick loop will use elapsed directly.
          // Status stays as-is; if elapsed >= duration we handle it in the
          // useEffect below after mount.
          startedAt: restored.status === 'running' ? null : restored.startedAt,
          // If it was running, treat it as paused until the user resumes,
          // because we've already baked the elapsed time in.
          status: restored.status === 'running' ? 'paused' : restored.status,
        }
      }
    } catch {
      // Corrupted localStorage — fall through to defaults.
    }

    return {
      ...INITIAL_STATE,
      settings: { ...DEFAULT_SETTINGS, ...initialSettings },
      soundEnabled: initialSoundEnabled ?? true,
      notificationsEnabled: initialNotificationsEnabled ?? false,
    }
  })

  // -------------------------------------------------------------------------
  // Tick counter — incremented every second while running.
  // We store `now` (ms) alongside the tick so totalElapsed can be computed
  // without calling Date.now() during render (which the React Compiler flags
  // as an impure call).
  // -------------------------------------------------------------------------
  const [now, setNow] = useState(() => Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // -------------------------------------------------------------------------
  // Derived values (recomputed on every tick or state change)
  // -------------------------------------------------------------------------
  const currentDuration = useMemo(
    () => getCurrentDuration(timerState.mode, timerState.phase, timerState.settings),
    [timerState.mode, timerState.phase, timerState.settings],
  )

  const totalElapsed = useMemo(() => {
    if (timerState.status === 'running' && timerState.startedAt !== null) {
      return timerState.elapsed + (now - timerState.startedAt) / 1000
    }
    return timerState.elapsed
  }, [timerState.status, timerState.startedAt, timerState.elapsed, now])

  const remainingSeconds = useMemo(() => {
    if (currentDuration === Infinity) return Infinity
    return Math.max(0, currentDuration - totalElapsed)
  }, [currentDuration, totalElapsed])

  // -------------------------------------------------------------------------
  // Refs to avoid stale closures in the interval callback.
  // Updated via useEffect (not during render) to satisfy the React Compiler.
  // -------------------------------------------------------------------------
  const stateRef = useRef(timerState)
  const currentDurationRef = useRef(currentDuration)
  const totalElapsedRef = useRef(totalElapsed)

  useEffect(() => {
    stateRef.current = timerState
  })

  useEffect(() => {
    currentDurationRef.current = currentDuration
  })

  useEffect(() => {
    totalElapsedRef.current = totalElapsed
  })

  // -------------------------------------------------------------------------
  // Phase-complete handler (called from tick effect)
  // -------------------------------------------------------------------------
  const handlePhaseComplete = useCallback(() => {
    const state = stateRef.current

    if (state.mode === 'stopwatch') {
      // Stopwatch reached max duration — stop and show modal.
      const completedAt = new Date()
      const durationMinutes = Math.round(currentDurationRef.current / 60)
      const startedAtMs =
        state.startedAt !== null
          ? state.startedAt
          : Date.now() - currentDurationRef.current * 1000
      setPendingSession({
        sessionType: 'STOPWATCH',
        duration: Math.max(1, durationMinutes),
        startedAt: new Date(startedAtMs),
        completedAt,
        tagId: state.selectedTagId,
        taskId: state.selectedTaskId,
      })
      setTimerState((prev) => ({
        ...prev,
        status: 'idle',
        startedAt: null,
        elapsed: currentDurationRef.current,
      }))
      return
    }

    const { nextPhase, incrementCycle } = computeNextPhase(
      state.mode,
      state.phase,
      state.cycleCount,
      state.settings.longBreakInterval,
    )

    const newCycleCount = incrementCycle ? state.cycleCount + 1 : state.cycleCount

    // Play sound / send notification if enabled.
    if (state.soundEnabled) {
      playTransitionTone()
    }
    if (state.notificationsEnabled) {
      sendPhaseNotification(nextPhase)
    }

    // If a focus phase just completed, capture session data for the modal.
    if (state.phase === 'focus') {
      const completedAt = new Date()
      const durationMinutes = Math.round(state.settings.focusDuration)
      const startedAtMs =
        state.startedAt !== null
          ? state.startedAt
          : Date.now() - state.settings.focusDuration * 60 * 1000
      setPendingSession({
        sessionType: 'POMODORO',
        duration: Math.max(1, durationMinutes),
        startedAt: new Date(startedAtMs),
        completedAt,
        tagId: state.selectedTagId,
        taskId: state.selectedTaskId,
      })
    }

    setTimerState((prev) => ({
      ...prev,
      phase: nextPhase,
      status: 'idle',
      startedAt: null,
      elapsed: 0,
      cycleCount: newCycleCount,
    }))
  }, [])

  // -------------------------------------------------------------------------
  // setInterval tick loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (timerState.status === 'running') {
      intervalRef.current = setInterval(() => {
        setNow(Date.now())

        // Check for phase completion inside the interval using refs to avoid
        // stale closure over timerState.
        const elapsed = totalElapsedRef.current
        const duration = currentDurationRef.current

        if (duration !== Infinity && elapsed >= duration) {
          // Clear the interval before transitioning to avoid double-firing.
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          handlePhaseComplete()
        }
      }, 1000)
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timerState.status, handlePhaseComplete])

  // -------------------------------------------------------------------------
  // Handle "page closed while running" — if elapsed already exceeds duration
  // on mount, trigger phase complete immediately.
  // -------------------------------------------------------------------------
  const didHandleOverflowRef = useRef(false)
  useEffect(() => {
    if (didHandleOverflowRef.current) return
    didHandleOverflowRef.current = true

    const state = stateRef.current
    // Only applies when we restored a paused state that was previously running
    // (we set status to 'paused' during rehydration for running timers).
    if (state.status === 'paused' && state.startedAt === null) {
      const duration = getCurrentDuration(state.mode, state.phase, state.settings)
      if (duration !== Infinity && state.elapsed >= duration) {
        handlePhaseComplete()
      }
    }
  }, [handlePhaseComplete])

  // -------------------------------------------------------------------------
  // Persist to localStorage on every state change
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeTimerState(timerState)))
    } catch {
      // Storage quota exceeded or private browsing — fail silently.
    }
  }, [timerState])

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const start = useCallback(() => {
    setTimerState((prev) => {
      if (prev.status !== 'idle') return prev
      return {
        ...prev,
        status: 'running',
        startedAt: Date.now(),
        elapsed: 0,
      }
    })
  }, [])

  const pause = useCallback(() => {
    setTimerState((prev) => {
      if (prev.status !== 'running') return prev
      const additionalElapsed =
        prev.startedAt !== null ? (Date.now() - prev.startedAt) / 1000 : 0
      return {
        ...prev,
        status: 'paused',
        startedAt: null,
        elapsed: prev.elapsed + additionalElapsed,
      }
    })
  }, [])

  const resume = useCallback(() => {
    setTimerState((prev) => {
      if (prev.status !== 'paused') return prev
      return {
        ...prev,
        status: 'running',
        startedAt: Date.now(),
      }
    })
  }, [])

  const stop = useCallback(() => {
    setTimerState((prev) => {
      if (prev.status === 'idle') return prev
      return {
        ...prev,
        status: 'idle',
        startedAt: null,
        elapsed: 0,
      }
    })
  }, [])

  const reset = useCallback(() => {
    setTimerState((prev) => ({
      ...prev,
      status: 'idle',
      startedAt: null,
      elapsed: 0,
      phase: 'focus',
      cycleCount: 0,
    }))
  }, [])

  const skipPhase = useCallback(() => {
    setTimerState((prev) => {
      if (prev.mode === 'stopwatch') return prev

      const { nextPhase, incrementCycle } = computeNextPhase(
        prev.mode,
        prev.phase,
        prev.cycleCount,
        prev.settings.longBreakInterval,
      )

      if (prev.soundEnabled) playTransitionTone()
      if (prev.notificationsEnabled) sendPhaseNotification(nextPhase)

      return {
        ...prev,
        phase: nextPhase,
        status: 'idle',
        startedAt: null,
        elapsed: 0,
        cycleCount: incrementCycle ? prev.cycleCount + 1 : prev.cycleCount,
      }
    })
  }, [])

  const setMode = useCallback((mode: TimerMode) => {
    setTimerState((prev) => ({
      ...prev,
      mode,
      status: 'idle',
      startedAt: null,
      elapsed: 0,
      phase: 'focus',
    }))
  }, [])

  const setSettings = useCallback((partial: Partial<PomodoroSettings>) => {
    setTimerState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...partial },
    }))
  }, [])

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setTimerState((prev) => ({ ...prev, soundEnabled: enabled }))
  }, [])

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    setTimerState((prev) => ({ ...prev, notificationsEnabled: enabled }))
  }, [])

  const setSelectedTagId = useCallback((id: string | null) => {
    setTimerState((prev) => ({ ...prev, selectedTagId: id }))
  }, [])

  const setSelectedTaskId = useCallback((id: string | null) => {
    setTimerState((prev) => ({ ...prev, selectedTaskId: id }))
  }, [])

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value = useMemo<TimerContextValue>(
    () => ({
      ...timerState,
      start,
      pause,
      resume,
      stop,
      reset,
      skipPhase,
      setMode,
      setSettings,
      setSoundEnabled,
      setNotificationsEnabled,
      setSelectedTagId,
      setSelectedTaskId,
      currentDuration,
      remainingSeconds,
      totalElapsed,
      pendingSession,
      clearPendingSession,
    }),
    [
      timerState,
      currentDuration,
      remainingSeconds,
      totalElapsed,
      pendingSession,
      // Actions are stable (useCallback with no deps), so listing them here
      // doesn't cause extra renders but keeps the linter happy.
      start,
      pause,
      resume,
      stop,
      reset,
      skipPhase,
      setMode,
      setSettings,
      setSoundEnabled,
      setNotificationsEnabled,
      setSelectedTagId,
      setSelectedTaskId,
      clearPendingSession,
    ],
  )

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}
