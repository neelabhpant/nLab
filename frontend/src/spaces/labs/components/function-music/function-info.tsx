import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useFunctionMusicStore, FUNCTION_PRESETS } from '@/spaces/labs/stores/function-music-store'

function KaTeXBlock({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      katex.render(latex, ref.current, {
        throwOnError: false,
        displayMode: true,
      })
    }
  }, [latex])

  return <div ref={ref} className="py-3" />
}

function FunctionModeInfo() {
  const { functionExpr, activePreset, properties, isPlotted, dataPoints, scale, speed, duration } =
    useFunctionMusicStore()

  const preset = activePreset || FUNCTION_PRESETS.find((p) => p.expr === functionExpr)
  const latex = preset?.latex || `f(x) = ${functionExpr}`
  const name = preset?.label || 'Custom Function'
  const description =
    preset?.description ||
    'A custom mathematical expression. Plot it and listen to what it sounds like!'

  return (
    <>
      <div className="rounded-xl bg-surface-0 border border-border p-5">
        <p className="text-[11px] font-display font-semibold text-[#BD6BFF] uppercase tracking-wider mb-1">
          Function
        </p>
        <h3 className="text-lg font-display font-bold text-slate-900 tracking-tight mb-2">
          {name}
        </h3>
        <div
          className="rounded-lg p-3 mb-4"
          style={{ background: 'linear-gradient(135deg, #13141f, #1a1b2e)' }}
        >
          <KaTeXBlock latex={latex} />
        </div>
        <p className="text-sm font-body text-slate-600 leading-relaxed">{description}</p>
      </div>

      {isPlotted && properties && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-surface-0 border border-border p-5"
        >
          <p className="text-[11px] font-display font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Properties
          </p>
          <div className="grid grid-cols-2 gap-3">
            <PropertyItem
              label="Domain"
              value={`[${properties.domain[0].toFixed(2)}, ${properties.domain[1].toFixed(2)}]`}
            />
            <PropertyItem
              label="Range"
              value={`[${properties.range[0].toFixed(2)}, ${properties.range[1].toFixed(2)}]`}
            />
            <PropertyItem label="Periodic" value={properties.isPeriodic ? 'Yes' : 'No'} />
            <PropertyItem label="Symmetric" value={properties.isSymmetric ? 'Yes' : 'No'} />
            <PropertyItem label="Monotonic" value={properties.isMonotonic ? 'Yes' : 'No'} />
            <PropertyItem label="Points" value={String(dataPoints.length)} />
          </div>
        </motion.div>
      )}

      {isPlotted && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-surface-0 border border-border p-5"
        >
          <p className="text-[11px] font-display font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Sound Properties
          </p>
          <div className="grid grid-cols-2 gap-3">
            <PropertyItem label="Scale" value={scale === 'pentatonic' ? 'Pentatonic' : 'Chromatic'} />
            <PropertyItem label="Duration" value={`${(duration / speed).toFixed(1)}s`} />
            <PropertyItem label="Notes" value={String(dataPoints.length)} />
            <PropertyItem label="Pitch Range" value="C3 — C6" />
          </div>
        </motion.div>
      )}
    </>
  )
}

function CsvModeInfo() {
  const { csvFileName, csvHeaders, csvAllHeaders, csvPreviewRows, csvStats, dataPoints, scale, speed, duration, isPlotted } =
    useFunctionMusicStore()

  return (
    <>
      <div className="rounded-xl bg-surface-0 border border-border p-5">
        <p className="text-[11px] font-display font-semibold text-[#BD6BFF] uppercase tracking-wider mb-1">
          Imported Data
        </p>
        <h3 className="text-lg font-display font-bold text-slate-900 tracking-tight mb-1">
          {csvFileName}
        </h3>
        <p className="text-xs font-body text-slate-500 mb-1">
          {dataPoints.length} rows · {csvAllHeaders.length} columns
        </p>
        {csvHeaders && (
          <p className="text-xs font-display font-medium text-[#BD6BFF] mb-3">
            {csvHeaders[0]} → {csvHeaders[1]}
          </p>
        )}

        {csvPreviewRows.length > 0 && (
          <div className="rounded-lg overflow-hidden border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-1">
                  <th className="px-3 py-1.5 text-left font-display font-semibold text-slate-500">
                    {csvHeaders?.[0] || 'X'}
                  </th>
                  <th className="px-3 py-1.5 text-right font-display font-semibold text-slate-500">
                    {csvHeaders?.[1] || 'Y'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {csvPreviewRows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5 font-body text-slate-700">{row[0]}</td>
                    <td className="px-3 py-1.5 font-body text-slate-900 text-right font-medium">{row[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dataPoints.length > 5 && (
              <div className="px-3 py-1 bg-surface-1 text-[10px] font-body text-slate-400 text-center">
                +{dataPoints.length - 5} more rows
              </div>
            )}
          </div>
        )}
      </div>

      {csvStats && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-surface-0 border border-border p-5"
        >
          <p className="text-[11px] font-display font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Data Properties
          </p>
          <div className="grid grid-cols-2 gap-3">
            <PropertyItem label="Min" value={csvStats.min.toFixed(2)} />
            <PropertyItem label="Max" value={csvStats.max.toFixed(2)} />
            <PropertyItem label="Mean" value={csvStats.mean.toFixed(2)} />
            <PropertyItem label="Std Dev" value={csvStats.stdDev.toFixed(2)} />
            <PropertyItem label="Trend" value={csvStats.trend} />
            <PropertyItem label="Points" value={String(dataPoints.length)} />
          </div>
        </motion.div>
      )}

      {isPlotted && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-surface-0 border border-border p-5"
        >
          <p className="text-[11px] font-display font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Sound Properties
          </p>
          <div className="grid grid-cols-2 gap-3">
            <PropertyItem label="Scale" value={scale === 'pentatonic' ? 'Pentatonic' : 'Chromatic'} />
            <PropertyItem label="Duration" value={`${(duration / speed).toFixed(1)}s`} />
            <PropertyItem label="Notes" value={String(dataPoints.length)} />
            <PropertyItem label="Pitch Range" value="C3 — C6" />
          </div>
        </motion.div>
      )}
    </>
  )
}

export function FunctionInfo() {
  const { dataSource } = useFunctionMusicStore()

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="space-y-4"
    >
      {dataSource === 'csv' ? <CsvModeInfo /> : <FunctionModeInfo />}
    </motion.div>
  )
}

function PropertyItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-display font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-display font-bold text-slate-800">{value}</p>
    </div>
  )
}
