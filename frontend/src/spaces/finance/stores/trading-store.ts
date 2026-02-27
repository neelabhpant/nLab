import { create } from 'zustand'
import { api } from '@/shared/lib/api'

export interface TradingAccount {
  id: string
  status: string
  currency: string
  buying_power: string
  cash: string
  portfolio_value: string
  equity: string
  last_equity: string
  long_market_value: string
  short_market_value: string
  initial_margin: string
  maintenance_margin: string
  daytrade_count: number
  pattern_day_trader: boolean
}

export interface Position {
  asset_id: string
  symbol: string
  qty: string
  side: string
  market_value: string
  cost_basis: string
  avg_entry_price: string
  current_price: string
  change_today: string
  unrealized_pl: string
  unrealized_plpc: string
  unrealized_intraday_pl: string
  unrealized_intraday_plpc: string
}

export interface Order {
  id: string
  symbol: string
  qty: string
  filled_qty: string
  side: string
  type: string
  time_in_force: string
  status: string
  limit_price: string | null
  filled_avg_price: string | null
  submitted_at: string | null
  filled_at: string | null
  created_at: string | null
}

export interface HistoryPoint {
  timestamp: number
  equity: number | null
  profit_loss: number | null
  profit_loss_pct: number | null
}

export interface PortfolioHistory {
  base_value: number | null
  timeframe: string | null
  points: HistoryPoint[]
}

export interface TradingObjective {
  goal: string
  target_return_pct: number
  timeframe_days: number
  risk_tolerance: 'low' | 'moderate' | 'aggressive'
  max_position_pct: number
  asset_universe: string[]
  max_daily_loss_pct: number
  status: 'active' | 'paused' | 'completed'
  created_at: string
  updated_at: string
}

export interface TradeProposal {
  id: string
  symbol: string
  action: string
  qty: number
  rationale: string
  expected_impact: string
  risk_level: string
  risk_review: string
  status: 'pending' | 'approved' | 'rejected' | 'executed'
  created_at: string
  reviewed_at: string | null
}

interface TradingState {
  account: TradingAccount | null
  positions: Position[]
  orders: Order[]
  history: PortfolioHistory | null
  accountLoading: boolean
  positionsLoading: boolean
  ordersLoading: boolean
  historyLoading: boolean
  orderSubmitting: boolean
  error: string | null
  orderError: string | null
  orderSuccess: string | null

  objective: TradingObjective | null
  proposals: TradeProposal[]
  objectiveLoading: boolean
  generatingProposals: boolean
  proposalExecuting: string | null

  fetchAccount: () => Promise<void>
  fetchPositions: () => Promise<void>
  fetchOrders: (status?: string) => Promise<void>
  fetchHistory: (period?: string) => Promise<void>
  placeOrder: (symbol: string, qty: number, side: string) => Promise<boolean>
  cancelOrder: (orderId: string) => Promise<void>
  clearOrderFeedback: () => void

  fetchObjective: () => Promise<void>
  saveObjective: (obj: Omit<TradingObjective, 'created_at' | 'updated_at' | 'status'>) => Promise<boolean>
  generateProposals: () => Promise<boolean>
  fetchProposals: () => Promise<void>
  approveProposal: (id: string) => Promise<boolean>
  rejectProposal: (id: string) => Promise<boolean>
  executeProposal: (id: string) => Promise<boolean>
}

export const useTradingStore = create<TradingState>((set, get) => ({
  account: null,
  positions: [],
  orders: [],
  history: null,
  accountLoading: false,
  positionsLoading: false,
  ordersLoading: false,
  historyLoading: false,
  orderSubmitting: false,
  error: null,
  orderError: null,
  orderSuccess: null,

  objective: null,
  proposals: [],
  objectiveLoading: false,
  generatingProposals: false,
  proposalExecuting: null,

  fetchAccount: async () => {
    set({ accountLoading: true })
    try {
      const { data } = await api.get('/trading/account')
      set({ account: data, accountLoading: false, error: null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch account'
      set({ accountLoading: false, error: msg })
    }
  },

  fetchPositions: async () => {
    set({ positionsLoading: true })
    try {
      const { data } = await api.get('/trading/positions')
      set({ positions: data, positionsLoading: false })
    } catch {
      set({ positionsLoading: false })
    }
  },

  fetchOrders: async (status = 'all') => {
    set({ ordersLoading: true })
    try {
      const { data } = await api.get(`/trading/orders?status=${status}`)
      set({ orders: data, ordersLoading: false })
    } catch {
      set({ ordersLoading: false })
    }
  },

  fetchHistory: async (period = '1M') => {
    set({ historyLoading: true })
    try {
      const { data } = await api.get(`/trading/history?period=${period}&timeframe=1D`)
      set({ history: data, historyLoading: false })
    } catch {
      set({ historyLoading: false })
    }
  },

  placeOrder: async (symbol: string, qty: number, side: string) => {
    set({ orderSubmitting: true, orderError: null, orderSuccess: null })
    try {
      const { data } = await api.post('/trading/orders', {
        symbol,
        qty,
        side,
        order_type: 'market',
        time_in_force: 'day',
      })
      set({
        orderSubmitting: false,
        orderSuccess: `${side.toUpperCase()} ${qty} ${symbol.toUpperCase()} — ${data.status}`,
      })
      return true
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.detail || 'Order failed'
      set({ orderSubmitting: false, orderError: msg })
      return false
    }
  },

  cancelOrder: async (orderId: string) => {
    try {
      await api.delete(`/trading/orders/${orderId}`)
      set((s) => ({ orders: s.orders.filter((o) => o.id !== orderId) }))
    } catch {
      // silent
    }
  },

  clearOrderFeedback: () => set({ orderError: null, orderSuccess: null }),

  fetchObjective: async () => {
    set({ objectiveLoading: true })
    try {
      const { data } = await api.get('/trading/objectives')
      set({ objective: data, objectiveLoading: false })
    } catch {
      set({ objective: null, objectiveLoading: false })
    }
  },

  saveObjective: async (obj) => {
    try {
      const { data } = await api.post('/trading/objectives', obj)
      set({ objective: data })
      return true
    } catch {
      return false
    }
  },

  generateProposals: async () => {
    set({ generatingProposals: true })
    try {
      const { data } = await api.post('/trading/proposals/generate')
      set({ proposals: data.proposals ?? [], generatingProposals: false })
      return true
    } catch {
      set({ generatingProposals: false })
      return false
    }
  },

  fetchProposals: async () => {
    try {
      const { data } = await api.get('/trading/proposals')
      set({ proposals: data })
    } catch {
      // silent
    }
  },

  approveProposal: async (id: string) => {
    try {
      await api.post(`/trading/proposals/${id}/approve`)
      set((s) => ({
        proposals: s.proposals.map((p) =>
          p.id === id ? { ...p, status: 'approved' as const } : p
        ),
      }))
      return true
    } catch {
      return false
    }
  },

  rejectProposal: async (id: string) => {
    try {
      await api.post(`/trading/proposals/${id}/reject`)
      set((s) => ({
        proposals: s.proposals.map((p) =>
          p.id === id ? { ...p, status: 'rejected' as const } : p
        ),
      }))
      return true
    } catch {
      return false
    }
  },

  executeProposal: async (id: string) => {
    set({ proposalExecuting: id })
    try {
      await api.post(`/trading/proposals/${id}/execute`)
      set((s) => ({
        proposals: s.proposals.map((p) =>
          p.id === id ? { ...p, status: 'executed' as const } : p
        ),
        proposalExecuting: null,
        orderSuccess: `Trade executed successfully`,
      }))
      get().fetchAccount()
      get().fetchPositions()
      return true
    } catch {
      set({ proposalExecuting: null, orderError: 'Failed to execute trade' })
      return false
    }
  },
}))
