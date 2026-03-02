import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronDown,
  Activity,
  MessageSquare,
  BarChart3,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react'
import { api } from '@/shared/lib/api'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'

const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', icon: 'B' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#627EEA', icon: 'E' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', color: '#14B8A6', icon: 'S' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', color: '#0EA5E9', icon: 'X' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', color: '#C3A634', icon: 'D' },
]

const HORIZONS = [
  { days: 7, label: '7 Day' },
  { days: 14, label: '14 Day' },
  { days: 30, label: '30 Day' },
]

interface PriceCase {
  price: number
  probability: number
}

interface SignalDetail {
  direction: string
  confidence: number
  summary: string
}

interface ForecastData {
  coin_id: string
  coin: string
  current_price: number
  horizon_days: number
  bull_case: PriceCase
  base_case: PriceCase
  bear_case: PriceCase
  confidence: number
  direction: string
  signals: {
    technical?: SignalDetail
    sentiment?: SignalDetail
    fundamentals?: SignalDetail
  }
  explanation: string
  generated_at: number
}

const DIRECTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof TrendingUp }> = {
  bullish: { label: 'Bullish', color: 'text-gain', bg: 'bg-gain/10', icon: TrendingUp },
  bearish: { label: 'Bearish', color: 'text-loss', bg: 'bg-loss/10', icon: TrendingDown },
  neutral: { label: 'Neutral', color: 'text-slate-500', bg: 'bg-surface-2', icon: Minus },
}

const SIGNAL_ICONS: Record<string, typeof Activity> = {
  technical: Activity,
  sentiment: MessageSquare,
  fundamentals: BarChart3,
}

const SIGNAL_LABELS: Record<string, string> = {
  technical: 'Technical Analysis',
  sentiment: 'Market Sentiment',
  fundamentals: 'Fundamentals',
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  if (price >= 1) return `$${price.toFixed(2)}`
  return `$${price.toFixed(4)}`
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function PriceRangeGauge({ forecast }: { forecast: ForecastData }) {
  const { bear_case, base_case, bull_case, current_price } = forecast
  const min = bear_case.price * 0.97
  const max = bull_case.price * 1.03
  const range = max - min

  const bearPos = ((bear_case.price - min) / range) * 100
  const basePos = ((base_case.price - min) / range) * 100
  const bullPos = ((bull_case.price - min) / range) * 100
  const currentPos = ((current_price - min) / range) * 100

  const baseIsHigher = base_case.price >= current_price

  return (
    <div className="mt-4 mb-2">
      <div className="relative h-3 rounded-full bg-gradient-to-r from-loss/20 via-slate-200 to-gain/20 overflow-hidden">
        <motion.div
          className="absolute top-0 h-full rounded-full bg-gradient-to-r from-loss/40 via-cyan/30 to-gain/40"
          style={{ left: `${bearPos}%`, width: `${bullPos - bearPos}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-400 shadow-md z-10"
          style={{ left: `${currentPos}%`, marginLeft: '-7px' }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
        />
      </div>
      <div className="relative mt-2 h-14">
        <div className="absolute flex flex-col items-center" style={{ left: `${bearPos}%`, transform: 'translateX(-50%)' }}>
          <span className="text-[10px] font-display font-bold text-loss">{formatPrice(bear_case.price)}</span>
          <span className="text-[9px] text-slate-400 font-body">Bear {bear_case.probability}%</span>
        </div>
        <div className="absolute flex flex-col items-center" style={{ left: `${basePos}%`, transform: 'translateX(-50%)' }}>
          <span className={`text-[11px] font-display font-bold ${baseIsHigher ? 'text-gain' : 'text-loss'}`}>{formatPrice(base_case.price)}</span>
          <span className="text-[9px] text-slate-400 font-body">Base {base_case.probability}%</span>
        </div>
        <div className="absolute flex flex-col items-center" style={{ left: `${bullPos}%`, transform: 'translateX(-50%)' }}>
          <span className="text-[10px] font-display font-bold text-gain">{formatPrice(bull_case.price)}</span>
          <span className="text-[9px] text-slate-400 font-body">Bull {bull_case.probability}%</span>
        </div>
      </div>
    </div>
  )
}

function ConfidenceRing({ value, size = 72 }: { value: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference
  const color = value >= 70 ? '#16A34A' : value >= 50 ? '#0EA5E9' : value >= 30 ? '#F59E0B' : '#DC2626'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={4} className="text-surface-2" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-display font-bold text-slate-900">{value}</span>
      </div>
    </div>
  )
}

function SignalCard({ type, signal }: { type: string; signal: SignalDetail }) {
  const Icon = SIGNAL_ICONS[type] || Activity
  const label = SIGNAL_LABELS[type] || type
  const dir = DIRECTION_CONFIG[signal.direction] ?? DIRECTION_CONFIG.neutral
  const DirIcon = dir.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-surface-0 p-3.5"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-display font-semibold text-slate-700 uppercase tracking-wide">{label}</span>
        </div>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-display font-bold ${dir.color} ${dir.bg}`}>
          <DirIcon className="w-2.5 h-2.5" />
          {dir.label}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: signal.confidence >= 60 ? '#16A34A' : signal.confidence >= 40 ? '#0EA5E9' : '#F59E0B' }}
            initial={{ width: 0 }}
            animate={{ width: `${signal.confidence}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[10px] font-display font-bold text-slate-500">{signal.confidence}%</span>
      </div>
      <p className="text-[11px] text-slate-500 font-body leading-relaxed">{signal.summary}</p>
    </motion.div>
  )
}

export function Forecast() {
  const { collapsed } = useLayoutContext()
  const [selectedCoin, setSelectedCoin] = useState(COINS[0])
  const [horizon, setHorizon] = useState(7)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [coinMenuOpen, setCoinMenuOpen] = useState(false)

  const fetchForecast = useCallback(async (coinId: string, days: number, refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = refresh ? `/forecast/${coinId}/refresh?days=${days}` : `/forecast/${coinId}?days=${days}`
      const method = refresh ? 'post' : 'get'
      const { data } = await api[method]<ForecastData>(url)
      setForecast(data)
    } catch {
      setError('Failed to generate forecast. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchForecast(selectedCoin.id, horizon)
  }, [selectedCoin.id, horizon, fetchForecast])

  const dir = DIRECTION_CONFIG[forecast?.direction ?? 'neutral'] ?? DIRECTION_CONFIG.neutral
  const DirIcon = dir.icon

  const pctChange = forecast
    ? ((forecast.base_case.price - forecast.current_price) / forecast.current_price * 100)
    : 0
  const isPositive = pctChange >= 0

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Price Forecast" subtitle="AI-powered multi-signal price predictions" collapsed={collapsed} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setCoinMenuOpen(!coinMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface-0 hover:bg-surface-1 transition-colors cursor-pointer"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-display font-bold text-white"
                style={{ backgroundColor: selectedCoin.color }}
              >
                {selectedCoin.icon}
              </div>
              <span className="text-sm font-display font-semibold text-slate-900">{selectedCoin.symbol}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <AnimatePresence>
              {coinMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1 left-0 w-48 rounded-lg border border-border bg-surface-0 shadow-lg z-20 py-1"
                >
                  {COINS.map((coin) => (
                    <button
                      key={coin.id}
                      onClick={() => { setSelectedCoin(coin); setCoinMenuOpen(false) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-1 transition-colors cursor-pointer ${coin.id === selectedCoin.id ? 'bg-surface-1' : ''}`}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-display font-bold text-white"
                        style={{ backgroundColor: coin.color }}
                      >
                        {coin.icon}
                      </div>
                      <div>
                        <span className="text-sm font-display font-semibold text-slate-900">{coin.symbol}</span>
                        <span className="text-[11px] text-slate-400 ml-1.5 font-body">{coin.name}</span>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex rounded-lg border border-border overflow-hidden">
            {HORIZONS.map((h) => (
              <button
                key={h.days}
                onClick={() => setHorizon(h.days)}
                className={`px-3.5 py-1.5 text-xs font-display font-semibold transition-colors cursor-pointer ${
                  horizon === h.days
                    ? 'bg-cyan text-white'
                    : 'bg-surface-0 text-slate-500 hover:bg-surface-1'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchForecast(selectedCoin.id, horizon, true)}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold text-slate-500 hover:text-slate-700 hover:bg-surface-1 border border-border transition-colors cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-border bg-surface-0 p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-cyan"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <span className="text-sm text-slate-500 font-body">Analyzing {selectedCoin.name} — gathering signals from technical, sentiment, and fundamental data...</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {['Technical Analysis', 'Sentiment Analysis', 'Fundamentals'].map((label, i) => (
                <div key={label} className="rounded-lg border border-border/50 p-4">
                  <motion.div
                    className="flex items-center gap-2 mb-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.4 }}
                  >
                    <motion.div
                      className="w-2 h-2 rounded-full bg-cyan"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.4 }}
                    />
                    <span className="text-[11px] font-display font-semibold text-slate-600">{label}</span>
                  </motion.div>
                  <div className="animate-pulse space-y-2">
                    <div className="h-2 bg-surface-2 rounded w-full" />
                    <div className="h-2 bg-surface-2 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-600 font-body">{error}</p>
          </div>
        ) : forecast ? (
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-surface-0 p-6"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-display font-bold text-white shadow-sm"
                      style={{ backgroundColor: selectedCoin.color }}
                    >
                      {selectedCoin.icon}
                    </div>
                    <div>
                      <h2 className="text-lg font-display font-bold text-slate-900">{selectedCoin.name} {horizon}-Day Forecast</h2>
                      <span className="text-xs text-slate-400 font-body">Current: {formatPrice(forecast.current_price)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[11px] text-slate-400 font-body block mb-0.5">Projected (Base)</span>
                      <span className="text-2xl font-display font-bold text-slate-900">{formatPrice(forecast.base_case.price)}</span>
                    </div>
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${isPositive ? 'bg-gain/10' : 'bg-loss/10'}`}>
                      {isPositive ? <ArrowUpRight className="w-4 h-4 text-gain" /> : <ArrowDownRight className="w-4 h-4 text-loss" />}
                      <span className={`text-sm font-display font-bold ${isPositive ? 'text-gain' : 'text-loss'}`}>
                        {isPositive ? '+' : ''}{pctChange.toFixed(2)}%
                      </span>
                    </div>
                    <motion.span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-bold ${dir.color} ${dir.bg}`}
                    >
                      <motion.span
                        animate={forecast.direction !== 'neutral' ? { scale: [1, 1.15, 1] } : undefined}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <DirIcon className="w-3.5 h-3.5" />
                      </motion.span>
                      {dir.label}
                    </motion.span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <ConfidenceRing value={forecast.confidence} />
                  <span className="text-[10px] text-slate-400 font-body">Confidence</span>
                </div>
              </div>

              <PriceRangeGauge forecast={forecast} />
            </motion.div>

            <div className="grid grid-cols-3 gap-4">
              {(['technical', 'sentiment', 'fundamentals'] as const).map((key, i) => {
                const signal = forecast.signals[key]
                if (!signal) return null
                return (
                  <motion.div key={key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                    <SignalCard type={key} signal={signal} />
                  </motion.div>
                )
              })}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl border border-border bg-surface-0"
            >
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-surface-1 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan" />
                  <span className="text-sm font-display font-semibold text-slate-900">AI Explanation</span>
                </div>
                <motion.div animate={{ rotate: showExplanation ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </motion.div>
              </button>
              <AnimatePresence>
                {showExplanation && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 border-t border-border/40">
                      <p className="text-[13px] text-slate-600 font-body leading-relaxed pt-3">{forecast.explanation}</p>
                      <div className="flex justify-end mt-2">
                        <span className="text-[10px] text-slate-400 font-body">
                          Generated {formatDate(forecast.generated_at)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Bear Case', case: forecast.bear_case, color: 'text-loss', border: 'border-loss/20', bg: 'bg-loss/5' },
                { label: 'Base Case', case: forecast.base_case, color: 'text-cyan', border: 'border-cyan/20', bg: 'bg-cyan/5' },
                { label: 'Bull Case', case: forecast.bull_case, color: 'text-gain', border: 'border-gain/20', bg: 'bg-gain/5' },
              ].map((scenario, i) => {
                const change = ((scenario.case.price - forecast.current_price) / forecast.current_price * 100)
                return (
                  <motion.div
                    key={scenario.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className={`rounded-lg border ${scenario.border} ${scenario.bg} p-4 text-center`}
                  >
                    <span className="text-[11px] font-display font-semibold text-slate-500 uppercase tracking-wide">{scenario.label}</span>
                    <p className={`text-xl font-display font-bold ${scenario.color} mt-1`}>{formatPrice(scenario.case.price)}</p>
                    <p className={`text-xs font-display font-semibold ${change >= 0 ? 'text-gain' : 'text-loss'} mt-0.5`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-1">
                      <Target className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-body">{scenario.case.probability}% probability</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
