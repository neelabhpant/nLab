import { useComposeStore } from '../stores/compose-store'
import { AIAssistButton } from '../components/ai-assist-button'
import { CheckVoiceButton } from '../components/check-voice-button'
import { GenerationOverlay } from '../components/generation-overlay'
import { VoiceWarningBanner } from '../components/voice-warning-banner'
import { GenerationErrorToast } from '../components/generation-error-toast'

const ITEM_COUNT = 3

export function WinsEditor() {
  const {
    currentDraft,
    updateCurrentDraft,
    polishSection,
    dismissVoiceWarning,
    applyVoiceSuggestions,
    generating,
    generationError,
    voiceWarnings,
  } = useComposeStore()
  if (!currentDraft) return null

  const items: string[] = [...currentDraft.sections.wins.items]
  while (items.length < ITEM_COUNT) items.push('')
  items.length = ITEM_COUNT

  const isGenerating = generating.wins ?? false
  const violations = voiceWarnings.wins ?? []
  const error = generationError.wins ?? null

  const handleChange = (index: number, value: string) => {
    const next = items.map((s, i) => (i === index ? value : s))
    updateCurrentDraft({
      sections: {
        ...currentDraft.sections,
        wins: { items: next },
      },
    })
  }

  const handlePolish = () => void polishSection('wins')

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-display font-semibold text-slate-900">Wins & References</h2>
        <p className="text-sm font-body text-slate-500 mt-0.5">
          3 bullets. Paste rough, AI will polish in your voice.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <AIAssistButton label="Polish in voice" loading={isGenerating} onClick={handlePolish} />
        <CheckVoiceButton section="wins" />
      </div>

      <VoiceWarningBanner
        violations={violations}
        onApply={() => applyVoiceSuggestions('wins')}
        onDismiss={() => dismissVoiceWarning('wins')}
        applying={isGenerating}
      />

      <GenerationErrorToast
        message={error}
        onDismiss={() => useComposeStore.setState((s) => ({
          generationError: { ...s.generationError, wins: null },
        }))}
        onRetry={handlePolish}
      />

      <div className="relative">
        <GenerationOverlay
          visible={isGenerating}
          message="Polishing wins"
          estimate="about 12 seconds"
        />
        <div className="space-y-3">
          {items.map((value, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="mt-2.5 text-xs font-display font-semibold text-slate-400 w-6 shrink-0">
                #{idx + 1}
              </span>
              <textarea
                rows={2}
                value={value}
                onChange={(e) => handleChange(idx, e.target.value)}
                disabled={isGenerating}
                placeholder="Name the account. Name what happened. Signal why it matters."
                className="flex-1 rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 leading-relaxed resize-y disabled:bg-surface-1"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
