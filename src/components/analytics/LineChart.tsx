'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineChartPoint {
  label: string
  value: number
}

export interface LineChartProps {
  points: LineChartPoint[]
  height?: number
  className?: string
  formatValue?: (value: number) => string
  color?: string
  fillOpacity?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_HEIGHT = 200
const PADDING_TOP = 16
const PADDING_BOTTOM = 40
const PADDING_LEFT = 52
const PADDING_RIGHT = 16
const Y_TICK_COUNT = 5
const DEFAULT_COLOR = 'oklch(0.62 0.24 270)'
const TOTAL_WIDTH = 400

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

export function LineChart({
  points,
  height = DEFAULT_HEIGHT,
  className,
  formatValue = defaultFormatValue,
  color = DEFAULT_COLOR,
  fillOpacity = 0.15,
}: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const chartHeight = height - PADDING_TOP - PADDING_BOTTOM
  const chartWidth = TOTAL_WIDTH - PADDING_LEFT - PADDING_RIGHT

  const maxVal = Math.max(...points.map((p) => p.value), 1)
  const computedMax = niceMax(maxVal)

  const yTicks = Array.from({ length: Y_TICK_COUNT + 1 }, (_, i) =>
    Math.round((computedMax / Y_TICK_COUNT) * i)
  )

  // Compute (x, y) for each point
  const coords = points.map((p, i) => {
    const x = PADDING_LEFT + (points.length > 1 ? (i / (points.length - 1)) * chartWidth : chartWidth / 2)
    const y = PADDING_TOP + chartHeight - (p.value / computedMax) * chartHeight
    return { x, y, point: p }
  })

  // Build polyline path
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')

  // Build fill area path (close down to baseline)
  const fillPath = coords.length > 0
    ? [
        linePath,
        `L ${coords[coords.length - 1].x} ${PADDING_TOP + chartHeight}`,
        `L ${coords[0].x} ${PADDING_TOP + chartHeight}`,
        'Z',
      ].join(' ')
    : ''

  const fillId = `line-fill-${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${TOTAL_WIDTH} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Line chart"
        role="img"
        className="w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity * 2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Y-axis grid lines and labels */}
        {yTicks.map((tick) => {
          const y = PADDING_TOP + chartHeight - (tick / computedMax) * chartHeight
          return (
            <g key={tick}>
              <line
                x1={PADDING_LEFT}
                y1={y}
                x2={TOTAL_WIDTH - PADDING_RIGHT}
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

        {/* Fill area */}
        {fillPath && (
          <path d={fillPath} fill={`url(#${fillId})`} />
        )}

        {/* Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Data points + tooltips */}
        {coords.map(({ x, y, point }, i) => {
          const isHovered = hoveredIndex === i
          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* Invisible hit area */}
              <rect
                x={x - 12}
                y={PADDING_TOP}
                width={24}
                height={chartHeight}
                fill="transparent"
              />

              {/* Dot */}
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 5 : 3}
                fill={color}
                stroke="oklch(0.1 0.02 265)"
                strokeWidth={2}
                className="transition-all duration-100"
              />

              {/* Hover tooltip */}
              {isHovered && (
                <g>
                  {/* Vertical guide line */}
                  <line
                    x1={x}
                    y1={PADDING_TOP}
                    x2={x}
                    y2={PADDING_TOP + chartHeight}
                    stroke={color}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.4}
                  />
                  <rect
                    x={Math.min(x - 28, TOTAL_WIDTH - PADDING_RIGHT - 60)}
                    y={y - 32}
                    width={56}
                    height={20}
                    rx={4}
                    fill="oklch(0.14 0.025 265)"
                    stroke="oklch(1 0 0 / 10%)"
                    strokeWidth={1}
                  />
                  <text
                    x={Math.min(x, TOTAL_WIDTH - PADDING_RIGHT - 32)}
                    y={y - 18}
                    textAnchor="middle"
                    fontSize={10}
                    fill="white"
                    fontWeight={500}
                  >
                    {formatValue(point.value)}
                  </text>
                </g>
              )}

              {/* X-axis label */}
              <text
                x={x}
                y={PADDING_TOP + chartHeight + 16}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                className="text-muted-foreground fill-current opacity-60"
              >
                {point.label}
              </text>
            </g>
          )
        })}

        {/* X-axis baseline */}
        <line
          x1={PADDING_LEFT}
          y1={PADDING_TOP + chartHeight}
          x2={TOTAL_WIDTH - PADDING_RIGHT}
          y2={PADDING_TOP + chartHeight}
          stroke="currentColor"
          strokeWidth={1}
          className="text-white/10"
        />
      </svg>
    </div>
  )
}
