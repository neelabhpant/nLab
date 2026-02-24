import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

interface SparklineProps {
  data: { price: number }[]
  color: string
  gainColor?: string
  lossColor?: string
}

export function Sparkline({ data, color, gainColor = '#00E599', lossColor = '#FF4976' }: SparklineProps) {
  if (data.length < 2) return null

  const first = data[0].price
  const last = data[data.length - 1].price
  const trending = last >= first
  const strokeColor = trending ? gainColor : lossColor
  const gradientId = `sparkline-${color.replace('#', '')}-${Math.random().toString(36).slice(2, 7)}`

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.4} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={['dataMin', 'dataMax']} hide />
        <Area
          type="monotone"
          dataKey="price"
          stroke={strokeColor}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          animationDuration={1200}
          animationEasing="ease-in-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
