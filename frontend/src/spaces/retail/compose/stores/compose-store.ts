import { create } from 'zustand'
import { api } from '@/shared/lib/api'
import {
  newsletterApi,
  extractErrorMessage,
  type SectionKey,
  type VoiceViolation,
  type UsageInfo,
} from '@/shared/lib/newsletter-api'

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
  title: string | null
  kicker: string | null
  ship_date: string | null
  hero_image_path: string | null
  hero_caption: string | null
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
  kicker: string | null
  ship_date: string | null
  hero_image_path: string | null
  hero_caption: string | null
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

type DraftPatch = Partial<
  Pick<
    IssueDraft,
    'sections' | 'footer_cta' | 'title' | 'kicker' | 'ship_date' | 'hero_image_path' | 'hero_caption'
  >
>

export type GenerationParams =
  | { kind: 'the_read'; userInput: string }
  | { kind: 'whats_moving'; userInput: string }
  | {
      kind: 'use_case_spotlight'
      povId: string
      userInput?: string | null
      tailoredForAccount?: string | null
    }
  | { kind: 'polish'; userInput: string; promptPrefix?: string }

interface ComposeStore {
  currentDraft: IssueDraft | null
  drafts: IssueDraft[]
  issues: SentIssue[]
  loading: boolean
  saving: boolean
  lastSavedAt: string | null
  error: string | null
  activeSection: ActiveSection

  // AI state
  generating: Partial<Record<ActiveSection, boolean>>
  generationError: Partial<Record<ActiveSection, string | null>>
  voiceWarnings: Partial<Record<ActiveSection, VoiceViolation[]>>

  // Session cost tracking (resets per draft / composer load)
  sessionCostUsd: number
  sessionCalls: number
  lastModelLabel: string | null

  // Composer settings mirrored from the backend (for header + voice-check gating)
  voiceCheckMode: string
  generationModelLabel: string | null
  fetchComposerSettings: () => Promise<void>

  createDraft: () => Promise<IssueDraft>
  loadDraft: (draftId: string) => Promise<void>
  updateCurrentDraft: (patch: DraftPatch) => void
  saveCurrentDraft: () => Promise<void>
  uploadHero: (file: File) => Promise<void>
  deleteDraft: (draftId: string) => Promise<void>
  sendDraft: (draftId: string, recipientCount?: number) => Promise<SentIssue>

  fetchDrafts: () => Promise<void>
  fetchIssues: () => Promise<void>
  loadIssue: (issueId: string) => Promise<SentIssue | null>

  setActiveSection: (section: ActiveSection) => void
  resetCurrentDraft: () => void

  // AI actions
  generateSection: (section: ActiveSection, params: GenerationParams) => Promise<void>
  polishSection: (section: ActiveSection, promptPrefix?: string) => Promise<void>
  checkVoice: (section: ActiveSection) => Promise<void>
  dismissVoiceWarning: (section: ActiveSection) => void
  applyVoiceSuggestions: (section: ActiveSection) => Promise<void>
}

// Model id → short label for the composer header.
const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-7': 'Opus 4.7',
  'claude-opus-4-6': 'Opus 4.6',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-haiku-4-5': 'Haiku 4.5',
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

  generating: {},
  generationError: {},
  voiceWarnings: {},

  sessionCostUsd: 0,
  sessionCalls: 0,
  lastModelLabel: null,

  voiceCheckMode: 'manual',
  generationModelLabel: null,

  async fetchComposerSettings() {
    try {
      const { data } = await api.get<{
        newsletter_generation_model: string
        voice_check_mode: string
      }>('/settings')
      set({
        voiceCheckMode: data.voice_check_mode || 'manual',
        generationModelLabel: MODEL_LABELS[data.newsletter_generation_model] ?? data.newsletter_generation_model,
      })
    } catch {
      /* non-fatal — header just shows the last-used model instead */
    }
  },

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
        sessionCostUsd: 0,
        sessionCalls: 0,
        lastModelLabel: null,
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
        sessionCostUsd: 0,
        sessionCalls: 0,
        lastModelLabel: null,
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
        title: current.title,
        kicker: current.kicker,
        ship_date: current.ship_date,
        hero_caption: current.hero_caption,
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

  async uploadHero(file) {
    const current = get().currentDraft
    if (!current) return
    set({ saving: true, error: null })
    try {
      const updated = await newsletterApi.uploadHero(current.id, file)
      set({
        currentDraft: { ...updated },
        saving: false,
        lastSavedAt: updated.updated_at,
      })
    } catch (err) {
      const message = extractErrorMessage(err, 'Hero upload failed')
      set({ saving: false, error: message })
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
    set({
      currentDraft: null,
      lastSavedAt: null,
      error: null,
      generating: {},
      generationError: {},
      voiceWarnings: {},
      sessionCostUsd: 0,
      sessionCalls: 0,
      lastModelLabel: null,
    })
  },

  // ---------- AI actions ----------

  async generateSection(section, params) {
    const current = get().currentDraft
    if (!current) return

    set({
      generating: { ...get().generating, [section]: true },
      generationError: { ...get().generationError, [section]: null },
    })

    try {
      let content: string
      let usage: UsageInfo | null = null
      switch (params.kind) {
        case 'the_read': {
          const r = await newsletterApi.generateTheRead(params.userInput, current.issue_number)
          content = r.content
          usage = r.usage
          break
        }
        case 'whats_moving': {
          const r = await newsletterApi.generateWhatsMoving(params.userInput, current.issue_number)
          content = r.content
          usage = r.usage
          break
        }
        case 'use_case_spotlight': {
          const r = await newsletterApi.generateUseCaseSpotlight(
            params.povId,
            params.userInput ?? null,
            params.tailoredForAccount ?? null,
          )
          content = r.content
          usage = r.usage
          break
        }
        case 'polish': {
          const input = params.promptPrefix
            ? `${params.promptPrefix}\n\n${params.userInput}`
            : params.userInput
          const r = await newsletterApi.polish(input, section as SectionKey)
          content = r.content
          usage = r.usage
          break
        }
      }

      accumulateUsage(usage, set, get)
      applySectionContent(section, content, set, get)

      // Voice check fires automatically only in auto_save mode. Default is manual
      // (user clicks "Check voice"), which avoids a second LLM call per generation.
      if (get().voiceCheckMode === 'auto_save') {
        try {
          const check = await newsletterApi.voiceCheck(content)
          accumulateUsage(check.usage, set, get)
          set({
            voiceWarnings: { ...get().voiceWarnings, [section]: check.violations },
          })
        } catch (voiceErr) {
          console.warn('voice check failed', voiceErr)
        }
      }
    } catch (err) {
      const message = extractErrorMessage(err, 'Generation failed')
      set({
        generationError: { ...get().generationError, [section]: message },
      })
    } finally {
      set({
        generating: { ...get().generating, [section]: false },
      })
    }
  },

  async polishSection(section, promptPrefix) {
    const current = get().currentDraft
    if (!current) return
    const userInput = extractSectionText(section, current.sections)
    if (!userInput.trim()) {
      set({
        generationError: {
          ...get().generationError,
          [section]: 'Nothing to polish — write some text first.',
        },
      })
      return
    }
    await get().generateSection(section, {
      kind: 'polish',
      userInput,
      promptPrefix,
    })
  },

  async checkVoice(section) {
    const current = get().currentDraft
    if (!current) return
    const text = extractSectionText(section, current.sections)
    if (!text.trim()) {
      set({
        voiceWarnings: { ...get().voiceWarnings, [section]: [] },
      })
      return
    }
    try {
      const result = await newsletterApi.voiceCheck(text)
      accumulateUsage(result.usage, set, get)
      set({
        voiceWarnings: { ...get().voiceWarnings, [section]: result.violations },
      })
    } catch (err) {
      console.warn('voice check failed', err)
    }
  },

  dismissVoiceWarning(section) {
    set({
      voiceWarnings: { ...get().voiceWarnings, [section]: [] },
    })
  },

  async applyVoiceSuggestions(section) {
    const violations = get().voiceWarnings[section] || []
    if (violations.length === 0) return
    const current = get().currentDraft
    if (!current) return
    const currentContent = extractSectionText(section, current.sections)
    if (!currentContent.trim()) return

    const violationsBlock = violations
      .map((v) => `- Rule ${v.rule}: "${v.problematic_text}" → ${v.suggestion}`)
      .join('\n')

    const userInput = `Apply these specific voice fixes to the text below. Preserve every fact and the overall structure.

Voice fixes to apply:
${violationsBlock}

Text to fix:
${currentContent}`

    set({
      generating: { ...get().generating, [section]: true },
      generationError: { ...get().generationError, [section]: null },
    })

    try {
      const { content, usage } = await newsletterApi.polish(userInput, section as SectionKey)
      accumulateUsage(usage, set, get)

      // 1. Write the rewritten content back into the section (debounced auto-save fires).
      applySectionContent(section, content, set, get)

      // 2. Clear the existing warnings so the banner hides immediately. The follow-up
      //    voice check will repopulate if the rewrite still has issues.
      set({
        voiceWarnings: { ...get().voiceWarnings, [section]: [] },
      })

      // 3. Fresh voice check on the *applied* draft text (not the raw LLM output),
      //    so list sections like wins/horizon are checked after splitListSection runs.
      await get().checkVoice(section)
    } catch (err) {
      const message = extractErrorMessage(err, 'Apply suggestions failed')
      set({
        generationError: { ...get().generationError, [section]: message },
      })
    } finally {
      set({
        generating: { ...get().generating, [section]: false },
      })
    }
  },
}))

/** Accumulate a call's token cost into the running session total. */
function accumulateUsage(
  usage: UsageInfo | null,
  set: (partial: Partial<ComposeStore>) => void,
  get: () => ComposeStore,
) {
  if (!usage) return
  set({
    sessionCostUsd: get().sessionCostUsd + (usage.cost_usd || 0),
    sessionCalls: get().sessionCalls + 1,
    lastModelLabel: usage.model_label,
  })
}

/**
 * Section content extractor — mirrors the structure that section editors use
 * to write back into the draft.
 */
function extractSectionText(section: ActiveSection, sections: IssueSections): string {
  switch (section) {
    case 'the_read':
      return sections.the_read.content
    case 'whats_moving':
      return sections.whats_moving.items
        .map((i, idx) => (i.line.trim() ? `${idx + 1}. ${i.line}` : ''))
        .filter(Boolean)
        .join('\n')
    case 'use_case_spotlight':
      return sections.use_case_spotlight.content
    case 'wins':
      return sections.wins.items.filter((s) => s.trim()).join('\n\n')
    case 'horizon':
      return sections.horizon.items.filter((s) => s.trim()).join('\n\n')
  }
}

/**
 * Write generated content back into the appropriate section shape. The four
 * "list" sections split the LLM output on blank lines.
 */
function applySectionContent(
  section: ActiveSection,
  content: string,
  _set: (partial: Partial<ComposeStore>) => void,
  get: () => ComposeStore,
) {
  const current = get().currentDraft
  if (!current) return
  const sections = { ...current.sections }
  const parts = splitListSection(content)

  switch (section) {
    case 'the_read':
      sections.the_read = { ...sections.the_read, content: content.trim() }
      break
    case 'whats_moving': {
      const lines = parts.slice(0, 4)
      while (lines.length < 4) lines.push('')
      sections.whats_moving = {
        items: lines.map((line, idx) => ({
          line,
          article_id: sections.whats_moving.items[idx]?.article_id ?? null,
        })),
      }
      break
    }
    case 'use_case_spotlight':
      sections.use_case_spotlight = {
        ...sections.use_case_spotlight,
        content: content.trim(),
      }
      break
    case 'wins': {
      const items = parts.slice(0, 3)
      while (items.length < 3) items.push('')
      sections.wins = { items }
      break
    }
    case 'horizon': {
      const items = parts.slice(0, 3)
      while (items.length < 3) items.push('')
      sections.horizon = { items }
      break
    }
  }

  // Reuse the existing updateCurrentDraft path so debounced auto-save fires.
  get().updateCurrentDraft({ sections })
}

/** Split an LLM response into list items, tolerating blank-line or numeric separators. */
function splitListSection(content: string): string[] {
  return content
    .split(/\n{2,}|^\s*\d+\.\s+/m)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

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
