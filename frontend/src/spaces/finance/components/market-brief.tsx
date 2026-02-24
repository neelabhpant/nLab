import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RefreshCw } from 'lucide-react'
import { api } from '@/shared/lib/api'

const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A', XRP: '#0EA5E9', ETH: '#627EEA',
  Bitcoin: '#F7931A', Ripple: '#0EA5E9', Ethereum: '#627EEA',
}

function formatFinancialText(text: string): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = []
  const regex = /(\$[\d,]+(?:\.\d+)?(?:[TBMK])?)|([+-]?\d+(?:\.\d+)?%)|(\b(?:BTC|XRP|ETH|Bitcoin|Ripple|Ethereum)\b)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyIdx = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const [full] = match
    if (match[1]) {
      parts.push(<span key={`f-${keyIdx++}`} className="font-display font-semibold text-slate-900">{full}</span>)
    } else if (match[2]) {
      const isNeg = full.startsWith('-')
      const isPos = full.startsWith('+') || (!isNeg && parseFloat(full) > 0)
      parts.push(<span key={`p-${keyIdx++}`} className={`font-display font-semibold ${isNeg ? 'text-loss' : isPos ? 'text-gain' : 'text-slate-900'}`}>{full}</span>)
    } else if (match[3]) {
      parts.push(<span key={`c-${keyIdx++}`} className="font-display font-semibold" style={{ color: COIN_COLORS[full] }}>{full}</span>)
    }
    lastIndex = match.index + full.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

interface BriefData {
  content: string
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.12 }}
      className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm mb-6"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-cyan" />
          </div>
          <span className="text-sm font-display font-semibold text-slate-900">AI Market Brief</span>
          {brief && (
            <span className="text-[10px] text-slate-400 font-body">
              {formatTime(brief.generated_at)}
            </span>
          )}
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
        <div className="space-y-2">
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
        <p className="text-[13px] text-slate-600 font-body leading-relaxed">
          {formatFinancialText(brief.content)}
        </p>
      ) : null}
    </motion.div>
  )
}
