import { useEffect, useRef } from 'react'
import { usePendulumStore } from '@/spaces/labs/stores/pendulum-store'
import {
  divergence,
  rk4Step,
  toCartesian,
  totalEnergy,
  wrapAngle,
  type PendulumState,
} from '@/spaces/labs/lib/pendulum-engine'

const FIXED_DT = 1 / 240 // physics substep (s) — small + RK4 = stable, real energy
const MAX_FRAME = 0.05 // clamp frame delta (s) to avoid the spiral of death
const READOUT_HZ = 12 // how often analytics are pushed to the store (not per frame)

const PRIMARY = '#F5A623'
const PRIMARY_2 = '#FF8C42'
const PHASE = '#00D4FF'

/** Plain-words description of the lower arm's state, for the phase-space caption. */
function phaseCaption(th2: number, w2: number): string {
  const a = wrapAngle(th2) // 0 = straight down, +/-pi = straight up
  const tilt =
    Math.abs(a) < 0.4
      ? 'hanging down'
      : Math.abs(a) > 2.7
        ? 'pointing up'
        : a > 0
          ? 'leaning right'
          : 'leaning left'
  const sp = Math.abs(w2)
  const speed = sp < 0.3 ? 'barely moving' : sp < 3 ? 'drifting' : sp < 8 ? 'spinning fast' : 'whipping around'
  return `${tilt} · ${speed}`
}

/**
 * The double-pendulum stage: owns the requestAnimationFrame loop and the live
 * per-frame state (kept in refs, never the store, so 60fps drawing never
 * triggers React re-renders). Only low-rate analytics are pushed to the store.
 */
export function PendulumCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Live simulation state — index 0 is the primary; index 1 is the reference
  // twin used for the divergence metric (always present, even in single mode).
  const statesRef = useRef<PendulumState[]>([])
  const trailRef = useRef<{ x: number; y: number }[]>([])
  const phaseTrailRef = useRef<{ x: number; y: number }[]>([]) // (wrapped th2, w2) of primary
  const phaseMaxWRef = useRef(2) // smoothed |w2| extent for the inset's y-scale
  const seenRevisionRef = useRef(-1)
  const accumulatorRef = useRef(0)
  const simTimeRef = useRef(0)
  const lastReadoutRef = useRef(0)
  const lastFrameRef = useRef(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  const draggingRef = useRef<0 | 1 | 2>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = () => window.devicePixelRatio || 1

    function resize() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      sizeRef.current = { w: rect.width, h: rect.height }
      canvas.width = Math.round(rect.width * dpr())
      canvas.height = Math.round(rect.height * dpr())
      ctx!.setTransform(dpr(), 0, 0, dpr(), 0, 0) // draw in CSS pixels
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function seed() {
      const { initial, mode, swarmCount, epsilon } = usePendulumStore.getState()
      const count = mode === 'swarm' ? swarmCount : 2 // always >=2 for divergence
      const arr: PendulumState[] = []
      for (let i = 0; i < count; i++) {
        arr.push({ th1: initial.th1 + i * epsilon, th2: initial.th2, w1: 0, w2: 0 })
      }
      statesRef.current = arr
      trailRef.current = []
      phaseTrailRef.current = []
      accumulatorRef.current = 0
      simTimeRef.current = 0
      lastReadoutRef.current = 0
    }

    function geometry() {
      const { w, h } = sizeRef.current
      const { L1, L2 } = usePendulumStore.getState().params
      const pivotX = w / 2
      const pivotY = h * 0.44 // near-centre so the arm has room to swing overhead
      // Fit the full reachable circle (radius L1+L2) with a margin, so nothing
      // ever clips no matter how chaotically it swings.
      const reach = Math.min(w * 0.46, h * 0.42)
      const scale = reach / (L1 + L2)
      return { pivotX, pivotY, scale }
    }

    // The synchronised phase-space inset: a live "map of the motion" (tilt vs
    // spin) tethered to the real lower bob, so the abstract plot is felt, not
    // just read. Drawn in the same loop as the pendulum → perfectly in sync.
    function drawPhaseInset(headBobX: number, headBobY: number) {
      const states = statesRef.current
      if (states.length === 0) return
      const { w, h } = sizeRef.current
      const size = Math.max(150, Math.min(Math.min(w, h) * 0.34, 230))
      const x0 = w - size - 14
      const y0 = 14
      const padTop = 30
      const pad = 12
      const plotX = x0 + pad
      const plotY = y0 + padTop
      const plotW = size - pad * 2
      const plotH = size - padTop - pad
      const cx = plotX + plotW / 2
      const cy = plotY + plotH / 2

      // panel
      ctx!.fillStyle = 'rgba(10,11,18,0.55)'
      ctx!.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.roundRect(x0, y0, size, size, 14)
      ctx!.fill()
      ctx!.stroke()

      // title + axis hints
      ctx!.fillStyle = 'rgba(255,255,255,0.55)'
      ctx!.font = "600 10px 'Space Grotesk', sans-serif"
      ctx!.textBaseline = 'alphabetic'
      ctx!.fillText('PHASE SPACE', x0 + pad, y0 + 18)
      ctx!.fillStyle = 'rgba(255,255,255,0.30)'
      ctx!.font = "10px 'Outfit', sans-serif"
      ctx!.fillText('tilt →', cx + plotW / 2 - 30, plotY + plotH + 9)
      ctx!.save()
      ctx!.translate(plotX - 3, cy + 14)
      ctx!.rotate(-Math.PI / 2)
      ctx!.fillText('spin →', 0, 0)
      ctx!.restore()

      // axes
      ctx!.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx!.beginPath()
      ctx!.moveTo(plotX, cy)
      ctx!.lineTo(plotX + plotW, cy)
      ctx!.moveTo(cx, plotY)
      ctx!.lineTo(cx, plotY + plotH)
      ctx!.stroke()

      // smooth the vertical (spin) scale toward the trail's peak
      const trail = phaseTrailRef.current
      let mw = 2
      for (const p of trail) mw = Math.max(mw, Math.abs(p.y))
      phaseMaxWRef.current += (mw - phaseMaxWRef.current) * 0.1
      const maxW = phaseMaxWRef.current

      const toX = (a: number) => cx + (a / Math.PI) * (plotW / 2)
      const toY = (wv: number) => cy - (wv / maxW) * (plotH / 2 - 4)

      // trajectory (fading), skipping the wrap seam
      for (let i = 1; i < trail.length; i++) {
        const prev = trail[i - 1]
        const cur = trail[i]
        if (Math.abs(cur.x - prev.x) > Math.PI) continue
        const alpha = (i / trail.length) * 0.7 + 0.05
        ctx!.strokeStyle = `rgba(0,212,255,${alpha.toFixed(3)})`
        ctx!.lineWidth = 1.4
        ctx!.beginPath()
        ctx!.moveTo(toX(prev.x), toY(prev.y))
        ctx!.lineTo(toX(cur.x), toY(cur.y))
        ctx!.stroke()
      }

      // live head dot
      const hx = toX(wrapAngle(states[0].th2))
      const hy = toY(states[0].w2)

      // tether from the real lower bob to the dot — the literal "this ↔ this" link
      ctx!.strokeStyle = 'rgba(0,212,255,0.16)'
      ctx!.lineWidth = 1
      ctx!.setLineDash([3, 4])
      ctx!.beginPath()
      ctx!.moveTo(headBobX, headBobY)
      ctx!.lineTo(hx, hy)
      ctx!.stroke()
      ctx!.setLineDash([])

      ctx!.fillStyle = PHASE
      ctx!.shadowBlur = 10
      ctx!.shadowColor = PHASE
      ctx!.beginPath()
      ctx!.arc(hx, hy, 3.5, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.shadowBlur = 0

      // live caption
      ctx!.fillStyle = 'rgba(255,255,255,0.7)'
      ctx!.font = "500 11px 'Outfit', sans-serif"
      const cap = phaseCaption(states[0].th2, states[0].w2)
      ctx!.fillText(cap, x0 + pad, y0 + size - 9)
    }

    function draw() {
      const st = usePendulumStore.getState()
      const { w, h } = sizeRef.current
      const { pivotX, pivotY, scale } = geometry()
      ctx!.clearRect(0, 0, w, h)

      const states = statesRef.current
      if (states.length === 0) return

      // --- Faint reach guides (instrument feel): inner = L1, outer = L1+L2 ---
      const mParams = st.params
      ctx!.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.arc(pivotX, pivotY, scale * mParams.L1, 0, Math.PI * 2)
      ctx!.stroke()
      ctx!.beginPath()
      ctx!.arc(pivotX, pivotY, scale * (mParams.L1 + mParams.L2), 0, Math.PI * 2)
      ctx!.stroke()

      // --- Trail of the primary lower bob (recorded only while running) ---
      const primary = toCartesian(states[0], st.params, pivotX, pivotY, scale)
      if (st.trailOn && st.isRunning && st.trailLength > 0) {
        const trail = trailRef.current
        trail.push({ x: primary.x2, y: primary.y2 })
        if (trail.length > st.trailLength) trail.splice(0, trail.length - st.trailLength)
      }
      // Phase-space trail of the primary (wrapped tilt vs spin), recorded live.
      if (st.isRunning) {
        const pt = phaseTrailRef.current
        pt.push({ x: wrapAngle(states[0].th2), y: states[0].w2 })
        if (pt.length > 420) pt.splice(0, pt.length - 420)
      }
      const trail = trailRef.current
      if (st.trailOn && trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const a = (i / trail.length) * 0.55
          ctx!.strokeStyle = `rgba(245,166,35,${a.toFixed(3)})`
          ctx!.lineWidth = 2
          ctx!.beginPath()
          ctx!.moveTo(trail[i - 1].x, trail[i - 1].y)
          ctx!.lineTo(trail[i].x, trail[i].y)
          ctx!.stroke()
        }
      }

      // --- Swarm cloud (faded), only in swarm mode and skipping the primary ---
      if (st.mode === 'swarm') {
        ctx!.lineWidth = 1.5
        for (let i = 1; i < states.length; i++) {
          const pos = toCartesian(states[i], st.params, pivotX, pivotY, scale)
          ctx!.strokeStyle = 'rgba(0,212,255,0.20)'
          ctx!.beginPath()
          ctx!.moveTo(pivotX, pivotY)
          ctx!.lineTo(pos.x1, pos.y1)
          ctx!.lineTo(pos.x2, pos.y2)
          ctx!.stroke()
          ctx!.fillStyle = 'rgba(0,212,255,0.28)'
          ctx!.beginPath()
          ctx!.arc(pos.x2, pos.y2, 3, 0, Math.PI * 2)
          ctx!.fill()
        }
      }

      // --- Primary pendulum (bright, glowing) ---
      ctx!.lineCap = 'round'
      ctx!.strokeStyle = 'rgba(245,166,35,0.85)'
      ctx!.lineWidth = 3
      ctx!.beginPath()
      ctx!.moveTo(pivotX, pivotY)
      ctx!.lineTo(primary.x1, primary.y1)
      ctx!.lineTo(primary.x2, primary.y2)
      ctx!.stroke()

      // pivot
      ctx!.fillStyle = '#8a8f9c'
      ctx!.beginPath()
      ctx!.arc(pivotX, pivotY, 4, 0, Math.PI * 2)
      ctx!.fill()

      const bob = (x: number, y: number, r: number, color: string) => {
        ctx!.shadowBlur = 22
        ctx!.shadowColor = color
        ctx!.fillStyle = color
        ctx!.beginPath()
        ctx!.arc(x, y, r, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.shadowBlur = 0
      }
      const m = usePendulumStore.getState().params
      bob(primary.x1, primary.y1, 6 + m.m1 * 2, PRIMARY)
      bob(primary.x2, primary.y2, 6 + m.m2 * 2, PRIMARY_2)

      // Drag affordance when paused — both bobs are grabbable.
      if (!st.isRunning) {
        ctx!.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx!.lineWidth = 1.5
        ctx!.beginPath()
        ctx!.arc(primary.x1, primary.y1, 14, 0, Math.PI * 2)
        ctx!.stroke()
        ctx!.beginPath()
        ctx!.arc(primary.x2, primary.y2, 14, 0, Math.PI * 2)
        ctx!.stroke()
      }

      // Synchronised phase-space inset, tethered to the lower bob.
      drawPhaseInset(primary.x2, primary.y2)
    }

    const rafRef = { current: 0 }

    function loop(now: number) {
      const st = usePendulumStore.getState()
      if (st.revision !== seenRevisionRef.current) {
        seenRevisionRef.current = st.revision
        seed()
      }

      if (lastFrameRef.current === 0) lastFrameRef.current = now
      const dtReal = Math.min((now - lastFrameRef.current) / 1000, MAX_FRAME)
      lastFrameRef.current = now

      if (st.isRunning && statesRef.current.length > 0) {
        accumulatorRef.current += dtReal * st.speed
        let steps = 0
        while (accumulatorRef.current >= FIXED_DT && steps < 800) {
          const states = statesRef.current
          for (let i = 0; i < states.length; i++) {
            states[i] = rk4Step(states[i], st.params, FIXED_DT)
          }
          accumulatorRef.current -= FIXED_DT
          simTimeRef.current += FIXED_DT
          steps++
        }

        if (simTimeRef.current - lastReadoutRef.current >= 1 / READOUT_HZ) {
          lastReadoutRef.current = simTimeRef.current
          const states = statesRef.current
          const e = totalEnergy(states[0], st.params)
          const d = divergence(states[0], states[1])
          st.pushReadout(e, d, { t: simTimeRef.current, d })
        }
      }

      draw()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    // --- Pointer drag: grab a bob to set the starting pose ---
    function pointerToCss(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      return { mx: e.clientX - rect.left, my: e.clientY - rect.top }
    }

    function onDown(e: PointerEvent) {
      const st = usePendulumStore.getState()
      if (statesRef.current.length === 0) return
      const { pivotX, pivotY, scale } = geometry()
      const pos = toCartesian(statesRef.current[0], st.params, pivotX, pivotY, scale)
      const { mx, my } = pointerToCss(e)
      if (Math.hypot(mx - pos.x2, my - pos.y2) <= 20) draggingRef.current = 2
      else if (Math.hypot(mx - pos.x1, my - pos.y1) <= 20) draggingRef.current = 1
      else return
      usePendulumStore.getState().pause()
      canvas!.setPointerCapture(e.pointerId)
    }

    function onMove(e: PointerEvent) {
      if (draggingRef.current === 0) return
      const st = usePendulumStore.getState()
      const { pivotX, pivotY, scale } = geometry()
      const { mx, my } = pointerToCss(e)
      if (draggingRef.current === 1) {
        const th1 = Math.atan2(mx - pivotX, my - pivotY)
        st.setInitial(th1, st.initial.th2)
      } else {
        const x1 = pivotX + scale * st.params.L1 * Math.sin(st.initial.th1)
        const y1 = pivotY + scale * st.params.L1 * Math.cos(st.initial.th1)
        const th2 = Math.atan2(mx - x1, my - y1)
        st.setInitial(st.initial.th1, th2)
      }
    }

    function onUp() {
      draggingRef.current = 0
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const isRunning = usePendulumStore((s) => s.isRunning)

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block touch-none"
      style={{ cursor: isRunning ? 'default' : 'grab' }}
    />
  )
}
