import { useEffect } from 'react'
import { AlertCircle, X, RotateCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface GenerationErrorToastProps {
  message: string | null
  onDismiss: () => void
  onRetry?: () => void
}

export function GenerationErrorToast({ message, onDismiss, onRetry }: GenerationErrorToastProps) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => onDismiss(), 8000)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-loss/20 bg-loss/5 px-4 py-3 mb-4"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-loss mt-0.5 shrink-0" />
            <div className="flex-1 text-sm font-body text-slate-700">{message}</div>
            <div className="flex items-center gap-1 shrink-0">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-display font-medium text-loss hover:bg-loss/10 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
