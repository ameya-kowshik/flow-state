'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { CalendarCell } from '@/lib/analytics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarHeatmapProps {
  cells: CalendarCell[]
  colorScale: (minutes: number) => string
  className?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_SIZE = 12
const CELL_GAP = 2
const CELL_STEP = CELL_SIZE + CELL_GAP
const WEEKS = 53
const DAYS = 7
const MONTH_LABELS_HEIGHT = 20
const DAY_LABELS_WIDTH = 28

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SVG_WIDTH = DAY_LABELS_WIDTH + WEEKS * CELL_STEP
const SVG_HEIGHT = MONTH_LABELS_HEIGHT + DAYS * CELL_STEP

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCellMap(cells: CalendarCell[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const cell of cells) {
    map.set(cell.date, cell.minutes)
  }
  return map
}

function getWeekAndDay(dateStr: string, startDate: Date): { week: number; day: number } | null {
  const date = new Date(dateStr + 'T00:00:00')
  const diffMs = date.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0 || diffDays >= WEEKS * DAYS) return null
  return {
    week: Math.floor(diffDays / 7),
    day: diffDays % 7,
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarHeatmap({ cells, colorScale, className }: CalendarHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    date: string
    minutes: number
  } | null>(null)

  // Determine start date: go back ~53 weeks from today, aligned to Sunday
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - (WEEKS * DAYS - 1))
  // Align to Sunday
  const dayOfWeek = startDate.getDay()
  startDate.setDate(startDate.getDate() - dayOfWeek)

  const cellMap = buildCellMap(cells)

  // Build grid: [week][day] = { date, minutes }
  const grid: Array<Array<{ date: string; minutes: number }>> = []
  for (let w = 0; w < WEEKS; w++) {
    grid[w] = []
    for (let d = 0; d < DAYS; d++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + w * 7 + d)
      const dateStr = date.toISOString().slice(0, 10)
      grid[w][d] = { date: dateStr, minutes: cellMap.get(dateStr) ?? 0 }
    }
  }

  // Compute month label positions
  const monthLabels: Array<{ x: number; label: string }> = []
  let lastMonth = -1
  for (let w = 0; w < WEEKS; w++) {
    const firstDayOfWeek = grid[w][0]
    const month = new Date(firstDayOfWeek.date + 'T00:00:00').getMonth()
    if (month !== lastMonth) {
      monthLabels.push({
        x: DAY_LABELS_WIDTH + w * CELL_STEP,
        label: MONTH_NAMES[month],
      })
      lastMonth = month
    }
  }

  return (
    <div className={cn('relative', className)}>
      <svg
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        aria-label="Calendar heatmap showing daily focus time"
        role="img"
        className="overflow-visible"
      >
        {/* Month labels */}
        {monthLabels.map(({ x, label }) => (
          <text
            key={label + x}
            x={x}
            y={12}
            fontSize={10}
            fill="currentColor"
            className="text-muted-foreground fill-current opacity-60"
          >
            {label}
          </text>
        ))}

        {/* Day labels */}
        {DAY_LABELS.map((label, d) => (
          label ? (
            <text
              key={d}
              x={DAY_LABELS_WIDTH - 4}
              y={MONTH_LABELS_HEIGHT + d * CELL_STEP + CELL_SIZE - 2}
              fontSize={9}
              textAnchor="end"
              fill="currentColor"
              className="text-muted-foreground fill-current opacity-50"
            >
              {label}
            </text>
          ) : null
        ))}

        {/* Cells */}
        {grid.map((week, w) =>
          week.map(({ date, minutes }, d) => {
            const x = DAY_LABELS_WIDTH + w * CELL_STEP
            const y = MONTH_LABELS_HEIGHT + d * CELL_STEP
            const isFuture = new Date(date + 'T00:00:00') > today
            const fill = isFuture ? 'transparent' : colorScale(minutes)

            return (
              <rect
                key={date}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                fill={fill}
                className={cn(
                  'transition-opacity duration-100',
                  isFuture ? 'opacity-0' : 'cursor-pointer hover:opacity-80',
                )}
                onMouseEnter={(e) => {
                  if (!isFuture) {
                    setTooltip({ x, y, date, minutes })
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className={cn(
            'pointer-events-none absolute z-10 rounded-lg border border-white/10',
            'bg-popover px-3 py-2 text-xs shadow-xl',
          )}
          style={{
            left: tooltip.x + CELL_SIZE + 4,
            top: tooltip.y - 4,
          }}
        >
          <p className="font-medium text-foreground">{formatDate(tooltip.date)}</p>
          <p className="text-muted-foreground">
            {tooltip.minutes > 0
              ? `${tooltip.minutes} min`
              : 'No sessions'}
          </p>
        </div>
      )}
    </div>
  )
}
