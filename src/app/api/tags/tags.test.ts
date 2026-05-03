/**
 * Unit + property-based tests for tag validation logic.
 *
 * Feature: flow-state-app
 * Tests the hex color regex and name validation rules used in the tags API.
 * Requirements: 5.1, 5.2, 5.6
 *
 * Note: These tests cover the pure validation logic without requiring a DB.
 * The regex and rules are extracted from the route handlers for testability.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ---------------------------------------------------------------------------
// Pure validation helpers (mirrors the logic in the route handlers)
// ---------------------------------------------------------------------------

/** Validates a hex color string — must be #RGB or #RRGGBB */
function isValidHexColor(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value)
}

/** Validates a tag name — must be a non-empty string after trimming */
function isValidTagName(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return value.trim().length > 0
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates valid 3-digit hex colors like #ABC */
const arbHex3 = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.hexaString({ minLength: 3, maxLength: 3 }),
    )
    .map(([h]) => `#${h.toUpperCase()}`)

/** Generates valid 6-digit hex colors like #AABBCC */
const arbHex6 = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.hexaString({ minLength: 6, maxLength: 6 }),
    )
    .map(([h]) => `#${h.toUpperCase()}`)

/** Generates invalid hex color strings */
const arbInvalidHex = (): fc.Arbitrary<string> =>
  fc.oneof(
    // Wrong length
    fc.hexaString({ minLength: 1, maxLength: 2 }).map((h) => `#${h}`),
    fc.hexaString({ minLength: 4, maxLength: 5 }).map((h) => `#${h}`),
    fc.hexaString({ minLength: 7, maxLength: 10 }).map((h) => `#${h}`),
    // Missing #
    fc.hexaString({ minLength: 6, maxLength: 6 }),
    // Non-hex characters after #
    fc.string({ minLength: 3, maxLength: 6 }).filter((s) => !/^[0-9A-Fa-f]+$/.test(s)).map((s) => `#${s}`),
  )

// ---------------------------------------------------------------------------
// Hex color validation tests
// ---------------------------------------------------------------------------

describe('isValidHexColor', () => {
  it('accepts valid 3-digit hex colors', () => {
    expect(isValidHexColor('#FFF')).toBe(true)
    expect(isValidHexColor('#000')).toBe(true)
    expect(isValidHexColor('#abc')).toBe(true)
    expect(isValidHexColor('#A1B')).toBe(true)
  })

  it('accepts valid 6-digit hex colors', () => {
    expect(isValidHexColor('#FF5733')).toBe(true)
    expect(isValidHexColor('#000000')).toBe(true)
    expect(isValidHexColor('#ffffff')).toBe(true)
    expect(isValidHexColor('#a78bfa')).toBe(true)
  })

  it('rejects colors without leading #', () => {
    expect(isValidHexColor('FF5733')).toBe(false)
    expect(isValidHexColor('fff')).toBe(false)
  })

  it('rejects wrong-length hex strings', () => {
    expect(isValidHexColor('#FF')).toBe(false)
    expect(isValidHexColor('#FFFF')).toBe(false)
    expect(isValidHexColor('#FFFFF')).toBe(false)
    expect(isValidHexColor('#FFFFFFF')).toBe(false)
  })

  it('rejects non-hex characters', () => {
    expect(isValidHexColor('#GGGGGG')).toBe(false)
    expect(isValidHexColor('#XYZ')).toBe(false)
    expect(isValidHexColor('#12345Z')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isValidHexColor(null)).toBe(false)
    expect(isValidHexColor(undefined)).toBe(false)
    expect(isValidHexColor(123456)).toBe(false)
    expect(isValidHexColor({})).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidHexColor('')).toBe(false)
  })

  // Property: all generated valid 3-digit hex colors pass validation
  it('always accepts generated valid 3-digit hex colors', () => {
    fc.assert(
      fc.property(arbHex3(), (color) => {
        expect(isValidHexColor(color)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  // Property: all generated valid 6-digit hex colors pass validation
  it('always accepts generated valid 6-digit hex colors', () => {
    fc.assert(
      fc.property(arbHex6(), (color) => {
        expect(isValidHexColor(color)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  // Property 11 (partial): tag color validation is consistent
  // Validates: Requirements 5.1, 5.2
  it('rejects generated invalid hex color strings', () => {
    // Feature: flow-state-app, Property 11: Tag names are unique per user (color validation aspect)
    fc.assert(
      fc.property(arbInvalidHex(), (color) => {
        expect(isValidHexColor(color)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Tag name validation tests
// ---------------------------------------------------------------------------

describe('isValidTagName', () => {
  it('accepts non-empty strings', () => {
    expect(isValidTagName('Work')).toBe(true)
    expect(isValidTagName('Deep Focus')).toBe(true)
    expect(isValidTagName('a')).toBe(true)
    expect(isValidTagName('  padded  ')).toBe(true) // trim makes it non-empty
  })

  it('rejects empty string', () => {
    expect(isValidTagName('')).toBe(false)
  })

  it('rejects whitespace-only strings', () => {
    expect(isValidTagName('   ')).toBe(false)
    expect(isValidTagName('\t')).toBe(false)
    expect(isValidTagName('\n')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isValidTagName(null)).toBe(false)
    expect(isValidTagName(undefined)).toBe(false)
    expect(isValidTagName(42)).toBe(false)
    expect(isValidTagName({})).toBe(false)
    expect(isValidTagName([])).toBe(false)
  })

  // Property: any string with at least one non-whitespace character is valid
  it('accepts any string with at least one non-whitespace character', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (name) => {
          expect(isValidTagName(name)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Property: whitespace-only strings are always invalid
  it('rejects whitespace-only strings of any length', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 20 }),
        (name) => {
          expect(isValidTagName(name)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Tag payload validation (combined name + color)
// ---------------------------------------------------------------------------

describe('tag payload validation', () => {
  interface TagPayload {
    name: unknown
    color: unknown
  }

  function validateTagPayload(payload: TagPayload): { valid: boolean; fields: Record<string, string> } {
    const fields: Record<string, string> = {}
    if (!isValidTagName(payload.name)) {
      fields.name = 'name is required and must be a non-empty string'
    }
    if (!isValidHexColor(payload.color)) {
      fields.color = 'color must be a valid hex color (e.g. "#FF5733")'
    }
    return { valid: Object.keys(fields).length === 0, fields }
  }

  it('accepts a valid name + color payload', () => {
    const result = validateTagPayload({ name: 'Work', color: '#FF5733' })
    expect(result.valid).toBe(true)
    expect(result.fields).toEqual({})
  })

  it('rejects missing name', () => {
    const result = validateTagPayload({ name: '', color: '#FF5733' })
    expect(result.valid).toBe(false)
    expect(result.fields.name).toBeDefined()
  })

  it('rejects invalid color', () => {
    const result = validateTagPayload({ name: 'Work', color: 'not-a-color' })
    expect(result.valid).toBe(false)
    expect(result.fields.color).toBeDefined()
  })

  it('rejects both invalid name and color', () => {
    const result = validateTagPayload({ name: '', color: 'bad' })
    expect(result.valid).toBe(false)
    expect(result.fields.name).toBeDefined()
    expect(result.fields.color).toBeDefined()
  })

  // Property 9 (validation aspect): valid tag payloads always pass validation
  // Validates: Requirements 5.1, 5.2
  it('valid name + valid hex color always produces a valid payload', () => {
    // Feature: flow-state-app, Property 9: Tag creation round-trip (validation aspect)
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.oneof(arbHex3(), arbHex6()),
        (name, color) => {
          const result = validateTagPayload({ name, color })
          expect(result.valid).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
