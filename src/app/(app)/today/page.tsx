import { CalendarDays } from 'lucide-react'

export default function TodayPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15">
        <CalendarDays className="size-6 text-violet-400" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-white">Today</h1>
        <p className="mt-1 text-sm text-[oklch(0.56_0.04_265)]">
          Your tasks and timer will appear here — coming in Phase 10.
        </p>
      </div>
    </div>
  )
}
