import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import type { ComponentType } from 'react'

interface ComingSoonCardProps {
  title: string
  phase: number | string
  description?: string
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>
}

export function ComingSoonCard({ title, phase, description, icon: Icon = Sparkles }: ComingSoonCardProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md rounded-2xl border border-border bg-surface-0 p-8 shadow-sm text-center"
      >
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan/10 text-cyan mb-5">
          <Icon className="w-6 h-6" strokeWidth={1.75} />
        </div>
        <h2 className="text-xl font-display font-semibold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm font-body text-slate-500 mb-4">
          {description ?? 'This surface is part of the Newsletter Composer build.'}
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-1 border border-border">
          <span className="text-[10px] font-display font-semibold uppercase tracking-wider text-slate-400">
            Coming soon
          </span>
          <span className="text-[10px] font-display font-semibold text-slate-600">
            · Phase {phase}
          </span>
        </div>
      </motion.div>
    </div>
  )
}
