import { create } from 'zustand'
import { api } from '@/shared/lib/api'

export interface NewsArticle {
  title: string
  source: string
  url: string
  published_at: number
  image_url: string
  related_coins: string[]
}

interface NewsState {
  articles: NewsArticle[]
  loading: boolean
  error: string | null
  fetchNews: (coins?: string[], limit?: number) => Promise<void>
}

export const useNewsStore = create<NewsState>((set, get) => ({
  articles: [],
  loading: false,
  error: null,

  fetchNews: async (coins?: string[], limit = 20) => {
    const current = get()
    if (!current.articles.length) {
      set({ loading: true })
    }
    try {
      const params = new URLSearchParams()
      if (coins?.length) params.set('coins', coins.join(','))
      params.set('limit', String(limit))
      const { data } = await api.get<{ articles: NewsArticle[] }>(
        `/news?${params.toString()}`
      )
      set({ articles: data.articles, loading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch news'
      set({ error: message, loading: false })
    }
  },
}))
