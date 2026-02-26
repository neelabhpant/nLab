import { useEffect, useState, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Menu, Search, LogOut, Library } from 'lucide-react'
import { usePriceStore } from '@/spaces/finance/stores/price-store'
import { useAuthStore } from '@/shared/stores/auth-store'
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
  onMenuToggle?: () => void
}

export function TopHeader({ title, subtitle, children, onMenuToggle }: TopHeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { prices, fetchPrices } = usePriceStore()
  const { user, logout } = useAuthStore()
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

  const activeSpaceId = location.pathname === '/vault' || location.pathname.startsWith('/vault/')
    ? 'vault'
    : SPACES.find((s) =>
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
    <header className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4 border-b border-border bg-surface-0">
      <div className="flex items-center gap-3 md:gap-8 min-w-0">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-surface-1 transition-colors flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="min-w-0">
          <h1 className="text-base md:text-xl font-display font-bold tracking-tight text-slate-900 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground font-body hidden sm:block">{subtitle}</p>
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
                className={`flex items-center gap-2 px-2.5 md:px-4 py-2 rounded-lg text-[13px] font-display font-semibold tracking-tight transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-surface-2'
                }`}
              >
                <SpaceIcon className="w-4 h-4" strokeWidth={2.2} />
                <span className="hidden md:inline">{space.name}</span>
              </button>
            )
          })}
          <button
            onClick={() => navigate('/vault')}
            className={`flex items-center gap-2 px-2.5 md:px-4 py-2 rounded-lg text-[13px] font-display font-semibold tracking-tight transition-all duration-200 cursor-pointer ${
              activeSpaceId === 'vault'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-surface-2'
            }`}
          >
            <Library className="w-4 h-4" strokeWidth={2.2} />
            <span className="hidden md:inline">Vault</span>
          </button>
        </div>
      </div>

      {children && <div className="hidden sm:flex items-center">{children}</div>}

      <div className="flex items-center gap-3 md:gap-6">
        {isFinance && tickerPrices.length > 0 && (
          <div className="hidden md:flex items-center gap-4">
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

        {isFinance && tickerPrices.length > 0 && <div className="hidden md:block h-6 w-px bg-border" />}

        <div className="hidden md:block">
          <AISearch />
        </div>

        <button
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors"
        >
          <Search className="w-[18px] h-[18px]" />
        </button>

        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors cursor-pointer">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-loss" />
        </button>

        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 cursor-pointer"
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-cyan flex items-center justify-center">
                <span className="text-xs font-display font-bold text-white">
                  {(user?.name ?? 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-surface-0 shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-display font-semibold text-slate-900 truncate">
                  {user?.name}
                </p>
                <p className="text-xs font-body text-slate-500 truncate">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => { setProfileOpen(false); logout() }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-body text-slate-600 hover:bg-surface-1 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="absolute top-full left-0 right-0 z-30 border-b border-border bg-surface-0 p-3 md:hidden">
          <AISearch />
        </div>
      )}
    </header>
  )
}
