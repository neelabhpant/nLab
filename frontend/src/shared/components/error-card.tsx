import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorCardProps {
  message: string
  onRetry: () => void
}

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="col-span-full rounded-2xl border border-loss/20 bg-loss/[0.04] p-8"
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-loss/10 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-loss" />
        </div>
        <div>
          <p className="font-display font-medium text-foreground mb-1">Unable to load market data</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-0 border border-border text-sm font-medium text-foreground hover:bg-surface-1 transition-colors cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    </motion.div>
  )
}
