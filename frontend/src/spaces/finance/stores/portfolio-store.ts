import { create } from 'zustand'

export interface Holding {
  account_type: string
  asset: string
  value: number
}

export interface GoalsAnswers {
  selected: string[]
  description: string
}

export interface TimelineAnswers {
  horizon: string
  target_date: string
}

export interface RiskAnswers {
  drawdown_reaction: string
  investment_preference: string
  experience: string
  score: number
}

export interface PortfolioAnswers {
  has_investments: boolean
  holdings: Holding[]
  monthly_investment: number
}

export interface PreferencesAnswers {
  avoid: string[]
  include: string[]
  tax_situation: string
}

export interface QuestionnaireAnswers {
  goals: GoalsAnswers
  timeline: TimelineAnswers
  risk: RiskAnswers
  portfolio: PortfolioAnswers
  preferences: PreferencesAnswers
}

export interface AllocationItem {
  asset_class: string
  percentage: number
  funds: string[]
  rationale: string
}

export interface MonthlyBreakdown {
  fund: string
  amount: number
}

export interface Recommendation {
  allocation: AllocationItem[]
  monthly_plan: { total: number; breakdown: MonthlyBreakdown[] }
  risk_score: number
  risk_analysis: string
  expected_returns: { conservative: number; moderate: number; aggressive: number }
  key_risks: string[]
  tax_notes: string
  rebalancing_schedule: string
  summary: string
}

export interface ThinkingStep {
  content: string
  timestamp: number
}

export interface FollowUpMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinkingSteps: ThinkingStep[]
  timestamp: number
}

interface PortfolioState {
  currentStep: number
  answers: QuestionnaireAnswers
  recommendation: Recommendation | null
  loading: boolean
  activeAgent: string
  error: string | null
  followUpMessages: FollowUpMessage[]
  streaming: boolean
  showChat: boolean

  nextStep: () => void
  prevStep: () => void
  setGoals: (goals: Partial<GoalsAnswers>) => void
  setTimeline: (timeline: Partial<TimelineAnswers>) => void
  setRisk: (risk: Partial<RiskAnswers>) => void
  setPortfolio: (portfolio: Partial<PortfolioAnswers>) => void
  setPreferences: (preferences: Partial<PreferencesAnswers>) => void
  submitQuestionnaire: () => Promise<void>
  sendFollowUp: (content: string) => Promise<void>
  startOver: () => void
  setShowChat: (show: boolean) => void
  importProfile: () => Promise<void>
}

const API_BASE = 'http://localhost:8000/api/v1'

const DEFAULT_ANSWERS: QuestionnaireAnswers = {
  goals: { selected: [], description: '' },
  timeline: { horizon: '', target_date: '' },
  risk: { drawdown_reaction: '', investment_preference: '', experience: '', score: 5 },
  portfolio: { has_investments: false, holdings: [], monthly_investment: 0 },
  preferences: { avoid: [], include: [], tax_situation: '' },
}

function computeRiskScore(risk: RiskAnswers): number {
  let score = 5

  switch (risk.drawdown_reaction) {
    case 'sell_everything':
      score -= 3
      break
    case 'sell_some':
      score -= 1
      break
    case 'hold':
      score += 1
      break
    case 'buy_more':
      score += 3
      break
  }

  switch (risk.investment_preference) {
    case 'steady':
      score -= 2
      break
    case 'balanced':
      break
    case 'maximize':
      score += 2
      break
  }

  switch (risk.experience) {
    case 'beginner':
      score -= 1
      break
    case 'intermediate':
      break
    case 'advanced':
      score += 1
      break
  }

  return Math.max(1, Math.min(10, score))
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  currentStep: 1,
  answers: { ...DEFAULT_ANSWERS },
  recommendation: null,
  loading: false,
  activeAgent: '',
  error: null,
  followUpMessages: [],
  streaming: false,
  showChat: false,

  nextStep: () =>
    set((state) => ({ currentStep: Math.min(5, state.currentStep + 1) })),

  prevStep: () =>
    set((state) => ({ currentStep: Math.max(1, state.currentStep - 1) })),

  setGoals: (goals) =>
    set((state) => ({
      answers: { ...state.answers, goals: { ...state.answers.goals, ...goals } },
    })),

  setTimeline: (timeline) =>
    set((state) => ({
      answers: { ...state.answers, timeline: { ...state.answers.timeline, ...timeline } },
    })),

  setRisk: (risk) => {
    set((state) => {
      const updated = { ...state.answers.risk, ...risk }
      updated.score = computeRiskScore(updated)
      return { answers: { ...state.answers, risk: updated } }
    })
  },

  setPortfolio: (portfolio) =>
    set((state) => ({
      answers: { ...state.answers, portfolio: { ...state.answers.portfolio, ...portfolio } },
    })),

  setPreferences: (preferences) =>
    set((state) => ({
      answers: { ...state.answers, preferences: { ...state.answers.preferences, ...preferences } },
    })),

  submitQuestionnaire: async () => {
    set({ loading: true, error: null, activeAgent: 'Investor Profiler' })

    const agents = [
      { name: 'Investor Profiler', delay: 0 },
      { name: 'Market Research Analyst', delay: 8000 },
      { name: 'Portfolio Strategist', delay: 20000 },
      { name: 'Risk Analyst', delay: 35000 },
    ]

    const timers = agents.slice(1).map((a) =>
      setTimeout(() => {
        if (get().loading) set({ activeAgent: a.name })
      }, a.delay)
    )

    try {
      const response = await fetch(`${API_BASE}/portfolio/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(get().answers),
      })

      timers.forEach(clearTimeout)

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Request failed' }))
        throw new Error(err.detail || err.error || `Server error: ${response.status}`)
      }

      const recommendation: Recommendation = await response.json()
      set({ recommendation, loading: false, activeAgent: '' })
    } catch (err) {
      timers.forEach(clearTimeout)
      const message = err instanceof Error ? err.message : 'Failed to generate recommendation'
      set({ error: message, loading: false, activeAgent: '' })
    }
  },

  sendFollowUp: async (content: string) => {
    const userMessage: FollowUpMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      thinkingSteps: [],
      timestamp: Date.now(),
    }

    const assistantMessage: FollowUpMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      thinkingSteps: [],
      timestamp: Date.now(),
    }

    set((state) => ({
      followUpMessages: [...state.followUpMessages, userMessage, assistantMessage],
      streaming: true,
      error: null,
    }))

    const apiMessages = get()
      .followUpMessages.filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const response = await fetch(`${API_BASE}/portfolio/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          recommendation: get().recommendation,
        }),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

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
              type: 'thinking' | 'text' | 'error'
              content: string
            }

            set((state) => {
              const msgs = [...state.followUpMessages]
              const last = msgs[msgs.length - 1]
              if (last.id !== assistantMessage.id) return state

              if (event.type === 'thinking') {
                last.thinkingSteps = [
                  ...last.thinkingSteps,
                  { content: event.content, timestamp: Date.now() },
                ]
              } else if (event.type === 'text') {
                last.content = event.content
              } else if (event.type === 'error') {
                last.content = event.content
              }

              return { followUpMessages: msgs }
            })
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get response'
      set((state) => {
        const msgs = [...state.followUpMessages]
        const last = msgs[msgs.length - 1]
        if (last.id === assistantMessage.id) {
          last.content = `I encountered an error: ${message}`
        }
        return { followUpMessages: msgs, error: message }
      })
    } finally {
      set({ streaming: false })
    }
  },

  startOver: () =>
    set({
      currentStep: 1,
      answers: { ...DEFAULT_ANSWERS },
      recommendation: null,
      loading: false,
      activeAgent: '',
      error: null,
      followUpMessages: [],
      streaming: false,
      showChat: false,
    }),

  setShowChat: (show) => set({ showChat: show }),

  importProfile: async () => {
    try {
      const res = await fetch(`${API_BASE}/advisor/profile`)
      if (!res.ok) return
      const data = await res.json()
      const profile = data.profile
      if (!profile) return

      const holdings: Holding[] = []
      const accounts = profile.assets?.accounts
      if (Array.isArray(accounts)) {
        for (const acc of accounts) {
          if (acc.balance && acc.balance > 0) {
            holdings.push({
              account_type: acc.type || 'Investment',
              asset: acc.name || 'Unknown',
              value: acc.balance,
            })
          }
        }
      }

      if (holdings.length > 0) {
        set((state) => ({
          answers: {
            ...state.answers,
            portfolio: {
              ...state.answers.portfolio,
              has_investments: true,
              holdings,
            },
          },
        }))
      }
    } catch {
      // silently fail
    }
  },
}))
