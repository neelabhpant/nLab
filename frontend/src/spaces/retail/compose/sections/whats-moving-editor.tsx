import { useState } from 'react'
import { useRetailStore } from '@/spaces/retail/stores/retail-store'
import { useComposeStore, type WhatsMovingItem } from '../stores/compose-store'
import { AIAssistButton } from '../components/ai-assist-button'
import { GenerationOverlay } from '../components/generation-overlay'
import { VoiceWarningBanner } from '../components/voice-warning-banner'
import { GenerationErrorToast } from '../components/generation-error-toast'

const CHAR_LIMIT = 200
const ITEM_COUNT = 4

export function WhatsMovingEditor() {
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
  const { digest, fetchDigest } = useRetailStore()
  const [fetchingDigest, setFetchingDigest] = useState(false)

  if (!currentDraft) return null

  const items: WhatsMovingItem[] = [...currentDraft.sections.whats_moving.items]
  while (items.length < ITEM_COUNT) items.push({ article_id: null, line: '' })
  items.length = ITEM_COUNT

  const isGenerating = generating.whats_moving ?? false
  const violations = voiceWarnings.whats_moving ?? []
  const error = generationError.whats_moving ?? null

  const handleChange = (index: number, line: string) => {
    const next = items.map((it, i) => (i === index ? { ...it, line } : it))
    updateCurrentDraft({
      sections: {
        ...currentDraft.sections,
        whats_moving: { items: next },
      },
    })
  }

  const handleSuggestFromDigest = async () => {
    setFetchingDigest(true)
    try {
      if (!digest || (digest.articles?.length ?? 0) === 0) {
        await fetchDigest()
      }
      const current = useRetailStore.getState().digest
      const top = (current?.articles ?? []).slice(0, 4)
      if (top.length === 0) {
        useComposeStore.setState((s) => ({
          generationError: {
            ...s.generationError,
            whats_moving: 'No digest articles available. Refresh the Daily Digest first.',
          },
        }))
        return
      }
      const userInput = top
        .map((a, idx) => `${idx + 1}. ${a.title}${a.summary ? ` — ${a.summary}` : ''}`)
        .join('\n')
      await generateSection('whats_moving', { kind: 'whats_moving', userInput })
    } finally {
      setFetchingDigest(false)
    }
  }

  const handlePolishLines = () => {
    const currentInput = items
      .map((i, idx) => (i.line.trim() ? `${idx + 1}. ${i.line}` : ''))
      .filter(Boolean)
      .join('\n')
    if (!currentInput.trim()) {
      useComposeStore.setState((s) => ({
        generationError: {
          ...s.generationError,
          whats_moving: 'Add at least one rough line to polish.',
        },
      }))
      return
    }
    void generateSection('whats_moving', { kind: 'whats_moving', userInput: currentInput })
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-display font-semibold text-slate-900">What's Moving</h2>
        <p className="text-sm font-body text-slate-500 mt-0.5">
          4 bullets. 1 line each. Account-relevant, not just news.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <AIAssistButton
          label={fetchingDigest ? 'Loading digest…' : "Suggest 4 from this week's digest"}
          loading={isGenerating || fetchingDigest}
          onClick={handleSuggestFromDigest}
        />
        <AIAssistButton
          label="Generate 1-line takes"
          loading={isGenerating}
          onClick={handlePolishLines}
        />
      </div>

      <VoiceWarningBanner
        violations={violations}
        onApply={() => applyVoiceSuggestions('whats_moving')}
        onDismiss={() => dismissVoiceWarning('whats_moving')}
        applying={isGenerating}
      />

      <GenerationErrorToast
        message={error}
        onDismiss={() => useComposeStore.setState((s) => ({
          generationError: { ...s.generationError, whats_moving: null },
        }))}
        onRetry={handlePolishLines}
      />

      <div className="relative">
        <GenerationOverlay
          visible={isGenerating}
          message="Generating takes"
          estimate="about 10 seconds"
        />
        <div className="space-y-3">
          {items.map((item, idx) => {
            const over = item.line.length > CHAR_LIMIT
            return (
              <div key={idx} className="flex items-start gap-3">
                <span className="mt-2.5 text-xs font-display font-semibold text-slate-400 w-6 shrink-0">
                  #{idx + 1}
                </span>
                <div className="flex-1">
                  <input
                    type="text"
                    value={item.line}
                    onChange={(e) => handleChange(idx, e.target.value)}
                    disabled={isGenerating}
                    placeholder="What happened. Why it matters for the account."
                    className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2.5 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:bg-surface-1"
                  />
                  <div className="mt-1 flex justify-end text-[11px] font-display font-medium">
                    <span className={over ? 'text-loss' : 'text-slate-400'}>
                      {item.line.length} / {CHAR_LIMIT}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
  // Note: polishSection unused locally; kept on the store API so other sections share the path.
  void polishSection
}
