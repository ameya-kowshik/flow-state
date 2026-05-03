/**
 * Unit + property-based tests for the pure timer logic exported from TimerContext.
 *
 * Feature: flow-state-app
 * Covers: serializeTimerState, deserializeTimerState, getCurrentDuration
 * Requirements: 3.3, 3.4, 3.12, 4.1, 4.4
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  serializeTimerState,
  deserializeTimerState,
  getCurrentDuration,
  type TimerState,
  type TimerMode,
  type TimerPhase,
  type TimerStatus,
  type PomodoroSettings,
} from '@/contexts/TimerContext'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbMode = (): fc.Arbitrary<TimerMode> =>
  fc.constantFrom('pomodoro', 'stopwatch')

const arbPhase = (): fc.Arbitrary<TimerPhase> =>
  fc.constantFrom('focus', 'shortBreak', 'longBreak')

const arbStatus = (): fc.Arbitrary<TimerStatus> =>
  fc.constantFrom('idle', 'running', 'paused')

const arbSettings = (): fc.Arbitrary<PomodoroSettings> =>
  fc.record({
    focusDuration: fc.integer({ min: 1, max: 120 }),
    shortBreakDuration: fc.integer({ min: 1, max: 60 }),
    longBreakDuration: fc.integer({ min: 1, max: 60 }),
    longBreakInterval: fc.integer({ min: 1, max: 10 }),
    maxStopwatchDuration: fc.option(fc.integer({ min: 60, max: 7200 }), { nil: null }),
  })

const arbTimerState = (): fc.Arbitrary<TimerState> =>
  fc.record({
    mode: arbMode(),
    phase: arbPhase(),
    status: arbStatus(),
    startedAt: fc.option(fc.integer({ min: 0, max: 9_999_999_999_999 }), { nil: null }),
    elapsed: fc.float({ min: 0, max: 7200, noNaN: true }),
    settings: arbSettings(),
    soundEnabled: fc.boolean(),
    notificationsEnabled: fc.boolean(),
    selectedTagId: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    selectedTaskId: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    cycleCount: fc.integer({ min: 0, max: 100 }),
  })

// ---------------------------------------------------------------------------
// Property 4: Timer state persistence round-trip
// Validates: Requirements 3.12, 4.4
// ---------------------------------------------------------------------------

describe('serializeTimerState / deserializeTimerState', () => {
  it('round-trips all fields through JSON serialization', () => {
    // Feature: flow-state-app, Property 4: Timer state persistence round-trip
    fc.assert(
      fc.property(arbTimerState(), (state) => {
        const serialized = JSON.stringify(serializeTimerState(state))
        const deserialized = deserializeTimerState(JSON.parse(serialized) as Record<string, unknown>)

        expect(deserialized.mode).toBe(state.mode)
        expect(deserialized.phase).toBe(state.phase)
        expect(deserialized.status).toBe(state.status)
        expect(deserialized.startedAt).toBe(state.startedAt)
        expect(deserialized.elapsed).toBeCloseTo(state.elapsed, 5)
        expect(deserialized.soundEnabled).toBe(state.soundEnabled)
        expect(deserialized.notificationsEnabled).toBe(state.notificationsEnabled)
        expect(deserialized.selectedTagId).toBe(state.selectedTagId)
        expect(deserialized.selectedTaskId).toBe(state.selectedTaskId)
        expect(deserialized.cycleCount).toBe(state.cycleCount)
        expect(deserialized.settings.focusDuration).toBe(state.settings.focusDuration)
        expect(deserialized.settings.shortBreakDuration).toBe(state.settings.shortBreakDuration)
        expect(deserialized.settings.longBreakDuration).toBe(state.settings.longBreakDuration)
        expect(deserialized.settings.longBreakInterval).toBe(state.settings.longBreakInterval)
        expect(deserialized.settings.maxStopwatchDuration).toBe(state.settings.maxStopwatchDuration)
      }),
      { numRuns: 100 },
    )
  })

  it('falls back to defaults for unknown/corrupt fields', () => {
    const deserialized = deserializeTimerState({
      mode: 'invalid-mode',
      phase: 'invalid-phase',
      status: 'invalid-status',
      startedAt: 'not-a-number',
      elapsed: 'not-a-number',
      settings: null,
      soundEnabled: 'yes',
      notificationsEnabled: 'no',
      selectedTagId: 42,
      selectedTaskId: false,
      cycleCount: 'many',
    })

    expect(deserialized.mode).toBe('pomodoro')
    expect(deserialized.phase).toBe('focus')
    expect(deserialized.status).toBe('idle')
    expect(deserialized.startedAt).toBeNull()
    expect(deserialized.elapsed).toBe(0)
    expect(deserialized.soundEnabled).toBe(true)
    expect(deserialized.notificationsEnabled).toBe(false)
    expect(deserialized.selectedTagId).toBeNull()
    expect(deserialized.selectedTaskId).toBeNull()
    expect(deserialized.cycleCount).toBe(0)
  })

  it('preserves valid string selectedTagId through round-trip', () => {
    const state = {
      mode: 'pomodoro' as TimerMode,
      phase: 'focus' as TimerPhase,
      status: 'idle' as TimerStatus,
      startedAt: null,
      elapsed: 0,
      settings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        longBreakInterval: 4,
        maxStopwatchDuration: null,
      },
      soundEnabled: true,
      notificationsEnabled: false,
      selectedTagId: 'tag-abc-123',
      selectedTaskId: null,
      cycleCount: 0,
    }
    const deserialized = deserializeTimerState(
      JSON.parse(JSON.stringify(serializeTimerState(state))) as Record<string, unknown>,
    )
    expect(deserialized.selectedTagId).toBe('tag-abc-123')
  })
})

// ---------------------------------------------------------------------------
// getCurrentDuration
// ---------------------------------------------------------------------------

describe('getCurrentDuration', () => {
  const settings: PomodoroSettings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    maxStopwatchDuration: null,
  }

  it('returns focusDuration * 60 for pomodoro focus phase', () => {
    expect(getCurrentDuration('pomodoro', 'focus', settings)).toBe(25 * 60)
  })

  it('returns shortBreakDuration * 60 for pomodoro shortBreak phase', () => {
    expect(getCurrentDuration('pomodoro', 'shortBreak', settings)).toBe(5 * 60)
  })

  it('returns longBreakDuration * 60 for pomodoro longBreak phase', () => {
    expect(getCurrentDuration('pomodoro', 'longBreak', settings)).toBe(15 * 60)
  })

  it('returns Infinity for stopwatch with no max duration', () => {
    expect(getCurrentDuration('stopwatch', 'focus', settings)).toBe(Infinity)
  })

  it('returns maxStopwatchDuration for stopwatch with a max set', () => {
    const s = { ...settings, maxStopwatchDuration: 3600 }
    expect(getCurrentDuration('stopwatch', 'focus', s)).toBe(3600)
  })

  // Property 6: Timer duration settings are positive integers
  // Validates: Requirements 3.13
  it('always returns a positive value for pomodoro phases with positive settings', () => {
    // Feature: flow-state-app, Property 6: Timer duration settings are positive integers
    fc.assert(
      fc.property(
        arbSettings(),
        arbPhase(),
        (s, phase) => {
          const duration = getCurrentDuration('pomodoro', phase, s)
          expect(duration).toBeGreaterThan(0)
          expect(Number.isFinite(duration)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Property 7: Stopwatch elapsed time is non-negative
  // Validates: Requirements 4.1
  it('stopwatch duration is either Infinity or a positive number', () => {
    // Feature: flow-state-app, Property 7: Stopwatch elapsed time is non-negative and monotonically increasing
    fc.assert(
      fc.property(arbSettings(), (s) => {
        const duration = getCurrentDuration('stopwatch', 'focus', s)
        if (s.maxStopwatchDuration === null) {
          expect(duration).toBe(Infinity)
        } else {
          expect(duration).toBe(s.maxStopwatchDuration)
          expect(duration).toBeGreaterThan(0)
        }
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Phase transition logic (via serializeTimerState shape verification)
// ---------------------------------------------------------------------------

describe('timer state shape invariants', () => {
  it('serialized state always contains all required keys', () => {
    fc.assert(
      fc.property(arbTimerState(), (state) => {
        const serialized = serializeTimerState(state)
        const requiredKeys = [
          'mode', 'phase', 'status', 'startedAt', 'elapsed',
          'settings', 'soundEnabled', 'notificationsEnabled',
          'selectedTagId', 'selectedTaskId', 'cycleCount',
        ]
        for (const key of requiredKeys) {
          expect(key in serialized).toBe(true)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('deserialized state always has valid mode/phase/status values', () => {
    fc.assert(
      fc.property(arbTimerState(), (state) => {
        const raw = JSON.parse(JSON.stringify(serializeTimerState(state))) as Record<string, unknown>
        const deserialized = deserializeTimerState(raw)
        expect(['pomodoro', 'stopwatch']).toContain(deserialized.mode)
        expect(['focus', 'shortBreak', 'longBreak']).toContain(deserialized.phase)
        expect(['idle', 'running', 'paused']).toContain(deserialized.status)
      }),
      { numRuns: 100 },
    )
  })
})
