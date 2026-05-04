/**
 * Keyboard shortcut registry.
 * Consumed by the command palette help section and shortcut listeners.
 * Requirements: 20.1
 */

export interface ShortcutDefinition {
  /** Human-readable key combination, e.g. "Cmd+K" */
  keys: string
  /** Short description of what the shortcut does */
  description: string
  /**
   * Where the shortcut is active.
   * "global" = works on every authenticated page.
   * "boards" = works only on a board detail page (/boards/[id]).
   */
  scope: 'global' | 'boards'
}

export const SHORTCUTS: ShortcutDefinition[] = [
  {
    keys: '⌘K / Ctrl+K',
    description: 'Open command palette',
    scope: 'global',
  },
  {
    keys: 'F',
    description: 'Go to Focus page',
    scope: 'global',
  },
  {
    keys: 'B',
    description: 'Focus the Boards section in the sidebar',
    scope: 'global',
  },
  {
    keys: 'N',
    description: 'Add a new card to the first column',
    scope: 'boards',
  },
  {
    keys: 'Esc',
    description: 'Close command palette / dialogs',
    scope: 'global',
  },
]
