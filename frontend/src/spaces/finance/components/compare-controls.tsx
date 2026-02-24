import { motion } from 'framer-motion'

const AVAILABLE_COINS = [
  { id: 'bitcoin', label: 'BTC', color: '#F7931A' },
  { id: 'ripple', label: 'XRP', color: '#00D4FF' },
  { id: 'ethereum', label: 'ETH', color: '#627EEA' },
  { id: 'solana', label: 'SOL', color: '#00E599' },
  { id: 'dogecoin', label: 'DOGE', color: '#C3A634' },
]

const TIME_WINDOWS = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
  { value: 365, label: '1Y' },
]

const NORM_METHODS = [
  { value: 'minmax' as const, label: 'Min-Max' },
  { value: 'zscore' as const, label: 'Z-Score' },
]

interface CompareControlsProps {
  selectedCoins: string[]
  days: number
  method: 'minmax' | 'zscore'
  onCoinsChange: (coins: string[]) => void
  onDaysChange: (days: number) => void
  onMethodChange: (method: 'minmax' | 'zscore') => void
}

export function CompareControls({
  selectedCoins,
  days,
  method,
  onCoinsChange,
  onDaysChange,
  onMethodChange,
}: CompareControlsProps) {
  const toggleCoin = (coinId: string) => {
    if (selectedCoins.includes(coinId)) {
      if (selectedCoins.length <= 2) return
      onCoinsChange(selectedCoins.filter((c) => c !== coinId))
    } else {
      onCoinsChange([...selectedCoins, coinId])
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex flex-wrap items-center gap-3"
    >
      <div className="flex items-center gap-1 rounded-lg bg-surface-1 border border-border p-0.5">
        {AVAILABLE_COINS.map((coin) => {
          const selected = selectedCoins.includes(coin.id)
          return (
            <button
              key={coin.id}
              onClick={() => toggleCoin(coin.id)}
              className={`relative px-3 py-1.5 rounded-md text-xs font-display font-medium transition-all duration-200 cursor-pointer ${
                selected
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              {selected && (
                <motion.div
                  layoutId="coin-bg"
                  className="absolute inset-0 rounded-md bg-surface-0 shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
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
        {TIME_WINDOWS.map((tw) => (
          <button
            key={tw.value}
            onClick={() => onDaysChange(tw.value)}
            className={`relative px-3 py-1.5 rounded-md text-xs font-display font-medium transition-all duration-200 cursor-pointer ${
              days === tw.value
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/70'
            }`}
          >
            {days === tw.value && (
              <motion.div
                layoutId="time-bg"
                className="absolute inset-0 rounded-md bg-surface-0 shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{tw.label}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border" />

      <div className="flex items-center gap-1 rounded-lg bg-surface-1 border border-border p-0.5">
        {NORM_METHODS.map((nm) => (
          <button
            key={nm.value}
            onClick={() => onMethodChange(nm.value)}
            className={`relative px-3 py-1.5 rounded-md text-xs font-display font-medium transition-all duration-200 cursor-pointer ${
              method === nm.value
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/70'
            }`}
          >
            {method === nm.value && (
              <motion.div
                layoutId="method-bg"
                className="absolute inset-0 rounded-md bg-surface-0 shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{nm.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}

export { AVAILABLE_COINS }
