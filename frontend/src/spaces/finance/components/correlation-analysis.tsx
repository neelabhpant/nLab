import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RefreshCw } from 'lucide-react'
import { api } from '@/shared/lib/api'

const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A', XRP: '#0EA5E9', ETH: '#627EEA', SOL: '#14B8A6', DOGE: '#C3A634',
  Bitcoin: '#F7931A', Ripple: '#0EA5E9', Ethereum: '#627EEA', Solana: '#14B8A6', Dogecoin: '#C3A634',
}

function formatFinancialText(text: string): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = []
  const regex = /(\$[\d,]+(?:\.\d+)?(?:[TBMK])?)|([+-]?\d+(?:\.\d+)?%)|(\b(?:BTC|XRP|ETH|SOL|DOGE|Bitcoin|Ripple|Ethereum|Solana|Dogecoin)\b)/g
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
      parts.push(<span key={`c-${keyIdx++}`} className="font-display font-semibold" style={{ color: COIN_COLORS[full] ?? '#6B7280' }}>{full}</span>)
    }
    lastIndex = match.index + full.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

interface AnalysisData {
  content: string
  coins: string[]
  days: number
  generated_at: number
}

interface CorrelationAnalysisProps {
  coins: string[]
  days: number
}

export function CorrelationAnalysis({ coins, days }: CorrelationAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const lastKey = useRef('')

  const fetchAnalysis = useCallback(async (coinsArr: string[], d: number, refresh = false) => {
    const key = `${coinsArr.sort().join(',')}-${d}`
    if (!refresh && key === lastKey.current && analysis) return
    lastKey.current = key

    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const endpoint = refresh ? '/analyze-correlation/refresh' : '/analyze-correlation'
      const method = refresh ? 'post' : 'get'
      const { data } = await api[method]<AnalysisData>(
        `${endpoint}?coins=${coinsArr.join(',')}&days=${d}`
      )
      setAnalysis(data)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [analysis])

  useEffect(() => {
    if (coins.length >= 2) {
      fetchAnalysis(coins, days)
    }
  }, [coins, days, fetchAnalysis])

  const handleRefresh = useCallback(() => {
    fetchAnalysis(coins, days, true)
  }, [coins, days, fetchAnalysis])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-cyan" />
          </div>
          <span className="text-sm font-display font-semibold text-slate-900">AI Analysis</span>
          {analysis && (
            <span className="text-[10px] text-slate-400 font-body">
              {new Date(analysis.generated_at * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-surface-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Regenerate analysis"
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
              {refreshing ? 'Regenerating analysis...' : 'Analyzing correlation...'}
            </span>
          </div>
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-surface-2 rounded w-full" />
            <div className="h-3 bg-surface-2 rounded w-11/12" />
            <div className="h-3 bg-surface-2 rounded w-4/5" />
          </div>
        </div>
      ) : analysis ? (
        <p className="text-[13px] text-slate-600 font-body leading-relaxed">
          {formatFinancialText(analysis.content)}
        </p>
      ) : null}
    </motion.div>
  )
}
