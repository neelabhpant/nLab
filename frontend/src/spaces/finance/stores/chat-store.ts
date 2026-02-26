import { create } from 'zustand'
import { API_BASE, getAuthHeaders } from '@/shared/lib/api'

export interface ThinkingStep {
  content: string
  timestamp: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinkingSteps: ThinkingStep[]
  timestamp: number
}

interface ChatState {
  messages: ChatMessage[]
  streaming: boolean
  error: string | null
  widgetOpen: boolean
  setWidgetOpen: (open: boolean) => void
  openWidgetWithMessage: (content: string) => void
  sendMessage: (content: string) => Promise<void>
  clearChat: () => void
}


export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  error: null,
  widgetOpen: false,

  setWidgetOpen: (open: boolean) => set({ widgetOpen: open }),

  openWidgetWithMessage: (content: string) => {
    set({ widgetOpen: true })
    setTimeout(() => get().sendMessage(content), 100)
  },

  sendMessage: async (content: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      thinkingSteps: [],
      timestamp: Date.now(),
    }

    const assistantMessage: ChatMessage = {
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

    const apiMessages = get().messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const response = await fetch(`${API_BASE}/chat`, {
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
            // skip malformed JSON lines
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
    }
  },

  clearChat: () => set({ messages: [], error: null }),
}))
