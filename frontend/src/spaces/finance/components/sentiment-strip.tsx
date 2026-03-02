import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'
import { useSentimentStore } from '@/spaces/finance/stores/sentiment-store'
import { AVAILABLE_COINS } from './compare-controls'

const STRIP_COINS = ['bitcoin', 'ripple']

function trendIcon(trend: string) {
  if (trend === 'improving') return <TrendingUp className="w-3 h-3 text-gain" />
  if (trend === 'declining') return <TrendingDown className="w-3 h-3 text-loss" />
  return <Minus className="w-3 h-3 text-slate-400" />
}

function trendLabel(trend: string) {
  if (trend === 'improving') return 'Improving'
  if (trend === 'declining') return 'Declining'
  return 'Stable'
}

function SentimentBar({ score }: { score: number }) {
  const clamped = Math.max(-1, Math.min(1, score))
  const pct = ((clamped + 1) / 2) * 100

  return (
    <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300/60 z-10" />
      <motion.div
        className="absolute top-0 left-0 bottom-0 rounded-full"
        initial={{ width: '50%' }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{
          background: clamped > 0.1
            ? `linear-gradient(90deg, #94a3b8 0%, #22c55e ${Math.min(pct, 100)}%)`
            : clamped < -0.1
              ? `linear-gradient(90deg, #ef4444 0%, #94a3b8 100%)`
              : '#94a3b8',
        }}
      />
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-20"
        initial={{ left: '50%' }}
        animate={{ left: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{
          marginLeft: '-5px',
          background: clamped > 0.1 ? '#22c55e' : clamped < -0.1 ? '#ef4444' : '#94a3b8',
        }}
      />
    </div>
  )
}

export function SentimentStrip() {
  const { summaries, summaryLoading, fetchSummary } = useSentimentStore()

  useEffect(() => {
    fetchSummary(STRIP_COINS)
  }, [fetchSummary])

  if (summaryLoading && !summaries.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm animate-pulse h-full">
        <div className="h-5 w-32 bg-surface-2 rounded mb-4" />
        <div className="space-y-4">
          <div className="h-12 bg-surface-2 rounded" />
          <div className="h-12 bg-surface-2 rounded" />
        </div>
      </div>
    )
  }

  if (!summaries.length) return null

  const totalArticles = summaries.reduce((sum, s) => sum + s.article_count, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan/10 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-cyan" />
          </div>
          <span className="text-sm font-display font-semibold text-slate-900">Market Sentiment</span>
        </div>
        <span className="text-[10px] text-slate-400 font-body">{totalArticles} articles</span>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-4">
        {summaries.map((item) => {
          const meta = AVAILABLE_COINS.find((c) => c.id === item.coin)
          const isPositive = item.score > 0.1
          const isNegative = item.score < -0.1

          return (
            <div key={item.coin} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center font-display font-bold text-[10px]"
                    style={{ backgroundColor: `${meta?.color ?? '#6B7280'}15`, color: meta?.color ?? '#6B7280' }}
                  >
                    {meta?.label?.charAt(0) ?? item.coin.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-display font-semibold text-slate-800">
                    {meta?.label ?? item.coin.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-display font-bold ${
                    isPositive ? 'text-gain' : isNegative ? 'text-loss' : 'text-slate-500'
                  }`}>
                    {item.score >= 0 ? '+' : ''}{item.score.toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1">
                    {trendIcon(item.trend)}
                    <span className="text-[10px] text-slate-400 font-body">{trendLabel(item.trend)}</span>
                  </div>
                </div>
              </div>
              <SentimentBar score={item.score} />
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
