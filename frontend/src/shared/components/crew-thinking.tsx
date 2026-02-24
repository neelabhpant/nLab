import { motion, AnimatePresence } from 'framer-motion'
import { Cpu } from 'lucide-react'
import type { ThinkingStep } from '@/spaces/finance/stores/chat-store'

interface CrewThinkingProps {
  steps: ThinkingStep[]
  visible: boolean
}

export function CrewThinking({ steps, visible }: CrewThinkingProps) {
  return (
    <AnimatePresence>
      {visible && steps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="flex gap-3 max-w-[600px]"
        >
          <div className="w-7 h-7 rounded-lg bg-cyan flex items-center justify-center flex-shrink-0 mt-0.5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Cpu className="w-3.5 h-3.5 text-white" />
            </motion.div>
          </div>

          <div className="space-y-1.5">
            {steps.map((step, i) => (
              <motion.div
                key={step.timestamp}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: i === steps.length - 1 ? 1 : 0.4, x: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2"
              >
                {i === steps.length - 1 && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan" />
                  </span>
                )}
                {i < steps.length - 1 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-surface-3" />
                )}
                <span className="text-xs text-muted-foreground font-body">
                  {step.content}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
