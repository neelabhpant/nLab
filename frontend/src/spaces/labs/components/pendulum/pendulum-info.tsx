import { useMemo } from 'react'
import { Activity, TrendingUp, Sparkles, Orbit } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { usePendulumStore } from '@/spaces/labs/stores/pendulum-store'

const CARD = 'rounded-2xl border border-white/10 bg-white/[0.03] p-4'

export function PendulumInfo() {
  const energy = usePendulumStore((s) => s.energy)
  const divergenceVal = usePendulumStore((s) => s.divergence)
  const history = usePendulumStore((s) => s.divergenceHistory)
  const mode = usePendulumStore((s) => s.mode)
  const damping = usePendulumStore((s) => s.params.damping)

  const chartData = useMemo(
    () => history.map((s) => ({ t: Number(s.t.toFixed(2)), d: Math.max(s.d, 1e-6) })),
    [history],
  )

  return (
    <div className="space-y-4">
      {/* Energy readout */}
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-[#F5A623]" />
          <h3 className="text-sm font-display font-semibold text-white">Energy</h3>
          <span className="ml-auto text-[11px] font-body text-white/40">
            {damping === 0 ? 'conserved (frictionless)' : 'dissipating'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Kinetic', value: energy.ke, color: '#00D4FF' },
            { label: 'Potential', value: energy.pe, color: '#BD6BFF' },
            { label: 'Total', value: energy.total, color: '#F5A623' },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-white/5 px-3 py-2.5">
              <p className="text-[10px] font-display font-semibold uppercase tracking-wide" style={{ color: m.color }}>
                {m.label}
              </p>
              <p className="text-base font-display font-bold text-white tabular-nums">
                {m.value.toFixed(2)}
                <span className="text-[10px] font-body font-normal text-white/40 ml-1">J</span>
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[11px] font-body text-white/40 leading-relaxed">
          With damping off, total energy stays flat — proof the motion is real physics
          (RK4-integrated), not a scripted animation.
        </p>
      </div>

      {/* Divergence vs time */}
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-sm font-display font-semibold text-white">Divergence</h3>
          <span className="ml-auto text-xs font-display font-bold text-[#00D4FF] tabular-nums">
            {divergenceVal < 0.001 ? divergenceVal.toExponential(1) : divergenceVal.toFixed(3)} rad
          </span>
        </div>
        <p className="text-[11px] font-body text-white/40 mb-2">
          Separation of two pendulums started ε apart, on a log scale.
        </p>
        <div className="h-[140px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="divGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00D4FF" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 9, fill: '#6B7280', fontFamily: "'Outfit', sans-serif" }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickFormatter={(v) => `${v}s`}
              />
              <YAxis
                scale="log"
                domain={[1e-6, 10]}
                tick={{ fontSize: 9, fill: '#6B7280', fontFamily: "'Outfit', sans-serif" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1 ? String(v) : v.toExponential(0))}
                width={42}
              />
              <Line
                type="monotone"
                dataKey="d"
                stroke="url(#divGrad)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {mode === 'single' && (
          <p className="text-[11px] font-body text-white/40 mt-1">
            Switch to <span className="text-[#F5A623]">Swarm</span> to watch this fan out across many pendulums.
          </p>
        )}
      </div>

      {/* What you're seeing — chaos + phase space, in plain terms */}
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#F5A623]" />
          <h3 className="text-sm font-display font-semibold text-white">What you're seeing</h3>
        </div>
        <p className="text-xs font-body text-white/55 leading-relaxed">
          A double pendulum is <span className="font-semibold text-white/90">deterministic</span> —
          the same start always gives the same motion. Yet it's{' '}
          <span className="font-semibold text-white/90">chaotic</span>: two starts a hair apart (ε)
          track together, then diverge exponentially. Run the swarm and watch a tight cluster explode
          into a fan — the "sensitive dependence" a teacher shows with two steel rods.
        </p>
      </div>

      {/* Phase space, explained */}
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-2">
          <Orbit className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-sm font-display font-semibold text-white">Reading the phase map</h3>
        </div>
        <p className="text-xs font-body text-white/55 leading-relaxed">
          The cyan box on the stage maps the lower arm's <span className="font-semibold text-white/90">behaviour</span>,
          not its position: how far it's <span className="text-white/90">tilted</span> (left↔right) versus how fast it's{' '}
          <span className="text-white/90">spinning</span> (up↔down). The dotted line ties it back to the real bob.
          A simple swing would trace the <span className="font-semibold text-white/90">same loop forever — a habit</span>.
          This one never repeats: chaos can't settle into a rhythm.
        </p>
        <p className="mt-2 text-[11px] font-body text-white/40 leading-relaxed">
          It's the same math that decides whether a passing asteroid leaves forever, loops back in
          centuries, or gets briefly captured — the three-body problem that founded chaos theory.
        </p>
      </div>
    </div>
  )
}
