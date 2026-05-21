import { useComposeStore } from '../stores/compose-store'
import { AIAssistButton } from '../components/ai-assist-button'

const SOFT_LIMIT = 100
const HARD_LIMIT = 130

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function TheReadEditor() {
  const { currentDraft, updateCurrentDraft } = useComposeStore()
  if (!currentDraft) return null

  const content = currentDraft.sections.the_read.content
  const words = countWords(content)
  const overSoft = words > SOFT_LIMIT
  const overHard = words > HARD_LIMIT

  const handleChange = (value: string) => {
    updateCurrentDraft({
      sections: {
        ...currentDraft.sections,
        the_read: { ...currentDraft.sections.the_read, content: value },
      },
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-display font-semibold text-slate-900">The Read</h2>
        <p className="text-sm font-body text-slate-500 mt-0.5">
          100 words. Your opinion. One sharp take.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <AIAssistButton label="Draft from scratch" />
        <AIAssistButton label="Polish in voice" />
        <AIAssistButton label="Sharper" />
        <AIAssistButton label="Make the prediction concrete" />
      </div>

      <textarea
        rows={12}
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="State the sharpest insight. Then explain."
        className="w-full rounded-xl border border-border bg-surface-0 px-4 py-3 text-base font-body text-slate-900 placeholder:text-slate-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y min-h-[18rem]"
      />

      <div className="flex items-center justify-end text-xs font-display font-medium">
        <span className={overHard ? 'text-loss' : overSoft ? 'text-amber-600' : 'text-slate-400'}>
          {words} / {SOFT_LIMIT} words
          {overHard && ` · ${words - HARD_LIMIT} over hard cap`}
        </span>
      </div>
    </div>
  )
}
