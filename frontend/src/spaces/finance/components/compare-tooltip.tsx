
interface CoinMeta {
  id: string
  label: string
  color: string
}

interface CompareTooltipOwnProps {
  coinMeta: CoinMeta[]
  method: string
}

type CompareTooltipProps = CompareTooltipOwnProps & {
  active?: boolean
  payload?: Array<{ dataKey?: string; value?: number; payload?: Record<string, number> }>
  label?: number
}

export function CompareTooltip(props: CompareTooltipProps) {
  const { active, payload, label, coinMeta, method } = props
  if (!active || !payload?.length) return null

  const date = new Date(label as number)
  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="rounded-xl border border-border bg-surface-0 p-3.5 shadow-lg min-w-[200px]">
      <p className="text-[11px] text-muted-foreground mb-2.5 font-body">{formatted}</p>
      <div className="space-y-2">
        {payload.map((entry) => {
          const meta = coinMeta.find((c) => entry.dataKey === `norm_${c.id}`)
          if (!meta) return null
          const usdKey = `usd_${meta.id}`
          const usdValue = entry.payload?.[usdKey]
          const normValue = entry.value

          return (
            <div key={meta.id} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-xs font-display font-medium text-foreground">
                  {meta.label}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-display font-semibold text-foreground">
                  ${usdValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: usdValue < 10 ? 4 : 2 }) ?? '—'}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1.5">
                  {method === 'minmax' ? `${((normValue ?? 0) * 100).toFixed(0)}%` : `${(normValue ?? 0) >= 0 ? '+' : ''}${(normValue ?? 0).toFixed(2)}σ`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
