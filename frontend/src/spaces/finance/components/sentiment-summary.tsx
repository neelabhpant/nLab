import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
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
  if (score > 0.3) return { text: 'Very Bullish', className: 'bg-gain/10 text-gain' }
  if (score > 0.1) return { text: 'Bullish', className: 'bg-gain/10 text-gain' }
  if (score < -0.3) return { text: 'Very Bearish', className: 'bg-loss/10 text-loss' }
  if (score < -0.1) return { text: 'Bearish', className: 'bg-loss/10 text-loss' }
  return { text: 'Neutral', className: 'bg-slate-100 text-slate-500' }
}

export function SentimentSummary({ summaries, loading }: SentimentSummaryProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm animate-pulse">
            <div className="h-4 w-16 bg-surface-2 rounded mb-3" />
            <div className="h-8 w-24 bg-surface-2 rounded mb-2" />
            <div className="h-3 w-full bg-surface-2 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!summaries.length) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {summaries.map((item, idx) => {
        const meta = AVAILABLE_COINS.find((c) => c.id === item.coin)
        const label = sentimentLabel(item.score)
        return (
          <motion.div
            key={item.coin}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.08 }}
            className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-[10px]"
                  style={{ backgroundColor: `${meta?.color ?? '#6B7280'}20`, color: meta?.color ?? '#6B7280' }}
                >
                  {meta?.label?.charAt(0) ?? item.coin.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-display font-semibold text-slate-900">
                  {meta?.label ?? item.coin.toUpperCase()}
                </span>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${label.className}`}>
                {label.text}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-display font-bold text-slate-900">
                {item.score >= 0 ? '+' : ''}{item.score.toFixed(2)}
              </span>
              <div className="flex items-center gap-1">
                {trendIcon(item.trend)}
                <span className="text-xs text-slate-500 font-body capitalize">{item.trend}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-body mb-2">
              {item.article_count} article{item.article_count !== 1 ? 's' : ''} analyzed
            </p>

            {item.top_bullish && (
              <p className="text-[11px] text-gain/80 font-body truncate" title={item.top_bullish}>
                ↑ {item.top_bullish}
              </p>
            )}
            {item.top_bearish && (
              <p className="text-[11px] text-loss/80 font-body truncate" title={item.top_bearish}>
                ↓ {item.top_bearish}
              </p>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
