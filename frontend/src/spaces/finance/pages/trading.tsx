import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  BarChart3,
  Shield,
  X as XIcon,
  Check,
  Clock,
  Ban,
  AlertCircle,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useTradingStore } from '@/spaces/finance/stores/trading-store'
import type { Order } from '@/spaces/finance/stores/trading-store'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { AnimatedNumber } from '@/shared/components/animated-number'
import { TradeConfirmationModal } from '@/spaces/finance/components/trading/trade-confirmation-modal'

const REFRESH_INTERVAL = 30_000
const HISTORY_PERIODS = [
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
]

const ORDER_STATUS_STYLE: Record<string, { bg: string; text: string; icon: typeof Check }> = {
  filled: { bg: 'bg-gain/10', text: 'text-gain', icon: Check },
  partially_filled: { bg: 'bg-gain/10', text: 'text-gain', icon: Check },
  new: { bg: 'bg-amber-500/10', text: 'text-amber-600', icon: Clock },
  accepted: { bg: 'bg-amber-500/10', text: 'text-amber-600', icon: Clock },
  pending_new: { bg: 'bg-amber-500/10', text: 'text-amber-600', icon: Clock },
  canceled: { bg: 'bg-slate-200', text: 'text-slate-500', icon: Ban },
  cancelled: { bg: 'bg-slate-200', text: 'text-slate-500', icon: Ban },
  expired: { bg: 'bg-slate-200', text: 'text-slate-500', icon: Ban },
  rejected: { bg: 'bg-loss/10', text: 'text-loss', icon: AlertCircle },
}

function formatCurrency(val: string | number | null, decimals = 2): string {
  if (val === null || val === undefined) return '--'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return '--'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function formatPct(val: string | number | null): string {
  if (val === null || val === undefined) return '--'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return '--'
  return `${(n * 100).toFixed(2)}%`
}

function formatTime(ts: string | null): string {
  if (!ts) return '--'
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface-0 px-3 py-2 shadow-lg">
      <p className="text-[11px] text-muted-foreground mb-1">
        {new Date((label as number) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
      <p className="text-sm font-display font-semibold text-slate-900">
        {formatCurrency(payload[0].value ?? 0)}
      </p>
    </div>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  const style = ORDER_STATUS_STYLE[status] ?? ORDER_STATUS_STYLE.rejected
  const Icon = style.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  )
}

export function Trading() {
  const { onMobileMenuToggle } = useLayoutContext()
  const {
    account,
    positions,
    orders,
    history,
    accountLoading,
    orderSubmitting,
    orderError,
    orderSuccess,
    fetchAccount,
    fetchPositions,
    fetchOrders,
    fetchHistory,
    placeOrder,
    cancelOrder,
    clearOrderFeedback,
  } = useTradingStore()

  const [historyPeriod, setHistoryPeriod] = useState('1M')
  const [tradeSymbol, setTradeSymbol] = useState('')
  const [tradeQty, setTradeQty] = useState('')
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetchAccount()
    fetchPositions()
    fetchOrders()
    fetchHistory(historyPeriod)
    const interval = setInterval(() => {
      fetchAccount()
      fetchPositions()
    }, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchAccount, fetchPositions, fetchOrders, fetchHistory, historyPeriod])

  useEffect(() => {
    fetchHistory(historyPeriod)
  }, [historyPeriod, fetchHistory])

  useEffect(() => {
    if (orderSuccess || orderError) {
      const t = setTimeout(clearOrderFeedback, 4000)
      return () => clearTimeout(t)
    }
  }, [orderSuccess, orderError, clearOrderFeedback])

  const handleTradeSubmit = useCallback(() => {
    const qty = parseFloat(tradeQty)
    if (!tradeSymbol.trim() || isNaN(qty) || qty <= 0) return
    setShowConfirm(true)
  }, [tradeSymbol, tradeQty])

  const handleConfirmOrder = useCallback(async () => {
    const qty = parseFloat(tradeQty)
    const success = await placeOrder(tradeSymbol.trim(), qty, tradeSide)
    setShowConfirm(false)
    if (success) {
      setTradeSymbol('')
      setTradeQty('')
      fetchPositions()
      fetchAccount()
      fetchOrders()
    }
  }, [tradeSymbol, tradeQty, tradeSide, placeOrder, fetchPositions, fetchAccount, fetchOrders])

  const equity = account ? parseFloat(account.equity) : 0
  const lastEquity = account ? parseFloat(account.last_equity) : 0
  const dailyPl = equity - lastEquity
  const dailyPlPct = lastEquity > 0 ? (dailyPl / lastEquity) * 100 : 0

  const chartData = useMemo(() => {
    if (!history?.points) return []
    return history.points
      .filter((p) => p.equity !== null)
      .map((p) => ({ timestamp: p.timestamp, equity: p.equity }))
  }, [history])

  const openOrders = useMemo(
    () => orders.filter((o) => ['new', 'accepted', 'pending_new', 'partially_filled'].includes(o.status)),
    [orders],
  )

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Trading" subtitle="Paper trading · Alpaca" onMenuToggle={onMobileMenuToggle} />

      <div className="flex-1 overflow-auto p-3 md:p-6 lg:p-8">
        {(orderSuccess || orderError) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mb-4 px-4 py-3 rounded-lg text-sm font-body flex items-center justify-between ${
              orderSuccess ? 'bg-gain/10 text-gain border border-gain/20' : 'bg-loss/10 text-loss border border-loss/20'
            }`}
          >
            <span>{orderSuccess || orderError}</span>
            <button onClick={clearOrderFeedback} className="cursor-pointer">
              <XIcon className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          {[
            { label: 'Portfolio Value', value: account?.portfolio_value, icon: BarChart3, color: '#0EA5E9' },
            { label: 'Buying Power', value: account?.buying_power, icon: DollarSign, color: '#16A34A' },
            { label: 'Cash', value: account?.cash, icon: Wallet, color: '#8B5CF6' },
            { label: 'Equity', value: account?.equity, icon: TrendingUp, color: '#F59E0B' },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="rounded-xl border border-border bg-surface-0 p-3 md:p-4 shadow-md overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${card.color}, ${card.color}80)` }} />
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-body text-slate-400 uppercase tracking-wider">{card.label}</span>
                <card.icon className="w-4 h-4 text-slate-300" />
              </div>
              {card.value && !accountLoading ? (
                <AnimatedNumber
                  value={parseFloat(card.value)}
                  prefix="$"
                  decimals={2}
                  className="text-xl md:text-2xl font-display font-bold text-slate-900"
                />
              ) : (
                <div className="h-8 w-24 rounded bg-surface-1 animate-pulse" />
              )}
            </motion.div>
          ))}
        </div>

        {account && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex items-center gap-4 mb-6"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-display font-medium px-3 py-1.5 rounded-lg bg-cyan/10 text-cyan border border-cyan/20">
              <Shield className="w-3.5 h-3.5" />
              PAPER
            </span>
            <span className={`text-sm font-display font-semibold ${dailyPl >= 0 ? 'text-gain' : 'text-loss'}`}>
              {dailyPl >= 0 ? '+' : ''}{formatCurrency(dailyPl)} ({dailyPlPct >= 0 ? '+' : ''}{dailyPlPct.toFixed(2)}%) today
            </span>
          </motion.div>
        )}

        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="rounded-xl border border-border bg-surface-0 p-3 md:p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-display font-semibold text-slate-900">Portfolio Performance</h2>
                <div className="flex items-center gap-1 rounded-lg bg-surface-1 border border-border p-0.5">
                  {HISTORY_PERIODS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setHistoryPeriod(p.value)}
                      className={`px-3 py-1 rounded-md text-xs font-display font-medium transition-colors cursor-pointer ${
                        historyPeriod === p.value
                          ? 'bg-surface-0 text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[200px] md:h-[260px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -12 }}>
                      <defs>
                        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="#E5E7EB" vertical={false} />
                      <XAxis
                        dataKey="timestamp"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(ts: number) => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        tick={{ fontSize: 11, fill: '#6B7280', fontFamily: "'Outfit', sans-serif" }}
                        axisLine={{ stroke: '#E5E7EB' }}
                        tickLine={false}
                        minTickGap={60}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
                        tick={{ fontSize: 11, fill: '#6B7280', fontFamily: "'Outfit', sans-serif" }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }} />
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="#0EA5E9"
                        strokeWidth={2}
                        fill="url(#equityGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#0EA5E9', stroke: '#FFFFFF', strokeWidth: 2 }}
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
                <h2 className="text-base font-display font-semibold text-slate-900">Open Positions</h2>
              </div>
              {positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {['Symbol', 'Qty', 'Avg Entry', 'Current', 'Mkt Value', 'P&L', 'P&L %'].map((h) => (
                          <th key={h} className="text-left text-xs font-body font-medium text-muted-foreground px-4 py-3 first:pl-6 last:pr-6 last:text-right">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => {
                        const pl = parseFloat(pos.unrealized_pl)
                        const plPct = parseFloat(pos.unrealized_plpc)
                        const isPos = pl >= 0
                        return (
                          <tr key={pos.asset_id} className="border-b border-border/50 last:border-b-0 hover:bg-surface-1/50 transition-colors">
                            <td className="px-4 py-3 pl-6">
                              <span className="text-sm font-display font-semibold text-slate-900">{pos.symbol}</span>
                              <p className="text-[11px] text-slate-400 capitalize">{pos.side}</p>
                            </td>
                            <td className="px-4 py-3 text-sm font-body text-slate-700">{parseFloat(pos.qty)}</td>
                            <td className="px-4 py-3 text-sm font-body text-slate-700">{formatCurrency(pos.avg_entry_price)}</td>
                            <td className="px-4 py-3 text-sm font-display font-semibold text-slate-900">{formatCurrency(pos.current_price)}</td>
                            <td className="px-4 py-3 text-sm font-body text-slate-700">{formatCurrency(pos.market_value)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-sm font-display font-semibold ${isPos ? 'text-gain' : 'text-loss'}`}>
                                {isPos ? '+' : ''}{formatCurrency(pl)}
                              </span>
                            </td>
                            <td className="px-4 py-3 pr-6 text-right">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${isPos ? 'text-gain' : 'text-loss'}`}>
                                {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {formatPct(plPct)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-body">No open positions. Place your first trade below.</p>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="rounded-xl border border-border bg-surface-0 shadow-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-base font-display font-semibold text-slate-900">Recent Orders</h2>
              </div>
              {orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {['Symbol', 'Side', 'Qty', 'Type', 'Status', 'Submitted', ''].map((h) => (
                          <th key={h} className="text-left text-xs font-body font-medium text-muted-foreground px-4 py-3 first:pl-6 last:pr-6">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 20).map((order: Order) => {
                        const isOpen = openOrders.some((o) => o.id === order.id)
                        return (
                          <tr key={order.id} className="border-b border-border/50 last:border-b-0 hover:bg-surface-1/50 transition-colors">
                            <td className="px-4 py-3 pl-6 text-sm font-display font-semibold text-slate-900">{order.symbol}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium uppercase ${order.side === 'buy' ? 'text-gain' : 'text-loss'}`}>
                                {order.side}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-body text-slate-700">{parseFloat(order.qty)}</td>
                            <td className="px-4 py-3 text-xs font-body text-slate-500 capitalize">{order.type}</td>
                            <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                            <td className="px-4 py-3 text-xs font-body text-slate-500">{formatTime(order.submitted_at)}</td>
                            <td className="px-4 py-3 pr-6">
                              {isOpen && (
                                <button
                                  onClick={() => cancelOrder(order.id)}
                                  className="text-xs text-loss hover:text-loss/80 font-medium cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-body">No orders yet.</p>
                </div>
              )}
            </motion.div>
          </div>

          <div className="w-full xl:w-[340px] flex-shrink-0">
            <div className="xl:sticky xl:top-0">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="rounded-xl border border-border bg-surface-0 p-5 shadow-md"
              >
                <h3 className="text-base font-display font-semibold text-slate-900 mb-4">Quick Trade</h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-body text-slate-400 uppercase tracking-wider mb-1.5 block">Symbol</label>
                    <input
                      type="text"
                      value={tradeSymbol}
                      onChange={(e) => setTradeSymbol(e.target.value.toUpperCase())}
                      placeholder="AAPL"
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-1 text-sm font-display font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-body text-slate-400 uppercase tracking-wider mb-1.5 block">Quantity</label>
                    <input
                      type="number"
                      value={tradeQty}
                      onChange={(e) => setTradeQty(e.target.value)}
                      placeholder="10"
                      min="0"
                      step="1"
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-1 text-sm font-display font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-body text-slate-400 uppercase tracking-wider mb-1.5 block">Side</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setTradeSide('buy')}
                        className={`px-4 py-2.5 rounded-lg text-sm font-display font-semibold transition-colors cursor-pointer ${
                          tradeSide === 'buy'
                            ? 'bg-gain text-white shadow-md'
                            : 'bg-surface-1 text-slate-500 border border-border hover:bg-gain/10 hover:text-gain'
                        }`}
                      >
                        Buy
                      </button>
                      <button
                        onClick={() => setTradeSide('sell')}
                        className={`px-4 py-2.5 rounded-lg text-sm font-display font-semibold transition-colors cursor-pointer ${
                          tradeSide === 'sell'
                            ? 'bg-loss text-white shadow-md'
                            : 'bg-surface-1 text-slate-500 border border-border hover:bg-loss/10 hover:text-loss'
                        }`}
                      >
                        Sell
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleTradeSubmit}
                    disabled={!tradeSymbol.trim() || !tradeQty || parseFloat(tradeQty) <= 0}
                    className={`w-full px-4 py-3 rounded-lg text-sm font-display font-semibold text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      tradeSide === 'buy'
                        ? 'bg-gain hover:bg-gain/90'
                        : 'bg-loss hover:bg-loss/90'
                    }`}
                  >
                    {tradeSide === 'buy' ? 'Buy' : 'Sell'} {tradeSymbol || '...'}
                  </button>

                  <p className="text-[10px] text-slate-400 font-body text-center">
                    Market order · Day · Paper trading
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <TradeConfirmationModal
        open={showConfirm}
        symbol={tradeSymbol}
        qty={parseFloat(tradeQty) || 0}
        side={tradeSide}
        submitting={orderSubmitting}
        onConfirm={handleConfirmOrder}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
