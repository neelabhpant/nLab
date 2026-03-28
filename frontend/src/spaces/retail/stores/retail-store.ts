import { create } from 'zustand'
import { api, API_BASE, getAuthHeaders } from '@/shared/lib/api'
import type { StructuredReport } from '../utils/pdf-report'

export interface UseCaseSpark {
  id?: string
  title: string
  description: string
  cloudera_capabilities: string[]
  retail_problem: string
  architecture_flow?: string
  competitive_advantage?: string
  confidence: number
  article_title?: string
  article_id?: string
  source_id?: string
}

export interface RetailArticle {
  id: string
  source_id: string
  title: string
  url: string
  published_at: string | null
  fetched_at: string
  raw_content: string | null
  summary: string | null
  key_takeaways: string[]
  use_case_sparks: UseCaseSpark[]
  tags: string[]
  image_url: string | null
  is_bookmarked: boolean
  is_read: boolean
  relevance_score: number | null
}

export interface RetailDigest {
  date: string
  generated_at: string
  articles: RetailArticle[]
  top_theme: string
  theme_summary: string
  use_case_sparks: UseCaseSpark[]
  article_count: number
  source_breakdown: Record<string, number>
}

export interface RetailSource {
  id: string
  name: string
  url: string
  feed_type: string
  tier: string
  enabled: boolean
  focus: string
  last_fetched: string | null
  fetch_interval_minutes: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinkingSteps: { content: string; timestamp: number }[]
  timestamp: number
}

interface RetailState {
  digest: RetailDigest | null
  digestLoading: boolean
  digestDates: string[]

  articles: RetailArticle[]
  articlesLoading: boolean
  articlesCount: number

  sparks: UseCaseSpark[]
  sparksLoading: boolean

  sources: RetailSource[]
  sourcesLoading: boolean

  chatMessages: ChatMessage[]
  chatStreaming: boolean

  fetchingArticles: boolean

  report: string | null
  reportLoading: boolean

  structuredReport: StructuredReport | null
  structuredReportLoading: boolean

  newsletterFileId: string | null
  newsletterLoading: boolean
  newsletterSending: boolean
  newsletterSent: boolean

  error: string | null

  fetchDigest: (date?: string) => Promise<void>
  refreshDigest: () => Promise<void>
  fetchDigestDates: () => Promise<void>

  fetchArticles: (params?: { source_id?: string; tag?: string; bookmarked?: boolean; limit?: number; offset?: number }) => Promise<void>
  toggleBookmark: (articleId: string) => Promise<void>
  markRead: (articleId: string) => Promise<void>
  fetchNewArticles: (tier?: string) => Promise<void>

  fetchSparks: () => Promise<void>

  fetchSources: () => Promise<void>
  updateSource: (sourceId: string, updates: { enabled?: boolean; fetch_interval_minutes?: number }) => Promise<void>

  sendChatMessage: (message: string) => Promise<void>
  clearChat: () => void

  generateReport: (date?: string) => Promise<void>
  fetchStructuredReport: (date?: string) => Promise<StructuredReport | null>
  clearReport: () => void

  generateNewsletter: (topN?: number) => Promise<void>
  downloadNewsletter: (fileId: string) => void
  sendNewsletter: (fileId: string, recipients: string[], subject?: string, body?: string) => Promise<void>
  clearNewsletter: () => void
}

export const useRetailStore = create<RetailState>((set, get) => ({
  digest: null,
  digestLoading: false,
  digestDates: [],
  articles: [],
  articlesLoading: false,
  articlesCount: 0,
  sparks: [],
  sparksLoading: false,
  sources: [],
  sourcesLoading: false,
  chatMessages: [],
  chatStreaming: false,
  fetchingArticles: false,
  report: null,
  reportLoading: false,
  structuredReport: null,
  structuredReportLoading: false,
  newsletterFileId: null,
  newsletterLoading: false,
  newsletterSending: false,
  newsletterSent: false,
  error: null,

  fetchDigest: async (date?: string) => {
    set({ digestLoading: true })
    try {
      const params = date ? `?date=${date}` : ''
      const { data } = await api.get(`/retail/digest${params}`)
      set({ digest: data.digest, digestLoading: false, error: null })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch digest', digestLoading: false })
    }
  },

  refreshDigest: async () => {
    set({ digestLoading: true })
    try {
      const { data } = await api.post('/retail/digest/refresh')
      set({ digest: data.digest, digestLoading: false, error: null })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to refresh digest', digestLoading: false })
    }
  },

  fetchDigestDates: async () => {
    try {
      const { data } = await api.get('/retail/digest/dates')
      set({ digestDates: data.dates })
    } catch { /* ignore */ }
  },

  fetchArticles: async (params) => {
    set({ articlesLoading: true })
    try {
      const qp = new URLSearchParams()
      if (params?.source_id) qp.set('source_id', params.source_id)
      if (params?.tag) qp.set('tag', params.tag)
      if (params?.bookmarked !== undefined) qp.set('bookmarked', String(params.bookmarked))
      if (params?.limit) qp.set('limit', String(params.limit))
      if (params?.offset) qp.set('offset', String(params.offset))
      const { data } = await api.get(`/retail/articles?${qp.toString()}`)
      set({ articles: data.articles, articlesCount: data.count, articlesLoading: false, error: null })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch articles', articlesLoading: false })
    }
  },

  toggleBookmark: async (articleId: string) => {
    try {
      const { data } = await api.post(`/retail/articles/${articleId}/bookmark`)
      if (data.article) {
        set((state) => ({
          articles: state.articles.map((a) => a.id === articleId ? { ...a, is_bookmarked: data.article.is_bookmarked } : a),
        }))
      }
    } catch { /* ignore */ }
  },

  markRead: async (articleId: string) => {
    try {
      await api.post(`/retail/articles/${articleId}/read`)
      set((state) => ({
        articles: state.articles.map((a) => a.id === articleId ? { ...a, is_read: true } : a),
      }))
    } catch { /* ignore */ }
  },

  fetchNewArticles: async (tier?: string) => {
    set({ fetchingArticles: true })
    try {
      await api.post('/retail/articles/fetch', tier ? { tier } : {})
      await get().fetchArticles()
      set({ fetchingArticles: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch articles', fetchingArticles: false })
    }
  },

  fetchSparks: async () => {
    set({ sparksLoading: true })
    try {
      const { data } = await api.get('/retail/sparks')
      set({ sparks: data.sparks, sparksLoading: false, error: null })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch sparks', sparksLoading: false })
    }
  },

  fetchSources: async () => {
    set({ sourcesLoading: true })
    try {
      const { data } = await api.get('/retail/sources')
      set({ sources: data.sources, sourcesLoading: false, error: null })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch sources', sourcesLoading: false })
    }
  },

  updateSource: async (sourceId, updates) => {
    try {
      const { data } = await api.put(`/retail/sources/${sourceId}`, updates)
      if (data.source) {
        set((state) => ({
          sources: state.sources.map((s) => s.id === sourceId ? data.source : s),
        }))
      }
    } catch { /* ignore */ }
  },

  sendChatMessage: async (message: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      thinkingSteps: [],
      timestamp: Date.now(),
    }
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      thinkingSteps: [],
      timestamp: Date.now(),
    }

    set((state) => ({
      chatMessages: [...state.chatMessages, userMsg, assistantMsg],
      chatStreaming: true,
      error: null,
    }))

    try {
      const response = await fetch(`${API_BASE}/retail/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ message }),
      })

      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') continue

          try {
            const event = JSON.parse(payload) as {
              type: 'thinking' | 'text' | 'text_delta' | 'text_done' | 'error'
              content?: string
            }
            set((state) => {
              const msgs = [...state.chatMessages]
              const last = msgs[msgs.length - 1]
              if (last.id !== assistantMsg.id) return state

              if (event.type === 'thinking') {
                last.thinkingSteps = [...last.thinkingSteps, { content: event.content ?? '', timestamp: Date.now() }]
              } else if (event.type === 'text_delta') {
                last.content += event.content ?? ''
              } else if (event.type === 'text') {
                last.content = event.content ?? ''
              } else if (event.type === 'text_done') {
                // no-op
              } else if (event.type === 'error') {
                last.content = event.content ?? ''
              }
              return { chatMessages: msgs }
            })
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      set((state) => {
        const msgs = [...state.chatMessages]
        const last = msgs[msgs.length - 1]
        if (last.id === assistantMsg.id) {
          last.content = `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`
        }
        return { chatMessages: msgs }
      })
    } finally {
      set({ chatStreaming: false })
    }
  },

  clearChat: () => set({ chatMessages: [], error: null }),

  generateReport: async (date?: string) => {
    set({ reportLoading: true, report: null })
    try {
      const params = date ? `?date=${date}` : ''
      const response = await fetch(`${API_BASE}/retail/report${params}`, {
        headers: { ...getAuthHeaders() },
      })
      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullReport = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          try {
            const event = JSON.parse(payload) as { type: string; content?: string }
            if (event.type === 'text_delta' && event.content) {
              fullReport += event.content
              set({ report: fullReport })
            } else if (event.type === 'error') {
              set({ error: event.content || 'Report generation failed' })
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to generate report' })
    } finally {
      set({ reportLoading: false })
    }
  },

  fetchStructuredReport: async (date?: string) => {
    set({ structuredReportLoading: true })
    try {
      const params = date ? `?date=${date}` : ''
      const { data } = await api.get(`/retail/report/structured${params}`)
      if (data.error) {
        set({ error: data.error, structuredReportLoading: false })
        return null
      }
      set({ structuredReport: data.report, structuredReportLoading: false })
      return data.report as StructuredReport
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch structured report', structuredReportLoading: false })
      return null
    }
  },

  clearReport: () => set({ report: null, reportLoading: false, structuredReport: null, structuredReportLoading: false }),

  generateNewsletter: async (topN = 10) => {
    set({ newsletterLoading: true, newsletterFileId: null, newsletterSent: false })
    try {
      const { data } = await api.post('/retail/newsletter/generate', { top_n: topN })
      if (data.error) {
        set({ error: data.error, newsletterLoading: false })
      } else {
        set({ newsletterFileId: data.file_id, newsletterLoading: false, error: null })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to generate newsletter', newsletterLoading: false })
    }
  },

  downloadNewsletter: (fileId: string) => {
    window.open(`${API_BASE}/retail/newsletter/download/${fileId}`, '_blank')
  },

  sendNewsletter: async (fileId: string, recipients: string[], subject?: string, body?: string) => {
    set({ newsletterSending: true, newsletterSent: false })
    try {
      const payload: Record<string, unknown> = { file_id: fileId, recipients }
      if (subject) payload.subject = subject
      if (body) payload.body = body
      const { data } = await api.post('/retail/newsletter/send', payload)
      if (data.error) {
        set({ error: data.error, newsletterSending: false })
      } else {
        set({ newsletterSending: false, newsletterSent: true, error: null })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to send newsletter', newsletterSending: false })
    }
  },

  clearNewsletter: () => set({ newsletterFileId: null, newsletterLoading: false, newsletterSending: false, newsletterSent: false }),
}))
