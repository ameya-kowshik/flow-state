'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { LayoutList, ChevronDown, Search, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimer } from '@/contexts/TimerContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskCard {
  id: string
  title: string
  status: string
  dueDate: string | null
  board: { id: string; name: string; color: string }
  column: { id: string; name: string }
}

// ---------------------------------------------------------------------------
// TaskPicker
// ---------------------------------------------------------------------------
// Searchable dropdown listing all non-archived, non-terminal cards.
// Shows board name + column name as context.
// Wires into TimerContext via setSelectedTaskId.
// Requirements: 16.1

interface TaskPickerProps {
  className?: string
}

export function TaskPicker({ className }: TaskPickerProps) {
  const { selectedTaskId, setSelectedTaskId } = useTimer()

  const [tasks, setTasks] = useState<TaskCard[]>([])
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // -------------------------------------------------------------------------
  // Fetch tasks
  // -------------------------------------------------------------------------
  const fetchTasks = useCallback(async () => {
    setLoadStatus('loading')
    try {
      const res = await fetch('/api/cards/tasks')
      if (!res.ok) throw new Error('Failed to load tasks')
      const data = (await res.json()) as TaskCard[]
      setTasks(data)
      setLoadStatus('idle')
    } catch {
      setLoadStatus('error')
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // -------------------------------------------------------------------------
  // Close on outside click
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
  // Close on Escape, focus search on open
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    // Focus the search input when the dropdown opens
    setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // -------------------------------------------------------------------------
  // Clear selected task if it no longer exists in the list
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (selectedTaskId && loadStatus === 'idle') {
      const stillExists = tasks.some((t) => t.id === selectedTaskId)
      if (!stillExists) setSelectedTaskId(null)
    }
  }, [tasks, selectedTaskId, loadStatus, setSelectedTaskId])

  // -------------------------------------------------------------------------
  // Filtered tasks
  // -------------------------------------------------------------------------
  const filtered = query.trim()
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.board.name.toLowerCase().includes(query.toLowerCase()) ||
          t.column.name.toLowerCase().includes(query.toLowerCase()),
      )
    : tasks

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const toggle = useCallback(() => {
    setOpen((v) => {
      if (!v) setQuery('')
      return !v
    })
  }, [])

  const pick = useCallback(
    (id: string | null) => {
      setSelectedTaskId(id)
      setOpen(false)
      setQuery('')
    },
    [setSelectedTaskId],
  )

  const clearSelection = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedTaskId(null)
    },
    [setSelectedTaskId],
  )

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------
  const selected = tasks.find((t) => t.id === selectedTaskId) ?? null

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
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
          <LayoutList className="size-4 shrink-0" aria-hidden="true" />
        )}

        <span className="flex-1 truncate text-left">
          {selected ? (
            <span className="flex items-center gap-2">
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: selected.board.color }}
                aria-hidden="true"
              />
              <span className="truncate">{selected.title}</span>
            </span>
          ) : (
            'Link a task'
          )}
        </span>

        {selected ? (
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Clear selected task"
            className="rounded p-0.5 text-[oklch(0.45_0.03_265)] hover:text-white transition-colors"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : (
          <ChevronDown
            className={cn(
              'size-4 shrink-0 transition-transform duration-150',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            'absolute z-20 mt-1 w-full rounded-xl border border-white/10',
            'bg-[oklch(0.14_0.025_265)] shadow-xl shadow-black/40',
            'flex flex-col',
          )}
          style={{ maxHeight: '320px' }}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
            <Search className="size-3.5 shrink-0 text-[oklch(0.45_0.03_265)]" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className={cn(
                'flex-1 bg-transparent text-sm text-white placeholder:text-[oklch(0.45_0.03_265)]',
                'outline-none',
              )}
              aria-label="Search tasks"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="text-[oklch(0.45_0.03_265)] hover:text-white transition-colors"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* List */}
          <ul
            role="listbox"
            aria-label="Tasks"
            className="overflow-y-auto py-1"
            style={{ maxHeight: '260px' }}
          >
            {/* No task option */}
            <li>
              <button
                role="option"
                aria-selected={selectedTaskId === null}
                onClick={() => pick(null)}
                className={cn(
                  'flex w-full items-center gap-2 px-4 py-2 text-sm',
                  'transition-colors hover:bg-white/6',
                  selectedTaskId === null
                    ? 'text-violet-300'
                    : 'text-[oklch(0.56_0.04_265)]',
                )}
              >
                <span
                  className="size-2 rounded-full border border-white/20 shrink-0"
                  aria-hidden="true"
                />
                No task
              </button>
            </li>

            {/* Error state */}
            {loadStatus === 'error' && (
              <li className="px-4 py-2 text-xs text-red-400">
                Failed to load tasks.{' '}
                <button
                  type="button"
                  onClick={fetchTasks}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  Retry
                </button>
              </li>
            )}

            {/* Task options */}
            {filtered.map((task) => (
              <li key={task.id}>
                <button
                  role="option"
                  aria-selected={selectedTaskId === task.id}
                  onClick={() => pick(task.id)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 px-4 py-2 text-left',
                    'transition-colors hover:bg-white/6',
                    selectedTaskId === task.id ? 'bg-white/4' : '',
                  )}
                >
                  <span
                    className={cn(
                      'truncate text-sm leading-snug',
                      selectedTaskId === task.id ? 'text-white' : 'text-[oklch(0.88_0.01_265)]',
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-[oklch(0.45_0.03_265)]">
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: task.board.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {task.board.name} · {task.column.name}
                    </span>
                  </span>
                </button>
              </li>
            ))}

            {/* Empty state */}
            {loadStatus === 'idle' && filtered.length === 0 && (
              <li className="px-4 py-3 text-xs text-[oklch(0.45_0.03_265)]">
                {query ? 'No tasks match your search.' : 'No active tasks found.'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
