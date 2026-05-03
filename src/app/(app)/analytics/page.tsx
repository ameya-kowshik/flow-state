import { BarChart2 } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15">
        <BarChart2 className="size-6 text-violet-400" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-[oklch(0.56_0.04_265)]">
          Session analytics coming in Phase 4.
        </p>
      </div>
    </div>
  )
}
