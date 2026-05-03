'use client'

import { useState, useCallback } from 'react'
import { TimerDisplay } from '@/components/timer/TimerDisplay'
import { useTimer } from '@/contexts/TimerContext'
import { cn } from '@/lib/utils'
import { Settings2, Tag, ChevronDown } from 'lucide-react'

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

function SettingsPanel() {
  const { settings, setSettings } = useTimer()

  const handleChange =
    (field: 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'longBreakInterval') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10)
      const value = Number.isNaN(raw) ? 1 : Math.max(1, raw)
      setSettings({ [field]: value })
    }

  return (
    <div className="w-full rounded-2xl border border-white/8 bg-[oklch(0.14_0.025_265)] overflow-hidden">
      <div className="border-b border-white/6 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)]">
          Timer settings
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/5">
        <DurationField
          id="focus-focus"
          label="Focus"
          value={settings.focusDuration}
          onChange={handleChange('focusDuration')}
          accent="amber"
        />
        <DurationField
          id="focus-short"
          label="Short break"
          value={settings.shortBreakDuration}
          onChange={handleChange('shortBreakDuration')}
          accent="violet"
        />
        <DurationField
          id="focus-long"
          label="Long break"
          value={settings.longBreakDuration}
          onChange={handleChange('longBreakDuration')}
          accent="indigo"
        />
        <DurationField
          id="focus-interval"
          label="Long break every"
          value={settings.longBreakInterval}
          onChange={handleChange('longBreakInterval')}
          unit="sessions"
          accent="violet"
        />
      </div>
    </div>
  )
}

const ACCENT_RING: Record<string, string> = {
  amber:  'focus:ring-amber-500/40 focus:border-amber-500/40',
  violet: 'focus:ring-violet-500/40 focus:border-violet-500/40',
  indigo: 'focus:ring-indigo-500/40 focus:border-indigo-500/40',
}

function DurationField({
  id,
  label,
  value,
  onChange,
  unit = 'min',
  accent = 'violet',
}: {
  id: string
  label: string
  value: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  unit?: string
  accent?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-[oklch(0.14_0.025_265)] px-4 py-3">
      <label htmlFor={id} className="text-xs text-[oklch(0.56_0.04_265)]">
        {label}
      </label>
      <div className="flex items-baseline gap-1.5">
        <input
          id={id}
          type="number"
          min={1}
          max={999}
          value={value}
          onChange={onChange}
          className={cn(
            'w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1',
            'text-sm font-medium text-white text-center tabular-nums',
            'outline-none transition-colors focus:ring-2 focus:bg-white/8',
            ACCENT_RING[accent] ?? ACCENT_RING.violet,
          )}
          aria-label={`${label} duration`}
        />
        <span className="text-xs text-[oklch(0.45_0.03_265)]">{unit}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tag selector stub
// ---------------------------------------------------------------------------

// Stub tag list — replaced in Phase 3 when the Tags API is implemented.
const STUB_TAGS = [
  { id: 'deep-work',  name: 'Deep work',  color: '#a78bfa' },
  { id: 'learning',   name: 'Learning',   color: '#34d399' },
  { id: 'admin',      name: 'Admin',      color: '#fb923c' },
  { id: 'planning',   name: 'Planning',   color: '#60a5fa' },
]

function TagSelector() {
  const { selectedTagId, setSelectedTagId } = useTimer()
  const [open, setOpen] = useState(false)

  const selected = STUB_TAGS.find((t) => t.id === selectedTagId) ?? null

  const toggle = useCallback(() => setOpen((v) => !v), [])

  const pick = useCallback(
    (id: string | null) => {
      setSelectedTagId(id)
      setOpen(false)
    },
    [setSelectedTagId],
  )

  return (
    <div className="relative w-full">
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
        <Tag className="size-4 shrink-0" aria-hidden="true" />
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
          className={cn('size-4 shrink-0 transition-transform duration-150', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Tags"
          className={cn(
            'absolute z-20 mt-1 w-full rounded-xl border border-white/10',
            'bg-[oklch(0.14_0.025_265)] py-1 shadow-xl shadow-black/40',
          )}
        >
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
              <span className="size-2.5 rounded-full border border-white/20 shrink-0" aria-hidden="true" />
              No tag
            </button>
          </li>
          {STUB_TAGS.map((tag) => (
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
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Focus page
// ---------------------------------------------------------------------------

export default function FocusPage() {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="flex h-full min-h-screen flex-col items-center justify-center gap-8 px-6 py-12">
      {/* Timer */}
      <TimerDisplay />

      {/* Controls row: tag selector + settings toggle */}
      <div className="flex w-full max-w-sm flex-col gap-3">
        {/* Tag selector */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[oklch(0.45_0.03_265)]">Tag</span>
          <TagSelector />
        </div>

        {/* Settings toggle */}
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
          aria-controls="focus-settings-panel"
          className={cn(
            'flex items-center gap-2 self-start rounded-lg px-3 py-1.5 text-xs font-medium',
            'border border-white/8 transition-colors duration-150',
            showSettings
              ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
              : 'bg-white/4 text-[oklch(0.56_0.04_265)] hover:bg-white/6 hover:text-[oklch(0.88_0.01_265)]',
          )}
        >
          <Settings2 className="size-3.5" aria-hidden="true" />
          {showSettings ? 'Hide settings' : 'Timer settings'}
        </button>

        {/* Collapsible settings panel */}
        {showSettings && (
          <div id="focus-settings-panel">
            <SettingsPanel />
          </div>
        )}
      </div>
    </div>
  )
}
