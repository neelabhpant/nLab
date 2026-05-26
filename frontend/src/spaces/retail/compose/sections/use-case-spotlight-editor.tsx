import { useState } from 'react'
import { useComposeStore } from '../stores/compose-store'
import { AIAssistButton } from '../components/ai-assist-button'
import { CheckVoiceButton } from '../components/check-voice-button'
import { POVPicker } from '../components/pov-picker'
import { GenerationOverlay } from '../components/generation-overlay'
import { VoiceWarningBanner } from '../components/voice-warning-banner'
import { GenerationErrorToast } from '../components/generation-error-toast'

const SOFT_LIMIT = 200
const HARD_LIMIT = 230

function countWords(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

export function UseCaseSpotlightEditor() {
  const {
    currentDraft,
    updateCurrentDraft,
    generateSection,
    dismissVoiceWarning,
    applyVoiceSuggestions,
    generating,
    generationError,
    voiceWarnings,
  } = useComposeStore()

  const [tailorPromptOpen, setTailorPromptOpen] = useState(false)
  const [tailorInput, setTailorInput] = useState('')

  if (!currentDraft) return null

  const section = currentDraft.sections.use_case_spotlight
  const words = countWords(section.content)
  const overSoft = words > SOFT_LIMIT
  const overHard = words > HARD_LIMIT
  const isGenerating = generating.use_case_spotlight ?? false
  const violations = voiceWarnings.use_case_spotlight ?? []
  const error = generationError.use_case_spotlight ?? null
  const noPOV = !section.pov_id
  const tailoredAccount = section.tailored_for_account ?? ''

  const patch = (next: Partial<typeof section>) => {
    updateCurrentDraft({
      sections: {
        ...currentDraft.sections,
        use_case_spotlight: { ...section, ...next },
      },
    })
  }

  const handleCompose = () => {
    if (!section.pov_id) return
    void generateSection('use_case_spotlight', {
      kind: 'use_case_spotlight',
      povId: section.pov_id,
      userInput: section.content || null,
      tailoredForAccount: section.tailored_for_account ?? null,
    })
  }

  const handleTailor = () => {
    if (!section.pov_id) return
    if (!tailorPromptOpen) {
      setTailorPromptOpen(true)
      setTailorInput(tailoredAccount)
      return
    }
    const account = tailorInput.trim()
    if (!account) {
      setTailorPromptOpen(false)
      return
    }
    patch({ tailored_for_account: account })
    void generateSection('use_case_spotlight', {
      kind: 'use_case_spotlight',
      povId: section.pov_id,
      userInput: section.content || null,
      tailoredForAccount: account,
    })
    setTailorPromptOpen(false)
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-display font-semibold text-slate-900">Use Case Spotlight</h2>
        <p className="text-sm font-body text-slate-500 mt-0.5">
          200 words. Pick a POV, generate the spotlight.
        </p>
      </div>

      <div>
        <label className="block text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
          POV
        </label>
        <POVPicker
          selectedId={section.pov_id}
          onChange={(povId) => patch({ pov_id: povId })}
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <AIAssistButton
          label="Compose spotlight from POV"
          loading={isGenerating}
          disabledReason={noPOV ? 'Select a POV first' : undefined}
          onClick={handleCompose}
        />
        <AIAssistButton
          label={tailorPromptOpen ? 'Generate tailored version' : 'Tailor for account'}
          loading={isGenerating}
          disabledReason={noPOV ? 'Select a POV first' : undefined}
          onClick={handleTailor}
        />
        {tailorPromptOpen && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tailorInput}
              onChange={(e) => setTailorInput(e.target.value)}
              placeholder="e.g. Walmart"
              autoFocus
              className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-surface-0 text-xs font-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => {
                setTailorPromptOpen(false)
                setTailorInput('')
              }}
              className="text-xs font-display font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
        <CheckVoiceButton section="use_case_spotlight" />
      </div>

      <VoiceWarningBanner
        violations={violations}
        onApply={() => applyVoiceSuggestions('use_case_spotlight')}
        onDismiss={() => dismissVoiceWarning('use_case_spotlight')}
        applying={isGenerating}
      />

      <GenerationErrorToast
        message={error}
        onDismiss={() => useComposeStore.setState((s) => ({
          generationError: { ...s.generationError, use_case_spotlight: null },
        }))}
        onRetry={handleCompose}
      />

      <div className="relative">
        <GenerationOverlay
          visible={isGenerating}
          message="Composing spotlight"
          estimate="about 20 seconds"
        />
        <textarea
          rows={12}
          value={section.content}
          onChange={(e) => patch({ content: e.target.value })}
          disabled={isGenerating}
          placeholder="What it is. The differentiator. Target accounts. The AE hook."
          className="w-full rounded-xl border border-border bg-surface-0 px-4 py-3 text-base font-body text-slate-900 placeholder:text-slate-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y min-h-[18rem] disabled:bg-surface-1"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="block text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Tailored for account (optional)
          </label>
          <input
            type="text"
            value={tailoredAccount}
            onChange={(e) => patch({ tailored_for_account: e.target.value || null })}
            placeholder="e.g. Walmart, Mars, Kroger"
            className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
        </div>
        <span
          className={`text-xs font-display font-medium shrink-0 ${
            overHard ? 'text-loss' : overSoft ? 'text-amber-600' : 'text-slate-400'
          }`}
        >
          {words} / {SOFT_LIMIT} words
          {overHard && ` · ${words - HARD_LIMIT} over hard cap`}
        </span>
      </div>
    </div>
  )
}
