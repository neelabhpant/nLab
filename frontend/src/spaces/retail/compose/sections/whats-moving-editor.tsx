import { useComposeStore, type WhatsMovingItem } from '../stores/compose-store'
import { AIAssistButton } from '../components/ai-assist-button'

const CHAR_LIMIT = 200
const ITEM_COUNT = 4

export function WhatsMovingEditor() {
  const { currentDraft, updateCurrentDraft } = useComposeStore()
  if (!currentDraft) return null

  // Normalise to exactly ITEM_COUNT items for editing.
  const items: WhatsMovingItem[] = [...currentDraft.sections.whats_moving.items]
  while (items.length < ITEM_COUNT) items.push({ article_id: null, line: '' })
  items.length = ITEM_COUNT

  const handleChange = (index: number, line: string) => {
    const next = items.map((it, i) => (i === index ? { ...it, line } : it))
    updateCurrentDraft({
      sections: {
        ...currentDraft.sections,
        whats_moving: { items: next },
      },
    })
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
        <AIAssistButton label="Suggest 4 from this week's digest" />
        <AIAssistButton label="Generate 1-line takes" />
      </div>

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
                  placeholder="What happened. Why it matters for the account."
                  className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2.5 text-sm font-body text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
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
  )
}
