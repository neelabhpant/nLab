import { Sparkles } from 'lucide-react'

interface AIAssistButtonProps {
  label: string
}

/**
 * Disabled placeholder for the Phase 5 AI assist actions. Renders the button
 * so the UI signals where assistance will live, but the action is a no-op
 * with a tooltip that flags the upcoming phase.
 */
export function AIAssistButton({ label }: AIAssistButtonProps) {
  return (
    <button
      type="button"
      disabled
      title="Available in Phase 5"
      aria-label={`${label} (available in Phase 5)`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 bg-surface-1 text-xs font-display font-medium text-slate-500 opacity-60 cursor-not-allowed"
    >
      <Sparkles className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}
