import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Layers, BarChart3, Activity } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useCompareStore } from '@/spaces/finance/stores/compare-store'
import { useSentimentStore } from '@/spaces/finance/stores/sentiment-store'
import { pearsonCorrelation } from '@/shared/lib/correlation'
import { CompareControls, AVAILABLE_COINS } from '@/spaces/finance/components/compare-controls'
import { OverlayChart } from '@/spaces/finance/components/overlay-chart'
import { CorrelationBadge } from '@/spaces/finance/components/correlation-badge'
import { CompareSkeleton } from '@/spaces/finance/components/compare-skeleton'
import { ErrorCard } from '@/shared/components/error-card'
import { TopHeader } from '@/shared/components/top-header'
import { SentimentHeatmap } from '@/spaces/finance/components/sentiment-heatmap'
import { SentimentTrendChart } from '@/spaces/finance/components/sentiment-trend-chart'
import { SentimentSummary } from '@/spaces/finance/components/sentiment-summary'
import { CorrelationAnalysis } from '@/spaces/finance/components/correlation-analysis'

type Section = 'correlation' | 'sentiment'

const VALID_COINS = new Set(AVAILABLE_COINS.map((c) => c.id))

const SENTIMENT_DAYS_OPTIONS = [7, 14, 30]

export function Compare() {
  const [section, setSection] = useState<Section>('sentiment')
  const [sentimentCoins, setSentimentCoins] = useState<string[]>(['bitcoin', 'ripple'])
  const [sentimentDays, setSentimentDays] = useState(14)
  const {
    coins, days, method, data, loading, error,
    setCoins, setDays, setMethod, fetchComparison,
  } = useCompareStore()
  const {
    heatmap, summaries, heatmapLoading, summaryLoading,
    fetchHeatmap, fetchSummary,
  } = useSentimentStore()

  const [searchParams, setSearchParams] = useSearchParams()
  const initializedFromUrl = useRef(false)

  useEffect(() => {
    if (initializedFromUrl.current) return
    initializedFromUrl.current = true

    const urlCoins = searchParams.get('coins')
    const urlDays = searchParams.get('days')
    const urlMethod = searchParams.get('method')

    if (urlCoins) {
      const parsed = urlCoins.split(',').filter((c) => VALID_COINS.has(c))
      if (parsed.length >= 2) setCoins(parsed)
    }
    if (urlDays) {
      const d = parseInt(urlDays)
      if ([7, 30, 90, 365].includes(d)) setDays(d)
    }
    if (urlMethod === 'minmax' || urlMethod === 'zscore') {
      setMethod(urlMethod)
    }

    if (urlCoins || urlDays || urlMethod) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, setCoins, setDays, setMethod])

  useEffect(() => {
    fetchComparison()
  }, [coins, days, method, fetchComparison])

  useEffect(() => {
    if (section === 'sentiment' && sentimentCoins.length > 0) {
      fetchHeatmap(sentimentCoins, sentimentDays)
      fetchSummary(sentimentCoins)
    }
  }, [section, sentimentCoins, sentimentDays, fetchHeatmap, fetchSummary])

  const toggleSentimentCoin = useCallback((coinId: string) => {
    setSentimentCoins((prev) => {
      if (prev.includes(coinId)) {
        if (prev.length <= 1) return prev
        return prev.filter((c) => c !== coinId)
      }
      return [...prev, coinId]
    })
  }, [])

  const handleRetry = useCallback(() => {
    fetchComparison()
  }, [fetchComparison])

  const correlation = useMemo(() => {
    if (!data || data.series.length !== 2) return null
    const a = data.series[0].points.map((p) => p.normalized)
    const b = data.series[1].points.map((p) => p.normalized)
    return pearsonCorrelation(a, b)
  }, [data])

  const correlationLabels = useMemo(() => {
    if (!data || data.series.length !== 2) return null
    const metaA = AVAILABLE_COINS.find((c) => c.id === data.series[0].coin_id)
    const metaB = AVAILABLE_COINS.find((c) => c.id === data.series[1].coin_id)
    return {
      a: metaA?.label ?? data.series[0].coin_id.toUpperCase(),
      b: metaB?.label ?? data.series[1].coin_id.toUpperCase(),
    }
  }, [data])

  const animationKey = `${coins.join(',')}-${days}-${method}`

  if (loading && !data && section === 'correlation') {
    return (
      <div className="flex flex-col h-full">
        <TopHeader title="Analytics" subtitle="Market Sentiment & Price Correlation" />
        <div className="flex-1 p-6 lg:p-8">
          <CompareSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Analytics" subtitle="Market Sentiment & Price Correlation" />
      <div className="flex-1 overflow-auto p-6 lg:p-8">

      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center gap-1 rounded-lg bg-surface-1 border border-border p-0.5">
          <button
            onClick={() => setSection('sentiment')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-display font-medium transition-colors cursor-pointer ${
              section === 'sentiment'
                ? 'bg-surface-0 text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Market Sentiment
          </button>
          <button
            onClick={() => setSection('correlation')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-display font-medium transition-colors cursor-pointer ${
              section === 'correlation'
                ? 'bg-surface-0 text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Price Correlation
          </button>
        </div>
      </div>

      {section === 'correlation' && (<>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 flex-shrink-0"
      >
        <div className="flex items-end justify-between mb-6">
          <div />
          {correlation !== null && correlationLabels && (
            <CorrelationBadge
              value={correlation}
              coinA={correlationLabels.a}
              coinB={correlationLabels.b}
            />
          )}
        </div>

        <CompareControls
          selectedCoins={coins}
          days={days}
          method={method}
          onCoinsChange={setCoins}
          onDaysChange={setDays}
          onMethodChange={setMethod}
        />
      </motion.div>

      {error && !loading && (
        <div className="mb-6">
          <ErrorCard message={error} onRetry={handleRetry} />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="flex-1 min-h-0 relative rounded-xl border border-border bg-surface-0 overflow-hidden shadow-sm"
      >

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-0/80 backdrop-blur-sm rounded-xl">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            >
              <Layers className="w-6 h-6 text-cyan" />
            </motion.div>
          </div>
        )}

        <div className="relative p-4 h-full">
          {data && data.series.length > 0 && (
            <div className="h-[460px]">
              <OverlayChart
                series={data.series}
                method={data.method}
                animationKey={animationKey}
              />
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 flex items-center gap-4 flex-shrink-0 mb-4"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {data?.series.map((s) => {
            const meta = AVAILABLE_COINS.find((c) => c.id === s.coin_id)
            return (
              <div key={s.coin_id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="w-3 h-[2px] rounded-full"
                  style={{ backgroundColor: meta?.color ?? '#00D4FF' }}
                />
                <span className="font-display">{meta?.label ?? s.coin_id.toUpperCase()}</span>
                <span className="text-muted-foreground/40">
                  {s.points.length} pts
                </span>
              </div>
            )
          })}
        </div>
        <span className="text-[10px] text-muted-foreground/40 ml-auto">
          {method === 'minmax' ? 'Min-Max [0,1]' : 'Z-Score (σ)'} normalization
        </span>
      </motion.div>

      <div className="mt-6">
        <CorrelationAnalysis coins={coins} days={days} />
      </div>
      </>)}

      {section === 'sentiment' && (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-wrap items-center gap-3"
          >
            <div className="flex items-center gap-1 rounded-lg bg-surface-1 border border-border p-0.5">
              {AVAILABLE_COINS.map((coin) => {
                const selected = sentimentCoins.includes(coin.id)
                return (
                  <button
                    key={coin.id}
                    onClick={() => toggleSentimentCoin(coin.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-display font-medium transition-all duration-200 cursor-pointer ${
                      selected
                        ? 'bg-surface-0 text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: selected ? coin.color : 'transparent', border: selected ? 'none' : `1px solid ${coin.color}50` }}
                      />
                      {coin.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="w-px h-6 bg-border" />

            <div className="flex items-center gap-1 rounded-lg bg-surface-1 border border-border p-0.5">
              {SENTIMENT_DAYS_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setSentimentDays(d)}
                  className={`px-3 py-1.5 rounded-md text-xs font-display font-medium transition-all duration-200 cursor-pointer ${
                    sentimentDays === d
                      ? 'bg-surface-0 text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>
          </motion.div>

          <SentimentSummary summaries={summaries} loading={summaryLoading} />
          <SentimentHeatmap data={heatmap} loading={heatmapLoading} />
          <SentimentTrendChart data={heatmap} loading={heatmapLoading} />
        </div>
      )}
      </div>
    </div>
  )
}
