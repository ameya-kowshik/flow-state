'use client'

/**
 * CommandPaletteShell — client wrapper rendered inside the (app) layout.
 *
 * Registers global keyboard shortcuts:
 *   Cmd+K / Ctrl+K  → open command palette
 *   F               → navigate to /focus
 *   B               → focus the Boards section in the sidebar
 *
 * Requirements: 20.1, 20.4
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CommandPalette } from '@/components/CommandPalette'
import { useCommandPalette } from '@/contexts/CommandPaletteContext'

/** ID placed on the Boards nav link in the Sidebar so B can focus it. */
export const SIDEBAR_BOARDS_ID = 'sidebar-boards-link'

export function CommandPaletteShell() {
  const { openPalette } = useCommandPalette()
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Never fire shortcuts when the user is typing
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // Cmd+K / Ctrl+K — open command palette (fires even while typing)
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        openPalette()
        return
      }

      if (isTyping) return

      // F — navigate to /focus
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        router.push('/focus')
        return
      }

      // B — focus the Boards section in the sidebar
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        const el = document.getElementById(SIDEBAR_BOARDS_ID)
        el?.focus()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openPalette, router])

  return <CommandPalette />
}
