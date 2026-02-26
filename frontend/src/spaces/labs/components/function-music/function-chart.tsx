import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { motion } from 'framer-motion'
import { useFunctionMusicStore } from '@/spaces/labs/stores/function-music-store'

function ActiveDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="#BD6BFF" opacity={0.25}>
        <animate attributeName="r" values="6;12;6" dur="1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={4} fill="#BD6BFF" stroke="#fff" strokeWidth={1.5} />
    </g>
  )
}

export function FunctionChart() {
  const { dataPoints, playheadIndex, isPlaying, isPlotted, dataSource } = useFunctionMusicStore()

  const hasLabels = dataSource === 'csv' && dataPoints.some((p) => p.label)

  const chartData = useMemo(
    () =>
      dataPoints.map((p) => ({
        x: Number(p.x.toFixed(4)),
        y: Number(p.y.toFixed(6)),
        label: p.label,
      })),
    [dataPoints]
  )

  const labelMap = useMemo(() => {
    if (!hasLabels) return null
    const map = new Map<number, string>()
    dataPoints.forEach((p) => {
      if (p.label) map.set(Number(p.x.toFixed(4)), p.label)
    })
    return map
  }, [dataPoints, hasLabels])

  const tickInterval = useMemo(() => {
    if (!hasLabels || chartData.length <= 8) return undefined
    return Math.floor(chartData.length / 7)
  }, [hasLabels, chartData.length])

  const playheadX = useMemo(() => {
    if (playheadIndex >= 0 && playheadIndex < dataPoints.length) {
      return dataPoints[playheadIndex].x
    }
    return null
  }, [playheadIndex, dataPoints])

  if (!isPlotted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #13141f 0%, #1a1b2e 100%)' }}
      >
        <div className="h-[360px] flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3 opacity-40">~</div>
            <p className="text-sm font-display font-medium text-white/40">
              Enter a function and click Plot to see it visualized
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #13141f 0%, #1a1b2e 100%)' }}
    >
      <div className="h-[360px] p-4 pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: hasLabels ? 30 : 10, left: 10 }}>
            <defs>
              <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#BD6BFF" />
                <stop offset="50%" stopColor="#00D4FF" />
                <stop offset="100%" stopColor="#BD6BFF" />
              </linearGradient>
              <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#BD6BFF" stopOpacity={0.3} />
                <stop offset="50%" stopColor="#00D4FF" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#1a1b2e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'Space Grotesk' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tickFormatter={(v: number) => {
                if (hasLabels && labelMap) {
                  const label = labelMap.get(Number(v.toFixed(4)))
                  return label || ''
                }
                return v.toFixed(1)
              }}
              tickCount={hasLabels ? undefined : 7}
              interval={tickInterval}
              angle={hasLabels ? -35 : 0}
              textAnchor={hasLabels ? 'end' : 'middle'}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'Space Grotesk' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tickFormatter={(v: number) => v.toFixed(1)}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e1f36',
                border: '1px solid rgba(189,107,255,0.3)',
                borderRadius: '10px',
                fontFamily: 'Space Grotesk',
                fontSize: 12,
                color: '#e2e8f0',
              }}
              labelFormatter={(v) => {
                const n = Number(v)
                if (hasLabels && labelMap) {
                  const label = labelMap.get(Number(n.toFixed(4)))
                  return label || `x = ${n.toFixed(3)}`
                }
                return `x = ${n.toFixed(3)}`
              }}
              formatter={(v) => [Number(v).toFixed(4), 'y']}
            />
            <Area
              type="monotone"
              dataKey="y"
              stroke="url(#curveGradient)"
              strokeWidth={2.5}
              fill="url(#fillGradient)"
              isAnimationActive={true}
              animationDuration={600}
            />
            {isPlaying && playheadX !== null && (
              <ReferenceLine
                x={playheadX}
                stroke="#BD6BFF"
                strokeWidth={2}
                strokeDasharray="4 2"
                ifOverflow="extendDomain"
              />
            )}
            {isPlaying && playheadIndex >= 0 && playheadIndex < chartData.length && (
              <Area
                type="monotone"
                dataKey="y"
                stroke="none"
                fill="none"
                activeDot={false}
                dot={(props: Record<string, unknown>) => {
                  const idx = props.index as number
                  if (idx === playheadIndex) {
                    return <ActiveDot cx={props.cx as number} cy={props.cy as number} />
                  }
                  return <g />
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
