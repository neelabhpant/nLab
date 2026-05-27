import { Play, Pause, RotateCcw, Layers, Circle, Gauge, Spline, SlidersHorizontal } from 'lucide-react'
import { usePendulumStore } from '@/spaces/labs/stores/pendulum-store'

interface PendulumDockProps {
  tuneOpen: boolean
  onToggleTune: () => void
}

/**
 * Floating glass HUD docked at the bottom of the stage — transport, mode,
 * speed, trail, and the Tune toggle. Overlays the canvas instead of stealing
 * layout space, so the simulation stays the hero.
 */
export function PendulumDock({ tuneOpen, onToggleTune }: PendulumDockProps) {
  const store = usePendulumStore()

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-2rem)] max-w-[640px]">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 rounded-2xl border border-white/10 bg-black/45 backdrop-blur-md px-3 py-2.5 shadow-xl">
        <button
          onClick={() => store.toggleRun()}
          className="w-11 h-11 rounded-full flex items-center justify-center text-[#15110d] transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
          style={{ background: 'linear-gradient(135deg, #F5A623, #FF8C42)' }}
          aria-label={store.isRunning ? 'Pause' : 'Play'}
        >
          {store.isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <button
          onClick={() => store.reset()}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all cursor-pointer shrink-0"
          aria-label="Reset"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="w-px h-7 bg-white/10 mx-0.5 hidden sm:block" />

        {/* Single / Swarm */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5">
          <button
            onClick={() => store.setMode('single')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-display font-medium transition-all cursor-pointer ${
              store.mode === 'single' ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white/80'
            }`}
          >
            <Circle className="w-3 h-3" /> Single
          </button>
          <button
            onClick={() => store.setMode('swarm')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-display font-medium transition-all cursor-pointer ${
              store.mode === 'swarm' ? 'bg-[#F5A623]/20 text-[#F5A623]' : 'text-white/45 hover:text-white/80'
            }`}
          >
            <Layers className="w-3 h-3" /> Swarm
          </button>
        </div>

        <label className="flex items-center gap-2 text-white/50 font-display text-xs">
          <Gauge className="w-3.5 h-3.5 shrink-0" />
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.1}
            value={store.speed}
            onChange={(e) => store.setSpeed(parseFloat(e.target.value))}
            className="w-16 sm:w-20 accent-[#F5A623] cursor-pointer"
          />
          <span className="text-white/70 font-medium w-8 tabular-nums">{store.speed.toFixed(1)}x</span>
        </label>

        <button
          onClick={() => store.setTrailOn(!store.trailOn)}
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all cursor-pointer ${
            store.trailOn ? 'bg-[#F5A623]/20 text-[#F5A623]' : 'bg-white/5 text-white/45 hover:text-white/80'
          }`}
          aria-label="Toggle trail"
          title="Motion trail"
        >
          <Spline className="w-4 h-4" />
        </button>

        <div className="w-px h-7 bg-white/10 mx-0.5 hidden sm:block" />

        <button
          onClick={onToggleTune}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-display font-medium transition-all cursor-pointer ${
            tuneOpen ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Tune
        </button>
      </div>
    </div>
  )
}
