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

export function CompareSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center gap-3 mb-6">
        <Shimmer className="w-64 h-9 rounded-lg" />
        <Shimmer className="w-40 h-9 rounded-lg" />
        <Shimmer className="w-36 h-9 rounded-lg" />
      </div>
      <div className="flex-1 rounded-xl border border-border bg-surface-0 p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <Shimmer className="w-48 h-8 rounded-lg" />
        </div>
        <Shimmer className="w-full h-full min-h-[300px] rounded-lg" />
      </div>
    </motion.div>
  )
}
