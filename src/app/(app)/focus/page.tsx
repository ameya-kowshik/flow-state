'use client'

import { useState } from 'react'
import { TimerDisplay } from '@/components/timer/TimerDisplay'
import { TagSelector } from '@/components/tags/TagSelector'
import { useTimer } from '@/contexts/TimerContext'
import { cn } from '@/lib/utils'
import { Settings2 } from 'lucide-react'

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
