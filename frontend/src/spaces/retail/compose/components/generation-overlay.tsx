import { Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface GenerationOverlayProps {
  visible: boolean
  message?: string
  estimate?: string
}

/**
 * Subtle, low-opacity overlay rendered on top of the active section editor
 * while an LLM call is in flight. Doesn't block the rest of the composer.
 */
export function GenerationOverlay({
  visible,
  message = 'Drafting',
  estimate = 'about 15 seconds',
}: GenerationOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-10 rounded-xl bg-surface-0/70 backdrop-blur-[1px] flex items-center justify-center pointer-events-none"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-200 bg-surface-0 shadow-sm">
            <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
            <span className="text-xs font-display font-medium text-slate-700">
              {message}…
            </span>
            <span className="text-[11px] font-body text-slate-400">{estimate}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
