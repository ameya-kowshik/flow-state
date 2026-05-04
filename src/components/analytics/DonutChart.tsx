'use client'

import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DonutSegment {
  value: number
  color: string
  label: string
}

export interface DonutChartProps {
  segments: DonutSegment[]
  size?: number
  strokeWidth?: number
  className?: string
  showTotal?: boolean
  totalLabel?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DonutChart({
  segments,
  size = 200,
  strokeWidth = 24,
  className,
  showTotal = true,
  totalLabel = 'Total',
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  const total = segments.reduce((sum, seg) => sum + seg.value, 0)

  if (total === 0) {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        style={{ width: size, height: size }}
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No data</p>
        </div>
      </div>
    )
  }

  // Compute arc paths
  let cumulativeAngle = 0
  const arcs = segments.map((seg) => {
    const proportion = seg.value / total
    const angle = proportion * 2 * Math.PI
    const startAngle = cumulativeAngle
    const endAngle = cumulativeAngle + angle

    // Arc path using polar coordinates
    const x1 = center + radius * Math.cos(startAngle - Math.PI / 2)
    const y1 = center + radius * Math.sin(startAngle - Math.PI / 2)
    const x2 = center + radius * Math.cos(endAngle - Math.PI / 2)
    const y2 = center + radius * Math.sin(endAngle - Math.PI / 2)

    const largeArcFlag = angle > Math.PI ? 1 : 0

    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    ].join(' ')

    cumulativeAngle = endAngle

    return {
      pathData,
      color: seg.color,
      label: seg.label,
      value: seg.value,
      percentage: proportion * 100,
    }
  })

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`Donut chart showing ${segments.length} segments`}
        role="img"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/6"
        />

        {/* Segments */}
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arc.pathData}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="transition-opacity duration-200 hover:opacity-80"
          >
            <title>
              {arc.label}: {arc.value} ({arc.percentage.toFixed(1)}%)
            </title>
          </path>
        ))}
      </svg>

      {/* Center label */}
      {showTotal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none">
          <span className="text-3xl font-semibold tabular-nums text-foreground">
            {total}
          </span>
          <span className="text-xs text-muted-foreground">{totalLabel}</span>
        </div>
      )}
    </div>
  )
}
