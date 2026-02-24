import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { usePriceStore } from '@/spaces/finance/stores/price-store'
import { SPACES } from '@/spaces/registry'
import { AnimatedNumber } from './animated-number'
import { AISearch } from './ai-search'

const TICKER_COINS = ['bitcoin', 'ripple']
const TICKER_INTERVAL = 60_000

const COIN_META: Record<string, { symbol: string; color: string }> = {
  bitcoin: { symbol: 'BTC', color: '#F7931A' },
  ripple: { symbol: 'XRP', color: '#0EA5E9' },
}

interface TopHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

export function TopHeader({ title, subtitle, children }: TopHeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { prices, fetchPrices } = usePriceStore()

  const activeSpaceId = SPACES.find((s) =>
    location.pathname === s.basePath || location.pathname.startsWith(s.basePath + '/')
  )?.id ?? 'finance'

  const isFinance = activeSpaceId === 'finance'

  useEffect(() => {
    if (!isFinance) return
    fetchPrices(TICKER_COINS)
    const interval = setInterval(() => fetchPrices(TICKER_COINS), TICKER_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchPrices, isFinance])

  const tickerPrices = prices.filter((p) => TICKER_COINS.includes(p.coin_id))

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-surface-0">
      <div className="flex items-center gap-8">
        <div>
          <h1 className="text-xl font-display font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground font-body">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {SPACES.map((space) => {
            const SpaceIcon = space.icon
            const isActive = space.id === activeSpaceId
            return (
              <button
                key={space.id}
                onClick={() => navigate(space.basePath)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-display font-semibold tracking-tight transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-surface-2'
                }`}
              >
                <SpaceIcon className="w-4 h-4" strokeWidth={2.2} />
                {space.name}
              </button>
            )
          })}
        </div>
      </div>

      {children && <div className="flex items-center">{children}</div>}

      <div className="flex items-center gap-6">
        {isFinance && tickerPrices.length > 0 && (
          <div className="flex items-center gap-4">
            {tickerPrices.map((coin) => {
              const meta = COIN_META[coin.coin_id]
              if (!meta || coin.usd === null) return null
              const change = coin.usd_24h_change
              const isPositive = change !== null && change >= 0
              return (
                <div key={coin.coin_id} className="flex items-center gap-2">
                  <span
                    className="text-xs font-display font-bold"
                    style={{ color: meta.color }}
                  >
                    {meta.symbol}
                  </span>
                  <AnimatedNumber
                    value={coin.usd}
                    prefix="$"
                    decimals={coin.usd > 100 ? 0 : 4}
                    className="text-sm font-display font-semibold text-slate-900"
                    duration={0.4}
                  />
                  {change !== null && (
                    <span
                      className={`text-xs font-display font-medium ${
                        isPositive ? 'text-gain' : 'text-loss'
                      }`}
                    >
                      {isPositive ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {isFinance && tickerPrices.length > 0 && <div className="h-6 w-px bg-border" />}

        <AISearch />

        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors cursor-pointer">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-loss" />
        </button>

        <div className="w-9 h-9 rounded-full bg-cyan flex items-center justify-center">
          <span className="text-xs font-display font-bold text-white">NP</span>
        </div>
      </div>
    </header>
  )
}
