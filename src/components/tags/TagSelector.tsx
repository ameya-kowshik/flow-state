'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Tag as TagIcon, ChevronDown, Settings2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimer } from '@/contexts/TimerContext'
import { TagManager } from './TagManager'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tag {
  id: string
  name: string
  color: string
}

// ---------------------------------------------------------------------------
// TagSelector
// ---------------------------------------------------------------------------
// Dropdown/popover for selecting one tag. Fetches tags from /api/tags.
// Wires into TimerContext via setSelectedTagId.
// Requirements: 5.5

interface TagSelectorProps {
  /** Extra class names for the trigger button wrapper. */
  className?: string
}

export function TagSelector({ className }: TagSelectorProps) {
  const { selectedTagId, setSelectedTagId } = useTimer()

  const [tags, setTags] = useState<Tag[]>([])
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // -------------------------------------------------------------------------
  // Fetch tags
  // -------------------------------------------------------------------------
  const fetchTags = useCallback(async () => {
    setLoadStatus('loading')
    try {
      const res = await fetch('/api/tags')
      if (!res.ok) throw new Error('Failed to load tags')
      const data = (await res.json()) as Tag[]
      setTags(data)
      setLoadStatus('idle')
    } catch {
      setLoadStatus('error')
    }
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  // -------------------------------------------------------------------------
  // Close dropdown on outside click
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // -------------------------------------------------------------------------
  // Close dropdown on Escape
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const toggle = useCallback(() => setOpen((v) => !v), [])

  const pick = useCallback(
    (id: string | null) => {
      setSelectedTagId(id)
      setOpen(false)
    },
    [setSelectedTagId],
  )

  const openManager = useCallback(() => {
    setOpen(false)
    setManagerOpen(true)
  }, [])

  const handleTagsChanged = useCallback(() => {
    fetchTags()
  }, [fetchTags])

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------
  const selected = tags.find((t) => t.id === selectedTagId) ?? null

  // If the selected tag was deleted, clear it
  useEffect(() => {
    if (selectedTagId && loadStatus === 'idle' && tags.length >= 0) {
      const stillExists = tags.some((t) => t.id === selectedTagId)
      if (!stillExists) {
        setSelectedTagId(null)
      }
    }
  }, [tags, selectedTagId, loadStatus, setSelectedTagId])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      <div ref={containerRef} className={cn('relative w-full', className)}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm',
            'transition-colors duration-150',
            open
              ? 'border-violet-500/40 bg-white/8 text-white'
              : 'border-white/8 bg-white/4 text-[oklch(0.56_0.04_265)] hover:bg-white/6 hover:text-[oklch(0.88_0.01_265)]',
          )}
        >
          {loadStatus === 'loading' ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <TagIcon className="size-4 shrink-0" aria-hidden="true" />
          )}
          <span className="flex-1 text-left">
            {selected ? (
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selected.color }}
                  aria-hidden="true"
                />
                {selected.name}
              </span>
            ) : (
              'Select a tag'
            )}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 transition-transform duration-150',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div
            className={cn(
              'absolute z-20 mt-1 w-full rounded-xl border border-white/10',
              'bg-[oklch(0.14_0.025_265)] py-1 shadow-xl shadow-black/40',
            )}
          >
            <ul role="listbox" aria-label="Tags">
              {/* No tag option */}
              <li>
                <button
                  role="option"
                  aria-selected={selectedTagId === null}
                  onClick={() => pick(null)}
                  className={cn(
                    'flex w-full items-center gap-2 px-4 py-2 text-sm',
                    'transition-colors hover:bg-white/6',
                    selectedTagId === null
                      ? 'text-violet-300'
                      : 'text-[oklch(0.56_0.04_265)]',
                  )}
                >
                  <span
                    className="size-2.5 rounded-full border border-white/20 shrink-0"
                    aria-hidden="true"
                  />
                  No tag
                </button>
              </li>

              {/* Error state */}
              {loadStatus === 'error' && (
                <li className="px-4 py-2 text-xs text-red-400">
                  Failed to load tags.{' '}
                  <button
                    type="button"
                    onClick={fetchTags}
                    className="underline underline-offset-2 hover:no-underline"
                  >
                    Retry
                  </button>
                </li>
              )}

              {/* Tag options */}
              {tags.map((tag) => (
                <li key={tag.id}>
                  <button
                    role="option"
                    aria-selected={selectedTagId === tag.id}
                    onClick={() => pick(tag.id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-4 py-2 text-sm',
                      'transition-colors hover:bg-white/6',
                      selectedTagId === tag.id
                        ? 'text-white'
                        : 'text-[oklch(0.88_0.01_265)]',
                    )}
                  >
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                      aria-hidden="true"
                    />
                    {tag.name}
                  </button>
                </li>
              ))}

              {/* Empty state */}
              {loadStatus === 'idle' && tags.length === 0 && (
                <li className="px-4 py-2 text-xs text-[oklch(0.45_0.03_265)]">
                  No tags yet.
                </li>
              )}
            </ul>

            {/* Divider + Manage tags */}
            <div className="mx-2 my-1 h-px bg-white/6" />
            <button
              type="button"
              onClick={openManager}
              className={cn(
                'flex w-full items-center gap-2 px-4 py-2 text-xs',
                'text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/6 hover:text-[oklch(0.88_0.01_265)]',
              )}
            >
              <Settings2 className="size-3.5" aria-hidden="true" />
              Manage tags
            </button>
          </div>
        )}
      </div>

      {/* Tag Manager modal */}
      <TagManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        onTagsChanged={handleTagsChanged}
      />
    </>
  )
}
