import { create } from 'zustand'
import { api } from '@/shared/lib/api'

export type ActiveSection =
  | 'the_read'
  | 'whats_moving'
  | 'use_case_spotlight'
  | 'wins'
  | 'horizon'

export interface TheReadSection {
  content: string
  topic_seed?: string | null
  angle?: string | null
}

export interface WhatsMovingItem {
  article_id?: string | null
  line: string
}

export interface WhatsMovingSection {
  items: WhatsMovingItem[]
}

export interface UseCaseSpotlightSection {
  pov_id?: string | null
  content: string
  tailored_for_account?: string | null
}

export interface BulletSection {
  items: string[]
}

export interface IssueSections {
  the_read: TheReadSection
  whats_moving: WhatsMovingSection
  use_case_spotlight: UseCaseSpotlightSection
  wins: BulletSection
  horizon: BulletSection
}

export interface IssueDraft {
  id: string
  issue_number: number | null
  status: 'draft' | 'sent'
  sections: IssueSections
  footer_cta: string
  created_at: string
  updated_at: string
  sent_at: string | null
}

export interface SentIssue {
  id: string
  issue_number: number
  slug: string
  title: string
  sections: IssueSections
  footer_cta: string
  pdf_path: string | null
  html_path: string | null
  sent_at: string
  recipient_count: number | null
}

export const EMPTY_SECTIONS: IssueSections = {
  the_read: { content: '', topic_seed: null, angle: null },
  whats_moving: {
    items: [
      { article_id: null, line: '' },
      { article_id: null, line: '' },
      { article_id: null, line: '' },
      { article_id: null, line: '' },
    ],
  },
  use_case_spotlight: { pov_id: null, content: '', tailored_for_account: null },
  wins: { items: ['', '', ''] },
  horizon: { items: ['', '', ''] },
}

type DraftPatch = Partial<Pick<IssueDraft, 'sections' | 'footer_cta'>>

interface ComposeStore {
  currentDraft: IssueDraft | null
  drafts: IssueDraft[]
  issues: SentIssue[]
  loading: boolean
  saving: boolean
  lastSavedAt: string | null
  error: string | null
  activeSection: ActiveSection

  createDraft: () => Promise<IssueDraft>
  loadDraft: (draftId: string) => Promise<void>
  updateCurrentDraft: (patch: DraftPatch) => void
  saveCurrentDraft: () => Promise<void>
  deleteDraft: (draftId: string) => Promise<void>
  sendDraft: (draftId: string, recipientCount?: number) => Promise<SentIssue>

  fetchDrafts: () => Promise<void>
  fetchIssues: () => Promise<void>
  loadIssue: (issueId: string) => Promise<SentIssue | null>

  setActiveSection: (section: ActiveSection) => void
  resetCurrentDraft: () => void
}

// Module-scoped debounce timer for auto-save.
const AUTO_SAVE_MS = 5000
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

function clearAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
}

export const useComposeStore = create<ComposeStore>((set, get) => ({
  currentDraft: null,
  drafts: [],
  issues: [],
  loading: false,
  saving: false,
  lastSavedAt: null,
  error: null,
  activeSection: 'the_read',

  async createDraft() {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post<IssueDraft>('/newsletter/drafts', {
        sections: EMPTY_SECTIONS,
        footer_cta: '',
      })
      set({
        currentDraft: data,
        loading: false,
        lastSavedAt: data.updated_at,
        activeSection: 'the_read',
      })
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create draft'
      set({ loading: false, error: message })
      throw err
    }
  },

  async loadDraft(draftId) {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get<IssueDraft>(`/newsletter/drafts/${draftId}`)
      set({
        currentDraft: data,
        loading: false,
        lastSavedAt: data.updated_at,
        activeSection: 'the_read',
      })
    } catch (err) {
      const message =
        (err as { response?: { status?: number } }).response?.status === 404
          ? 'Draft not found'
          : err instanceof Error
            ? err.message
            : 'Failed to load draft'
      set({ loading: false, error: message, currentDraft: null })
    }
  },

  updateCurrentDraft(patch) {
    const current = get().currentDraft
    if (!current) return
    const next: IssueDraft = {
      ...current,
      ...patch,
      sections: patch.sections ?? current.sections,
      footer_cta: patch.footer_cta ?? current.footer_cta,
    }
    set({ currentDraft: next })

    // Schedule debounced auto-save.
    clearAutoSave()
    autoSaveTimer = setTimeout(() => {
      void get().saveCurrentDraft()
    }, AUTO_SAVE_MS)
  },

  async saveCurrentDraft() {
    const current = get().currentDraft
    if (!current) return
    set({ saving: true, error: null })
    try {
      const { data } = await api.put<IssueDraft>(`/newsletter/drafts/${current.id}`, {
        sections: current.sections,
        footer_cta: current.footer_cta,
      })
      set({
        currentDraft: { ...data },
        saving: false,
        lastSavedAt: data.updated_at,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      set({ saving: false, error: message })
    } finally {
      clearAutoSave()
    }
  },

  async deleteDraft(draftId) {
    await api.delete(`/newsletter/drafts/${draftId}`)
    set({ drafts: get().drafts.filter((d) => d.id !== draftId) })
    if (get().currentDraft?.id === draftId) {
      clearAutoSave()
      set({ currentDraft: null, lastSavedAt: null })
    }
  },

  async sendDraft(draftId, recipientCount) {
    const body = recipientCount !== undefined ? { recipient_count: recipientCount } : {}
    const { data } = await api.post<SentIssue>(`/newsletter/drafts/${draftId}/send`, body)
    clearAutoSave()
    set({
      drafts: get().drafts.filter((d) => d.id !== draftId),
      issues: [data, ...get().issues],
      currentDraft: null,
      lastSavedAt: null,
    })
    return data
  },

  async fetchDrafts() {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get<IssueDraft[]>('/newsletter/drafts')
      set({ drafts: data, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load drafts'
      set({ loading: false, error: message })
    }
  },

  async fetchIssues() {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get<SentIssue[]>('/newsletter/issues')
      set({ issues: data, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load issues'
      set({ loading: false, error: message })
    }
  },

  async loadIssue(issueId) {
    try {
      const { data } = await api.get<SentIssue>(`/newsletter/issues/${issueId}`)
      return data
    } catch (err) {
      if ((err as { response?: { status?: number } }).response?.status === 404) {
        return null
      }
      throw err
    }
  },

  setActiveSection(section) {
    set({ activeSection: section })
  },

  resetCurrentDraft() {
    clearAutoSave()
    set({ currentDraft: null, lastSavedAt: null, error: null })
  },
}))

/** Derive a title from The Read content. Mirrors the backend _derive_title. */
export function deriveTitle(draft: IssueDraft | null): string {
  if (!draft) return 'Untitled Draft'
  const text = draft.sections.the_read.content.trim()
  if (!text) return 'Untitled Draft'
  const period = text.indexOf('.')
  if (period > 0 && period < 80) return text.slice(0, period).trim()
  if (text.length <= 60) return text
  return text.slice(0, 60).trim() + '...'
}

/** Section completeness — for stepper indicator. */
export function sectionHasContent(sections: IssueSections, section: ActiveSection): boolean {
  switch (section) {
    case 'the_read':
      return sections.the_read.content.trim().length > 0
    case 'whats_moving':
      return sections.whats_moving.items.some((i) => i.line.trim().length > 0)
    case 'use_case_spotlight':
      return (
        sections.use_case_spotlight.content.trim().length > 0 ||
        Boolean(sections.use_case_spotlight.pov_id)
      )
    case 'wins':
      return sections.wins.items.some((s) => s.trim().length > 0)
    case 'horizon':
      return sections.horizon.items.some((s) => s.trim().length > 0)
  }
}
