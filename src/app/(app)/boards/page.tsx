import { LayoutDashboard } from 'lucide-react'

export default function BoardsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15">
        <LayoutDashboard className="size-6 text-violet-400" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-white">Boards</h1>
        <p className="mt-1 text-sm text-[oklch(0.56_0.04_265)]">
          Kanban boards coming in Phase 5.
        </p>
      </div>
    </div>
  )
}
