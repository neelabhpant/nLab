import { create } from 'zustand'
import { api } from '@/shared/lib/api'

interface CompareSeriesPoint {
  timestamp: number
  normalized: number
  usd: number
}

interface CompareSeries {
  coin_id: string
  points: CompareSeriesPoint[]
}

interface CompareResponse {
  method: string
  days: number
  series: CompareSeries[]
}

type NormMethod = 'minmax' | 'zscore'

interface CompareState {
  coins: string[]
  days: number
  method: NormMethod
  data: CompareResponse | null
  loading: boolean
  error: string | null
  setCoins: (coins: string[]) => void
  setDays: (days: number) => void
  setMethod: (method: NormMethod) => void
  fetchComparison: () => Promise<void>
}

export const useCompareStore = create<CompareState>((set, get) => ({
  coins: ['bitcoin', 'ripple'],
  days: 30,
  method: 'minmax',
  data: null,
  loading: false,
  error: null,

  setCoins: (coins) => set({ coins }),
  setDays: (days) => set({ days }),
  setMethod: (method) => set({ method }),

  fetchComparison: async () => {
    const { coins, days, method } = get()
    if (coins.length < 2) return
    set({ loading: true, error: null })
    try {
      const { data } = await api.get<CompareResponse>(
        `/compare?coins=${coins.join(',')}&days=${days}&method=${method}`
      )
      set({ data, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch comparison data'
      set({ error: message, loading: false })
    }
  },
}))
