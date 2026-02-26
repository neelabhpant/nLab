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

export function SentimentStrip() {
  const { summaries, summaryLoading, fetchSummary } = useSentimentStore()

  useEffect(() => {
    fetchSummary(STRIP_COINS)
  }, [fetchSummary])

  if (summaryLoading && !summaries.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-0 p-4 shadow-sm animate-pulse mb-6">
        <div className="h-5 w-48 bg-surface-2 rounded" />
      </div>
    )
  }

  if (!summaries.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-xl border border-border bg-surface-0 px-5 py-3.5 shadow-sm mb-6"
    >
      <div className="flex items-center gap-4 md:gap-6 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs font-display font-semibold text-slate-900">
          <Activity className="w-3.5 h-3.5 text-cyan" />
          Sentiment
        </div>
        <div className="flex items-center gap-5 flex-1">
          {summaries.map((item) => {
            const meta = AVAILABLE_COINS.find((c) => c.id === item.coin)
            const isPositive = item.score > 0.1
            const isNegative = item.score < -0.1
            return (
              <div key={item.coin} className="flex items-center gap-2">
                <span
                  className="text-xs font-display font-bold"
                  style={{ color: meta?.color ?? '#6B7280' }}
                >
                  {meta?.label ?? item.coin.toUpperCase()}
                </span>
                <span className={`text-xs font-display font-semibold ${
                  isPositive ? 'text-gain' : isNegative ? 'text-loss' : 'text-slate-500'
                }`}>
                  {item.score >= 0 ? '+' : ''}{item.score.toFixed(2)}
                </span>
                {trendIcon(item.trend)}
              </div>
            )
          })}
        </div>
        <span className="text-[10px] text-slate-400 font-body">
          {summaries.reduce((sum, s) => sum + s.article_count, 0)} articles
        </span>
      </div>
    </motion.div>
  )
}
