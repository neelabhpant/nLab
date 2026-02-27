import { create } from 'zustand'
import { api, API_BASE, getAuthHeaders } from '@/shared/lib/api'

export interface Template {
  id: string
  title: string
  description: string
  goal: string
}

export interface AgentDefinition {
  id: string
  name: string
  role: string
  goal: string
  backstory: string
  tools: string[]
  order: number
}

export interface TaskDefinition {
  id: string
  description: string
  agent_id: string
  expected_output: string
  order: number
}

export interface CrewPlan {
  agents: AgentDefinition[]
  tasks: TaskDefinition[]
  execution_order: string
  summary: string
}

export interface ExecutionEvent {
  type:
    | 'agent_start'
    | 'agent_thinking'
    | 'tool_call'
    | 'tool_result'
    | 'handoff'
    | 'agent_complete'
    | 'crew_complete'
    | 'error'
  agent_name: string
  content: string
  timestamp: number
  metadata: Record<string, unknown>
}

export interface SessionSummary {
  id: string
  goal: string
  status: string
  created_at: string
  execution_time_seconds: number
}

export interface ExecutionStats {
  execution_time_seconds: number
  total_tool_calls: number
  agent_times: Record<string, number>
  agents_used: number
}

type WorkshopStatus = 'idle' | 'planning' | 'planned' | 'running' | 'complete' | 'error'

interface WorkshopState {
  goal: string
  templates: Template[]
  crewPlan: CrewPlan | null
  events: ExecutionEvent[]
  result: string
  status: WorkshopStatus
  stats: ExecutionStats | null
  sessions: SessionSummary[]
  activeAgentName: string
  error: string | null

  setGoal: (goal: string) => void
  fetchTemplates: () => Promise<void>
  planCrew: (goal: string) => Promise<void>
  planFromTemplate: (templateId: string) => Promise<void>
  editPlan: (plan: CrewPlan) => Promise<void>
  executeCrew: () => Promise<void>
  fetchSessions: () => Promise<void>
  loadSession: (id: string) => Promise<void>
  reset: () => void
}

export const useWorkshopStore = create<WorkshopState>((set, get) => ({
  goal: '',
  templates: [],
  crewPlan: null,
  events: [],
  result: '',
  status: 'idle',
  stats: null,
  sessions: [],
  activeAgentName: '',
  error: null,

  setGoal: (goal: string) => set({ goal }),

  fetchTemplates: async () => {
    try {
      const { data } = await api.get('/workshop/templates')
      set({ templates: data })
    } catch {
      // silent
    }
  },

  planCrew: async (goal: string) => {
    set({ status: 'planning', error: null, goal, events: [], result: '', stats: null })
    try {
      const { data } = await api.post('/workshop/plan', { user_goal: goal })
      set({ crewPlan: data, status: 'planned' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Planning failed'
      set({ status: 'error', error: msg })
    }
  },

  planFromTemplate: async (templateId: string) => {
    const template = get().templates.find((t) => t.id === templateId)
    if (template) {
      set({ goal: template.goal })
    }
    set({ status: 'planning', error: null, events: [], result: '', stats: null })
    try {
      const { data } = await api.post('/workshop/plan', { template_id: templateId })
      set({ crewPlan: data, status: 'planned' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Planning failed'
      set({ status: 'error', error: msg })
    }
  },

  editPlan: async (plan: CrewPlan) => {
    try {
      const { data } = await api.post('/workshop/plan/edit', plan)
      set({ crewPlan: data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Validation failed'
      set({ error: msg })
    }
  },

  executeCrew: async () => {
    const { crewPlan, goal } = get()
    if (!crewPlan) return

    set({ status: 'running', events: [], result: '', stats: null, error: null })

    try {
      const response = await fetch(`${API_BASE}/workshop/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ plan: crewPlan, goal }),
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
            const event = JSON.parse(payload) as ExecutionEvent

            set((state) => {
              const updates: Partial<WorkshopState> = {
                events: [...state.events, event],
              }

              if (event.type === 'agent_start') {
                updates.activeAgentName = event.agent_name
              } else if (event.type === 'crew_complete') {
                const agentTimes: Record<string, number> = {}
                const allEvents = [...state.events, event]
                for (const e of allEvents) {
                  if (e.type === 'agent_complete' && e.agent_name) {
                    const dur = (e.metadata?.duration_seconds as number) ?? 0
                    if (dur > 0) {
                      agentTimes[e.agent_name] = dur
                    }
                  }
                }

                updates.result = event.content
                updates.status = 'complete'
                updates.activeAgentName = ''
                updates.stats = {
                  execution_time_seconds: (event.metadata?.execution_time_seconds as number) ?? 0,
                  total_tool_calls: (event.metadata?.total_tool_calls as number) ?? 0,
                  agent_times: agentTimes,
                  agents_used: (event.metadata?.agents_used as number) ?? 0,
                }
              } else if (event.type === 'error') {
                updates.error = event.content
                updates.status = 'error'
              }

              return updates
            })
          } catch {
            // skip
          }
        }
      }

      if (get().status === 'running') {
        set({ status: 'complete' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed'
      set({ status: 'error', error: msg })
    }
  },

  fetchSessions: async () => {
    try {
      const { data } = await api.get('/workshop/sessions')
      set({ sessions: data })
    } catch {
      // silent
    }
  },

  loadSession: async (id: string) => {
    try {
      const { data } = await api.get(`/workshop/sessions/${id}`)
      set({
        goal: data.goal,
        crewPlan: data.crew_plan,
        events: data.events ?? [],
        result: data.result ?? '',
        status: data.status === 'complete' ? 'complete' : 'error',
        stats: data.events?.length
          ? {
              execution_time_seconds: data.execution_time_seconds ?? 0,
              total_tool_calls: data.total_tokens ?? 0,
              agent_times: {},
              agents_used: data.crew_plan?.agents?.length ?? 0,
            }
          : null,
      })
    } catch {
      // silent
    }
  },

  reset: () =>
    set({
      goal: '',
      crewPlan: null,
      events: [],
      result: '',
      status: 'idle',
      stats: null,
      activeAgentName: '',
      error: null,
    }),
}))
