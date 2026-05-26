import { Sparkles, Loader2 } from 'lucide-react'

interface AIAssistButtonProps {
  label: string
  enabled?: boolean
  loading?: boolean
  disabledReason?: string
  onClick?: () => void
}

/**
 * AI assist button.
 *
 * - `enabled=false` renders a Phase-5 style placeholder (kept for any surface
 *   that wants to flag future work).
 * - `enabled=true` renders the live button. While `loading=true` the icon
 *   swaps to a spinner and clicks are ignored.
 * - `disabledReason` overrides the tooltip when the button is enabled-but-
 *   not-clickable (e.g., spotlight requires a POV selection first).
 */
export function AIAssistButton({
  label,
  enabled = true,
  loading = false,
  disabledReason,
  onClick,
}: AIAssistButtonProps) {
  const inactive = !enabled || loading || Boolean(disabledReason)
  const title = !enabled
    ? 'Available in Phase 5'
    : disabledReason
      ? disabledReason
      : loading
        ? 'Working…'
        : label

  return (
    <button
      type="button"
      disabled={inactive}
      title={title}
      aria-label={`${label}${inactive ? ` (${title})` : ''}`}
      onClick={enabled && !loading && !disabledReason ? onClick : undefined}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium transition-colors',
        enabled && !inactive
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
          : enabled && disabledReason
            ? 'border border-slate-200 bg-surface-1 text-slate-400 cursor-not-allowed'
            : enabled && loading
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-wait'
              : 'border border-dashed border-slate-300 bg-surface-1 text-slate-500 opacity-60 cursor-not-allowed',
      ].join(' ')}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}
