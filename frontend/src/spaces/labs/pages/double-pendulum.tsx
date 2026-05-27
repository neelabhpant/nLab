import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { PendulumCanvas } from '@/spaces/labs/components/pendulum/pendulum-canvas'
import { PendulumDock } from '@/spaces/labs/components/pendulum/pendulum-dock'
import { PendulumTune } from '@/spaces/labs/components/pendulum/pendulum-tune'
import { PendulumInfo } from '@/spaces/labs/components/pendulum/pendulum-info'
import { usePendulumStore } from '@/spaces/labs/stores/pendulum-store'

export function DoublePendulum() {
  const navigate = useNavigate()
  const { onMobileMenuToggle } = useLayoutContext()
  const reset = usePendulumStore((s) => s.reset)
  const [tuneOpen, setTuneOpen] = useState(false)

  // Re-seed to the starting pose whenever the exhibit is opened.
  useEffect(() => {
    reset()
  }, [reset])

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Double Pendulum" subtitle="Chaos theory · Labs" onMenuToggle={onMobileMenuToggle}>
        <button
          onClick={() => navigate('/labs')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all duration-200 cursor-pointer"
        >
          <ArrowLeft className="w-3 h-3" />
          Gallery
        </button>
      </TopHeader>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row bg-[#0a0b12]">
        {/* The stage — the simulation is the hero, filling the space. */}
        <div
          className="relative flex-1 min-h-[58vh] lg:min-h-0 overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 42%, #1d2036 0%, #11131f 55%, #0a0b12 100%)',
          }}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <PendulumCanvas />
          </motion.div>

          <AnimatePresence>
            {tuneOpen && (
              <motion.div
                key="tune"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute top-4 left-4 bottom-24 z-20 flex"
              >
                <PendulumTune onClose={() => setTuneOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>

          <PendulumDock tuneOpen={tuneOpen} onToggleTune={() => setTuneOpen((o) => !o)} />
        </div>

        {/* Analytics rail — cohesive dark instrument panel. */}
        <aside className="w-full lg:w-[360px] shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0c0d15] p-4">
          <PendulumInfo />
        </aside>
      </div>
    </div>
  )
}
