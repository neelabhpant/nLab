import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Gauge } from 'lucide-react'
import type { SentimentSummaryItem } from '@/spaces/finance/stores/sentiment-store'

interface SentimentGaugeProps {
  summaries: SentimentSummaryItem[]
  loading: boolean
}

const SEGMENTS = [
  { label: 'Extreme Fear', color: '#DC2626', range: [-1, -0.5] },
  { label: 'Fear', color: '#F97316', range: [-0.5, -0.15] },
  { label: 'Neutral', color: '#94A3B8', range: [-0.15, 0.15] },
  { label: 'Greed', color: '#22C55E', range: [0.15, 0.5] },
  { label: 'Extreme Greed', color: '#16A34A', range: [0.5, 1] },
]

function getSegment(score: number) {
  for (const seg of SEGMENTS) {
    if (score >= seg.range[0] && score <= seg.range[1]) return seg
  }
  return score < -0.5 ? SEGMENTS[0] : SEGMENTS[SEGMENTS.length - 1]
}

export function SentimentGauge({ summaries, loading }: SentimentGaugeProps) {
  const avgScore = useMemo(() => {
    if (!summaries.length) return 0
    return summaries.reduce((sum, s) => sum + s.score, 0) / summaries.length
  }, [summaries])

  const segment = getSegment(avgScore)
  const clamped = Math.max(-1, Math.min(1, avgScore))
  const needleAngle = -90 + ((clamped + 1) / 2) * 180

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm animate-pulse h-full">
        <div className="h-4 w-32 bg-surface-2 rounded mb-4" />
        <div className="h-40 bg-surface-2 rounded-full mx-auto w-48" />
      </div>
    )
  }

  if (!summaries.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-xl border border-border bg-surface-0 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border flex-shrink-0">
        <Gauge className="w-4 h-4 text-cyan" />
        <h3 className="text-sm font-display font-semibold text-slate-900">Market Mood</h3>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-5">
        <div className="relative w-52 h-28">
          <svg viewBox="0 0 200 110" className="w-full h-full">
            {SEGMENTS.map((seg, i) => {
              const startAngle = -180 + (i / SEGMENTS.length) * 180
              const endAngle = -180 + ((i + 1) / SEGMENTS.length) * 180
              const r = 80
              const cx = 100
              const cy = 100

              const startRad = (startAngle * Math.PI) / 180
              const endRad = (endAngle * Math.PI) / 180

              const x1 = cx + r * Math.cos(startRad)
              const y1 = cy + r * Math.sin(startRad)
              const x2 = cx + r * Math.cos(endRad)
              const y2 = cy + r * Math.sin(endRad)

              const largeArc = endAngle - startAngle > 180 ? 1 : 0

              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={14}
                  strokeLinecap="round"
                  opacity={0.25}
                />
              )
            })}

            {(() => {
              const activeIdx = SEGMENTS.indexOf(segment)
              if (activeIdx < 0) return null
              const startAngle = -180 + (activeIdx / SEGMENTS.length) * 180
              const endAngle = -180 + ((activeIdx + 1) / SEGMENTS.length) * 180
              const r = 80
              const cx = 100
              const cy = 100

              const startRad = (startAngle * Math.PI) / 180
              const endRad = (endAngle * Math.PI) / 180

              const x1 = cx + r * Math.cos(startRad)
              const y1 = cy + r * Math.sin(startRad)
              const x2 = cx + r * Math.cos(endRad)
              const y2 = cy + r * Math.sin(endRad)

              return (
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={14}
                  strokeLinecap="round"
                />
              )
            })()}

            <motion.g
              initial={{ rotate: -90 }}
              animate={{ rotate: needleAngle }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
              style={{ transformOrigin: '100px 100px' }}
            >
              <line
                x1="100"
                y1="100"
                x2="100"
                y2="32"
                stroke={segment.color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <circle cx="100" cy="100" r="5" fill={segment.color} />
              <circle cx="100" cy="100" r="2.5" fill="white" />
            </motion.g>
          </svg>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-2"
        >
          <span
            className="text-2xl font-display font-bold"
            style={{ color: segment.color }}
          >
            {avgScore >= 0 ? '+' : ''}{avgScore.toFixed(2)}
          </span>
          <p
            className="text-sm font-display font-semibold mt-0.5"
            style={{ color: segment.color }}
          >
            {segment.label}
          </p>
        </motion.div>

        <div className="flex items-center gap-3 mt-4 flex-wrap justify-center">
          {SEGMENTS.map((seg) => (
            <div key={seg.label} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: seg.color, opacity: seg === segment ? 1 : 0.3 }}
              />
              <span className="text-[10px] font-body text-slate-400">{seg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
