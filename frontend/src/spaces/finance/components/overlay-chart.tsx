import { useMemo, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { CompareTooltip } from './compare-tooltip'
import { AVAILABLE_COINS } from './compare-controls'

interface SeriesData {
  coin_id: string
  points: { timestamp: number; normalized: number; usd: number }[]
}

interface OverlayChartProps {
  series: SeriesData[]
  method: string
  animationKey: string
}

export function OverlayChart({ series, method, animationKey }: OverlayChartProps) {
  const baseId = useId()

  const coinMeta = useMemo(
    () =>
      series.map((s) => {
        const found = AVAILABLE_COINS.find((c) => c.id === s.coin_id)
        return {
          id: s.coin_id,
          label: found?.label ?? s.coin_id.toUpperCase(),
          color: found?.color ?? '#00D4FF',
        }
      }),
    [series],
  )

  const chartData = useMemo(() => {
    if (!series.length) return []

    const primary = series[0]
    return primary.points.map((pt, i) => {
      const row: Record<string, number> = { timestamp: pt.timestamp }
      for (const s of series) {
        const point = s.points[i]
        if (point) {
          row[`norm_${s.coin_id}`] = point.normalized
          row[`usd_${s.coin_id}`] = point.usd
        }
      }
      return row
    })
  }, [series])

  const yDomain = useMemo((): [number, number] => {
    if (method === 'minmax') return [-0.02, 1.02]
    let min = 0
    let max = 0
    for (const s of series) {
      for (const p of s.points) {
        if (p.normalized < min) min = p.normalized
        if (p.normalized > max) max = p.normalized
      }
    }
    const pad = (max - min) * 0.08
    return [min - pad, max + pad]
  }, [series, method])

  const formatYAxis = (val: number) => {
    if (method === 'minmax') return `${(val * 100).toFixed(0)}%`
    return `${val >= 0 ? '+' : ''}${val.toFixed(1)}σ`
  }

  const formatXAxis = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={animationKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full h-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: -12 }}>
            <defs>
              {coinMeta.map((meta) => (
                <linearGradient
                  key={meta.id}
                  id={`${baseId}-grad-${meta.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={meta.color} stopOpacity={0.2} />
                  <stop offset="80%" stopColor={meta.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid
              strokeDasharray="3 6"
              stroke="#E5E7EB"
              vertical={false}
            />

            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatXAxis}
              tick={{ fontSize: 10, fill: '#6B7280', fontFamily: "'Outfit', sans-serif" }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
              minTickGap={60}
            />

            <YAxis
              domain={yDomain}
              tickFormatter={formatYAxis}
              tick={{ fontSize: 10, fill: '#6B7280', fontFamily: "'Outfit', sans-serif" }}
              axisLine={false}
              tickLine={false}
              width={52}
            />

            <Tooltip
              content={<CompareTooltip coinMeta={coinMeta} method={method} />}
              cursor={{
                stroke: '#E5E7EB',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
            />

            {coinMeta.map((meta, idx) => (
              <Area
                key={meta.id}
                type="monotone"
                dataKey={`norm_${meta.id}`}
                stroke={meta.color}
                strokeWidth={idx === 0 ? 2 : 1.5}
                fill={`url(#${baseId}-grad-${meta.id})`}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: meta.color,
                  stroke: '#FFFFFF',
                  strokeWidth: 2,
                }}
                animationDuration={1400}
                animationEasing="ease-in-out"
                animationBegin={idx * 200}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </AnimatePresence>
  )
}
