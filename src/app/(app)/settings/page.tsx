'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTimer } from '@/contexts/TimerContext'
import { requestNotificationPermission } from '@/lib/audio'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

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

  // Keep form in sync if context values change (e.g. after server-side hydration)
  useEffect(() => {
    setForm({
      focusDuration: settings.focusDuration,
      shortBreakDuration: settings.shortBreakDuration,
      longBreakDuration: settings.longBreakDuration,
      longBreakInterval: settings.longBreakInterval,
      soundEnabled,
      notificationsEnabled,
    })
  }, [settings, soundEnabled, notificationsEnabled])

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

      // When enabling notifications, request browser permission immediately
      if (field === 'notificationsEnabled' && next) {
        const permission = await requestNotificationPermission()
        if (permission !== 'granted') {
          // Permission denied — revert the toggle
          setForm((prev) => ({ ...prev, notificationsEnabled: false }))
          return
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
        const msg =
          typeof data?.error === 'string'
            ? data.error
            : `Failed to save settings (${res.status})`
        setErrorMessage(msg)
        setSaveStatus('error')
        return
      }

      // Sync the saved values back into TimerContext immediately
      setSettings({
        focusDuration: form.focusDuration,
        shortBreakDuration: form.shortBreakDuration,
        longBreakDuration: form.longBreakDuration,
        longBreakInterval: form.longBreakInterval,
      })
      setSoundEnabled(form.soundEnabled)
      setNotificationsEnabled(form.notificationsEnabled)

      setSaveStatus('saved')
      // Reset status indicator after 2 s
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setErrorMessage('Network error — please try again.')
      setSaveStatus('error')
    }
  }, [form, setSettings, setSoundEnabled, setNotificationsEnabled])

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your Pomodoro timer and notification preferences.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* ── Pomodoro Durations ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Timer durations</CardTitle>
            <CardDescription>
              Set the default length of each phase in minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <DurationField
              id="focusDuration"
              label="Focus"
              description="Length of a focus phase"
              value={form.focusDuration}
              onChange={handleDurationChange('focusDuration')}
            />
            <Separator />
            <DurationField
              id="shortBreakDuration"
              label="Short break"
              description="Length of a short break"
              value={form.shortBreakDuration}
              onChange={handleDurationChange('shortBreakDuration')}
            />
            <Separator />
            <DurationField
              id="longBreakDuration"
              label="Long break"
              description="Length of a long break"
              value={form.longBreakDuration}
              onChange={handleDurationChange('longBreakDuration')}
            />
            <Separator />
            <DurationField
              id="longBreakInterval"
              label="Long break interval"
              description="Number of focus phases before a long break"
              value={form.longBreakInterval}
              onChange={handleDurationChange('longBreakInterval')}
              unit="phases"
            />
          </CardContent>
        </Card>

        {/* ── Notifications ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Control how the app alerts you at phase transitions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ToggleRow
              id="soundEnabled"
              label="Sound"
              description="Play a tone when a phase ends"
              checked={form.soundEnabled}
              onToggle={handleToggle('soundEnabled')}
            />
            <Separator />
            <ToggleRow
              id="notificationsEnabled"
              label="Browser notifications"
              description="Send a browser notification at each phase transition"
              checked={form.notificationsEnabled}
              onToggle={handleToggle('notificationsEnabled')}
            />
          </CardContent>
        </Card>

        {/* ── Save button + status ───────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            size="lg"
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save settings'}
          </Button>

          {saveStatus === 'saved' && (
            <p className="text-sm text-green-600 dark:text-green-400" role="status">
              Settings saved.
            </p>
          )}

          {saveStatus === 'error' && errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface DurationFieldProps {
  id: string
  label: string
  description: string
  value: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  unit?: string
}

function DurationField({
  id,
  label,
  description,
  value,
  onChange,
  unit = 'min',
}: DurationFieldProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={id}
          className="text-sm font-medium leading-none text-foreground"
        >
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          id={id}
          type="number"
          min={1}
          max={999}
          value={value}
          onChange={onChange}
          className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`${label} duration`}
        />
        <span className="text-xs text-muted-foreground w-10">{unit}</span>
      </div>
    </div>
  )
}

interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onToggle: () => void
}

function ToggleRow({ id, label, description, checked, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={id}
          className="text-sm font-medium leading-none text-foreground cursor-pointer"
        >
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {/* Custom toggle switch built with a checkbox */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          checked ? 'bg-primary' : 'bg-input',
        ].join(' ')}
      >
        <span className="sr-only">Toggle {label}</span>
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0',
            'transition-transform duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}
