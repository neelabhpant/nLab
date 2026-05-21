import { useComposeStore } from '../stores/compose-store'
import { AIAssistButton } from '../components/ai-assist-button'
import { POVPicker } from '../components/pov-picker'

const SOFT_LIMIT = 200
const HARD_LIMIT = 230

function countWords(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

export function UseCaseSpotlightEditor() {
  const { currentDraft, updateCurrentDraft } = useComposeStore()
  if (!currentDraft) return null

  const section = currentDraft.sections.use_case_spotlight
  const words = countWords(section.content)
  const overSoft = words > SOFT_LIMIT
  const overHard = words > HARD_LIMIT

  const patch = (next: Partial<typeof section>) => {
    updateCurrentDraft({
      sections: {
        ...currentDraft.sections,
        use_case_spotlight: { ...section, ...next },
      },
    })
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

      <div className="flex flex-wrap gap-2">
        <AIAssistButton label="Compose spotlight from POV" />
        <AIAssistButton label="Tailor for account" />
      </div>

      <textarea
        rows={12}
        value={section.content}
        onChange={(e) => patch({ content: e.target.value })}
        placeholder="What it is. The differentiator. Target accounts. The AE hook."
        className="w-full rounded-xl border border-border bg-surface-0 px-4 py-3 text-base font-body text-slate-900 placeholder:text-slate-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y min-h-[18rem]"
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="block text-[10px] font-display font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Tailored for account (optional)
          </label>
          <input
            type="text"
            value={section.tailored_for_account ?? ''}
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
