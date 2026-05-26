import { useComposeStore } from '../stores/compose-store'
import { AIAssistButton } from '../components/ai-assist-button'
import { CheckVoiceButton } from '../components/check-voice-button'
import { GenerationOverlay } from '../components/generation-overlay'
import { VoiceWarningBanner } from '../components/voice-warning-banner'
import { GenerationErrorToast } from '../components/generation-error-toast'

const SOFT_LIMIT = 100
const HARD_LIMIT = 130

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function TheReadEditor() {
  const {
    currentDraft,
    updateCurrentDraft,
    generateSection,
    polishSection,
    dismissVoiceWarning,
    applyVoiceSuggestions,
    generating,
    generationError,
    voiceWarnings,
  } = useComposeStore()
  if (!currentDraft) return null

  const content = currentDraft.sections.the_read.content
  const words = countWords(content)
  const overSoft = words > SOFT_LIMIT
  const overHard = words > HARD_LIMIT
  const isGenerating = generating.the_read ?? false
  const violations = voiceWarnings.the_read ?? []
  const error = generationError.the_read ?? null

  const handleChange = (value: string) => {
    updateCurrentDraft({
      sections: {
        ...currentDraft.sections,
        the_read: { ...currentDraft.sections.the_read, content: value },
      },
    })
  }

  const handleDraft = () => {
    void generateSection('the_read', {
      kind: 'the_read',
      userInput: content.trim() || 'Pick a sharp angle on retail AI from the last week.',
    })
  }
  const handlePolish = () => void polishSection('the_read')
  const handleSharper = () =>
    void polishSection(
      'the_read',
      'Rewrite for maximum sharpness. Shorter sentences. Remove every hedge. Preserve all facts. Text:',
    )
  const handlePredictionConcrete = () =>
    void polishSection(
      'the_read',
      'Find any prediction or claim in this text and make it more specific and quotable. Preserve every other piece of content. Text:',
    )

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-display font-semibold text-slate-900">The Read</h2>
        <p className="text-sm font-body text-slate-500 mt-0.5">
          100 words. Your opinion. One sharp take.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <AIAssistButton label="Draft from scratch" loading={isGenerating} onClick={handleDraft} />
        <AIAssistButton label="Polish in voice" loading={isGenerating} onClick={handlePolish} />
        <AIAssistButton label="Sharper" loading={isGenerating} onClick={handleSharper} />
        <AIAssistButton
          label="Make the prediction concrete"
          loading={isGenerating}
          onClick={handlePredictionConcrete}
        />
        <CheckVoiceButton section="the_read" />
      </div>

      <VoiceWarningBanner
        violations={violations}
        onApply={() => applyVoiceSuggestions('the_read')}
        onDismiss={() => dismissVoiceWarning('the_read')}
        applying={isGenerating}
      />

      <GenerationErrorToast
        message={error}
        onDismiss={() => useComposeStore.setState((s) => ({
          generationError: { ...s.generationError, the_read: null },
        }))}
        onRetry={handleDraft}
      />

      <div className="relative">
        <GenerationOverlay
          visible={isGenerating}
          message="Drafting The Read"
          estimate="about 15 seconds"
        />
        <textarea
          rows={12}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="State the sharpest insight. Then explain."
          disabled={isGenerating}
          className="w-full rounded-xl border border-border bg-surface-0 px-4 py-3 text-base font-body text-slate-900 placeholder:text-slate-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y min-h-[18rem] disabled:bg-surface-1"
        />
      </div>

      <div className="flex items-center justify-end text-xs font-display font-medium">
        <span className={overHard ? 'text-loss' : overSoft ? 'text-amber-600' : 'text-slate-400'}>
          {words} / {SOFT_LIMIT} words
          {overHard && ` · ${words - HARD_LIMIT} over hard cap`}
        </span>
      </div>
    </div>
  )
}
