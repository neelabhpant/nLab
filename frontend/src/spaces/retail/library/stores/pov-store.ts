import { create } from 'zustand'
import { api, API_BASE, getAuthQueryParam } from '@/shared/lib/api'

export interface POV {
  id: string
  name: string
  one_liner: string
  problem_statement: string
  architecture: string
  why_cloudera: string
  target_accounts: string[]
  target_persona: string
  ae_hook: string
  demo_screenshot_path: string | null
  demo_link: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export type POVCreate = Omit<POV, 'id' | 'created_at' | 'updated_at'>

export type POVUpdate = Partial<POVCreate>

interface POVListFilters {
  tag?: string
  account?: string
}

interface POVStore {
  povs: POV[]
  loading: boolean
  error: string | null

  fetchPOVs: (filters?: POVListFilters) => Promise<void>
  getPOV: (id: string) => Promise<POV | null>
  createPOV: (data: POVCreate) => Promise<POV>
  updatePOV: (id: string, data: POVUpdate) => Promise<POV>
  deletePOV: (id: string) => Promise<void>
  uploadScreenshot: (id: string, file: File) => Promise<string>
  seedLibrary: () => Promise<number>
}

export const usePOVStore = create<POVStore>((set, get) => ({
  povs: [],
  loading: false,
  error: null,

  async fetchPOVs(filters) {
    set({ loading: true, error: null })
    try {
      const params: Record<string, string> = {}
      if (filters?.tag) params.tag = filters.tag
      if (filters?.account) params.account = filters.account
      const { data } = await api.get<POV[]>('/pov-library', { params })
      set({ povs: data, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load POVs'
      set({ loading: false, error: message })
    }
  },

  async getPOV(id) {
    try {
      const { data } = await api.get<POV>(`/pov-library/${id}`)
      return data
    } catch (err) {
      if ((err as { response?: { status?: number } }).response?.status === 404) {
        return null
      }
      throw err
    }
  },

  async createPOV(data) {
    const { data: created } = await api.post<POV>('/pov-library', data)
    set({ povs: [...get().povs, created] })
    return created
  },

  async updatePOV(id, data) {
    const { data: updated } = await api.put<POV>(`/pov-library/${id}`, data)
    set({ povs: get().povs.map((p) => (p.id === id ? updated : p)) })
    return updated
  },

  async deletePOV(id) {
    await api.delete(`/pov-library/${id}`)
    set({ povs: get().povs.filter((p) => p.id !== id) })
  },

  async uploadScreenshot(id, file) {
    const form = new FormData()
    form.append('file', file)
    const { data: updated } = await api.post<POV>(`/pov-library/${id}/screenshot`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    set({ povs: get().povs.map((p) => (p.id === id ? updated : p)) })
    return updated.demo_screenshot_path ?? ''
  },

  async seedLibrary() {
    const { data } = await api.post<{ loaded: number; total: number }>('/pov-library/seed')
    await get().fetchPOVs()
    return data.loaded
  },
}))

/**
 * Build the URL to load a POV screenshot in an <img> tag.
 * EventSource-style: token in query param since <img> can't set headers.
 */
export function povScreenshotUrl(povId: string): string {
  const sep = API_BASE.includes('?') ? '&' : '?'
  const auth = getAuthQueryParam()
  return `${API_BASE}/pov-library/${povId}/screenshot${auth ? `${sep}${auth}` : ''}`
}
