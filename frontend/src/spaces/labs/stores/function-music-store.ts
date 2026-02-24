import { create } from 'zustand'
import { evaluate } from 'mathjs'
import Papa from 'papaparse'

export interface DataPoint {
  x: number
  y: number
  freq?: number
  label?: string
}

export type ScaleType = 'pentatonic' | 'chromatic'
export type DataSource = 'function' | 'csv'

export interface FunctionPreset {
  id: string
  label: string
  expr: string
  latex: string
  description: string
}

export const FUNCTION_PRESETS: FunctionPreset[] = [
  {
    id: 'sine',
    label: 'Smooth Wave',
    expr: 'sin(x)',
    latex: 'f(x) = \\sin(x)',
    description: 'The sine function produces a smooth, periodic wave oscillating between -1 and 1. It is the fundamental building block of sound and signal processing, representing pure harmonic motion.',
  },
  {
    id: 'parabola',
    label: 'Parabola',
    expr: 'x^2',
    latex: 'f(x) = x^2',
    description: 'The parabola is a symmetric U-shaped curve that grows quadratically. It describes projectile trajectories, focusing mirrors, and appears throughout physics as the shape of potential energy wells.',
  },
  {
    id: 'interference',
    label: 'Interference',
    expr: 'sin(x) * cos(2*x)',
    latex: 'f(x) = \\sin(x) \\cdot \\cos(2x)',
    description: 'This product of sine and cosine at different frequencies creates an interference pattern — a complex waveform with beats and amplitude modulation, similar to how overlapping ripples interact in water.',
  },
  {
    id: 'bell',
    label: 'Bell Curve',
    expr: 'exp(-x^2)',
    latex: 'f(x) = e^{-x^2}',
    description: 'The Gaussian bell curve peaks at the center and tapers symmetrically to zero. It is the shape of the normal distribution and appears everywhere in statistics, heat diffusion, and quantum mechanics.',
  },
  {
    id: 'staircase',
    label: 'Staircase',
    expr: 'floor(sin(x) * 3) / 3',
    latex: 'f(x) = \\frac{\\lfloor 3\\sin(x) \\rfloor}{3}',
    description: 'A quantized sine wave that snaps to discrete steps, creating a staircase pattern. This is analogous to digital sampling — a continuous signal reduced to fixed levels, producing a characteristic "stepped" sound.',
  },
  {
    id: 'tangent',
    label: 'Wild Tangent',
    expr: 'tan(x)',
    latex: 'f(x) = \\tan(x)',
    description: 'The tangent function shoots to infinity at its asymptotes, creating dramatic spikes. When clamped and sonified, it produces sharp, aggressive sweeps — mathematical chaos tamed into sound.',
  },
  {
    id: 'bouncing',
    label: 'Bouncing',
    expr: 'abs(sin(x * 3))',
    latex: 'f(x) = |\\sin(3x)|',
    description: 'The absolute value of a faster sine wave creates a bouncing pattern that never goes negative. It resembles a ball bouncing on a surface — always positive, rhythmic, and energetic.',
  },
]

interface FunctionProperties {
  domain: [number, number]
  range: [number, number]
  isPeriodic: boolean
  isSymmetric: boolean
  isMonotonic: boolean
}

export interface CsvStats {
  min: number
  max: number
  mean: number
  stdDev: number
  trend: 'Rising' | 'Falling' | 'Mixed'
}

interface FunctionMusicState {
  functionExpr: string
  activePreset: FunctionPreset | null
  dataPoints: DataPoint[]
  xMin: number
  xMax: number
  resolution: number
  isPlotted: boolean

  dataSource: DataSource
  csvFileName: string | null
  csvAllHeaders: string[]
  csvColumnX: number
  csvColumnY: number
  csvRawRows: string[][]
  csvHeaders: [string, string] | null
  csvPreviewRows: string[][]
  csvStats: CsvStats | null

  isPlaying: boolean
  playheadIndex: number
  speed: number
  volume: number
  scale: ScaleType
  duration: number

  properties: FunctionProperties | null

  setFunctionExpr: (expr: string) => void
  setRange: (xMin: number, xMax: number) => void
  setResolution: (n: number) => void
  plot: () => void
  selectPreset: (preset: FunctionPreset) => void
  importCSV: (file: File) => void
  selectCsvColumns: (xCol: number, yCol: number) => void
  clearCSV: () => void
  setPlayheadIndex: (i: number) => void
  setIsPlaying: (playing: boolean) => void
  setSpeed: (speed: number) => void
  setVolume: (volume: number) => void
  setScale: (scale: ScaleType) => void
  stop: () => void
}

function detectProperties(points: DataPoint[], xMin: number, xMax: number): FunctionProperties {
  const ys = points.map((p) => p.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const midIdx = Math.floor(points.length / 2)
  let isSymmetric = true
  for (let i = 0; i < midIdx; i++) {
    const mirror = points.length - 1 - i
    if (Math.abs(points[i].y - points[mirror].y) > 0.01 * (maxY - minY + 1)) {
      isSymmetric = false
      break
    }
  }

  let isMonotonic = true
  let direction = 0
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].y - points[i - 1].y
    if (Math.abs(diff) < 1e-10) continue
    const sign = diff > 0 ? 1 : -1
    if (direction === 0) {
      direction = sign
    } else if (sign !== direction) {
      isMonotonic = false
      break
    }
  }

  const half = Math.floor(points.length / 2)
  let isPeriodic = false
  if (points.length > 20) {
    const firstHalf = points.slice(0, half)
    const secondHalf = points.slice(half, half * 2)
    let matchCount = 0
    for (let i = 0; i < firstHalf.length && i < secondHalf.length; i++) {
      if (Math.abs(firstHalf[i].y - secondHalf[i].y) < 0.05 * (maxY - minY + 1)) {
        matchCount++
      }
    }
    isPeriodic = matchCount / firstHalf.length > 0.85
  }

  return {
    domain: [xMin, xMax],
    range: [minY, maxY],
    isPeriodic,
    isSymmetric,
    isMonotonic,
  }
}

function computeCsvStats(points: DataPoint[]): CsvStats {
  const ys = points.map((p) => p.y)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const mean = ys.reduce((s, v) => s + v, 0) / ys.length
  const variance = ys.reduce((s, v) => s + (v - mean) ** 2, 0) / ys.length
  const stdDev = Math.sqrt(variance)

  const firstQuarter = ys.slice(0, Math.floor(ys.length / 4))
  const lastQuarter = ys.slice(Math.floor((3 * ys.length) / 4))
  const avgFirst = firstQuarter.reduce((s, v) => s + v, 0) / firstQuarter.length
  const avgLast = lastQuarter.reduce((s, v) => s + v, 0) / lastQuarter.length
  const diff = avgLast - avgFirst
  const threshold = stdDev * 0.25
  const trend: CsvStats['trend'] = diff > threshold ? 'Rising' : diff < -threshold ? 'Falling' : 'Mixed'

  return { min, max, mean, stdDev, trend }
}

function isDateString(val: string): boolean {
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(val)) return true
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(val)) return true
  const d = new Date(val)
  return !isNaN(d.getTime()) && val.length > 4
}

function buildCsvPoints(
  dataRows: string[][],
  xCol: number,
  yCol: number
): { points: DataPoint[]; previewRows: string[][] } {
  const previewRows = dataRows.slice(0, 5).map((r) => [r[xCol]?.trim() || '', r[yCol]?.trim() || ''])

  const firstXVal = dataRows[0]?.[xCol]?.trim() || ''
  const useDateLabels = isDateString(firstXVal)

  const points: DataPoint[] = []
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    if (!row || row.length <= Math.max(xCol, yCol)) continue
    const rawX = row[xCol]?.trim() || ''
    const yVal = parseFloat(row[yCol]?.trim() || '')
    if (isNaN(yVal)) continue

    let xVal: number
    let label: string | undefined
    if (useDateLabels) {
      xVal = i
      label = rawX
    } else {
      xVal = parseFloat(rawX)
      if (isNaN(xVal)) {
        xVal = i
        label = rawX
      }
    }

    points.push({ x: xVal, y: yVal, label })
  }

  return { points, previewRows }
}

export const useFunctionMusicStore = create<FunctionMusicState>((set, get) => ({
  functionExpr: 'sin(x)',
  activePreset: FUNCTION_PRESETS[0],
  dataPoints: [],
  xMin: -2 * Math.PI,
  xMax: 2 * Math.PI,
  resolution: 100,
  isPlotted: false,

  dataSource: 'function',
  csvFileName: null,
  csvAllHeaders: [],
  csvColumnX: 0,
  csvColumnY: 1,
  csvRawRows: [],
  csvHeaders: null,
  csvPreviewRows: [],
  csvStats: null,

  isPlaying: false,
  playheadIndex: -1,
  speed: 1,
  volume: 0.7,
  scale: 'pentatonic',
  duration: 4,

  properties: null,

  setFunctionExpr: (expr) =>
    set({
      functionExpr: expr,
      activePreset: null,
      dataSource: 'function',
      csvFileName: null,
      csvAllHeaders: [],
      csvColumnX: 0,
      csvColumnY: 1,
      csvRawRows: [],
      csvHeaders: null,
      csvPreviewRows: [],
      csvStats: null,
    }),

  setRange: (xMin, xMax) => set({ xMin, xMax }),

  setResolution: (n) => set({ resolution: Math.max(10, Math.min(500, n)) }),

  selectPreset: (preset) => {
    set({
      functionExpr: preset.expr,
      activePreset: preset,
      xMin: -2 * Math.PI,
      xMax: 2 * Math.PI,
      resolution: 100,
      dataSource: 'function',
      csvFileName: null,
      csvAllHeaders: [],
      csvColumnX: 0,
      csvColumnY: 1,
      csvRawRows: [],
      csvHeaders: null,
      csvPreviewRows: [],
      csvStats: null,
    })
    setTimeout(() => get().plot(), 0)
  },

  plot: () => {
    const { functionExpr, xMin, xMax, resolution } = get()
    const step = (xMax - xMin) / (resolution - 1)
    const points: DataPoint[] = []

    for (let i = 0; i < resolution; i++) {
      const x = xMin + i * step
      try {
        let y = evaluate(functionExpr, { x }) as number
        if (!isFinite(y) || isNaN(y)) {
          y = Math.max(-10, Math.min(10, points.length > 0 ? points[points.length - 1].y : 0))
        }
        y = Math.max(-10, Math.min(10, y))
        points.push({ x, y })
      } catch {
        points.push({ x, y: 0 })
      }
    }

    const properties = detectProperties(points, xMin, xMax)
    set({ dataPoints: points, isPlotted: true, properties, playheadIndex: -1, isPlaying: false })
  },

  importCSV: (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return

      const result = Papa.parse<string[]>(text, {
        skipEmptyLines: true,
        dynamicTyping: false,
      })

      const rows = result.data
      if (rows.length < 2) return

      let allHeaders: string[] = []
      let startRow = 0
      const firstRow = rows[0]
      const hasHeader = firstRow.some((cell) => {
        const trimmed = cell?.trim() || ''
        return trimmed !== '' && isNaN(Number(trimmed))
      })

      if (hasHeader) {
        allHeaders = firstRow.map((c) => c?.trim() || '')
        startRow = 1
      } else {
        allHeaders = firstRow.map((_, i) => `Column ${i + 1}`)
      }

      const dataRows = rows.slice(startRow)
      const xCol = 0
      const yCol = allHeaders.length > 1 ? 1 : 0

      const { points, previewRows } = buildCsvPoints(dataRows, xCol, yCol)
      if (points.length === 0) return

      const xMin = points[0].x
      const xMax = points[points.length - 1].x
      const properties = detectProperties(points, xMin, xMax)
      const csvStats = computeCsvStats(points)

      set({
        dataSource: 'csv',
        csvFileName: file.name,
        csvAllHeaders: allHeaders,
        csvColumnX: xCol,
        csvColumnY: yCol,
        csvRawRows: dataRows,
        csvHeaders: [allHeaders[xCol] || 'X', allHeaders[yCol] || 'Y'],
        csvPreviewRows: previewRows,
        csvStats,
        dataPoints: points,
        xMin,
        xMax,
        resolution: points.length,
        isPlotted: true,
        properties,
        playheadIndex: -1,
        isPlaying: false,
        activePreset: null,
        functionExpr: file.name,
      })
    }
    reader.readAsText(file)
  },

  selectCsvColumns: (xCol: number, yCol: number) => {
    const { csvRawRows, csvAllHeaders } = get()
    if (csvRawRows.length === 0) return

    const { points, previewRows } = buildCsvPoints(csvRawRows, xCol, yCol)
    if (points.length === 0) return

    const xMin = points[0].x
    const xMax = points[points.length - 1].x
    const properties = detectProperties(points, xMin, xMax)
    const csvStats = computeCsvStats(points)

    set({
      csvColumnX: xCol,
      csvColumnY: yCol,
      csvHeaders: [csvAllHeaders[xCol] || 'X', csvAllHeaders[yCol] || 'Y'],
      csvPreviewRows: previewRows,
      csvStats,
      dataPoints: points,
      xMin,
      xMax,
      resolution: points.length,
      isPlotted: true,
      properties,
      playheadIndex: -1,
      isPlaying: false,
    })
  },

  clearCSV: () =>
    set({
      dataSource: 'function',
      csvFileName: null,
      csvAllHeaders: [],
      csvColumnX: 0,
      csvColumnY: 1,
      csvRawRows: [],
      csvHeaders: null,
      csvPreviewRows: [],
      csvStats: null,
      functionExpr: 'sin(x)',
      activePreset: FUNCTION_PRESETS[0],
      isPlotted: false,
      dataPoints: [],
      xMin: -2 * Math.PI,
      xMax: 2 * Math.PI,
      resolution: 100,
      properties: null,
    }),

  setPlayheadIndex: (i) => set({ playheadIndex: i }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setSpeed: (speed) => set({ speed }),
  setVolume: (volume) => set({ volume }),
  setScale: (scale) => set({ scale }),

  stop: () => set({ isPlaying: false, playheadIndex: -1 }),
}))
