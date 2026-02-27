import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface TradeConfirmationModalProps {
  open: boolean
  symbol: string
  qty: number
  side: 'buy' | 'sell'
  submitting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function TradeConfirmationModal({
  open,
  symbol,
  qty,
  side,
  submitting,
  onConfirm,
  onCancel,
}: TradeConfirmationModalProps) {
  const isBuy = side === 'buy'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
            className="bg-surface-0 rounded-xl border border-border shadow-2xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-display font-semibold text-slate-900">Confirm Order</h3>
              </div>
              <button onClick={onCancel} className="p-1 rounded-lg hover:bg-surface-1 transition-colors cursor-pointer">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="rounded-lg bg-surface-1 border border-border p-4 mb-5">
              <p className="text-sm text-slate-600 font-body">
                {isBuy ? 'Buy' : 'Sell'}{' '}
                <span className="font-display font-bold text-slate-900">{qty}</span>{' '}
                shares of{' '}
                <span className="font-display font-bold text-slate-900">{symbol.toUpperCase()}</span>
              </p>
              <p className="text-xs text-slate-400 font-body mt-1">Market order · Day</p>
            </div>

            <p className="text-xs text-slate-500 font-body mb-4">
              This is a paper trade. No real money will be used.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-display font-medium text-slate-700 hover:bg-surface-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={submitting}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-display font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 ${
                  isBuy
                    ? 'bg-gain hover:bg-gain/90'
                    : 'bg-loss hover:bg-loss/90'
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Submitting…
                  </span>
                ) : (
                  `Confirm ${isBuy ? 'Buy' : 'Sell'}`
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
