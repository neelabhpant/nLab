import { motion } from 'framer-motion'

function Shimmer({ className }: { className: string }) {
  return (
    <div className={`relative overflow-hidden rounded bg-surface-2 ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-surface-3/40 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

export function PriceCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="rounded-2xl border border-border bg-surface-0 p-6 shadow-sm"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shimmer className="w-10 h-10 rounded-xl" />
          <div>
            <Shimmer className="w-20 h-4 mb-1.5" />
            <Shimmer className="w-10 h-3" />
          </div>
        </div>
        <Shimmer className="w-16 h-6 rounded-lg" />
      </div>
      <Shimmer className="w-48 h-10 mb-5" />
      <Shimmer className="w-full h-[72px] rounded-lg -mx-0" />
      <div className="mt-4 pt-4 border-t border-border flex justify-between">
        <Shimmer className="w-16 h-3" />
        <Shimmer className="w-20 h-3" />
      </div>
    </motion.div>
  )
}
