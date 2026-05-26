import { useState } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { useComposeStore, type ActiveSection } from '../stores/compose-store'

/**
 * Manual voice-check trigger. With voice-check mode defaulting to "manual",
 * generation no longer auto-fires a check — the user runs it here when ready.
 */
export function CheckVoiceButton({ section }: { section: ActiveSection }) {
  const checkVoice = useComposeStore((s) => s.checkVoice)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      await checkVoice(section)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title="Run the voice check on this section (Haiku)"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-surface-0 text-xs font-display font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
      Check voice
    </button>
  )
}
