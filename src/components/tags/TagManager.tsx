'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, Pencil, Trash2, Plus, Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tag {
  id: string
  name: string
  color: string
}

// ---------------------------------------------------------------------------
// TagManager
// ---------------------------------------------------------------------------
// Modal for creating, editing, and deleting tags.
// Requirements: 5.1, 5.2, 5.3

interface TagManagerProps {
  open: boolean
  onClose: () => void
  /** Called after any mutation so the parent can refresh its tag list. */
  onTagsChanged?: () => void
}

export function TagManager({ open, onClose, onTagsChanged }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  // Inline-edit state: maps tag id → draft values
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#a78bfa')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Create-new form
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#a78bfa')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
    if (open) {
      fetchTags()
    }
  }, [open, fetchTags])

  // -------------------------------------------------------------------------
  // Keyboard: close on Escape
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // -------------------------------------------------------------------------
  // Edit handlers
  // -------------------------------------------------------------------------
  const startEdit = useCallback((tag: Tag) => {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
    setEditError(null)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditError(null)
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editingId) return
    const trimmed = editName.trim()
    if (!trimmed) {
      setEditError('Name is required')
      return
    }
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/tags/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, color: editColor }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg =
          typeof data?.fields?.name === 'string'
            ? data.fields.name
            : typeof data?.error === 'string'
            ? data.error
            : `Failed to save (${res.status})`
        setEditError(msg)
        return
      }
      const updated = (await res.json()) as Tag
      setTags((prev) => prev.map((t) => (t.id === editingId ? updated : t)))
      setEditingId(null)
      onTagsChanged?.()
    } catch {
      setEditError('Network error — please try again.')
    } finally {
      setEditSaving(false)
    }
  }, [editingId, editName, editColor, onTagsChanged])

  // -------------------------------------------------------------------------
  // Delete handler
  // -------------------------------------------------------------------------
  const deleteTag = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
        if (!res.ok && res.status !== 204) {
          // Silently ignore — tag may already be gone
        }
        setTags((prev) => prev.filter((t) => t.id !== id))
        if (editingId === id) setEditingId(null)
        onTagsChanged?.()
      } catch {
        // Fail silently; the tag stays in the list
      } finally {
        setDeletingId(null)
      }
    },
    [editingId, onTagsChanged],
  )

  // -------------------------------------------------------------------------
  // Create handler
  // -------------------------------------------------------------------------
  const createTag = useCallback(async () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      setCreateError('Name is required')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, color: newColor }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg =
          typeof data?.fields?.name === 'string'
            ? data.fields.name
            : typeof data?.error === 'string'
            ? data.error
            : `Failed to create (${res.status})`
        setCreateError(msg)
        return
      }
      const created = (await res.json()) as Tag
      setTags((prev) => [...prev, created])
      setNewName('')
      setNewColor('#a78bfa')
      onTagsChanged?.()
    } catch {
      setCreateError('Network error — please try again.')
    } finally {
      setCreating(false)
    }
  }, [newName, newColor, onTagsChanged])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (!open) return null

  return (
    // Backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-manager-title"
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-black/60 backdrop-blur-sm',
        'animate-in fade-in duration-200',
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-md mx-4',
          'rounded-2xl border border-white/10',
          'bg-[oklch(0.14_0.025_265)]',
          'shadow-2xl shadow-black/60',
          'animate-in zoom-in-95 duration-200',
          'flex flex-col max-h-[80vh]',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 id="tag-manager-title" className="text-base font-semibold text-white">
            Manage tags
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tag manager"
            className={cn(
              'flex size-7 items-center justify-center rounded-lg',
              'text-[oklch(0.45_0.03_265)] transition-colors',
              'hover:bg-white/8 hover:text-[oklch(0.88_0.01_265)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tag list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {loadStatus === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-[oklch(0.45_0.03_265)]" aria-hidden="true" />
            </div>
          )}

          {loadStatus === 'error' && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              Failed to load tags.{' '}
              <button
                type="button"
                onClick={fetchTags}
                className="underline underline-offset-2 hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {loadStatus === 'idle' && tags.length === 0 && (
            <p className="py-6 text-center text-sm text-[oklch(0.45_0.03_265)]">
              No tags yet. Create one below.
            </p>
          )}

          {tags.map((tag) => {
            const isEditing = editingId === tag.id
            const isDeleting = deletingId === tag.id

            return (
              <div
                key={tag.id}
                className={cn(
                  'rounded-xl border px-3 py-2.5 transition-colors',
                  isEditing
                    ? 'border-violet-500/30 bg-violet-500/8'
                    : 'border-white/6 bg-white/3 hover:bg-white/5',
                )}
              >
                {isEditing ? (
                  /* Edit row */
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {/* Color picker */}
                      <label className="sr-only" htmlFor={`edit-color-${tag.id}`}>
                        Tag color
                      </label>
                      <div className="relative size-7 shrink-0">
                        <span
                          className="absolute inset-0 rounded-md border border-white/20"
                          style={{ backgroundColor: editColor }}
                          aria-hidden="true"
                        />
                        <input
                          id={`edit-color-${tag.id}`}
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="absolute inset-0 cursor-pointer opacity-0 size-full"
                          aria-label="Pick tag color"
                        />
                      </div>
                      {/* Name input */}
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit()
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        autoFocus
                        className={cn(
                          'flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5',
                          'text-sm text-white placeholder:text-[oklch(0.35_0.02_265)]',
                          'outline-none transition-colors',
                          'focus:border-violet-500/40 focus:bg-white/8 focus:ring-2 focus:ring-violet-500/20',
                        )}
                        placeholder="Tag name"
                        aria-label="Tag name"
                      />
                      {/* Save */}
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={editSaving}
                        aria-label="Save tag"
                        className={cn(
                          'flex size-7 items-center justify-center rounded-lg',
                          'bg-violet-500/20 text-violet-300 transition-colors',
                          'hover:bg-violet-500/30 disabled:opacity-50',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                        )}
                      >
                        {editSaving ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="size-3.5" aria-hidden="true" />
                        )}
                      </button>
                      {/* Cancel */}
                      <button
                        type="button"
                        onClick={cancelEdit}
                        aria-label="Cancel edit"
                        className={cn(
                          'flex size-7 items-center justify-center rounded-lg',
                          'text-[oklch(0.45_0.03_265)] transition-colors',
                          'hover:bg-white/8 hover:text-[oklch(0.88_0.01_265)]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                        )}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    {editError && (
                      <p className="text-xs text-red-400 pl-9">{editError}</p>
                    )}
                  </div>
                ) : (
                  /* Display row */
                  <div className="flex items-center gap-2.5">
                    <span
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-sm text-[oklch(0.88_0.01_265)] truncate">
                      {tag.name}
                    </span>
                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => startEdit(tag)}
                      aria-label={`Edit tag "${tag.name}"`}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-md',
                        'text-[oklch(0.45_0.03_265)] transition-colors',
                        'hover:bg-white/8 hover:text-[oklch(0.88_0.01_265)]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                      )}
                    >
                      <Pencil className="size-3" aria-hidden="true" />
                    </button>
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => deleteTag(tag.id)}
                      disabled={isDeleting}
                      aria-label={`Delete tag "${tag.name}"`}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-md',
                        'text-[oklch(0.45_0.03_265)] transition-colors',
                        'hover:bg-red-500/15 hover:text-red-400',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30',
                        'disabled:opacity-50',
                      )}
                    >
                      {isDeleting ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-3" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Create-new form */}
        <div className="border-t border-white/8 px-5 py-4">
          <p className="mb-2.5 text-xs font-medium text-[oklch(0.45_0.03_265)] uppercase tracking-wider">
            New tag
          </p>
          <div className="flex items-center gap-2">
            {/* Color picker */}
            <label className="sr-only" htmlFor="new-tag-color">
              New tag color
            </label>
            <div className="relative size-8 shrink-0">
              <span
                className="absolute inset-0 rounded-md border border-white/20"
                style={{ backgroundColor: newColor }}
                aria-hidden="true"
              />
              <input
                id="new-tag-color"
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0 size-full"
                aria-label="Pick new tag color"
              />
            </div>
            {/* Name input */}
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (createError) setCreateError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createTag()
              }}
              placeholder="Tag name"
              className={cn(
                'flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2',
                'text-sm text-white placeholder:text-[oklch(0.35_0.02_265)]',
                'outline-none transition-colors',
                'focus:border-violet-500/40 focus:bg-white/8 focus:ring-2 focus:ring-violet-500/20',
                createError && 'border-red-500/40',
              )}
              aria-label="New tag name"
              aria-describedby={createError ? 'create-tag-error' : undefined}
            />
            {/* Create button */}
            <button
              type="button"
              onClick={createTag}
              disabled={creating}
              aria-label="Create tag"
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl',
                'bg-violet-500/20 text-violet-300 transition-colors',
                'hover:bg-violet-500/30 disabled:opacity-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
              )}
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {createError && (
            <p id="create-tag-error" className="mt-1.5 text-xs text-red-400">
              {createError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
