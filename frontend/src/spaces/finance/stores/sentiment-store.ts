import { create } from 'zustand'
import { api } from '@/shared/lib/api'

interface DailyScore {
  date: string
  score: number
  article_count: number
}

interface CoinHeatmapData {
  coin: string
  days: DailyScore[]
}

interface SentimentSummaryItem {
  coin: string
  score: number
  trend: string
  article_count: number
  top_bullish: string | null
  top_bearish: string | null
}

interface SentimentState {
  heatmap: CoinHeatmapData[]
  trend: CoinHeatmapData[]
  summaries: SentimentSummaryItem[]
  heatmapLoading: boolean
  trendLoading: boolean
  summaryLoading: boolean
  error: string | null
  fetchHeatmap: (coins: string[], days: number) => Promise<void>
  fetchTrend: (coins: string[], days: number) => Promise<void>
  fetchSummary: (coins: string[]) => Promise<void>
}

export type { DailyScore, CoinHeatmapData, SentimentSummaryItem }

export const useSentimentStore = create<SentimentState>((set) => ({
  heatmap: [],
  trend: [],
  summaries: [],
  heatmapLoading: false,
  trendLoading: false,
  summaryLoading: false,
  error: null,

  fetchHeatmap: async (coins, days) => {
    set({ heatmapLoading: true, error: null })
    try {
      const { data } = await api.get<{ coins: CoinHeatmapData[] }>(
        `/sentiment/heatmap?coins=${coins.join(',')}&days=${days}`
      )
      set({ heatmap: data.coins, heatmapLoading: false })
    } catch {
      set({ heatmapLoading: false })
    }
  },

  fetchTrend: async (coins, days) => {
    set({ trendLoading: true, error: null })
    try {
      const { data } = await api.get<{ coins: CoinHeatmapData[] }>(
        `/sentiment/trend?coins=${coins.join(',')}&days=${days}`
      )
      set({ trend: data.coins, trendLoading: false })
    } catch {
      set({ trendLoading: false })
    }
  },

  fetchSummary: async (coins) => {
    set({ summaryLoading: true, error: null })
    try {
      const { data } = await api.get<{ summaries: SentimentSummaryItem[] }>(
        `/sentiment/summary?coins=${coins.join(',')}`
      )
      set({ summaries: data.summaries, summaryLoading: false })
    } catch {
      set({ summaryLoading: false })
    }
  },
}))
