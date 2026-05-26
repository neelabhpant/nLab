import { api, API_BASE, getAuthQueryParam } from './api'

/** Authenticated download URL for an issue's PDF (token in query for <a download>). */
export function issuePdfUrl(issueId: string): string {
  const sep = API_BASE.includes('?') ? '&' : '?'
  const auth = getAuthQueryParam()
  return `${API_BASE}/newsletter/issues/${issueId}/pdf${auth ? `${sep}${auth}` : ''}`
}

/** Authenticated download URL for an issue's email HTML. */
export function issueHtmlUrl(issueId: string): string {
  const sep = API_BASE.includes('?') ? '&' : '?'
  const auth = getAuthQueryParam()
  return `${API_BASE}/newsletter/issues/${issueId}/html${auth ? `${sep}${auth}` : ''}`
}

export type SectionKey =
  | 'the_read'
  | 'whats_moving'
  | 'use_case_spotlight'
  | 'wins'
  | 'horizon'

export interface VoiceViolation {
  rule: number
  problematic_text: string
  suggestion: string
}

export interface UsageInfo {
  model: string
  model_label: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export interface GenResult {
  content: string
  usage: UsageInfo | null
}

export interface VoiceCheckResult {
  violations: VoiceViolation[]
  usage: UsageInfo | null
}

export interface VoiceExample {
  id: string
  section_type: SectionKey
  example_text: string
  source: string | null
  notes: string | null
  created_at: string
}

export interface VoiceExampleCreate {
  section_type: SectionKey
  example_text: string
  source?: string | null
  notes?: string | null
}

export interface VoiceExampleUpdate {
  section_type?: SectionKey
  example_text?: string
  source?: string | null
  notes?: string | null
}

interface GenerateResponse {
  content: string
  usage: UsageInfo | null
}

/**
 * Pulls the structured error detail out of an Axios/HTTP error, so call sites
 * can surface a meaningful toast.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
  if (typeof detail === 'string' && detail.length > 0) return detail
  if (err instanceof Error) return err.message
  return fallback
}

export const newsletterApi = {
  async generateTheRead(userInput: string, issueNumber: number | null): Promise<GenResult> {
    const { data } = await api.post<GenerateResponse>('/newsletter/generate/the-read', {
      user_input: userInput,
      issue_number: issueNumber,
    })
    return { content: data.content, usage: data.usage }
  },

  async generateWhatsMoving(userInput: string, issueNumber: number | null): Promise<GenResult> {
    const { data } = await api.post<GenerateResponse>('/newsletter/generate/whats-moving', {
      user_input: userInput,
      issue_number: issueNumber,
    })
    return { content: data.content, usage: data.usage }
  },

  async generateUseCaseSpotlight(
    povId: string,
    userInput: string | null,
    tailoredForAccount: string | null,
  ): Promise<GenResult> {
    const { data } = await api.post<GenerateResponse>('/newsletter/generate/use-case-spotlight', {
      pov_id: povId,
      user_input: userInput,
      tailored_for_account: tailoredForAccount,
    })
    return { content: data.content, usage: data.usage }
  },

  async polish(userInput: string, sectionType: SectionKey | null = null): Promise<GenResult> {
    const { data } = await api.post<GenerateResponse>('/newsletter/polish', {
      user_input: userInput,
      section_type: sectionType,
    })
    return { content: data.content, usage: data.usage }
  },

  async voiceCheck(text: string): Promise<VoiceCheckResult> {
    const { data } = await api.post<VoiceCheckResult>('/newsletter/voice-check', { text })
    return data
  },

  // ---------- Exports ----------

  async getSlackText(issueId: string): Promise<string> {
    const { data } = await api.get<{ content: string }>(`/newsletter/issues/${issueId}/slack`)
    return data.content
  },

  /** Email HTML source, used for the "Copy HTML" clipboard action. */
  async getEmailHtml(issueId: string): Promise<string> {
    const { data } = await api.get(`/newsletter/issues/${issueId}/html`, { responseType: 'text' })
    return data as string
  },

  /** Email HTML for an in-progress draft, for the composer Preview. */
  async previewDraftHtml(draftId: string): Promise<string> {
    const { data } = await api.get(`/newsletter/drafts/${draftId}/preview`, { responseType: 'text' })
    return data as string
  },

  // ---------- Voice corpus CRUD ----------

  async listVoiceExamples(sectionType?: SectionKey): Promise<VoiceExample[]> {
    const params = sectionType ? { section_type: sectionType } : {}
    const { data } = await api.get<VoiceExample[]>('/newsletter/voice-examples', { params })
    return data
  },

  async addVoiceExample(payload: VoiceExampleCreate): Promise<VoiceExample> {
    const { data } = await api.post<VoiceExample>('/newsletter/voice-examples', payload)
    return data
  },

  async updateVoiceExample(id: string, payload: VoiceExampleUpdate): Promise<VoiceExample> {
    const { data } = await api.put<VoiceExample>(`/newsletter/voice-examples/${id}`, payload)
    return data
  },

  async deleteVoiceExample(id: string): Promise<void> {
    await api.delete(`/newsletter/voice-examples/${id}`)
  },
}
