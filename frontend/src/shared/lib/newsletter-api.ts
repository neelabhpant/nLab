import { api } from './api'

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

export interface VoiceCheckResult {
  violations: VoiceViolation[]
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
  async generateTheRead(userInput: string, issueNumber: number | null): Promise<string> {
    const { data } = await api.post<GenerateResponse>('/newsletter/generate/the-read', {
      user_input: userInput,
      issue_number: issueNumber,
    })
    return data.content
  },

  async generateWhatsMoving(userInput: string, issueNumber: number | null): Promise<string> {
    const { data } = await api.post<GenerateResponse>('/newsletter/generate/whats-moving', {
      user_input: userInput,
      issue_number: issueNumber,
    })
    return data.content
  },

  async generateUseCaseSpotlight(
    povId: string,
    userInput: string | null,
    tailoredForAccount: string | null,
  ): Promise<string> {
    const { data } = await api.post<GenerateResponse>('/newsletter/generate/use-case-spotlight', {
      pov_id: povId,
      user_input: userInput,
      tailored_for_account: tailoredForAccount,
    })
    return data.content
  },

  async polish(userInput: string, sectionType: SectionKey | null = null): Promise<string> {
    const { data } = await api.post<GenerateResponse>('/newsletter/polish', {
      user_input: userInput,
      section_type: sectionType,
    })
    return data.content
  },

  async voiceCheck(text: string): Promise<VoiceCheckResult> {
    const { data } = await api.post<VoiceCheckResult>('/newsletter/voice-check', { text })
    return data
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
