'use client'

import { useState, useCallback } from 'react'
import { useTimer } from '@/contexts/TimerContext'
import { requestNotificationPermission } from '@/lib/audio'
import { cn } from '@/lib/utils'
import { Save, Check, AlertCircle } from 'lucide-react'

interface SettingsFormState {
  focusDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  longBreakInterval: number
  soundEnabled: boolean
  notificationsEnabled: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function SettingsPage() {
  const {
    settings,
    soundEnabled,
    notificationsEnabled,
    setSettings,
    setSoundEnabled,
    setNotificationsEnabled,
  } = useTimer()

  const [form, setForm] = useState<SettingsFormState>({
    focusDuration: settings.focusDuration,
    shortBreakDuration: settings.shortBreakDuration,
    longBreakDuration: settings.longBreakDuration,
    longBreakInterval: settings.longBreakInterval,
    soundEnabled,
    notificationsEnabled,
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleDurationChange = useCallback(
    (field: keyof Pick<SettingsFormState, 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'longBreakInterval'>) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = parseInt(e.target.value, 10)
        const value = Number.isNaN(raw) ? 1 : Math.max(1, raw)
        setForm((prev) => ({ ...prev, [field]: value }))
      },
    [],
  )

  const handleToggle = useCallback(
    (field: 'soundEnabled' | 'notificationsEnabled') => async () => {
      const next = !form[field]
      setForm((prev) => ({ ...prev, [field]: next }))
      if (field === 'notificationsEnabled' && next) {
        const permission = await requestNotificationPermission()
        if (permission !== 'granted') {
          setForm((prev) => ({ ...prev, notificationsEnabled: false }))
        }
      }
    },
    [form],
  )

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    setErrorMessage(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMessage(typeof data?.error === 'string' ? data.error : `Failed to save (${res.status})`)
        setSaveStatus('error')
        return
      }
      setSettings({ focusDuration: form.focusDuration, shortBreakDuration: form.shortBreakDuration, longBreakDuration: form.longBreakDuration, longBreakInterval: form.longBreakInterval })
      setSoundEnabled(form.soundEnabled)
      setNotificationsEnabled(form.notificationsEnabled)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setErrorMessage('Network error — please try again.')
      setSaveStatus('error')
    }
  }, [form, setSettings, setSoundEnabled, setNotificationsEnabled])

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-[oklch(0.56_0.04_265)]">
          Configure your timer and notification preferences.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Timer durations */}
        <Section title="Timer durations" description="Set the default length of each phase in minutes.">
          <DurationField id="focusDuration" label="Focus" description="Length of a focus phase" value={form.focusDuration} onChange={handleDurationChange('focusDuration')} accent="amber" />
          <Divider />
          <DurationField id="shortBreakDuration" label="Short break" description="Length of a short break" value={form.shortBreakDuration} onChange={handleDurationChange('shortBreakDuration')} accent="violet" />
          <Divider />
          <DurationField id="longBreakDuration" label="Long break" description="Length of a long break" value={form.longBreakDuration} onChange={handleDurationChange('longBreakDuration')} accent="indigo" />
          <Divider />
          <DurationField id="longBreakInterval" label="Long break interval" description="Focus phases before a long break" value={form.longBreakInterval} onChange={handleDurationChange('longBreakInterval')} unit="phases" accent="violet" />
        </Section>

        {/* Notifications */}
        <Section title="Notifications" description="Control how the app alerts you at phase transitions.">
          <ToggleRow id="soundEnabled" label="Sound" description="Play a tone when a phase ends" checked={form.soundEnabled} onToggle={handleToggle('soundEnabled')} />
          <Divider />
          <ToggleRow id="notificationsEnabled" label="Browser notifications" description="Send a browser notification at each phase transition" checked={form.notificationsEnabled} onToggle={handleToggle('notificationsEnabled')} />
        </Section>

        {/* Save */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={cn(
              'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold',
              'bg-gradient-to-r from-violet-600 to-indigo-600 text-white',
              'shadow-lg shadow-violet-500/20 transition-all duration-150',
              'hover:from-violet-500 hover:to-indigo-500',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
              'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]',
            )}
          >
            <Save className="size-4" aria-hidden="true" />
            {saveStatus === 'saving' ? 'Saving…' : 'Save settings'}
          </button>

          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400" role="status">
              <Check className="size-4" />
              Saved
            </span>
          )}
          {saveStatus === 'error' && errorMessage && (
            <span className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
              <AlertCircle className="size-4" />
              {errorMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[oklch(0.14_0.025_265)] overflow-hidden">
      <div className="border-b border-white/6 px-6 py-4">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <p className="mt-0.5 text-xs text-[oklch(0.56_0.04_265)]">{description}</p>
      </div>
      <div className="flex flex-col px-6 py-2">{children}</div>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-white/5" />
}

const ACCENT_COLORS: Record<string, string> = {
  amber:  'focus:ring-amber-500/40 focus:border-amber-500/40',
  violet: 'focus:ring-violet-500/40 focus:border-violet-500/40',
  indigo: 'focus:ring-indigo-500/40 focus:border-indigo-500/40',
}

function DurationField({
  id, label, description, value, onChange, unit = 'min', accent = 'violet',
}: {
  id: string; label: string; description: string; value: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  unit?: string; accent?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-[oklch(0.88_0.01_265)]">{label}</label>
        <p className="mt-0.5 text-xs text-[oklch(0.45_0.03_265)]">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          id={id}
          type="number"
          min={1}
          max={999}
          value={value}
          onChange={onChange}
          className={cn(
            'w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5',
            'text-sm text-white text-center tabular-nums',
            'transition-colors outline-none',
            'focus:ring-2 focus:bg-white/8',
            ACCENT_COLORS[accent] ?? ACCENT_COLORS.violet,
          )}
          aria-label={`${label} duration`}
        />
        <span className="w-10 text-xs text-[oklch(0.45_0.03_265)]">{unit}</span>
      </div>
    </div>
  )
}

function ToggleRow({
  id, label, description, checked, onToggle,
}: {
  id: string; label: string; description: string; checked: boolean; onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-[oklch(0.88_0.01_265)]">{label}</label>
        <p className="mt-0.5 text-xs text-[oklch(0.45_0.03_265)]">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
          'border-2 border-transparent transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
          checked ? 'bg-violet-600' : 'bg-white/10',
        )}
      >
        <span className="sr-only">Toggle {label}</span>
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm',
            'transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}
