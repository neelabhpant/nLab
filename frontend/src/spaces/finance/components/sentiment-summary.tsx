import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'
import type { SentimentSummaryItem } from '@/spaces/finance/stores/sentiment-store'
import { AVAILABLE_COINS } from './compare-controls'

interface SentimentSummaryProps {
  summaries: SentimentSummaryItem[]
  loading: boolean
}

function trendIcon(trend: string) {
  if (trend === 'improving') return <TrendingUp className="w-3.5 h-3.5 text-gain" />
  if (trend === 'declining') return <TrendingDown className="w-3.5 h-3.5 text-loss" />
  return <Minus className="w-3.5 h-3.5 text-slate-400" />
}

function sentimentLabel(score: number): { text: string; className: string } {
  if (score > 0.3) return { text: 'Very Bullish', className: 'text-gain' }
  if (score > 0.1) return { text: 'Bullish', className: 'text-gain' }
  if (score < -0.3) return { text: 'Very Bearish', className: 'text-loss' }
  if (score < -0.1) return { text: 'Bearish', className: 'text-loss' }
  return { text: 'Neutral', className: 'text-slate-500' }
}

function SentimentBar({ score }: { score: number }) {
  const clamped = Math.max(-1, Math.min(1, score))
  const pct = ((clamped + 1) / 2) * 100

  return (
    <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 z-10" />
      <motion.div
        initial={{ width: '50%' }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute left-0 top-0 bottom-0 rounded-full"
        style={{
          background: clamped >= 0
            ? `linear-gradient(90deg, #e2e8f0 0%, #22C55E ${pct > 80 ? '100%' : '80%'})`
            : `linear-gradient(90deg, #EF4444 0%, #e2e8f0 ${pct}%)`,
        }}
      />
      <motion.div
        initial={{ left: '50%' }}
        animate={{ left: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm z-20"
        style={{
          backgroundColor: clamped > 0.1 ? '#22C55E' : clamped < -0.1 ? '#EF4444' : '#94A3B8',
        }}
      />
    </div>
  )
}

export function SentimentSummary({ summaries, loading }: SentimentSummaryProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm animate-pulse h-full">
        <div className="h-4 w-32 bg-surface-2 rounded mb-4" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 bg-surface-2 rounded-lg" />
              <div className="flex-1 h-3 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!summaries.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-border bg-surface-0 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border flex-shrink-0">
        <Activity className="w-4 h-4 text-cyan" />
        <h3 className="text-sm font-display font-semibold text-slate-900">Sentiment Overview</h3>
        <span className="text-[10px] text-slate-400 font-body ml-auto">
          {summaries.reduce((sum, s) => sum + s.article_count, 0)} articles
        </span>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {summaries.map((item, idx) => {
          const meta = AVAILABLE_COINS.find((c) => c.id === item.coin)
          const label = sentimentLabel(item.score)
          return (
            <motion.div
              key={item.coin}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.06 }}
              className="flex items-center gap-3"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-[10px] flex-shrink-0"
                style={{ backgroundColor: `${meta?.color ?? '#6B7280'}20`, color: meta?.color ?? '#6B7280' }}
              >
                {meta?.label?.charAt(0) ?? item.coin.charAt(0).toUpperCase()}
              </div>

              <div className="w-12 flex-shrink-0">
                <span className="text-xs font-display font-semibold text-slate-900">
                  {meta?.label ?? item.coin.toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <SentimentBar score={item.score} />
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-sm font-display font-bold ${label.className} w-12 text-right`}>
                  {item.score >= 0 ? '+' : ''}{item.score.toFixed(2)}
                </span>
                {trendIcon(item.trend)}
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="px-4 pb-4 space-y-1.5">
        {summaries.map((item) => {
          const meta = AVAILABLE_COINS.find((c) => c.id === item.coin)
          return (
            <div key={item.coin} className="flex flex-col">
              {item.top_bullish && (
                <p className="text-[10px] text-gain/70 font-body truncate">
                  <span className="font-display font-semibold" style={{ color: meta?.color }}>
                    {meta?.label ?? item.coin.toUpperCase()}
                  </span>
                  {' '}↑ {item.top_bullish}
                </p>
              )}
              {item.top_bearish && (
                <p className="text-[10px] text-loss/70 font-body truncate">
                  <span className="font-display font-semibold" style={{ color: meta?.color }}>
                    {meta?.label ?? item.coin.toUpperCase()}
                  </span>
                  {' '}↓ {item.top_bearish}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
