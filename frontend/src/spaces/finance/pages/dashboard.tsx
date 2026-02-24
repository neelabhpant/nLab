import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { usePriceStore } from '@/spaces/finance/stores/price-store'
import { TopHeader } from '@/shared/components/top-header'
import { AnimatedNumber } from '@/shared/components/animated-number'
import { Sparkline } from '@/spaces/finance/components/sparkline'
import { ErrorCard } from '@/shared/components/error-card'
import { NewsFeed } from '@/spaces/finance/components/news-feed'
import { MarketBrief } from '@/spaces/finance/components/market-brief'
import { SentimentStrip } from '@/spaces/finance/components/sentiment-strip'

const ALL_MARKET_COINS = ['bitcoin', 'ripple', 'ethereum', 'solana', 'dogecoin']
const PRICE_REFRESH = 60_000
const HISTORICAL_REFRESH = 300_000
const HISTORICAL_STAGGER = 1_500

const CHART_COINS = [
  { id: 'bitcoin', symbol: 'BTC', color: '#F7931A' },
  { id: 'ripple', symbol: 'XRP', color: '#0EA5E9' },
]

const TIME_RANGES: { label: string; days: number }[] = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
]

const COIN_META: Record<string, { name: string; symbol: string; color: string; icon: string }> = {
  bitcoin: { name: 'Bitcoin', symbol: 'BTC', color: '#F7931A', icon: 'B' },
  ripple: { name: 'XRP', symbol: 'XRP', color: '#0EA5E9', icon: 'X' },
  ethereum: { name: 'Ethereum', symbol: 'ETH', color: '#627EEA', icon: 'E' },
  solana: { name: 'Solana', symbol: 'SOL', color: '#14B8A6', icon: 'S' },
  dogecoin: { name: 'Dogecoin', symbol: 'DOGE', color: '#C3A634', icon: 'D' },
}


function formatMarketCap(value: number | null): string {
  if (!value) return '--'
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}

function formatXAxis(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface-0 px-3 py-2 shadow-lg">
      <p className="text-[11px] text-muted-foreground mb-1">
        {new Date(label as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
      <p className="text-sm font-display font-semibold text-slate-900">
        ${payload[0].value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const { prices, historical, loading, error, fetchPrices, fetchHistorical } = usePriceStore()
  const [chartCoin, setChartCoin] = useState('bitcoin')
  const [chartDays, setChartDays] = useState(7)

  const fetchAllHistorical = useCallback(async () => {
    for (const coin of ALL_MARKET_COINS) {
      fetchHistorical(coin, 7)
      await new Promise((r) => setTimeout(r, HISTORICAL_STAGGER))
    }
  }, [fetchHistorical])

  useEffect(() => {
    fetchPrices(ALL_MARKET_COINS)
    fetchAllHistorical()
    const priceInterval = setInterval(() => fetchPrices(ALL_MARKET_COINS), PRICE_REFRESH)
    const histInterval = setInterval(fetchAllHistorical, HISTORICAL_REFRESH)
    return () => {
      clearInterval(priceInterval)
      clearInterval(histInterval)
    }
  }, [fetchPrices, fetchAllHistorical])

  useEffect(() => {
    fetchHistorical(chartCoin, chartDays)
  }, [chartCoin, chartDays, fetchHistorical])

  const activeCoinMeta = CHART_COINS.find((c) => c.id === chartCoin) ?? CHART_COINS[0]

  const chartData = useMemo(() => {
    const hist = historical[chartCoin]
    if (!hist?.prices?.length) return []
    return hist.prices.map((p) => ({ timestamp: p.timestamp, price: p.price }))
  }, [historical, chartCoin])

  const allMarketData = useMemo(() => {
    return prices.map((p) => ({
      coin_id: p.coin_id,
      usd: p.usd ?? 0,
      usd_24h_change: p.usd_24h_change ?? 0,
      usd_market_cap: p.usd_market_cap ?? 0,
    }))
  }, [prices])

  const btcPrice = prices.find((p) => p.coin_id === 'bitcoin')
  const xrpPrice = prices.find((p) => p.coin_id === 'ripple')

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Dashboard" subtitle="Portfolio overview and market data" />

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        {error && !loading && !prices.length && (
          <div className="mb-6">
            <ErrorCard message={error} onRetry={() => { fetchPrices(ALL_MARKET_COINS); fetchAllHistorical() }} />
          </div>
        )}

        <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 min-w-0">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {btcPrice && btcPrice.usd !== null && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="rounded-xl border border-border bg-surface-0 p-5 shadow-md overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #F7931A, #F7931A80)' }} />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-sm" style={{ backgroundColor: '#F7931A20', color: '#F7931A' }}>B</div>
                  <div>
                    <span className="text-sm font-display font-semibold text-slate-900">Bitcoin</span>
                    <p className="text-[11px] text-slate-400 font-body">BTC</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${(btcPrice.usd_24h_change ?? 0) >= 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                  {(btcPrice.usd_24h_change ?? 0) >= 0 ? '+' : ''}{(btcPrice.usd_24h_change ?? 0).toFixed(2)}%
                </span>
              </div>
              <AnimatedNumber
                value={btcPrice.usd}
                prefix="$"
                decimals={2}
                className="text-3xl font-display font-bold text-slate-900"
              />
              {btcPrice.usd_market_cap && (
                <p className="text-[11px] text-slate-400 font-body mt-0.5">MCap {formatMarketCap(btcPrice.usd_market_cap)}</p>
              )}
              <div className="h-[56px] mt-3 -mx-1">
                <Sparkline data={historical['bitcoin']?.prices?.map((p) => ({ price: p.price })) ?? []} color="#F7931A" />
              </div>
            </motion.div>
          )}

          {xrpPrice && xrpPrice.usd !== null && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-xl border border-border bg-surface-0 p-5 shadow-md overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #0EA5E9, #0EA5E980)' }} />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-sm" style={{ backgroundColor: '#0EA5E920', color: '#0EA5E9' }}>X</div>
                  <div>
                    <span className="text-sm font-display font-semibold text-slate-900">XRP</span>
                    <p className="text-[11px] text-slate-400 font-body">Ripple</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${(xrpPrice.usd_24h_change ?? 0) >= 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                  {(xrpPrice.usd_24h_change ?? 0) >= 0 ? '+' : ''}{(xrpPrice.usd_24h_change ?? 0).toFixed(2)}%
                </span>
              </div>
              <AnimatedNumber
                value={xrpPrice.usd}
                prefix="$"
                decimals={4}
                className="text-3xl font-display font-bold text-slate-900"
              />
              {xrpPrice.usd_market_cap && (
                <p className="text-[11px] text-slate-400 font-body mt-0.5">MCap {formatMarketCap(xrpPrice.usd_market_cap)}</p>
              )}
              <div className="h-[56px] mt-3 -mx-1">
                <Sparkline data={historical['ripple']?.prices?.map((p) => ({ price: p.price })) ?? []} color="#0EA5E9" />
              </div>
            </motion.div>
          )}

        </div>

        <SentimentStrip />

        <MarketBrief />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-xl border border-border bg-surface-0 p-6 shadow-sm mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-display font-semibold text-slate-900">{activeCoinMeta.symbol} Price Performance</h2>
              <p className="text-xs text-slate-500 font-body">Last {chartDays === 7 ? '7 days' : chartDays === 30 ? '30 days' : chartDays === 180 ? '6 months' : '1 year'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-surface-1 border border-border p-0.5">
                {CHART_COINS.map((coin) => (
                  <button
                    key={coin.id}
                    onClick={() => setChartCoin(coin.id)}
                    className={`px-3 py-1 rounded-md text-xs font-display font-medium transition-colors cursor-pointer ${
                      chartCoin === coin.id
                        ? 'bg-surface-0 text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {coin.symbol}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-surface-1 border border-border p-0.5">
                {TIME_RANGES.map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => setChartDays(days)}
                    className={`px-3 py-1 rounded-md text-xs font-display font-medium transition-colors cursor-pointer ${
                      chartDays === days
                        ? 'bg-surface-0 text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="h-[240px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -12 }}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={activeCoinMeta.color} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={activeCoinMeta.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" stroke="#E5E7EB" vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={formatXAxis}
                    tick={{ fontSize: 11, fill: '#6B7280', fontFamily: "'Outfit', sans-serif" }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={false}
                    minTickGap={60}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`}
                    tick={{ fontSize: 11, fill: '#6B7280', fontFamily: "'Outfit', sans-serif" }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={activeCoinMeta.color}
                    strokeWidth={2}
                    fill="url(#chartGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: activeCoinMeta.color, stroke: '#FFFFFF', strokeWidth: 2 }}
                    animationDuration={1200}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-xl border border-border bg-surface-0 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-display font-semibold text-slate-900">Market Overview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-body font-medium text-muted-foreground px-6 py-3">Asset</th>
                  <th className="text-right text-xs font-body font-medium text-muted-foreground px-6 py-3">Price</th>
                  <th className="text-right text-xs font-body font-medium text-muted-foreground px-6 py-3">24h Change</th>
                  <th className="text-right text-xs font-body font-medium text-muted-foreground px-6 py-3 hidden lg:table-cell">7d Chart</th>
                  <th className="text-right text-xs font-body font-medium text-muted-foreground px-6 py-3 hidden md:table-cell">Market Cap</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {allMarketData.map((coin) => {
                  const meta = COIN_META[coin.coin_id] ?? {
                    name: coin.coin_id,
                    symbol: coin.coin_id.toUpperCase(),
                    color: '#6B7280',
                    icon: coin.coin_id.charAt(0).toUpperCase(),
                  }
                  const isPositive = coin.usd_24h_change >= 0
                  const hist = historical[coin.coin_id]
                  const sparkData = hist?.prices?.map((p) => ({ price: p.price })) ?? []

                  return (
                    <tr
                      key={coin.coin_id}
                      className="border-b border-border/50 last:border-b-0 hover:bg-surface-1/50 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/finance/analytics?coins=bitcoin,${coin.coin_id}&days=30`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-xs"
                            style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                          >
                            {meta.icon}
                          </div>
                          <div>
                            <p className="text-sm font-display font-semibold text-slate-900">{meta.name}</p>
                            <p className="text-xs text-muted-foreground">{meta.symbol}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-display font-semibold text-slate-900">
                          ${coin.usd.toLocaleString('en-US', {
                            minimumFractionDigits: coin.usd < 10 ? 4 : 2,
                            maximumFractionDigits: coin.usd < 10 ? 4 : 2,
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-gain' : 'text-loss'}`}>
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}{coin.usd_24h_change.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right hidden lg:table-cell">
                        <div className="w-[100px] h-[32px] ml-auto">
                          {sparkData.length > 0 ? (
                            <Sparkline data={sparkData} color={meta.color} />
                          ) : (
                            <span className="text-[10px] text-slate-300 font-body">Loading...</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right hidden md:table-cell">
                        <span className="text-sm text-muted-foreground font-body">
                          {formatMarketCap(coin.usd_market_cap)}
                        </span>
                      </td>
                      <td className="pr-4 py-4 w-8">
                        <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        </div>

        <div className="w-full xl:w-[340px] flex-shrink-0">
          <div className="xl:sticky xl:top-0 xl:max-h-[calc(100vh-8rem)]">
            <NewsFeed />
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
