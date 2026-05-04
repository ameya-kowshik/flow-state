/**
 * Command palette data layer.
 * Builds a flat index of searchable items from boards, cards, and nav destinations.
 * Requirements: 20.2
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandItemType = 'board' | 'card' | 'nav'

interface BaseCommandItem {
  id: string
  type: CommandItemType
  name: string
}

interface HrefCommandItem extends BaseCommandItem {
  href: string
  action?: never
}

interface ActionCommandItem extends BaseCommandItem {
  href?: never
  action: () => void
}

export type CommandItem = HrefCommandItem | ActionCommandItem

// Minimal shapes expected from callers — keeps this module decoupled from Prisma types.
export interface CommandBoard {
  id: string
  name: string
}

export interface CommandCard {
  id: string
  title: string
  boardId?: string
  boardName?: string
  columnName?: string
}

export interface NavItem {
  label: string
  href: string
}

// ---------------------------------------------------------------------------
// Index builder
// ---------------------------------------------------------------------------

/**
 * Builds a flat array of CommandItem objects from boards, cards, and nav items.
 * Feature: flow-state-app
 */
export function buildCommandIndex(
  boards: CommandBoard[],
  cards: CommandCard[],
  navItems: NavItem[],
): CommandItem[] {
  const items: CommandItem[] = []

  // Navigation destinations
  for (const nav of navItems) {
    items.push({
      id: `nav:${nav.href}`,
      type: 'nav',
      name: nav.label,
      href: nav.href,
    })
  }

  // Boards
  for (const board of boards) {
    items.push({
      id: `board:${board.id}`,
      type: 'board',
      name: board.name,
      href: `/boards/${board.id}`,
    })
  }

  // Cards — include board/column context in the searchable name so users can
  // find "Deploy API · Backend · In Progress" by typing any of those words.
  for (const card of cards) {
    const contextParts: string[] = []
    if (card.boardName) contextParts.push(card.boardName)
    if (card.columnName) contextParts.push(card.columnName)

    const displayName = contextParts.length > 0
      ? `${card.title} · ${contextParts.join(' · ')}`
      : card.title

    items.push({
      id: `card:${card.id}`,
      type: 'card',
      name: displayName,
      href: card.boardId ? `/boards/${card.boardId}?card=${card.id}` : '#',
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Returns items whose name contains `query` as a case-insensitive substring.
 * An empty query returns all items unchanged.
 *
 * Feature: flow-state-app, Property 27: Command palette search completeness
 */
export function searchCommands(index: CommandItem[], query: string): CommandItem[] {
  const trimmed = query.trim()
  if (trimmed === '') return index

  const lower = trimmed.toLowerCase()
  return index.filter((item) => item.name.toLowerCase().includes(lower))
}
