import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { api } from '@/shared/lib/api'

const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A',
  XRP: '#0EA5E9',
  ETH: '#627EEA',
  SOL: '#14B8A6',
  DOGE: '#C3A634',
}

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof TrendingUp }> = {
  bullish: { label: 'Bullish', color: 'text-gain', bg: 'bg-gain/10', icon: TrendingUp },
  bearish: { label: 'Bearish', color: 'text-loss', bg: 'bg-loss/10', icon: TrendingDown },
  neutral: { label: 'Neutral', color: 'text-slate-500', bg: 'bg-surface-2', icon: Minus },
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function highlightMetrics(text: string): React.ReactNode[] {
  const parts = text.split(/(\$[\d,]+(?:\.\d+)?|[+-]?\d+(?:\.\d+)?%)/g)
  return parts.map((part, i) => {
    if (/^\$[\d,]+(?:\.\d+)?$/.test(part)) {
      return <span key={i} className="font-semibold text-slate-800">{part}</span>
    }
    if (/^[+-]?\d+(?:\.\d+)?%$/.test(part)) {
      const isNeg = part.startsWith('-')
      return <span key={i} className={`font-semibold ${isNeg ? 'text-loss' : 'text-gain'}`}>{part}</span>
    }
    return part
  })
}

interface TopMover {
  coin: string
  change: string
  reason: string
}

interface BriefData {
  headline: string
  summary: string
  sentiment: string
  top_mover: TopMover | null
  generated_at: number
}

export function MarketBrief() {
  const [brief, setBrief] = useState<BriefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const fetchBrief = useCallback(async () => {
    try {
      setError(false)
      const { data } = await api.get<BriefData>('/market-brief')
      setBrief(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setError(false)
      const { data } = await api.post<BriefData>('/market-brief/refresh')
      setBrief(data)
    } catch {
      setError(true)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchBrief()
  }, [fetchBrief])

  const sentimentKey = brief?.sentiment?.toLowerCase() ?? 'neutral'
  const sentiment = SENTIMENT_CONFIG[sentimentKey] ?? SENTIMENT_CONFIG.neutral
  const SentimentIcon = sentiment.icon
  const moverColor = brief?.top_mover?.coin ? COIN_COLORS[brief.top_mover.coin] ?? '#6B7280' : '#6B7280'
  const moverChange = brief?.top_mover?.change ?? ''
  const moverIsNeg = moverChange.startsWith('-')
  const MoverArrow = moverIsNeg ? ArrowDownRight : ArrowUpRight

  const summaryNodes = useMemo(
    () => (brief?.summary ? highlightMetrics(brief.summary) : null),
    [brief?.summary]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.12 }}
      className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-cyan" />
          </div>
          <span className="text-sm font-display font-semibold text-slate-900">AI Market Brief</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-surface-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Regenerate brief"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading || refreshing ? (
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyan"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <span className="text-xs text-slate-400 font-body">
              {refreshing ? 'Regenerating market brief...' : 'Generating market brief...'}
            </span>
          </div>
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-surface-2 rounded w-full" />
            <div className="h-3 bg-surface-2 rounded w-11/12" />
            <div className="h-3 bg-surface-2 rounded w-4/5" />
          </div>
        </div>
      ) : error ? (
        <p className="text-[13px] text-red-500 font-body leading-relaxed">
          Failed to generate market brief. Click refresh to try again.
        </p>
      ) : brief ? (
        <div className="flex flex-col flex-1">
          <div className="flex items-start gap-2 mb-3">
            <p className="text-[15px] font-display font-semibold text-slate-900 leading-snug flex-1">
              {brief.headline}
            </p>
            <motion.span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-display font-bold flex-shrink-0 ${sentiment.color} ${sentiment.bg}`}
            >
              <motion.span
                animate={sentimentKey !== 'neutral' ? { scale: [1, 1.2, 1] } : undefined}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <SentimentIcon className="w-2.5 h-2.5" />
              </motion.span>
              {sentiment.label}
            </motion.span>
          </div>

          {brief.top_mover && (
            <div
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-1 mb-3 border-l-2"
              style={{ borderLeftColor: moverColor }}
            >
              <span
                className="text-xs font-display font-bold tracking-wide"
                style={{ color: moverColor }}
              >
                {brief.top_mover.coin}
              </span>
              <span className={`inline-flex items-center gap-0.5 text-xs font-display font-bold ${moverIsNeg ? 'text-loss' : 'text-gain'}`}>
                <MoverArrow className="w-3 h-3" />
                {moverChange}
              </span>
              <span className="w-px h-3 bg-slate-200" />
              <span className="text-[11px] text-slate-500 font-body leading-snug line-clamp-1">
                {brief.top_mover.reason}
              </span>
            </div>
          )}

          <p className="text-[12px] text-slate-500 font-body leading-relaxed flex-1">
            {summaryNodes}
          </p>

          {brief.generated_at && (
            <div className="flex justify-end mt-3 pt-2 border-t border-border/40">
              <span className="text-[10px] text-slate-400 font-body">
                Updated {formatTime(brief.generated_at)}
              </span>
            </div>
          )}
        </div>
      ) : null}
    </motion.div>
  )
}
