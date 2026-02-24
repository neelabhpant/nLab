import { motion } from 'framer-motion'
import { Link2, Unlink } from 'lucide-react'

interface CorrelationBadgeProps {
  value: number | null
  coinA: string
  coinB: string
}

function getCorrelationInfo(r: number): { label: string; colorClass: string; bgClass: string } {
  const abs = Math.abs(r)
  if (abs >= 0.8) return { label: 'Strong', colorClass: 'text-cyan', bgClass: 'bg-cyan/10 border-cyan/20' }
  if (abs >= 0.5) return { label: 'Moderate', colorClass: 'text-chart-3', bgClass: 'bg-chart-3/10 border-chart-3/20' }
  if (abs >= 0.3) return { label: 'Weak', colorClass: 'text-muted-foreground', bgClass: 'bg-surface-3/50 border-surface-3' }
  return { label: 'Negligible', colorClass: 'text-muted-foreground/60', bgClass: 'bg-surface-2/50 border-surface-3/50' }
}

export function CorrelationBadge({ value, coinA, coinB }: CorrelationBadgeProps) {
  if (value === null) return null

  const info = getCorrelationInfo(value)
  const isNegative = value < 0
  const Icon = Math.abs(value) >= 0.3 ? Link2 : Unlink

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className={`inline-flex items-center gap-3 rounded-xl border px-4 py-2.5 ${info.bgClass}`}
    >
      <Icon className={`w-3.5 h-3.5 ${info.colorClass}`} />
      <div className="flex items-baseline gap-2">
        <span className={`text-lg font-display font-bold tracking-tight ${info.colorClass}`}>
          {value >= 0 ? '+' : ''}{value.toFixed(3)}
        </span>
        <span className="text-xs text-muted-foreground">
          {info.label} {isNegative ? 'inverse' : ''} correlation
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
        {coinA} / {coinB}
      </span>
    </motion.div>
  )
}
