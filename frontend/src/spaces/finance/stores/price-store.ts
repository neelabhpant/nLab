import { create } from 'zustand'
import { api } from '@/shared/lib/api'

interface CoinPrice {
  coin_id: string
  usd: number | null
  usd_24h_change: number | null
  usd_market_cap: number | null
}

interface PricePoint {
  timestamp: number
  price: number
}

interface HistoricalData {
  coin_id: string
  days: number
  prices: PricePoint[]
}

interface PriceState {
  prices: CoinPrice[]
  historical: Record<string, HistoricalData>
  loading: boolean
  historicalLoading: boolean
  error: string | null
  lastUpdated: number | null
  fetchPrices: (coins: string[]) => Promise<void>
  fetchHistorical: (coinId: string, days: number) => Promise<void>
}

export const usePriceStore = create<PriceState>((set, get) => ({
  prices: [],
  historical: {},
  loading: false,
  historicalLoading: false,
  error: null,
  lastUpdated: null,

  fetchPrices: async (coins: string[]) => {
    const current = get()
    if (!current.prices.length) {
      set({ loading: true })
    }
    try {
      const { data } = await api.get<{ prices: CoinPrice[] }>(
        `/prices?coins=${coins.join(',')}`
      )
      set({
        prices: data.prices,
        loading: false,
        error: null,
        lastUpdated: Date.now(),
      })
    } catch (err) {
      const current = get()
      if (!current.prices.length) {
        const message = err instanceof Error ? err.message : 'Failed to fetch prices'
        set({ error: message, loading: false })
      } else {
        set({ loading: false })
      }
    }
  },

  fetchHistorical: async (coinId: string, days: number) => {
    set({ historicalLoading: true })
    try {
      const { data } = await api.get<HistoricalData>(
        `/historical/${coinId}?days=${days}`
      )
      set((state) => ({
        historical: { ...state.historical, [coinId]: data },
        historicalLoading: false,
      }))
    } catch {
      set({ historicalLoading: false })
    }
  },
}))
