import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { AnimatedNumber } from '@/shared/components/animated-number'
import { Sparkline } from './sparkline'

interface PriceCardProps {
  coinId: string
  name: string
  symbol: string
  price: number | null
  change24h: number | null
  marketCap: number | null
  sparklineData: { price: number }[]
  accentColor: string
  index: number
}

function formatMarketCap(value: number | null): string {
  if (!value) return '—'
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${value.toLocaleString()}`
}

export function PriceCard({
  name,
  symbol,
  price,
  change24h,
  marketCap,
  sparklineData,
  accentColor,
  index,
}: PriceCardProps) {
  const isPositive = (change24h ?? 0) >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
      className="group relative rounded-2xl border border-surface-3/60 bg-surface-1 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div
        className="absolute top-0 left-0 right-0 h-[1px] opacity-40"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)` }}
      />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm"
              style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
            >
              {symbol.slice(0, 1)}
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">{name}</h3>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{symbol}</span>
            </div>
          </div>

          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
            isPositive
              ? 'bg-gain/10 text-gain'
              : 'bg-loss/10 text-loss'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {change24h !== null ? `${Math.abs(change24h).toFixed(2)}%` : '—'}
          </div>
        </div>

        <div className="mb-5">
          {price !== null ? (
            <AnimatedNumber
              value={price}
              prefix="$"
              decimals={price < 10 ? 4 : 2}
              className="text-[2.5rem] leading-none font-display font-bold tracking-tight text-foreground"
            />
          ) : (
            <span className="text-[2.5rem] leading-none font-display font-bold tracking-tight text-muted-foreground">—</span>
          )}
        </div>

        <div className="h-[72px] -mx-2">
          <Sparkline data={sparklineData} color={accentColor} />
        </div>

        <div className="mt-4 pt-4 border-t border-surface-3/40">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Market Cap</span>
            <span className="text-xs font-display font-medium text-secondary-foreground">
              {formatMarketCap(marketCap)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
