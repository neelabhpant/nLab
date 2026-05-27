import { X } from 'lucide-react'
import { usePendulumStore, PENDULUM_PRESETS } from '@/spaces/labs/stores/pendulum-store'
import type { PendulumParams } from '@/spaces/labs/lib/pendulum-engine'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}

function Slider({ label, value, min, max, step, onChange, format }: SliderProps) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-[11px] font-display font-medium text-white/55 mb-1">
        <span>{label}</span>
        <span className="text-white/90 tabular-nums">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#F5A623] cursor-pointer"
      />
    </label>
  )
}

/** Glass drawer content: starting poses + the physical parameters of the rig. */
export function PendulumTune({ onClose }: { onClose: () => void }) {
  const store = usePendulumStore()
  const p = store.params
  const setP = <K extends keyof PendulumParams>(k: K) => (v: number) => store.setParam(k, v)

  return (
    <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-2xl p-4 w-[300px] max-h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-display font-semibold text-white">Tune the rig</h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] font-display font-semibold text-white/40 uppercase tracking-wider mb-2">
        Starting pose
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PENDULUM_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => store.applyPreset(preset)}
            title={preset.description}
            className="px-3 py-1.5 rounded-lg text-xs font-display font-medium bg-white/5 text-white/65 hover:text-white hover:bg-white/12 transition-all cursor-pointer"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] font-body text-white/35">
        Or drag either bob on the stage to set the start by hand.
      </p>

      <div className="h-px bg-white/10 my-4" />

      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Slider label="Mass m₁" value={p.m1} min={0.2} max={5} step={0.1} onChange={setP('m1')} format={(v) => `${v.toFixed(1)} kg`} />
        <Slider label="Mass m₂" value={p.m2} min={0.2} max={5} step={0.1} onChange={setP('m2')} format={(v) => `${v.toFixed(1)} kg`} />
        <Slider label="Length L₁" value={p.L1} min={0.3} max={1.6} step={0.05} onChange={setP('L1')} format={(v) => `${v.toFixed(2)} m`} />
        <Slider label="Length L₂" value={p.L2} min={0.3} max={1.6} step={0.05} onChange={setP('L2')} format={(v) => `${v.toFixed(2)} m`} />
        <Slider label="Gravity g" value={p.g} min={1} max={20} step={0.1} onChange={setP('g')} format={(v) => v.toFixed(1)} />
        <Slider label="Damping" value={p.damping} min={0} max={0.5} step={0.01} onChange={setP('damping')} format={(v) => (v === 0 ? 'none' : v.toFixed(2))} />
      </div>

      {store.mode === 'swarm' && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 mt-3.5 pt-3.5 border-t border-white/10">
          <Slider label="Swarm size" value={store.swarmCount} min={2} max={60} step={1} onChange={(v) => store.setSwarmCount(v)} format={(v) => v.toFixed(0)} />
          <Slider
            label="Perturbation ε"
            value={store.epsilon}
            min={0.0001}
            max={0.02}
            step={0.0001}
            onChange={(v) => store.setEpsilon(v)}
            format={(v) => `${(v * 1000).toFixed(2)} mrad`}
          />
        </div>
      )}

      <div className="mt-3.5 pt-3.5 border-t border-white/10">
        <Slider label="Trail length" value={store.trailLength} min={0} max={600} step={10} onChange={(v) => store.setTrailLength(v)} format={(v) => v.toFixed(0)} />
      </div>
    </div>
  )
}
