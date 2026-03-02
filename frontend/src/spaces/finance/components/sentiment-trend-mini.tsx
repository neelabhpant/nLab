import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { useSentimentStore } from '@/spaces/finance/stores/sentiment-store'

const TREND_COINS = ['bitcoin', 'ripple']
const TREND_DAYS = 30

const COIN_META: Record<string, { label: string; color: string }> = {
  bitcoin: { label: 'BTC', color: '#F7931A' },
  ripple: { label: 'XRP', color: '#0EA5E9' },
}

function formatDate(d: string) {
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface-0 px-3 py-2 shadow-lg">
      <p className="text-[10px] text-slate-400 font-body mb-1">{formatDate(label ?? '')}</p>
      {payload.map((p) => {
        const coin = String(p.dataKey ?? '')
        const meta = COIN_META[coin]
        if (!meta) return null
        return (
          <div key={coin} className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 rounded-full" style={{ backgroundColor: meta.color }} />
            <span className="text-[11px] font-display font-semibold" style={{ color: meta.color }}>{meta.label}</span>
            <span className={`text-[11px] font-display font-semibold ${(p.value ?? 0) > 0 ? 'text-gain' : (p.value ?? 0) < 0 ? 'text-loss' : 'text-slate-500'}`}>
              {(p.value ?? 0) >= 0 ? '+' : ''}{(p.value ?? 0).toFixed(2)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function SentimentTrendMini() {
  const { trend, trendLoading, fetchTrend } = useSentimentStore()

  useEffect(() => {
    fetchTrend(TREND_COINS, TREND_DAYS)
  }, [fetchTrend])

  const chartData = (() => {
    if (!trend.length) return []
    const primary = trend[0]
    if (!primary) return []
    return primary.days.map((day, i) => {
      const row: Record<string, string | number> = { date: day.date }
      for (const coin of trend) {
        row[coin.coin] = coin.days[i]?.score ?? 0
      }
      return row
    })
  })()

  const hasData = chartData.some((d) =>
    TREND_COINS.some((c) => (d[c] as number) !== 0)
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <span className="text-sm font-display font-semibold text-slate-900">Sentiment Trend</span>
        </div>
        <span className="text-[10px] text-slate-400 font-body">{TREND_DAYS}D</span>
      </div>

      <div className="flex items-center gap-3 mb-2 flex-shrink-0">
        {TREND_COINS.map((id) => {
          const meta = COIN_META[id]
          if (!meta) return null
          const latest = trend.find((t) => t.coin === id)?.days.at(-1)
          return (
            <div key={id} className="flex items-center gap-1.5">
              <span className="w-2 h-0.5 rounded-full" style={{ backgroundColor: meta.color }} />
              <span className="text-[11px] font-display font-semibold" style={{ color: meta.color }}>{meta.label}</span>
              {latest && (
                <span className={`text-[11px] font-display font-semibold ${latest.score > 0 ? 'text-gain' : latest.score < 0 ? 'text-loss' : 'text-slate-400'}`}>
                  {latest.score >= 0 ? '+' : ''}{latest.score.toFixed(2)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex-1 min-h-[100px]">
        {trendLoading && !chartData.length ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !hasData ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-slate-400 font-body text-center">
              Building sentiment history...<br />
              <span className="text-[10px]">Data will populate over the coming days</span>
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                {TREND_COINS.map((id) => (
                  <linearGradient key={id} id={`trendGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COIN_META[id]?.color ?? '#666'} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={COIN_META[id]?.color ?? '#666'} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                tickFormatter={(d: string) => {
                  const date = new Date(d + 'T00:00:00')
                  return date.getDate().toString()
                }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                domain={[-1, 1]}
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickCount={3}
                tickFormatter={(v: number) => v.toFixed(1)}
                width={30}
              />
              <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="3 3" />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
              {TREND_COINS.map((id) => (
                <Area
                  key={id}
                  type="monotone"
                  dataKey={id}
                  stroke={COIN_META[id]?.color ?? '#666'}
                  strokeWidth={1.5}
                  fill={`url(#trendGrad-${id})`}
                  dot={false}
                  activeDot={{ r: 3, fill: COIN_META[id]?.color ?? '#666', stroke: '#fff', strokeWidth: 1.5 }}
                  animationDuration={800}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  )
}
