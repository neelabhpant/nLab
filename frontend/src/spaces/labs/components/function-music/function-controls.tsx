import { useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Square, Volume2, Gauge, Music, Upload, X, FileSpreadsheet, Columns3 } from 'lucide-react'
import { useFunctionMusicStore, FUNCTION_PRESETS } from '@/spaces/labs/stores/function-music-store'
import { playSonification, stopSonification, setVolume as setSynthVolume } from '@/spaces/labs/lib/sound-engine'

export function FunctionControls() {
  const store = useFunctionMusicStore()
  const [inputExpr, setInputExpr] = useState(store.functionExpr)
  const [localXMin, setLocalXMin] = useState(String(store.xMin.toFixed(2)))
  const [localXMax, setLocalXMax] = useState(String(store.xMax.toFixed(2)))
  const [localRes, setLocalRes] = useState(String(store.resolution))
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePlot = useCallback(() => {
    const xMin = parseFloat(localXMin)
    const xMax = parseFloat(localXMax)
    const res = parseInt(localRes, 10)
    if (!isNaN(xMin) && !isNaN(xMax) && !isNaN(res) && xMin < xMax) {
      store.setFunctionExpr(inputExpr)
      store.setRange(xMin, xMax)
      store.setResolution(res)
      setTimeout(() => store.plot(), 0)
    }
  }, [inputExpr, localXMin, localXMax, localRes, store])

  const handlePreset = useCallback(
    (preset: (typeof FUNCTION_PRESETS)[0]) => {
      setInputExpr(preset.expr)
      setLocalXMin((-2 * Math.PI).toFixed(2))
      setLocalXMax((2 * Math.PI).toFixed(2))
      setLocalRes('100')
      store.selectPreset(preset)
    },
    [store]
  )

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.csv')) return
      store.importCSV(file)
    },
    [store]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handleClearCSV = useCallback(() => {
    store.clearCSV()
    setInputExpr('sin(x)')
    setLocalXMin((-2 * Math.PI).toFixed(2))
    setLocalXMax((2 * Math.PI).toFixed(2))
    setLocalRes('100')
    setTimeout(() => store.plot(), 0)
  }, [store])

  const handlePlay = useCallback(async () => {
    if (store.isPlaying) {
      stopSonification()
      store.stop()
      return
    }

    store.setIsPlaying(true)
    store.setPlayheadIndex(0)

    await playSonification(store.dataPoints, {
      speed: store.speed,
      volume: store.volume,
      scale: store.scale,
      duration: store.duration,
      onPlayheadUpdate: (index) => store.setPlayheadIndex(index),
      onComplete: () => store.stop(),
    })
  }, [store])

  const handleStop = useCallback(() => {
    stopSonification()
    store.stop()
  }, [store])

  const handleVolumeChange = useCallback(
    (val: number) => {
      store.setVolume(val)
      setSynthVolume(val)
    },
    [store]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="space-y-4"
    >
      <div className="rounded-xl bg-surface-0 border border-border p-4">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-display font-bold text-[#BD6BFF]">
              f(x) =
            </span>
            <input
              type="text"
              value={inputExpr}
              onChange={(e) => setInputExpr(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePlot()}
              className="w-full pl-16 pr-3 py-2.5 rounded-lg bg-surface-1 border border-border text-sm font-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#BD6BFF]/40 focus:border-[#BD6BFF]/50 transition-all"
              placeholder="sin(x)"
            />
          </div>
          <button
            onClick={handlePlot}
            className="px-5 py-2.5 rounded-lg text-sm font-display font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97] cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #BD6BFF, #8B5CF6)' }}
          >
            Plot
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 font-display font-medium text-slate-600">
            X min
            <input
              type="text"
              value={localXMin}
              onChange={(e) => setLocalXMin(e.target.value)}
              className="w-16 px-2 py-1.5 rounded-md bg-surface-1 border border-border text-slate-900 text-center font-body focus:outline-none focus:ring-1 focus:ring-[#BD6BFF]/40"
            />
          </label>
          <label className="flex items-center gap-1.5 font-display font-medium text-slate-600">
            X max
            <input
              type="text"
              value={localXMax}
              onChange={(e) => setLocalXMax(e.target.value)}
              className="w-16 px-2 py-1.5 rounded-md bg-surface-1 border border-border text-slate-900 text-center font-body focus:outline-none focus:ring-1 focus:ring-[#BD6BFF]/40"
            />
          </label>
          <label className="flex items-center gap-1.5 font-display font-medium text-slate-600">
            Points
            <input
              type="text"
              value={localRes}
              onChange={(e) => setLocalRes(e.target.value)}
              className="w-14 px-2 py-1.5 rounded-md bg-surface-1 border border-border text-slate-900 text-center font-body focus:outline-none focus:ring-1 focus:ring-[#BD6BFF]/40"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl bg-surface-0 border border-border p-4">
        <p className="text-[11px] font-display font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          Presets
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FUNCTION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-medium transition-all cursor-pointer ${
                store.activePreset?.id === preset.id
                  ? 'bg-[#BD6BFF]/15 text-[#BD6BFF] ring-1 ring-[#BD6BFF]/30'
                  : 'bg-surface-1 text-slate-600 hover:text-slate-900 hover:bg-surface-2'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-surface-0 border border-border p-4">
        <p className="text-[11px] font-display font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          Or import data
        </p>
        {store.csvFileName ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#BD6BFF]/8 border border-[#BD6BFF]/20">
              <FileSpreadsheet className="w-4 h-4 text-[#BD6BFF] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-semibold text-slate-900 truncate">
                  {store.csvFileName}
                </p>
                <p className="text-[11px] font-body text-slate-500">
                  {store.dataPoints.length} points · {store.csvAllHeaders.length} columns
                </p>
              </div>
              <button
                onClick={handleClearCSV}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {store.csvAllHeaders.length > 2 && (
              <div className="px-3 py-3 rounded-lg bg-surface-1 border border-border">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Columns3 className="w-3.5 h-3.5 text-[#BD6BFF]" />
                  <p className="text-[11px] font-display font-semibold text-slate-500 uppercase tracking-wider">
                    Column Mapping
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex-1">
                    <span className="block text-[10px] font-display font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      X Axis
                    </span>
                    <select
                      value={store.csvColumnX}
                      onChange={(e) => store.selectCsvColumns(parseInt(e.target.value, 10), store.csvColumnY)}
                      className="w-full px-2.5 py-1.5 rounded-md bg-surface-0 border border-border text-xs font-display font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#BD6BFF]/40 cursor-pointer"
                    >
                      {store.csvAllHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex-1">
                    <span className="block text-[10px] font-display font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      Y Axis
                    </span>
                    <select
                      value={store.csvColumnY}
                      onChange={(e) => store.selectCsvColumns(store.csvColumnX, parseInt(e.target.value, 10))}
                      className="w-full px-2.5 py-1.5 rounded-md bg-surface-0 border border-border text-xs font-display font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#BD6BFF]/40 cursor-pointer"
                    >
                      {store.csvAllHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
              dragOver
                ? 'border-[#BD6BFF] bg-[#BD6BFF]/5'
                : 'border-border hover:border-slate-400 hover:bg-surface-1'
            }`}
          >
            <Upload className={`w-4 h-4 ${dragOver ? 'text-[#BD6BFF]' : 'text-slate-400'}`} />
            <span className={`text-xs font-display font-medium ${dragOver ? 'text-[#BD6BFF]' : 'text-slate-500'}`}>
              Drop CSV or click to browse
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
                e.target.value = ''
              }}
            />
          </div>
        )}
      </div>

      {store.isPlotted && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border p-4"
          style={{ background: 'linear-gradient(135deg, #1a1b2e 0%, #13141f 100%)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handlePlay}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #BD6BFF, #8B5CF6)' }}
            >
              {store.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              onClick={handleStop}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-white/60 hover:bg-white/15 hover:text-white transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
            </button>

            {store.isPlaying && store.playheadIndex >= 0 && (
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #BD6BFF, #00D4FF)',
                    width: `${((store.playheadIndex + 1) / store.dataPoints.length) * 100}%`,
                  }}
                  transition={{ duration: 0.05 }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-5 text-xs">
            <label className="flex items-center gap-2 text-white/50 font-display">
              <Gauge className="w-3.5 h-3.5" />
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={store.speed}
                onChange={(e) => store.setSpeed(parseFloat(e.target.value))}
                className="w-20 accent-[#BD6BFF]"
              />
              <span className="text-white/70 font-medium w-8">{store.speed.toFixed(1)}x</span>
            </label>

            <label className="flex items-center gap-2 text-white/50 font-display">
              <Volume2 className="w-3.5 h-3.5" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={store.volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 accent-[#BD6BFF]"
              />
            </label>

            <label className="flex items-center gap-2 text-white/50 font-display">
              <Music className="w-3.5 h-3.5" />
              <select
                value={store.scale}
                onChange={(e) => store.setScale(e.target.value as 'pentatonic' | 'chromatic')}
                className="bg-white/10 text-white/70 rounded-md px-2 py-1 text-xs font-display border-none focus:outline-none cursor-pointer"
              >
                <option value="pentatonic">Pentatonic</option>
                <option value="chromatic">Chromatic</option>
              </select>
            </label>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
