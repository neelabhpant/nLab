import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link2, Unlink } from 'lucide-react'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
} from 'recharts'
import { useCompareStore } from '@/spaces/finance/stores/compare-store'
import { pearsonCorrelation } from '@/shared/lib/correlation'

const COIN_A = { id: 'bitcoin', label: 'BTC', color: '#F7931A' }
const COIN_B = { id: 'ripple', label: 'XRP', color: '#0EA5E9' }

function getCorrelationInfo(r: number) {
  const abs = Math.abs(r)
  if (abs >= 0.8) return { label: 'Strong', color: '#00D4FF' }
  if (abs >= 0.5) return { label: 'Moderate', color: '#F59E0B' }
  if (abs >= 0.3) return { label: 'Weak', color: '#94A3B8' }
  return { label: 'Negligible', color: '#64748B' }
}

export function CorrelationMini() {
  const { data, loading, fetchComparison, setCoins, setDays, setMethod } = useCompareStore()

  useEffect(() => {
    setCoins([COIN_A.id, COIN_B.id])
    setDays(30)
    setMethod('minmax')
    fetchComparison()
  }, [setCoins, setDays, setMethod, fetchComparison])

  const correlation = useMemo(() => {
    if (!data || data.series.length !== 2) return null
    const a = data.series[0].points.map((p) => p.normalized)
    const b = data.series[1].points.map((p) => p.normalized)
    return pearsonCorrelation(a, b)
  }, [data])

  const chartData = useMemo(() => {
    if (!data || data.series.length < 2) return []
    return data.series[0].points.map((p, i) => ({
      t: p.timestamp,
      a: p.normalized,
      b: data.series[1].points[i]?.normalized ?? 0,
    }))
  }, [data])

  const info = correlation !== null ? getCorrelationInfo(correlation) : null
  const Icon = correlation !== null && Math.abs(correlation) >= 0.3 ? Link2 : Unlink

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${info?.color ?? '#64748B'}15` }}>
            <Icon className="w-3.5 h-3.5" style={{ color: info?.color ?? '#64748B' }} />
          </div>
          <span className="text-sm font-display font-semibold text-slate-900">Price Correlation</span>
        </div>
        <span className="text-[10px] text-slate-400 font-body">30D</span>
      </div>

      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-display font-bold" style={{ color: COIN_A.color }}>{COIN_A.label}</span>
          <span className="text-[10px] text-slate-300">/</span>
          <span className="text-[11px] font-display font-bold" style={{ color: COIN_B.color }}>{COIN_B.label}</span>
        </div>
        {correlation !== null && info && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-display font-bold tracking-tight" style={{ color: info.color }}>
              {correlation >= 0 ? '+' : ''}{correlation.toFixed(3)}
            </span>
            <span className="text-[10px] text-slate-400 font-body">{info.label}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-[100px]">
        {loading && !chartData.length ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="corrGradA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COIN_A.color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={COIN_A.color} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="corrGradB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COIN_B.color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={COIN_B.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={[0, 1]} hide />
              <Area
                type="monotone"
                dataKey="a"
                stroke={COIN_A.color}
                strokeWidth={1.5}
                fill="url(#corrGradA)"
                dot={false}
                animationDuration={800}
              />
              <Area
                type="monotone"
                dataKey="b"
                stroke={COIN_B.color}
                strokeWidth={1.5}
                fill="url(#corrGradB)"
                dot={false}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      {chartData.length > 0 && (
        <div className="flex items-center gap-3 mt-1 flex-shrink-0">
          {[COIN_A, COIN_B].map((coin) => (
            <div key={coin.id} className="flex items-center gap-1">
              <span className="w-2 h-0.5 rounded-full" style={{ backgroundColor: coin.color }} />
              <span className="text-[10px] text-slate-400 font-body">{coin.label}</span>
            </div>
          ))}
          <span className="text-[10px] text-slate-300 font-body ml-auto">min-max normalized</span>
        </div>
      )}
    </motion.div>
  )
}
