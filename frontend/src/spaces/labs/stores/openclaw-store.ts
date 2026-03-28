import { create } from 'zustand'
import { api, API_BASE, getAuthHeaders } from '@/shared/lib/api'

export interface Skill {
  id: string
  name: string
  description: string
  enabled: boolean
  builtin: boolean
  instruction: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface OCEvent {
  type:
    | 'gateway_status'
    | 'thinking'
    | 'tool_call'
    | 'tool_result'
    | 'memory_update'
    | 'file_generated'
    | 'confirmation_required'
    | 'confirmation_result'
    | 'response'
    | 'error'
    | 'done'
  content: string
  timestamp: number
  metadata: Record<string, unknown>
}

export type GatewayStatus = 'idle' | 'processing' | 'error'

interface OpenClawState {
  messages: ChatMessage[]
  skills: Skill[]
  soul: string
  memory: Record<string, string>
  events: OCEvent[]
  gatewayStatus: GatewayStatus
  error: string | null
  skillsLoaded: boolean
  sessionId: string | null

  fetchSkills: () => Promise<void>
  toggleSkill: (id: string) => void
  updateSoul: (soul: string) => void
  sendMessage: (content: string) => Promise<void>
  stopExecution: () => Promise<void>
  confirmAction: (confirmationId: string, approved: boolean) => Promise<void>
  clearChat: () => void
  clearEvents: () => void
  reset: () => void
}

let nextMsgId = 1
let abortController: AbortController | null = null

export const useOpenClawStore = create<OpenClawState>((set, get) => ({
  messages: [],
  skills: [],
  soul: '',
  memory: {},
  events: [],
  gatewayStatus: 'idle',
  error: null,
  skillsLoaded: false,
  sessionId: null,

  fetchSkills: async () => {
    if (get().skillsLoaded) return
    try {
      const { data } = await api.get('/openclaw/skills')
      set({ skills: data, skillsLoaded: true })
    } catch {
      set({
        skills: [
          { id: 'web_search', name: 'Web Search', description: 'Search the web for current information', enabled: true, builtin: true, instruction: '' },
          { id: 'calculator', name: 'Calculator', description: 'Perform mathematical calculations', enabled: true, builtin: true, instruction: '' },
          { id: 'memory', name: 'Memory', description: 'Save and retrieve persistent memories', enabled: true, builtin: true, instruction: '' },
          { id: 'url_fetcher', name: 'URL Fetcher', description: 'Fetch and summarize web page content', enabled: false, builtin: true, instruction: '' },
          { id: 'text_analyzer', name: 'Text Analyzer', description: 'Analyze text for sentiment and themes', enabled: false, builtin: true, instruction: '' },
          { id: 'note_taker', name: 'Note Taker', description: 'Save and retrieve intermediate notes', enabled: false, builtin: true, instruction: '' },
          { id: 'send_email', name: 'Send Email', description: 'Send an email with subject and body', enabled: false, builtin: true, instruction: '' },
          { id: 'file_generator', name: 'File Generator', description: 'Generate downloadable PDF or CSV reports', enabled: false, builtin: true, instruction: '' },
        ],
        skillsLoaded: true,
      })
    }
  },

  toggleSkill: (id: string) => {
    set((state) => ({
      skills: state.skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    }))
  },

  updateSoul: (soul: string) => set({ soul }),

  sendMessage: async (content: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${nextMsgId++}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    abortController = new AbortController()

    set((state) => ({
      messages: [...state.messages, userMsg],
      gatewayStatus: 'processing' as GatewayStatus,
      error: null,
      events: [],
      sessionId: null,
    }))

    const { messages, skills, soul, memory } = get()

    try {
      const response = await fetch(`${API_BASE}/openclaw/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          skills,
          soul,
          memory,
        }),
        signal: abortController?.signal,
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
            const event = JSON.parse(payload) as OCEvent

            set((state) => {
              const updates: Partial<OpenClawState> = {
                events: [...state.events, event],
              }

              if (event.type === 'gateway_status') {
                updates.gatewayStatus = event.content as GatewayStatus
                if (event.metadata?.session_id) {
                  updates.sessionId = event.metadata.session_id as string
                }
              } else if (event.type === 'response') {
                const assistantMsg: ChatMessage = {
                  id: `msg-${nextMsgId++}`,
                  role: 'assistant',
                  content: event.content,
                  timestamp: Date.now(),
                }
                updates.messages = [...state.messages, assistantMsg]
                updates.gatewayStatus = 'idle'
              } else if (event.type === 'memory_update' && event.metadata?.memory) {
                updates.memory = event.metadata.memory as Record<string, string>
              } else if (event.type === 'error') {
                updates.error = event.content
                updates.gatewayStatus = 'error'
              }

              return updates
            })
          } catch {
            // skip malformed events
          }
        }
      }

      if (get().gatewayStatus === 'processing') {
        set({ gatewayStatus: 'idle' })
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      const msg = err instanceof Error ? err.message : 'Chat failed'
      set({ error: msg, gatewayStatus: 'error' })
    } finally {
      abortController = null
    }
  },

  stopExecution: async () => {
    const { sessionId } = get()
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    if (sessionId) {
      try {
        await api.post('/openclaw/abort', { session_id: sessionId })
      } catch {
        // session may have already finished
      }
    }
    set({ gatewayStatus: 'idle', sessionId: null })
  },

  confirmAction: async (confirmationId: string, approved: boolean) => {
    try {
      await api.post(`/openclaw/confirm/${confirmationId}`, { approved })
    } catch {
      // confirmation may have already expired
    }
  },

  clearChat: () => set({ messages: [], events: [], error: null }),

  clearEvents: () => set({ events: [] }),

  reset: () => {
    nextMsgId = 1
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    set({
      messages: [],
      skills: [],
      soul: '',
      memory: {},
      events: [],
      gatewayStatus: 'idle',
      error: null,
      skillsLoaded: false,
      sessionId: null,
    })
  },
}))
