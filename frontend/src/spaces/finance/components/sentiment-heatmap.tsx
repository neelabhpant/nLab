import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { CoinHeatmapData } from '@/spaces/finance/stores/sentiment-store'
import { AVAILABLE_COINS } from './compare-controls'

function sentimentColor(score: number, articleCount: number): string {
  if (articleCount === 0) return 'transparent'
  const clamped = Math.max(-1, Math.min(1, score))
  if (clamped > 0) {
    const t = clamped
    const r = Math.round(180 - t * 158)
    const g = Math.round(210 + t * 45)
    const b = Math.round(200 - t * 170)
    return `rgb(${r},${g},${b})`
  }
  if (clamped < 0) {
    const t = -clamped
    const r = Math.round(210 + t * 45)
    const g = Math.round(190 - t * 140)
    const b = Math.round(190 - t * 140)
    return `rgb(${r},${g},${b})`
  }
  return 'rgb(191,209,229)'
}

function legendColor(score: number): string {
  return sentimentColor(score, 1)
}

function sentimentLabel(score: number): string {
  if (score > 0.3) return 'Very Bullish'
  if (score > 0.1) return 'Bullish'
  if (score < -0.3) return 'Very Bearish'
  if (score < -0.1) return 'Bearish'
  return 'Neutral'
}

interface TooltipData {
  date: string
  score: number
  articleCount: number
  x: number
  y: number
}

interface SentimentHeatmapProps {
  data: CoinHeatmapData[]
  loading: boolean
}

export function SentimentHeatmap({ data, loading }: SentimentHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const maxCols = useMemo(() => {
    return Math.max(...data.map((c) => c.days.length), 0)
  }, [data])

  const dateLabels = useMemo(() => {
    if (!data.length || !data[0].days.length) return []
    const days = data[0].days
    const step = days.length <= 10 ? 1 : Math.max(3, Math.floor(days.length / 8))
    const labels: { index: number; label: string }[] = []
    for (let i = 0; i < days.length; i += step) {
      const d = new Date(days[i].date + 'T00:00:00')
      labels.push({
        index: i,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })
    }
    return labels
  }, [data])

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface-0 p-6 shadow-sm">
        <div className="animate-pulse space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-4 bg-surface-2 rounded" />
              <div className="flex-1 h-9 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border border-border bg-surface-0 p-6 shadow-sm relative"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {data.map((coinData, rowIdx) => {
            const meta = AVAILABLE_COINS.find((c) => c.id === coinData.coin)
            return (
              <div key={coinData.coin} className="flex items-center gap-3 mb-[3px] last:mb-0">
                <div className="w-10 flex-shrink-0">
                  <span
                    className="text-xs font-display font-bold"
                    style={{ color: meta?.color ?? '#6B7280' }}
                  >
                    {meta?.label ?? coinData.coin.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 flex gap-[3px]">
                  {coinData.days.map((day, colIdx) => {
                    const noData = day.article_count === 0
                    return (
                      <motion.div
                        key={day.date}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.2,
                          delay: rowIdx * 0.04 + colIdx * 0.008,
                        }}
                        className={`flex-1 h-9 rounded-[3px] cursor-crosshair transition-all hover:ring-2 hover:ring-slate-400/50 hover:z-10 ${
                          noData ? 'border border-dashed border-slate-200' : ''
                        }`}
                        style={{ backgroundColor: sentimentColor(day.score, day.article_count) }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setTooltip({
                            date: day.date,
                            score: day.score,
                            articleCount: day.article_count,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          })
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}

          {dateLabels.length > 0 && (
            <div className="flex items-center gap-3 mt-1">
              <div className="w-10 flex-shrink-0" />
              <div className="flex-1 relative h-4">
                {dateLabels.map((dl) => {
                  const totalDays = data[0].days.length
                  const pct = totalDays <= 1 ? 0 : (dl.index / (totalDays - 1)) * 100
                  return (
                    <span
                      key={dl.index}
                      className="absolute text-[9px] text-slate-400 font-body whitespace-nowrap"
                      style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
                    >
                      {dl.label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-body">Bearish</span>
            <div className="flex h-2.5 rounded-full overflow-hidden w-32">
              {Array.from({ length: 20 }, (_, i) => {
                const score = -1 + (i / 19) * 2
                return (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: legendColor(score) }}
                  />
                )
              })}
            </div>
            <span className="text-[10px] text-slate-400 font-body">Bullish</span>
            <span className="text-[10px] text-slate-300 font-body ml-2">|</span>
            <span className="inline-block w-3 h-2.5 border border-dashed border-slate-300 rounded-sm ml-1" />
            <span className="text-[10px] text-slate-400 font-body">No data</span>
          </div>
          <span className="text-[10px] text-slate-400 font-body">
            {maxCols} days · {data.length} assets
          </span>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="rounded-lg border border-border bg-surface-0 px-3 py-2 shadow-lg">
            <p className="text-[11px] text-slate-400 font-body">{tooltip.date}</p>
            {tooltip.articleCount === 0 ? (
              <p className="text-xs text-slate-400 font-body">No articles found</p>
            ) : (
              <>
                <p className="text-sm font-display font-semibold text-slate-900">
                  {tooltip.score >= 0 ? '+' : ''}{tooltip.score.toFixed(3)}
                  <span className="text-xs font-normal text-slate-500 ml-1.5">
                    {sentimentLabel(tooltip.score)}
                  </span>
                </p>
                <p className="text-[10px] text-slate-400 font-body">
                  {tooltip.articleCount} article{tooltip.articleCount !== 1 ? 's' : ''} analyzed
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
