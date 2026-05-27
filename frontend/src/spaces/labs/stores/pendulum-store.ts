import { create } from 'zustand'
import type { EnergyReadout, PendulumParams } from '@/spaces/labs/lib/pendulum-engine'

export type PendulumMode = 'single' | 'swarm'

export interface DivergenceSample {
  t: number // seconds since the run started
  d: number // configuration-space distance (rad)
}

export interface PendulumPreset {
  id: string
  label: string
  th1: number
  th2: number
  description: string
}

// Angles are in radians, measured from the downward vertical.
export const PENDULUM_PRESETS: PendulumPreset[] = [
  {
    id: 'classic',
    label: 'Classic chaos',
    th1: Math.PI / 2,
    th2: Math.PI / 2,
    description: 'Both arms started horizontal — the canonical high-energy chaotic run.',
  },
  {
    id: 'overhead',
    label: 'Near-vertical',
    th1: Math.PI * 0.98,
    th2: Math.PI * 0.98,
    description: 'Balanced almost straight up: a tiny imbalance triggers a violent collapse.',
  },
  {
    id: 'gentle',
    label: 'Gentle swing',
    th1: Math.PI / 6,
    th2: Math.PI / 6,
    description: 'Small angles stay near-periodic and orderly — chaos needs energy.',
  },
]

const DEFAULT_PARAMS: PendulumParams = {
  m1: 1,
  m2: 1,
  L1: 1,
  L2: 1,
  g: 9.81,
  damping: 0,
}

const HISTORY_CAP = 400 // divergence samples kept for the chart

interface PendulumStore {
  params: PendulumParams
  initial: { th1: number; th2: number }
  mode: PendulumMode
  swarmCount: number
  epsilon: number // per-member start-angle perturbation (rad)
  speed: number // time multiplier
  trailOn: boolean
  trailLength: number
  isRunning: boolean
  revision: number // bumps when the sim must re-seed from initial conditions

  // Low-rate readouts pushed by the canvas engine (~12 Hz), not per frame.
  energy: EnergyReadout
  divergence: number
  divergenceHistory: DivergenceSample[]

  setParam: <K extends keyof PendulumParams>(key: K, value: number) => void
  setInitial: (th1: number, th2: number) => void
  setMode: (mode: PendulumMode) => void
  setSwarmCount: (n: number) => void
  setEpsilon: (e: number) => void
  setSpeed: (s: number) => void
  setTrailOn: (on: boolean) => void
  setTrailLength: (n: number) => void
  applyPreset: (preset: PendulumPreset) => void
  play: () => void
  pause: () => void
  toggleRun: () => void
  reset: () => void
  pushReadout: (energy: EnergyReadout, divergence: number, sample: DivergenceSample) => void
}

// A param/topology change re-seeds the sim to its initial pose and clears the
// analytics history (you can't meaningfully continue chaos history across a
// physics change). The running/paused state is preserved.
function reseed(set: (partial: Partial<PendulumStore>) => void, get: () => PendulumStore) {
  set({
    revision: get().revision + 1,
    divergenceHistory: [],
    divergence: 0,
  })
}

export const usePendulumStore = create<PendulumStore>((set, get) => ({
  params: { ...DEFAULT_PARAMS },
  initial: { th1: Math.PI / 2, th2: Math.PI / 2 },
  mode: 'swarm',
  swarmCount: 30,
  epsilon: 0.001,
  speed: 1,
  trailOn: true,
  trailLength: 220,
  isRunning: false,
  revision: 0,

  energy: { ke: 0, pe: 0, total: 0 },
  divergence: 0,
  divergenceHistory: [],

  setParam: (key, value) => {
    set({ params: { ...get().params, [key]: value } })
    reseed(set, get)
  },

  setInitial: (th1, th2) => {
    set({ initial: { th1, th2 } })
    reseed(set, get)
  },

  setMode: (mode) => {
    set({ mode })
    reseed(set, get)
  },

  setSwarmCount: (n) => {
    set({ swarmCount: Math.max(2, Math.min(60, Math.round(n))) })
    reseed(set, get)
  },

  setEpsilon: (e) => {
    set({ epsilon: e })
    reseed(set, get)
  },

  // Speed and trail are "live" — they never re-seed the simulation.
  setSpeed: (s) => set({ speed: s }),
  setTrailOn: (on) => set({ trailOn: on }),
  setTrailLength: (n) => set({ trailLength: Math.max(0, Math.min(600, Math.round(n))) }),

  applyPreset: (preset) => {
    set({ initial: { th1: preset.th1, th2: preset.th2 } })
    reseed(set, get)
  },

  play: () => set({ isRunning: true }),
  pause: () => set({ isRunning: false }),
  toggleRun: () => set({ isRunning: !get().isRunning }),

  reset: () => {
    set({ isRunning: false })
    reseed(set, get)
  },

  pushReadout: (energy, divergence, sample) => {
    const { divergenceHistory } = get()
    const nextHistory =
      divergenceHistory.length >= HISTORY_CAP
        ? [...divergenceHistory.slice(divergenceHistory.length - HISTORY_CAP + 1), sample]
        : [...divergenceHistory, sample]
    set({ energy, divergence, divergenceHistory: nextHistory })
  },
}))
