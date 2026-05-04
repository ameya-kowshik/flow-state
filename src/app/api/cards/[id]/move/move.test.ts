/**
 * Unit + property-based tests for card move logic.
 *
 * Feature: flow-state-app
 * Tests the pure logic extracted from the card move route handler:
 *   - Terminal column name → CardStatus mapping
 *   - Position rebalancing trigger condition
 *   - Fractional indexing position computation
 *
 * Requirements: 15.4, 13.2
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ---------------------------------------------------------------------------
// Pure logic extracted from the route handler (mirrors route.ts)
// ---------------------------------------------------------------------------

type CardStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED'

const TERMINAL_COLUMN_STATUS: Record<string, CardStatus> = {
  done: 'DONE',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
}

function terminalStatusForColumn(columnName: string): CardStatus | null {
  const key = columnName.trim().toLowerCase()
  return Object.hasOwn(TERMINAL_COLUMN_STATUS, key) ? TERMINAL_COLUMN_STATUS[key] : null
}

/**
 * Determines whether a set of ordered positions needs rebalancing.
 * Returns true if any adjacent gap is below 0.001.
 */
function needsRebalance(positions: number[]): boolean {
  if (positions.length < 2) return false
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] - positions[i - 1] < 0.001) return true
  }
  return false
}

/**
 * Rebalances positions to integers 1, 2, 3, ...
 * Returns a new array of the same length.
 */
function rebalancePositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1)
}

/**
 * Computes the fractional index position between two neighbors.
 * If before is null, uses 0 as the lower bound.
 * If after is null, uses floor(before) + 2 as the upper bound.
 */
function computeFractionalPosition(
  before: number | null,
  after: number | null,
): number {
  const lo = before ?? 0
  const hi = after ?? (before !== null ? Math.floor(before) + 2 : 2)
  return (lo + hi) / 2
}

// ---------------------------------------------------------------------------
// Unit tests — terminal column status mapping
// ---------------------------------------------------------------------------

describe('terminalStatusForColumn', () => {
  it('maps "Done" (case-insensitive) to DONE', () => {
    expect(terminalStatusForColumn('Done')).toBe('DONE')
    expect(terminalStatusForColumn('done')).toBe('DONE')
    expect(terminalStatusForColumn('DONE')).toBe('DONE')
    expect(terminalStatusForColumn('  Done  ')).toBe('DONE')
  })

  it('maps "Cancelled" and "Canceled" to CANCELLED', () => {
    expect(terminalStatusForColumn('Cancelled')).toBe('CANCELLED')
    expect(terminalStatusForColumn('cancelled')).toBe('CANCELLED')
    expect(terminalStatusForColumn('Canceled')).toBe('CANCELLED')
    expect(terminalStatusForColumn('CANCELED')).toBe('CANCELLED')
  })

  it('returns null for non-terminal column names', () => {
    expect(terminalStatusForColumn('To Do')).toBeNull()
    expect(terminalStatusForColumn('In Progress')).toBeNull()
    expect(terminalStatusForColumn('In Review')).toBeNull()
    expect(terminalStatusForColumn('Backlog')).toBeNull()
    expect(terminalStatusForColumn('')).toBeNull()
  })

  // Property: any column name that is not a known terminal keyword returns null
  it('returns null for arbitrary non-terminal column names', () => {
    const terminalKeywords = new Set(['done', 'cancelled', 'canceled'])
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(
          (s) => !terminalKeywords.has(s.trim().toLowerCase()),
        ),
        (name) => {
          expect(terminalStatusForColumn(name)).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Unit tests — position rebalancing trigger
// ---------------------------------------------------------------------------

describe('needsRebalance', () => {
  it('returns false for fewer than 2 positions', () => {
    expect(needsRebalance([])).toBe(false)
    expect(needsRebalance([1])).toBe(false)
  })

  it('returns false when all gaps are >= 0.001', () => {
    expect(needsRebalance([1, 2, 3])).toBe(false)
    expect(needsRebalance([1.0, 1.5, 2.0])).toBe(false)
    // Use 1.002 to ensure the gap is safely above 0.001 despite floating-point
    expect(needsRebalance([1.0, 1.002, 2.0])).toBe(false)
  })

  it('returns true when any gap is < 0.001', () => {
    expect(needsRebalance([1.0, 1.0005, 2.0])).toBe(true)
    expect(needsRebalance([1.0, 2.0, 2.0009])).toBe(true)
  })

  it('returns true when positions are equal (gap = 0)', () => {
    expect(needsRebalance([1.0, 1.0, 2.0])).toBe(true)
  })
})

describe('rebalancePositions', () => {
  it('produces integers starting at 1', () => {
    expect(rebalancePositions(3)).toEqual([1, 2, 3])
    expect(rebalancePositions(1)).toEqual([1])
    expect(rebalancePositions(5)).toEqual([1, 2, 3, 4, 5])
  })

  it('returns empty array for 0 cards', () => {
    expect(rebalancePositions(0)).toEqual([])
  })

  // Property: rebalanced positions are always integers 1..N with no gaps < 0.001
  it('rebalanced positions never need further rebalancing', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (count) => {
        const positions = rebalancePositions(count)
        expect(needsRebalance(positions)).toBe(false)
        expect(positions[0]).toBe(1)
        expect(positions[positions.length - 1]).toBe(count)
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 23: Card move round-trip (fractional indexing)
// Validates: Requirements 15.4
// ---------------------------------------------------------------------------

describe('fractional indexing — computeFractionalPosition', () => {
  it('places a card between two neighbors', () => {
    const pos = computeFractionalPosition(1, 2)
    expect(pos).toBe(1.5)
    expect(pos).toBeGreaterThan(1)
    expect(pos).toBeLessThan(2)
  })

  it('places a card at the start when before is null', () => {
    const pos = computeFractionalPosition(null, 1)
    expect(pos).toBe(0.5)
    expect(pos).toBeLessThan(1)
  })

  it('places a card at the end when after is null', () => {
    const pos = computeFractionalPosition(3, null)
    expect(pos).toBeGreaterThan(3)
  })

  it('handles both null (single card in empty column)', () => {
    const pos = computeFractionalPosition(null, null)
    expect(pos).toBe(1)
  })

  // Feature: flow-state-app, Property 23: Card move round-trip
  // Validates: Requirements 15.4
  it('computed position is always strictly between before and after', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (a, b) => {
          // Ensure a < b for a valid before/after pair
          const before = Math.min(a, b)
          const after = Math.max(a, b)
          if (after - before < 0.0001) return // skip degenerate cases

          const pos = computeFractionalPosition(before, after)
          expect(pos).toBeGreaterThan(before)
          expect(pos).toBeLessThan(after)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Property: repeated bisection eventually triggers rebalancing threshold
  it('repeated bisection produces positions that eventually need rebalancing', () => {
    // Feature: flow-state-app, Property 23: Card move round-trip (rebalance trigger)
    // Validates: Requirements 15.4
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 60 }),
        (bisections) => {
          // Simulate inserting cards always between position 1 and 2
          let lo = 1
          const hi = 2
          const positions: number[] = [lo, hi]

          for (let i = 0; i < bisections; i++) {
            const newPos = computeFractionalPosition(lo, hi)
            positions.splice(1, 0, newPos) // insert after lo
            lo = newPos
          }

          // After enough bisections the gap must be < 0.001
          const minGap = Math.min(
            ...positions.slice(1).map((p, i) => p - positions[i]),
          )
          // With 30+ bisections between 1 and 2, gap = 1/2^30 ≈ 9.3e-10 << 0.001
          expect(minGap).toBeLessThan(0.001)
          expect(needsRebalance(positions)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
