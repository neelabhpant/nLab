import { useState } from 'react'
import { AlertTriangle, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VoiceViolation } from '@/shared/lib/newsletter-api'

const RULE_LABELS: Record<number, string> = {
  1: 'no em-dashes',
  2: 'no parallel lists in prose',
  3: 'no hedging',
  4: 'no filler phrases',
  5: 'no bolded lead-ins',
  6: 'no exclamation marks',
  7: 'tighten long sentences',
  8: 'no copywriter phrasing',
}

interface VoiceWarningBannerProps {
  violations: VoiceViolation[]
  onApply: () => Promise<void> | void
  onDismiss: () => void
  applying?: boolean
}

export function VoiceWarningBanner({
  violations,
  onApply,
  onDismiss,
  applying = false,
}: VoiceWarningBannerProps) {
  const [busy, setBusy] = useState(false)

  if (violations.length === 0) return null

  const handleApply = async () => {
    setBusy(true)
    try {
      await onApply()
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 mb-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-semibold text-amber-900 mb-2">
              Voice check: {violations.length}{' '}
              {violations.length === 1 ? 'issue' : 'issues'} found
            </p>
            <ul className="space-y-1.5">
              {violations.map((v, idx) => (
                <li key={idx} className="text-xs font-body text-slate-700">
                  <span className="font-mono bg-amber-100/70 rounded px-1 py-0.5">
                    {v.problematic_text || '—'}
                  </span>{' '}
                  → <span className="text-amber-900">{v.suggestion}</span>{' '}
                  <span className="text-amber-700/70">
                    (rule {v.rule}: {RULE_LABELS[v.rule] ?? 'voice'})
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleApply}
                disabled={busy || applying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-display font-medium hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                {busy || applying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                Apply suggestions
              </button>
              <button
                type="button"
                onClick={onDismiss}
                disabled={busy || applying}
                className="inline-flex items-center gap-1 text-xs font-display font-medium text-amber-800 hover:text-amber-900 cursor-pointer disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
