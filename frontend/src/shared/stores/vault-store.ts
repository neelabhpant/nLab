import { create } from 'zustand'
import { api, API_BASE, getAuthHeaders } from '@/shared/lib/api'

export interface VaultDocument {
  id: string
  filename: string
  file_type: string
  doc_type: string | null
  title: string | null
  summary: string | null
  entities_json: string | null
  key_facts_json: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  file_size: number
  created_at: string
}

export interface VaultStats {
  total: number
  total_size: number
  by_type: Record<string, number>
}

export interface VaultChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface VaultSearchResult {
  doc_id: string | null
  title: string | null
  filename: string | null
  snippet: string | null
  source: string
}

interface VaultState {
  documents: VaultDocument[]
  selectedDocument: VaultDocument | null
  isLoading: boolean

  isUploading: boolean
  uploadProgress: string | null

  searchQuery: string
  searchResults: VaultSearchResult[]
  isSearching: boolean

  chatMessages: VaultChatMessage[]
  isChatStreaming: boolean

  stats: VaultStats | null

  docTypeFilter: string | null

  uploadFile: (file: File) => Promise<void>
  fetchDocuments: (docType?: string | null, search?: string) => Promise<void>
  fetchDocument: (docId: string) => Promise<void>
  deleteDocument: (docId: string) => Promise<void>
  searchDocuments: (query: string) => Promise<void>
  sendChatMessage: (message: string) => Promise<void>
  fetchStats: () => Promise<void>
  clearChat: () => void
  setDocTypeFilter: (type: string | null) => void
  setSelectedDocument: (doc: VaultDocument | null) => void
  pollDocumentStatus: (docId: string) => Promise<void>
}

export const useVaultStore = create<VaultState>((set, get) => ({
  documents: [],
  selectedDocument: null,
  isLoading: false,

  isUploading: false,
  uploadProgress: null,

  searchQuery: '',
  searchResults: [],
  isSearching: false,

  chatMessages: [],
  isChatStreaming: false,

  stats: null,

  docTypeFilter: null,

  uploadFile: async (file: File) => {
    set({ isUploading: true, uploadProgress: 'Uploading...' })
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post<{ id: string; filename: string; status: string }>(
        '/vault/upload',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      set({ uploadProgress: 'Processing...' })
      await get().pollDocumentStatus(data.id)
      await get().fetchDocuments(get().docTypeFilter)
      await get().fetchStats()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      set({ uploadProgress: `Error: ${message}` })
      await new Promise((r) => setTimeout(r, 3000))
    } finally {
      set({ isUploading: false, uploadProgress: null })
    }
  },

  fetchDocuments: async (docType?: string | null, search?: string) => {
    set({ isLoading: true })
    try {
      const params = new URLSearchParams()
      if (docType) params.set('doc_type', docType)
      if (search) params.set('search', search)
      params.set('limit', '100')
      const { data } = await api.get<VaultDocument[]>(`/vault/documents?${params.toString()}`)
      set({ documents: data })
    } catch {
      // silently fail
    } finally {
      set({ isLoading: false })
    }
  },

  fetchDocument: async (docId: string) => {
    try {
      const { data } = await api.get<VaultDocument>(`/vault/documents/${docId}`)
      set({ selectedDocument: data })
    } catch {
      // silently fail
    }
  },

  deleteDocument: async (docId: string) => {
    try {
      await api.delete(`/vault/documents/${docId}`)
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== docId),
        selectedDocument: state.selectedDocument?.id === docId ? null : state.selectedDocument,
      }))
      await get().fetchStats()
    } catch {
      // silently fail
    }
  },

  searchDocuments: async (query: string) => {
    set({ searchQuery: query, isSearching: true })
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false })
      return
    }
    try {
      const { data } = await api.get<VaultSearchResult[]>(`/vault/search?q=${encodeURIComponent(query)}`)
      set({ searchResults: data })
    } catch {
      set({ searchResults: [] })
    } finally {
      set({ isSearching: false })
    }
  },

  sendChatMessage: async (message: string) => {
    const userMsg: VaultChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }
    const assistantMsg: VaultChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }

    set((state) => ({
      chatMessages: [...state.chatMessages, userMsg, assistantMsg],
      isChatStreaming: true,
    }))

    try {
      const response = await fetch(`${API_BASE}/vault/chat`, {
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
            const event = JSON.parse(payload) as { type: string; content: string }
            if (event.type === 'text' || event.type === 'error') {
              set((state) => {
                const msgs = [...state.chatMessages]
                const last = msgs[msgs.length - 1]
                if (last.id === assistantMsg.id) {
                  last.content = event.content
                }
                return { chatMessages: msgs }
              })
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      const message2 = err instanceof Error ? err.message : 'Failed to get response'
      set((state) => {
        const msgs = [...state.chatMessages]
        const last = msgs[msgs.length - 1]
        if (last.id === assistantMsg.id) {
          last.content = `Error: ${message2}`
        }
        return { chatMessages: msgs }
      })
    } finally {
      set({ isChatStreaming: false })
    }
  },

  fetchStats: async () => {
    try {
      const { data } = await api.get<VaultStats>('/vault/stats')
      set({ stats: data })
    } catch {
      // silently fail
    }
  },

  clearChat: () => set({ chatMessages: [] }),

  setDocTypeFilter: (type: string | null) => {
    set({ docTypeFilter: type })
    get().fetchDocuments(type)
  },

  setSelectedDocument: (doc: VaultDocument | null) => set({ selectedDocument: doc }),

  pollDocumentStatus: async (docId: string) => {
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const { data } = await api.get<VaultDocument>(`/vault/documents/${docId}`)
        if (data.status === 'completed' || data.status === 'failed') {
          set((state) => ({
            documents: state.documents.map((d) => (d.id === docId ? data : d)),
          }))
          return
        }
      } catch {
        return
      }
    }
  },
}))
