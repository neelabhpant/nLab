import * as Tone from 'tone'
import type { DataPoint, ScaleType } from '@/spaces/labs/stores/function-music-store'

const PENTATONIC_RATIOS = [1, 1.125, 1.25, 1.5, 1.6875]
const CHROMATIC_SEMITONE = Math.pow(2, 1 / 12)

const MIN_FREQ = 130.81
const MAX_FREQ = 1046.50

let synth: Tone.Synth | null = null
let reverb: Tone.Reverb | null = null
let scheduledEvents: number[] = []

function quantizeToScale(freq: number, scale: ScaleType): number {
  if (scale === 'chromatic') {
    const semitones = Math.round(12 * Math.log2(freq / MIN_FREQ))
    return MIN_FREQ * Math.pow(CHROMATIC_SEMITONE, semitones)
  }

  const octave = Math.floor(Math.log2(freq / MIN_FREQ))
  const baseFreq = MIN_FREQ * Math.pow(2, octave)
  const ratio = freq / baseFreq

  let closest = PENTATONIC_RATIOS[0]
  let minDist = Math.abs(ratio - closest)
  for (const r of PENTATONIC_RATIOS) {
    const dist = Math.abs(ratio - r)
    if (dist < minDist) {
      minDist = dist
      closest = r
    }
  }

  const nextOctaveFirst = 2
  const distToNextOctave = Math.abs(ratio - nextOctaveFirst)
  if (distToNextOctave < minDist) {
    return baseFreq * 2
  }

  return baseFreq * closest
}

function mapToFrequency(y: number, minY: number, maxY: number): number {
  const range = maxY - minY
  if (range === 0) return (MIN_FREQ + MAX_FREQ) / 2
  const normalized = (y - minY) / range
  return MIN_FREQ + normalized * (MAX_FREQ - MIN_FREQ)
}

export async function initAudio(): Promise<void> {
  await Tone.start()
}

export async function playSonification(
  points: DataPoint[],
  options: {
    speed: number
    volume: number
    scale: ScaleType
    duration: number
    onPlayheadUpdate: (index: number) => void
    onComplete: () => void
  }
): Promise<void> {
  await Tone.start()
  stopSonification()

  const ys = points.map((p) => p.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const totalDuration = options.duration / options.speed
  const noteSpacing = totalDuration / points.length

  if (!reverb) {
    reverb = new Tone.Reverb({ decay: 1.5, wet: 0.3 }).toDestination()
  }

  synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.05, release: 0.15 },
    volume: Tone.gainToDb(options.volume),
  }).connect(reverb)

  const now = Tone.now()

  for (let i = 0; i < points.length; i++) {
    const rawFreq = mapToFrequency(points[i].y, minY, maxY)
    const freq = quantizeToScale(rawFreq, options.scale)
    const time = now + i * noteSpacing

    const eventId = Tone.getTransport().schedule(() => {
      if (synth) {
        synth.triggerAttackRelease(freq, Math.max(0.05, noteSpacing * 0.8), time)
      }
      options.onPlayheadUpdate(i)
    }, time - now)
    scheduledEvents.push(eventId)

    points[i].freq = freq
  }

  const endId = Tone.getTransport().schedule(() => {
    options.onComplete()
  }, totalDuration + 0.1)
  scheduledEvents.push(endId)

  Tone.getTransport().start()
}

export function stopSonification(): void {
  Tone.getTransport().stop()
  Tone.getTransport().cancel()
  scheduledEvents = []

  if (synth) {
    synth.dispose()
    synth = null
  }
}

export function setVolume(vol: number): void {
  if (synth) {
    synth.volume.value = Tone.gainToDb(vol)
  }
}
