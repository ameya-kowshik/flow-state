'use client'

/**
 * CommandPaletteContext — shared open/close state for the command palette.
 * Allows the keyboard shortcut listener (in the layout) and the palette
 * component itself to communicate without prop drilling.
 * Requirements: 20.1, 20.4
 */

import { createContext, useCallback, useContext, useState } from 'react'

interface CommandPaletteContextValue {
  open: boolean
  openPalette: () => void
  closePalette: () => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const openPalette = useCallback(() => setOpen(true), [])
  const closePalette = useCallback(() => setOpen(false), [])

  return (
    <CommandPaletteContext.Provider value={{ open, openPalette, closePalette }}>
      {children}
    </CommandPaletteContext.Provider>
  )
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider')
  return ctx
}
