'use client'

/**
 * CardDetailModal — full-screen overlay for viewing and editing a card.
 *
 * Editable fields:
 *   - title (inline)
 *   - description (@uiw/react-md-editor, edit/preview toggle)
 *   - due date (date input)
 *   - labels (multi-select from board labels)
 *   - subtasks (checklist with add/delete)
 *   - comments (chronological, author + timestamp, edit/delete)
 *
 * Activity log: CardActivity records in chronological order.
 * All mutations call the relevant API endpoints with optimistic updates + revert on error.
 *
 * Requirements: 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 19.1, 19.2, 19.3
 */

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  X,
  CalendarDays,
  Tag,
  CheckSquare,
  MessageSquare,
  Activity,
  Plus,
  Trash2,
  Pencil,
  Check,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

// @uiw/react-md-editor uses browser APIs — must be loaded client-side only
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })
const MDPreview = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default.Markdown),
  { ssr: false },
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardUser {
  id: string
  name: string | null
  image: string | null
}

interface SubtaskItem {
  id: string
  title: string
  isCompleted: boolean
  position: number
}

interface LabelItem {
  id: string
  name: string
  color: string
}

interface CardLabelItem {
  cardId: string
  labelId: string
  label: LabelItem
}

interface CommentItem {
  id: string
  body: string
  createdAt: string
  updatedAt: string
  user: CardUser
}

interface ActivityItem {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
  user: CardUser
}

interface CardDetail {
  id: string
  title: string
  description: string | null
  status: string
  dueDate: string | null
  estimatedMinutes: number | null
  actualMinutes: number
  completedPomodoros: number
  subtasks: SubtaskItem[]
  labels: CardLabelItem[]
  comments: CommentItem[]
  activities: ActivityItem[]
}

interface BoardLabel {
  id: string
  name: string
  color: string
}

interface CardDetailModalProps {
  cardId: string
  boardId: string
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatActivityField(field: string): string {
  const map: Record<string, string> = {
    title: 'title',
    description: 'description',
    dueDate: 'due date',
    status: 'status',
    estimatedMinutes: 'estimated time',
  }
  return map[field] ?? field
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CardDetailModal({ cardId, boardId, onClose }: CardDetailModalProps) {
  const { toast } = useToast()

  const [card, setCard] = useState<CardDetail | null>(null)
  const [boardLabels, setBoardLabels] = useState<BoardLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch card + board labels
  // ---------------------------------------------------------------------------
  const fetchCard = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [cardRes, boardRes] = await Promise.all([
        fetch(`/api/cards/${cardId}`),
        fetch(`/api/boards/${boardId}`),
      ])
      if (!cardRes.ok) throw new Error(`Failed to load card (${cardRes.status})`)
      const cardData: CardDetail = await cardRes.json()
      setCard(cardData)

      if (boardRes.ok) {
        const boardData = await boardRes.json()
        setBoardLabels(boardData.labels ?? [])
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load card')
    } finally {
      setLoading(false)
    }
  }, [cardId, boardId])

  useEffect(() => {
    fetchCard()
  }, [fetchCard])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------
  if (loading) return <ModalShell onClose={onClose}><LoadingSkeleton /></ModalShell>
  if (fetchError || !card) {
    return (
      <ModalShell onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-red-400">{fetchError ?? 'Card not found'}</p>
          <button
            onClick={fetchCard}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Retry
          </button>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell onClose={onClose}>
      <CardDetailContent
        card={card}
        boardId={boardId}
        boardLabels={boardLabels}
        setCard={setCard}
        toast={toast}
      />
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// ModalShell — backdrop + panel
// ---------------------------------------------------------------------------

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Card detail"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 pt-12"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[oklch(0.12_0.022_265)] shadow-2xl shadow-black/60 mb-12">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close card detail"
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/8 hover:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LoadingSkeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 pt-8" aria-busy="true" aria-label="Loading card">
      <div className="h-7 w-2/3 animate-pulse rounded-lg bg-white/10" />
      <div className="h-32 animate-pulse rounded-xl bg-white/6" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// CardDetailContent — all editable sections
// ---------------------------------------------------------------------------

interface ContentProps {
  card: CardDetail
  boardId: string
  boardLabels: BoardLabel[]
  setCard: React.Dispatch<React.SetStateAction<CardDetail | null>>
  toast: (msg: string, variant?: 'default' | 'destructive') => void
}

function CardDetailContent({ card, boardId, boardLabels, setCard, toast }: ContentProps) {
  return (
    <div className="flex flex-col gap-0 divide-y divide-white/6">
      {/* Title */}
      <TitleSection card={card} setCard={setCard} toast={toast} />

      {/* Description */}
      <DescriptionSection card={card} setCard={setCard} toast={toast} />

      {/* Meta row: due date + labels */}
      <MetaSection card={card} boardId={boardId} boardLabels={boardLabels} setCard={setCard} toast={toast} />

      {/* Subtasks */}
      <SubtasksSection card={card} setCard={setCard} toast={toast} />

      {/* Comments */}
      <CommentsSection card={card} setCard={setCard} toast={toast} />

      {/* Activity log */}
      <ActivitySection activities={card.activities} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// TitleSection — inline editable title
// ---------------------------------------------------------------------------

function TitleSection({ card, setCard, toast }: Pick<ContentProps, 'card' | 'setCard' | 'toast'>) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(card.title)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === card.title) { setEditing(false); setValue(card.title); return }
    setSaving(true)
    const prev = card.title
    setCard((c) => c ? { ...c, title: trimmed } : c)
    setEditing(false)
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (!res.ok) throw new Error('Failed to update title')
    } catch {
      setCard((c) => c ? { ...c, title: prev } : c)
      setValue(prev)
      toast('Failed to update title', 'destructive')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-6 pt-6 pb-4 pr-12">
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { setEditing(false); setValue(card.title) }
          }}
          aria-label="Card title"
          className="w-full rounded-lg border border-violet-500/40 bg-white/5 px-2 py-1 text-xl font-semibold text-white outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          aria-label="Edit card title"
          className="group flex w-full items-start gap-2 text-left"
        >
          <h2 className="flex-1 text-xl font-semibold text-white group-hover:text-white/80">
            {card.title}
          </h2>
          {saving ? (
            <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-[oklch(0.45_0.03_265)]" aria-hidden="true" />
          ) : (
            <Pencil className="mt-1 size-3.5 shrink-0 text-[oklch(0.35_0.02_265)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DescriptionSection — @uiw/react-md-editor edit/preview toggle
// ---------------------------------------------------------------------------

function DescriptionSection({ card, setCard, toast }: Pick<ContentProps, 'card' | 'setCard' | 'toast'>) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(card.description ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    const trimmed = value.trim() || null
    const prev = card.description
    setCard((c) => c ? { ...c, description: trimmed } : c)
    setEditing(false)
    setSaving(true)
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmed }),
      })
      if (!res.ok) throw new Error('Failed to update description')
    } catch {
      setCard((c) => c ? { ...c, description: prev } : c)
      setValue(prev ?? '')
      toast('Failed to update description', 'destructive')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setValue(card.description ?? '')
    setEditing(false)
  }

  return (
    <div className="px-6 py-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
          Description
        </span>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            aria-label="Edit description"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/6 hover:text-white"
          >
            <Pencil className="size-3" aria-hidden="true" />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2" data-color-mode="dark">
          <MDEditor
            value={value}
            onChange={(v) => setValue(v ?? '')}
            preview="edit"
            height={200}
            aria-label="Card description editor"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Check className="size-3" aria-hidden="true" />}
              Save
            </button>
            <button
              onClick={cancel}
              className="rounded-lg px-3 py-1.5 text-xs text-[oklch(0.56_0.04_265)] transition-colors hover:bg-white/6 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : card.description ? (
        <div
          className="prose prose-invert prose-sm max-w-none cursor-pointer rounded-xl border border-transparent p-2 transition-colors hover:border-white/8 hover:bg-white/3"
          onClick={() => setEditing(true)}
          data-color-mode="dark"
          aria-label="Card description, click to edit"
        >
          <MDPreview source={card.description} />
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full rounded-xl border border-dashed border-white/10 px-3 py-4 text-left text-sm text-[oklch(0.38_0.02_265)] transition-colors hover:border-white/20 hover:bg-white/3 hover:text-[oklch(0.56_0.04_265)]"
        >
          Add a description…
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MetaSection — due date + labels
// ---------------------------------------------------------------------------

function MetaSection({ card, boardId, boardLabels, setCard, toast }: ContentProps) {
  return (
    <div className="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-2">
      <DueDateField card={card} setCard={setCard} toast={toast} />
      <LabelsField card={card} boardId={boardId} boardLabels={boardLabels} setCard={setCard} toast={toast} />
    </div>
  )
}

// --- Due date ---

function DueDateField({ card, setCard, toast }: Pick<ContentProps, 'card' | 'setCard' | 'toast'>) {
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const newDate = raw ? new Date(raw + 'T00:00:00').toISOString() : null
    const prev = card.dueDate
    setCard((c) => c ? { ...c, dueDate: newDate } : c)
    setSaving(true)
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: newDate }),
      })
      if (!res.ok) throw new Error('Failed to update due date')
    } catch {
      setCard((c) => c ? { ...c, dueDate: prev } : c)
      toast('Failed to update due date', 'destructive')
    } finally {
      setSaving(false)
    }
  }

  const isOverdue =
    card.dueDate !== null &&
    new Date(card.dueDate).getTime() < Date.now() &&
    !['DONE', 'CANCELLED'].includes(card.status)

  return (
    <div>
      <label
        htmlFor={`due-date-${card.id}`}
        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)]"
      >
        <CalendarDays className="size-3.5" aria-hidden="true" />
        Due date
        {saving && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
      </label>
      <input
        id={`due-date-${card.id}`}
        type="date"
        value={toDateInputValue(card.dueDate)}
        onChange={handleChange}
        aria-label="Card due date"
        className={cn(
          'w-full rounded-lg border bg-white/5 px-3 py-2 text-sm outline-none transition-colors',
          'focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20',
          isOverdue
            ? 'border-red-500/40 text-red-400'
            : 'border-white/10 text-white',
        )}
      />
    </div>
  )
}

// --- Labels ---

function LabelsField({ card, boardId, boardLabels, setCard, toast }: ContentProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [createError, setCreateError] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const attachedIds = new Set(card.labels.map((cl) => cl.labelId))

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  async function toggleLabel(label: BoardLabel) {
    const isAttached = attachedIds.has(label.id)
    if (isAttached) {
      // Detach
      const prev = card.labels
      setCard((c) => c ? { ...c, labels: c.labels.filter((cl) => cl.labelId !== label.id) } : c)
      try {
        const res = await fetch(`/api/cards/${card.id}/labels/${label.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error()
      } catch {
        setCard((c) => c ? { ...c, labels: prev } : c)
        toast('Failed to remove label', 'destructive')
      }
    } else {
      // Attach
      const optimistic: CardLabelItem = { cardId: card.id, labelId: label.id, label }
      const prev = card.labels
      setCard((c) => c ? { ...c, labels: [...c.labels, optimistic] } : c)
      try {
        const res = await fetch(`/api/cards/${card.id}/labels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labelId: label.id }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setCard((c) => c ? { ...c, labels: prev } : c)
        toast('Failed to add label', 'destructive')
      }
    }
  }

  async function createLabel(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreateError(null)
    try {
      const res = await fetch(`/api/boards/${boardId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newColor }),
      })
      if (!res.ok) {
        const data = await res.json()
        setCreateError(data.fields?.name ?? data.error ?? 'Failed to create label')
        return
      }
      const created: BoardLabel = await res.json()
      boardLabels.push(created)
      setNewName('')
      setCreating(false)
    } catch {
      setCreateError('Network error')
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
        <Tag className="size-3.5" aria-hidden="true" />
        Labels
      </div>

      {/* Attached labels */}
      <div className="flex flex-wrap gap-1.5 mb-2" aria-label="Attached labels">
        {card.labels.map(({ label }) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white/90"
            style={{ background: label.color + '33', border: `1px solid ${label.color}55` }}
          >
            {label.name}
          </span>
        ))}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker((v) => !v)}
            aria-label="Manage labels"
            aria-expanded={showPicker}
            className="flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2 py-0.5 text-xs text-[oklch(0.45_0.03_265)] transition-colors hover:border-white/25 hover:text-white"
          >
            <Plus className="size-3" aria-hidden="true" />
            Add
          </button>

          {showPicker && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-white/10 bg-[oklch(0.14_0.022_265)] p-2 shadow-xl">
              {boardLabels.length === 0 && !creating && (
                <p className="px-2 py-1 text-xs text-[oklch(0.45_0.03_265)]">No labels yet</p>
              )}
              {boardLabels.map((label) => (
                <button
                  key={label.id}
                  onClick={() => toggleLabel(label)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/6"
                  aria-pressed={attachedIds.has(label.id)}
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: label.color }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate text-left text-white">{label.name}</span>
                  {attachedIds.has(label.id) && (
                    <Check className="size-3.5 shrink-0 text-violet-400" aria-hidden="true" />
                  )}
                </button>
              ))}

              {creating ? (
                <form onSubmit={createLabel} className="mt-1 flex flex-col gap-1.5 border-t border-white/8 pt-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Label name"
                    maxLength={50}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-[oklch(0.35_0.02_265)] outline-none focus:border-violet-500/40"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      aria-label="Label color"
                      className="h-7 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
                    />
                    <button type="submit" className="flex-1 rounded-lg bg-violet-600 py-1 text-xs font-medium text-white hover:bg-violet-500">
                      Create
                    </button>
                    <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-2 py-1 text-xs text-[oklch(0.45_0.03_265)] hover:text-white">
                      Cancel
                    </button>
                  </div>
                  {createError && <p className="text-xs text-red-400">{createError}</p>}
                </form>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="mt-1 flex w-full items-center gap-1.5 rounded-lg border-t border-white/8 px-2 pt-2 pb-1 text-xs text-[oklch(0.45_0.03_265)] transition-colors hover:text-white"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  New label
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SubtasksSection
// ---------------------------------------------------------------------------

function SubtasksSection({ card, setCard, toast }: Pick<ContentProps, 'card' | 'setCard' | 'toast'>) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const completed = card.subtasks.filter((s) => s.isCompleted).length
  const total = card.subtasks.length

  async function handleToggle(subtask: SubtaskItem) {
    const prev = card.subtasks
    setCard((c) => c ? {
      ...c,
      subtasks: c.subtasks.map((s) =>
        s.id === subtask.id ? { ...s, isCompleted: !s.isCompleted } : s
      ),
    } : c)
    try {
      const res = await fetch(`/api/subtasks/${subtask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !subtask.isCompleted }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setCard((c) => c ? { ...c, subtasks: prev } : c)
      toast('Failed to update subtask', 'destructive')
    }
  }

  async function handleDelete(subtaskId: string) {
    const prev = card.subtasks
    setCard((c) => c ? { ...c, subtasks: c.subtasks.filter((s) => s.id !== subtaskId) } : c)
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setCard((c) => c ? { ...c, subtasks: prev } : c)
      toast('Failed to delete subtask', 'destructive')
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setSubmitting(true)
    setAddError(null)
    try {
      const res = await fetch(`/api/cards/${card.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) {
        const data = await res.json()
        setAddError(data.fields?.title ?? data.error ?? 'Failed to add subtask')
        return
      }
      const created: SubtaskItem = await res.json()
      setCard((c) => c ? { ...c, subtasks: [...c.subtasks, created] } : c)
      setNewTitle('')
      setAdding(false)
    } catch {
      setAddError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="size-3.5 text-[oklch(0.45_0.03_265)]" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
            Subtasks
          </span>
          {total > 0 && (
            <span className={cn(
              'rounded-md px-1.5 py-0.5 text-xs tabular-nums',
              completed === total ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/6 text-[oklch(0.56_0.04_265)]',
            )}>
              {completed}/{total}
            </span>
          )}
        </div>
        <button
          onClick={() => setAdding(true)}
          aria-label="Add subtask"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/6 hover:text-white"
        >
          <Plus className="size-3" aria-hidden="true" />
          Add
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/8" aria-hidden="true">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      )}

      {/* Subtask list */}
      <ul className="flex flex-col gap-1" aria-label="Subtasks">
        {card.subtasks.map((subtask) => (
          <li key={subtask.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/4">
            <button
              onClick={() => handleToggle(subtask)}
              aria-label={subtask.isCompleted ? `Mark "${subtask.title}" incomplete` : `Mark "${subtask.title}" complete`}
              aria-pressed={subtask.isCompleted}
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                subtask.isCompleted
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                  : 'border-white/20 bg-transparent hover:border-white/40',
              )}
            >
              {subtask.isCompleted && <Check className="size-2.5" aria-hidden="true" />}
            </button>
            <span className={cn(
              'flex-1 text-sm',
              subtask.isCompleted ? 'text-[oklch(0.45_0.03_265)] line-through' : 'text-white',
            )}>
              {subtask.title}
            </span>
            <button
              onClick={() => handleDelete(subtask.id)}
              aria-label={`Delete subtask "${subtask.title}"`}
              className="rounded p-0.5 text-[oklch(0.35_0.02_265)] opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {/* Add subtask form */}
      {adding && (
        <form onSubmit={handleAdd} className="mt-2 flex flex-col gap-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setNewTitle('') } }}
            placeholder="Subtask title…"
            maxLength={500}
            aria-label="New subtask title"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-[oklch(0.35_0.02_265)] outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
          />
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !newTitle.trim()}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add subtask'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setNewTitle(''); setAddError(null) }}
              className="rounded-lg px-3 py-1.5 text-xs text-[oklch(0.56_0.04_265)] hover:bg-white/6 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CommentsSection
// ---------------------------------------------------------------------------

function CommentsSection({ card, setCard, toast }: Pick<ContentProps, 'card' | 'setCard' | 'toast'>) {
  const [newBody, setNewBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    const body = newBody.trim()
    if (!body) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/cards/${card.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.fields?.body ?? data.error ?? 'Failed to post comment')
        return
      }
      const created: CommentItem = await res.json()
      setCard((c) => c ? { ...c, comments: [...c.comments, created] } : c)
      setNewBody('')
    } catch {
      setSubmitError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center gap-1.5">
        <MessageSquare className="size-3.5 text-[oklch(0.45_0.03_265)]" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
          Comments
        </span>
        {card.comments.length > 0 && (
          <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-xs tabular-nums text-[oklch(0.56_0.04_265)]">
            {card.comments.length}
          </span>
        )}
      </div>

      {/* Comment list */}
      <ul className="flex flex-col gap-4 mb-4" aria-label="Comments">
        {card.comments.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            cardId={card.id}
            setCard={setCard}
            toast={toast}
          />
        ))}
      </ul>

      {/* New comment form */}
      <form onSubmit={handlePost} className="flex flex-col gap-2">
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="Write a comment…"
          rows={3}
          aria-label="New comment"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-[oklch(0.35_0.02_265)] outline-none transition-colors focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
        />
        {submitError && <p className="text-xs text-red-400">{submitError}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !newBody.trim()}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {submitting ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </form>
    </div>
  )
}

// --- Single comment row ---

interface CommentRowProps {
  comment: CommentItem
  cardId: string
  setCard: React.Dispatch<React.SetStateAction<CardDetail | null>>
  toast: (msg: string, variant?: 'default' | 'destructive') => void
}

function CommentRow({ comment, cardId, setCard, toast }: CommentRowProps) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [saving, setSaving] = useState(false)

  async function saveEdit() {
    const body = editBody.trim()
    if (!body || body === comment.body) { setEditing(false); return }
    setSaving(true)
    const prev = comment.body
    setCard((c) => c ? {
      ...c,
      comments: c.comments.map((cm) => cm.id === comment.id ? { ...cm, body } : cm),
    } : c)
    setEditing(false)
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setCard((c) => c ? {
        ...c,
        comments: c.comments.map((cm) => cm.id === comment.id ? { ...cm, body: prev } : cm),
      } : c)
      setEditBody(prev)
      toast('Failed to update comment', 'destructive')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const prev = { cardId, comments: [] as CommentItem[] }
    setCard((c) => {
      if (!c) return c
      prev.comments = c.comments
      return { ...c, comments: c.comments.filter((cm) => cm.id !== comment.id) }
    })
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setCard((c) => c ? { ...c, comments: prev.comments } : c)
      toast('Failed to delete comment', 'destructive')
    }
  }

  const initials = comment.user.name
    ? comment.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <li className="group flex gap-3">
      {/* Avatar */}
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600/30 text-xs font-semibold text-violet-300"
        aria-hidden="true"
      >
        {comment.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.user.image} alt="" className="size-7 rounded-full object-cover" />
        ) : initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-medium text-white">{comment.user.name ?? 'Unknown'}</span>
          <time
            dateTime={comment.createdAt}
            className="text-xs text-[oklch(0.45_0.03_265)]"
          >
            {formatDateTime(comment.createdAt)}
          </time>
          {comment.updatedAt !== comment.createdAt && (
            <span className="text-xs text-[oklch(0.38_0.02_265)]">(edited)</span>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); setEditBody(comment.body) } }}
              rows={3}
              aria-label="Edit comment"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
            />
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditBody(comment.body) }}
                className="rounded-lg px-3 py-1 text-xs text-[oklch(0.56_0.04_265)] hover:bg-white/6 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[oklch(0.88_0.01_265)] whitespace-pre-wrap break-words">
            {comment.body}
          </p>
        )}
      </div>

      {/* Edit / delete actions */}
      {!editing && (
        <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setEditing(true)}
            aria-label="Edit comment"
            className="rounded p-1 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/6 hover:text-white"
          >
            <Pencil className="size-3" aria-hidden="true" />
          </button>
          <button
            onClick={handleDelete}
            aria-label="Delete comment"
            className="rounded p-1 text-[oklch(0.45_0.03_265)] transition-colors hover:bg-white/6 hover:text-red-400"
          >
            <Trash2 className="size-3" aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// ActivitySection — chronological field-change log
// ---------------------------------------------------------------------------

function ActivitySection({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) return null

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Activity className="size-3.5 text-[oklch(0.45_0.03_265)]" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
          Activity
        </span>
      </div>

      <ul className="flex flex-col gap-2" aria-label="Activity log">
        {activities.map((activity) => (
          <li key={activity.id} className="flex items-start gap-2 text-xs text-[oklch(0.56_0.04_265)]">
            <div
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/6 text-[10px] font-semibold text-[oklch(0.56_0.04_265)]"
              aria-hidden="true"
            >
              {activity.user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-[oklch(0.75_0.02_265)]">
                {activity.user.name ?? 'Someone'}
              </span>
              {' changed '}
              <span className="font-medium text-[oklch(0.75_0.02_265)]">
                {formatActivityField(activity.field)}
              </span>
              {activity.oldValue !== null && (
                <>
                  {' from '}
                  <span className="rounded bg-white/6 px-1 font-mono text-[oklch(0.65_0.03_265)]">
                    {truncate(activity.oldValue, 40)}
                  </span>
                </>
              )}
              {activity.newValue !== null && (
                <>
                  {' to '}
                  <span className="rounded bg-white/6 px-1 font-mono text-[oklch(0.65_0.03_265)]">
                    {truncate(activity.newValue, 40)}
                  </span>
                </>
              )}
            </div>
            <time
              dateTime={activity.createdAt}
              className="shrink-0 text-[oklch(0.38_0.02_265)]"
            >
              {formatDateTime(activity.createdAt)}
            </time>
          </li>
        ))}
      </ul>
    </div>
  )
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}
