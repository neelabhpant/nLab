import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type { CoinHeatmapData } from '@/spaces/finance/stores/sentiment-store'
import { AVAILABLE_COINS } from './compare-controls'

interface SentimentTrendChartProps {
  data: CoinHeatmapData[]
  loading: boolean
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; color?: string; name?: string; payload?: Record<string, number> }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface-0 px-3 py-2 shadow-lg">
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      {payload.map((entry) => {
        const countKey = `${entry.name}_count`
        const articleCount = entry.payload?.[countKey] ?? 0
        return (
          <div key={entry.name} className="mb-0.5 last:mb-0">
            <p className="text-xs font-display font-semibold" style={{ color: entry.color }}>
              {entry.name}: {entry.value !== undefined ? (entry.value >= 0 ? '+' : '') + entry.value.toFixed(3) : '--'}
            </p>
            <p className="text-[10px] text-slate-400 font-body">
              {articleCount} article{articleCount !== 1 ? 's' : ''} analyzed
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function SentimentTrendChart({ data, loading }: SentimentTrendChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return []
    const dateMap = new Map<string, Record<string, number>>()
    for (const coinData of data) {
      const meta = AVAILABLE_COINS.find((c) => c.id === coinData.coin)
      const label = meta?.label ?? coinData.coin.toUpperCase()
      for (const day of coinData.days) {
        const existing = dateMap.get(day.date) ?? {}
        existing[label] = day.score
        existing[`${label}_count`] = day.article_count
        dateMap.set(day.date, existing)
      }
    }
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, scores]) => ({ date, ...scores }))
  }, [data])

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface-0 p-6 shadow-sm">
        <div className="animate-pulse h-[300px] bg-surface-2 rounded" />
      </div>
    )
  }

  if (!data.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border border-border bg-surface-0 p-6 shadow-sm"
    >
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#6B7280', fontFamily: "'Outfit', sans-serif" }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[-1, 1]}
              ticks={[-1, -0.5, 0, 0.5, 1]}
              tick={{ fontSize: 11, fill: '#6B7280', fontFamily: "'Outfit', sans-serif" }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v: number) => (v >= 0 ? '+' : '') + v.toFixed(1)}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1} />
            {data.map((coinData) => {
              const meta = AVAILABLE_COINS.find((c) => c.id === coinData.coin)
              const label = meta?.label ?? coinData.coin.toUpperCase()
              return (
                <Line
                  key={coinData.coin}
                  type="monotone"
                  dataKey={label}
                  name={label}
                  stroke={meta?.color ?? '#6B7280'}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: meta?.color ?? '#6B7280', stroke: '#FFFFFF', strokeWidth: 2 }}
                  animationDuration={1200}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
        {data.map((coinData) => {
          const meta = AVAILABLE_COINS.find((c) => c.id === coinData.coin)
          return (
            <div key={coinData.coin} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-[2px] rounded-full" style={{ backgroundColor: meta?.color ?? '#6B7280' }} />
              <span className="font-display">{meta?.label ?? coinData.coin.toUpperCase()}</span>
            </div>
          )
        })}
        <span className="text-[10px] text-muted-foreground/40 ml-auto font-body">
          Sentiment range [-1, +1]
        </span>
      </div>
    </motion.div>
  )
}
