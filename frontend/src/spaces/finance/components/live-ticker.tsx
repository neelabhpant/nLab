import { useEffect } from 'react'
import { usePriceStore } from '@/spaces/finance/stores/price-store'
import { AnimatedNumber } from '@/shared/components/animated-number'

const TICKER_COINS = ['bitcoin', 'ripple']
const TICKER_INTERVAL = 60_000

const COIN_META: Record<string, { symbol: string; color: string }> = {
  bitcoin: { symbol: 'BTC', color: '#F7931A' },
  ripple: { symbol: 'XRP', color: '#00D4FF' },
}

export function LiveTicker() {
  const { prices, fetchPrices } = usePriceStore()

  useEffect(() => {
    fetchPrices(TICKER_COINS)
    const interval = setInterval(() => fetchPrices(TICKER_COINS), TICKER_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchPrices])

  const tickerPrices = prices.filter((p) => TICKER_COINS.includes(p.coin_id))

  if (!tickerPrices.length) return null

  return (
    <div className="flex flex-col gap-3 w-full px-2">
      {tickerPrices.map((coin) => {
        const meta = COIN_META[coin.coin_id]
        if (!meta || coin.usd === null) return null

        const change = coin.usd_24h_change
        const isPositive = change !== null && change >= 0

        return (
          <div key={coin.coin_id} className="flex flex-col items-center gap-0.5">
            <span
              className="text-[10px] font-display font-bold tracking-wide"
              style={{ color: meta.color }}
            >
              {meta.symbol}
            </span>
            <AnimatedNumber
              value={coin.usd}
              prefix="$"
              decimals={coin.usd > 100 ? 0 : 4}
              className="text-[11px] font-display font-semibold text-foreground"
              duration={0.4}
            />
            {change !== null && (
              <span
                className={`text-[9px] font-display font-medium ${
                  isPositive ? 'text-gain' : 'text-loss'
                }`}
              >
                {isPositive ? '+' : ''}
                {change.toFixed(1)}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
