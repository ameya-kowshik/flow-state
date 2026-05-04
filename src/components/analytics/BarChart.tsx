'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BarChartBar {
  label: string
  value: number
  color?: string
}

export interface BarChartProps {
  bars: BarChartBar[]
  maxValue?: number
  height?: number
  className?: string
  formatValue?: (value: number) => string
  yAxisLabel?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_HEIGHT = 200
const PADDING_TOP = 16
const PADDING_BOTTOM = 40
const PADDING_LEFT = 48
const PADDING_RIGHT = 16
const Y_TICK_COUNT = 5
const DEFAULT_BAR_COLOR = 'oklch(0.62 0.24 270)'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultFormatValue(value: number): string {
  if (value === 0) return '0'
  if (value >= 60) {
    const h = Math.floor(value / 60)
    const m = value % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${value}m`
}

function niceMax(value: number): number {
  if (value === 0) return 60
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  return Math.ceil(value / magnitude) * magnitude
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BarChart({
  bars,
  maxValue,
  height = DEFAULT_HEIGHT,
  className,
  formatValue = defaultFormatValue,
  yAxisLabel,
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const chartHeight = height - PADDING_TOP - PADDING_BOTTOM
  const computedMax = maxValue ?? niceMax(Math.max(...bars.map((b) => b.value), 1))

  const barCount = bars.length
  const totalWidth = 400 // SVG viewBox width
  const chartWidth = totalWidth - PADDING_LEFT - PADDING_RIGHT
  const barWidth = Math.max(8, (chartWidth / barCount) * 0.6)
  const barSpacing = chartWidth / barCount

  const yTicks = Array.from({ length: Y_TICK_COUNT + 1 }, (_, i) =>
    Math.round((computedMax / Y_TICK_COUNT) * i)
  )

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Bar chart"
        role="img"
        className="w-full"
        style={{ height }}
      >
        {/* Y-axis grid lines and labels */}
        {yTicks.map((tick) => {
          const y = PADDING_TOP + chartHeight - (tick / computedMax) * chartHeight
          return (
            <g key={tick}>
              <line
                x1={PADDING_LEFT}
                y1={y}
                x2={totalWidth - PADDING_RIGHT}
                y2={y}
                stroke="currentColor"
                strokeWidth={0.5}
                className="text-white/8"
              />
              <text
                x={PADDING_LEFT - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="currentColor"
                className="text-muted-foreground fill-current opacity-60"
              >
                {formatValue(tick)}
              </text>
            </g>
          )
        })}

        {/* Y-axis label */}
        {yAxisLabel && (
          <text
            x={10}
            y={PADDING_TOP + chartHeight / 2}
            textAnchor="middle"
            fontSize={9}
            fill="currentColor"
            className="text-muted-foreground fill-current opacity-50"
            transform={`rotate(-90, 10, ${PADDING_TOP + chartHeight / 2})`}
          >
            {yAxisLabel}
          </text>
        )}

        {/* Bars */}
        {bars.map((bar, i) => {
          const barHeight = (bar.value / computedMax) * chartHeight
          const x = PADDING_LEFT + i * barSpacing + (barSpacing - barWidth) / 2
          const y = PADDING_TOP + chartHeight - barHeight
          const isHovered = hoveredIndex === i
          const color = bar.color ?? DEFAULT_BAR_COLOR

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* Bar */}
              <rect
                x={x}
                y={bar.value > 0 ? y : PADDING_TOP + chartHeight - 2}
                width={barWidth}
                height={bar.value > 0 ? barHeight : 2}
                rx={3}
                fill={color}
                opacity={isHovered ? 1 : 0.75}
                className="transition-opacity duration-150"
              />

              {/* Hover tooltip */}
              {isHovered && bar.value > 0 && (
                <g>
                  <rect
                    x={x + barWidth / 2 - 28}
                    y={y - 26}
                    width={56}
                    height={20}
                    rx={4}
                    fill="oklch(0.14 0.025 265)"
                    stroke="oklch(1 0 0 / 10%)"
                    strokeWidth={1}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={y - 12}
                    textAnchor="middle"
                    fontSize={10}
                    fill="white"
                    fontWeight={500}
                  >
                    {formatValue(bar.value)}
                  </text>
                </g>
              )}

              {/* X-axis label */}
              <text
                x={x + barWidth / 2}
                y={PADDING_TOP + chartHeight + 16}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                className="text-muted-foreground fill-current opacity-60"
              >
                {bar.label}
              </text>
            </g>
          )
        })}

        {/* X-axis baseline */}
        <line
          x1={PADDING_LEFT}
          y1={PADDING_TOP + chartHeight}
          x2={totalWidth - PADDING_RIGHT}
          y2={PADDING_TOP + chartHeight}
          stroke="currentColor"
          strokeWidth={1}
          className="text-white/10"
        />
      </svg>
    </div>
  )
}
