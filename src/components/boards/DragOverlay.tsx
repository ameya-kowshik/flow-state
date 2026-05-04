'use client'

/**
 * CardDragOverlay — renders the dragged card's title during a drag operation.
 * Requirement: 15.5
 */

interface CardDragOverlayProps {
  title: string
}

export function CardDragOverlay({ title }: CardDragOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className="w-72 cursor-grabbing rounded-xl border border-violet-500/40 bg-[oklch(0.16_0.025_265)] p-3 shadow-2xl shadow-black/40 ring-1 ring-violet-500/20"
    >
      <p className="text-sm font-medium leading-snug text-white opacity-90">{title}</p>
    </div>
  )
}
