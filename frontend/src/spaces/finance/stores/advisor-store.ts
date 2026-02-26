import { create } from 'zustand'
import { API_BASE, getAuthHeaders } from '@/shared/lib/api'

export interface ThinkingStep {
  content: string
  timestamp: number
}

export interface AdvisorMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinkingSteps: ThinkingStep[]
  timestamp: number
}

export interface DocumentMeta {
  id: string
  filename: string
  document_type: string
  summary: string
  uploaded_at: number
}

export interface UploadResult {
  id: string
  filename: string
  document_type: string
  summary: string
  financial_data: Record<string, unknown>
  profile_updates: Record<string, unknown> | null
  notable_items: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UserProfile = Record<string, any>

interface AdvisorState {
  messages: AdvisorMessage[]
  streaming: boolean
  error: string | null
  profile: UserProfile | null
  profileLoading: boolean
  documents: DocumentMeta[]
  documentsLoading: boolean
  uploading: boolean
  uploadError: string | null
  lastUploadResult: UploadResult | null
  sendMessage: (content: string) => Promise<void>
  clearChat: () => void
  fetchProfile: () => Promise<void>
  extractProfileFromChat: () => Promise<void>
  updateProfile: (section: string, data: unknown) => Promise<void>
  fetchDocuments: () => Promise<void>
  uploadDocument: (file: File) => Promise<void>
  clearUploadResult: () => void
}


export const useAdvisorStore = create<AdvisorState>((set, get) => ({
  messages: [],
  streaming: false,
  error: null,
  profile: null,
  profileLoading: false,
  documents: [],
  documentsLoading: false,
  uploading: false,
  uploadError: null,
  lastUploadResult: null,

  sendMessage: async (content: string) => {
    const userMessage: AdvisorMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      thinkingSteps: [],
      timestamp: Date.now(),
    }

    const assistantMessage: AdvisorMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      thinkingSteps: [],
      timestamp: Date.now(),
    }

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      streaming: true,
      error: null,
    }))

    const apiMessages = get()
      .messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const response = await fetch(`${API_BASE}/advisor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ messages: apiMessages }),
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
              const msgs = [...state.messages]
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

              return { messages: msgs }
            })
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get response'
      set((state) => {
        const msgs = [...state.messages]
        const last = msgs[msgs.length - 1]
        if (last.id === assistantMessage.id) {
          last.content = `I encountered an error: ${message}`
        }
        return { messages: msgs, error: message }
      })
    } finally {
      set({ streaming: false })
      get().extractProfileFromChat()
    }
  },

  clearChat: () => set({ messages: [], error: null }),

  fetchProfile: async () => {
    set({ profileLoading: true })
    try {
      const res = await fetch(`${API_BASE}/advisor/profile`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        set({ profile: data.profile })
      }
    } catch {
      // silently fail
    } finally {
      set({ profileLoading: false })
    }
  },

  extractProfileFromChat: async () => {
    const messages = get()
      .messages.filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }))
    if (messages.length < 2) {
      get().fetchProfile()
      return
    }
    try {
      const res = await fetch(`${API_BASE}/advisor/extract-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ messages }),
      })
      if (res.ok) {
        const data = await res.json()
        set({ profile: data.profile })
      }
    } catch {
      get().fetchProfile()
    }
  },

  updateProfile: async (section: string, data: unknown) => {
    try {
      const res = await fetch(`${API_BASE}/advisor/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ section, data }),
      })
      if (res.ok) {
        const result = await res.json()
        set({ profile: result.profile })
      }
    } catch {
      // silently fail
    }
  },

  fetchDocuments: async () => {
    set({ documentsLoading: true })
    try {
      const res = await fetch(`${API_BASE}/advisor/documents`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        set({ documents: data })
      }
    } catch {
      // silently fail
    } finally {
      set({ documentsLoading: false })
    }
  },

  uploadDocument: async (file: File) => {
    set({ uploading: true, uploadError: null, lastUploadResult: null })
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_BASE}/advisor/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(err.detail || 'Upload failed')
      }
      const result: UploadResult = await res.json()
      set({ lastUploadResult: result })
      get().fetchDocuments()
      get().fetchProfile()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      set({ uploadError: message })
    } finally {
      set({ uploading: false })
    }
  },

  clearUploadResult: () => set({ lastUploadResult: null }),
}))
