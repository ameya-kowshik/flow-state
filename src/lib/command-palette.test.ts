/**
 * Unit + property-based tests for the command palette data layer.
 *
 * Feature: flow-state-app
 * Covers: buildCommandIndex, searchCommands
 * Requirements: 20.2
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  buildCommandIndex,
  searchCommands,
  type CommandBoard,
  type CommandCard,
  type CommandItem,
  type NavItem,
} from '@/lib/command-palette'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbBoard = (): fc.Arbitrary<CommandBoard> =>
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 60 }),
  })

const arbCard = (): fc.Arbitrary<CommandCard> =>
  fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 80 }),
    boardId: fc.option(fc.uuid(), { nil: undefined }),
    boardName: fc.option(fc.string({ minLength: 1, maxLength: 60 }), { nil: undefined }),
    columnName: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
  })

const arbNavItem = (): fc.Arbitrary<NavItem> =>
  fc.record({
    label: fc.string({ minLength: 1, maxLength: 40 }),
    href: fc.string({ minLength: 1, maxLength: 40 }).map((s) => `/${s}`),
  })

// ---------------------------------------------------------------------------
// Unit tests — buildCommandIndex
// ---------------------------------------------------------------------------

describe('buildCommandIndex', () => {
  it('returns an empty array when all inputs are empty', () => {
    expect(buildCommandIndex([], [], [])).toEqual([])
  })

  it('includes nav items with type "nav"', () => {
    const navItems: NavItem[] = [
      { label: 'Today', href: '/today' },
      { label: 'Focus', href: '/focus' },
    ]
    const index = buildCommandIndex([], [], navItems)
    expect(index).toHaveLength(2)
    expect(index.every((i) => i.type === 'nav')).toBe(true)
    expect(index.map((i) => i.name)).toEqual(['Today', 'Focus'])
  })

  it('includes boards with type "board"', () => {
    const boards: CommandBoard[] = [
      { id: 'b1', name: 'Backend' },
      { id: 'b2', name: 'Frontend' },
    ]
    const index = buildCommandIndex(boards, [], [])
    expect(index).toHaveLength(2)
    expect(index.every((i) => i.type === 'board')).toBe(true)
  })

  it('includes cards with type "card"', () => {
    const cards: CommandCard[] = [
      { id: 'c1', title: 'Deploy API', boardId: 'b1', boardName: 'Backend', columnName: 'In Progress' },
    ]
    const index = buildCommandIndex([], cards, [])
    expect(index).toHaveLength(1)
    expect(index[0].type).toBe('card')
  })

  it('embeds board and column context in card name', () => {
    const cards: CommandCard[] = [
      { id: 'c1', title: 'Deploy API', boardId: 'b1', boardName: 'Backend', columnName: 'In Progress' },
    ]
    const index = buildCommandIndex([], cards, [])
    expect(index[0].name).toContain('Deploy API')
    expect(index[0].name).toContain('Backend')
    expect(index[0].name).toContain('In Progress')
  })

  it('uses card title alone when no board/column context is provided', () => {
    const cards: CommandCard[] = [{ id: 'c1', title: 'Standalone Task' }]
    const index = buildCommandIndex([], cards, [])
    expect(index[0].name).toBe('Standalone Task')
  })

  it('assigns unique IDs to all items', () => {
    const boards: CommandBoard[] = [{ id: 'b1', name: 'Board A' }]
    const cards: CommandCard[] = [{ id: 'c1', title: 'Card A', boardId: 'b1' }]
    const navItems: NavItem[] = [{ label: 'Today', href: '/today' }]
    const index = buildCommandIndex(boards, cards, navItems)
    const ids = index.map((i) => i.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('board items have correct href', () => {
    const boards: CommandBoard[] = [{ id: 'board-123', name: 'My Board' }]
    const index = buildCommandIndex(boards, [], [])
    const item = index[0] as CommandItem & { href: string }
    expect(item.href).toBe('/boards/board-123')
  })

  it('nav items have correct href', () => {
    const navItems: NavItem[] = [{ label: 'Focus', href: '/focus' }]
    const index = buildCommandIndex([], [], navItems)
    const item = index[0] as CommandItem & { href: string }
    expect(item.href).toBe('/focus')
  })
})

// ---------------------------------------------------------------------------
// Unit tests — searchCommands
// ---------------------------------------------------------------------------

describe('searchCommands', () => {
  const boards: CommandBoard[] = [
    { id: 'b1', name: 'Backend' },
    { id: 'b2', name: 'Frontend' },
  ]
  const cards: CommandCard[] = [
    { id: 'c1', title: 'Deploy API', boardId: 'b1', boardName: 'Backend', columnName: 'Done' },
    { id: 'c2', title: 'Fix Login Bug', boardId: 'b2', boardName: 'Frontend', columnName: 'In Progress' },
  ]
  const navItems: NavItem[] = [
    { label: 'Today', href: '/today' },
    { label: 'Focus', href: '/focus' },
  ]

  const index = buildCommandIndex(boards, cards, navItems)

  it('returns all items for an empty query', () => {
    expect(searchCommands(index, '')).toHaveLength(index.length)
  })

  it('returns all items for a whitespace-only query', () => {
    expect(searchCommands(index, '   ')).toHaveLength(index.length)
  })

  it('filters by case-insensitive substring match', () => {
    const results = searchCommands(index, 'backend')
    // Should match the "Backend" board and the "Deploy API · Backend · Done" card
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.every((r) => r.name.toLowerCase().includes('backend'))).toBe(true)
  })

  it('is case-insensitive', () => {
    const lower = searchCommands(index, 'focus')
    const upper = searchCommands(index, 'FOCUS')
    const mixed = searchCommands(index, 'FoCuS')
    expect(lower.length).toBe(upper.length)
    expect(lower.length).toBe(mixed.length)
  })

  it('returns empty array when no items match', () => {
    expect(searchCommands(index, 'zzznomatch')).toHaveLength(0)
  })

  it('matches partial substrings', () => {
    const results = searchCommands(index, 'end')
    // "Backend" and "Frontend" both contain "end"
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  it('does not include items that do not match', () => {
    const results = searchCommands(index, 'Deploy')
    expect(results.every((r) => r.name.toLowerCase().includes('deploy'))).toBe(true)
    expect(results.some((r) => r.name === 'Today')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Property 27: Command palette search completeness
// Validates: Requirements 20.2
// ---------------------------------------------------------------------------

describe('searchCommands — Property 27: Command palette search completeness', () => {
  // Feature: flow-state-app, Property 27: Command palette search completeness
  it('includes every item whose name contains the query (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.array(arbBoard(), { maxLength: 10 }),
        fc.array(arbCard(), { maxLength: 10 }),
        fc.array(arbNavItem(), { maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (boards, cards, navItems, query) => {
          const index = buildCommandIndex(boards, cards, navItems)
          const results = searchCommands(index, query)
          const lower = query.trim().toLowerCase()

          // Every item whose name contains the query must appear in results
          const shouldMatch = index.filter((item) =>
            item.name.toLowerCase().includes(lower),
          )
          expect(results.length).toBe(shouldMatch.length)

          // All returned items must actually match
          for (const result of results) {
            expect(result.name.toLowerCase()).toContain(lower)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: flow-state-app, Property 27: Command palette search completeness (empty query)
  it('returns all items for an empty or whitespace-only query', () => {
    fc.assert(
      fc.property(
        fc.array(arbBoard(), { maxLength: 10 }),
        fc.array(arbCard(), { maxLength: 10 }),
        fc.array(arbNavItem(), { maxLength: 5 }),
        fc.oneof(
          fc.constant(''),
          fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 5 }),
        ),
        (boards, cards, navItems, emptyQuery) => {
          const index = buildCommandIndex(boards, cards, navItems)
          const results = searchCommands(index, emptyQuery)
          expect(results.length).toBe(index.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: flow-state-app, Property 27: Command palette search completeness (no false positives)
  it('never includes items whose name does not contain the query', () => {
    fc.assert(
      fc.property(
        fc.array(arbBoard(), { maxLength: 10 }),
        fc.array(arbCard(), { maxLength: 10 }),
        fc.array(arbNavItem(), { maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (boards, cards, navItems, query) => {
          const index = buildCommandIndex(boards, cards, navItems)
          const results = searchCommands(index, query)
          const lower = query.trim().toLowerCase()

          for (const result of results) {
            expect(result.name.toLowerCase()).toContain(lower)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
