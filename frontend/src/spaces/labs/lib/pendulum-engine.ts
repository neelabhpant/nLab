/**
 * Double pendulum physics engine — pure, framework-free, and unit-testable.
 *
 * A double pendulum is fully deterministic: it obeys two coupled nonlinear
 * equations of motion derived from Lagrangian mechanics. It is also the
 * textbook example of *deterministic chaos* — sensitive dependence on initial
 * conditions, where a hair's-breadth change in the start diverges exponentially.
 *
 * Model: two point masses on massless rigid rods (the canonical double
 * pendulum). Angles are measured from the downward vertical, so theta = 0 is
 * the stable hanging-at-rest pose. Integration is RK4 (4th-order Runge-Kutta)
 * for energy stability — forward Euler drifts badly and injects fake energy.
 */

export interface PendulumParams {
  m1: number // bob 1 mass (kg)
  m2: number // bob 2 mass (kg)
  L1: number // rod 1 length (m)
  L2: number // rod 2 length (m)
  g: number // gravity (m/s^2)
  damping: number // viscous damping coefficient (1/s); 0 = frictionless
}

export interface PendulumState {
  th1: number // angle of rod 1 from downward vertical (rad)
  th2: number // angle of rod 2 from downward vertical (rad)
  w1: number // angular velocity of rod 1 (rad/s)
  w2: number // angular velocity of rod 2 (rad/s)
}

export interface EnergyReadout {
  ke: number
  pe: number
  total: number
}

/**
 * Time derivatives of the state — the equations of motion. Returns d/dt of
 * (th1, th2, w1, w2). The angular accelerations are the standard closed form;
 * an optional viscous damping term (-c*w) dissipates energy when enabled.
 */
export function derivatives(s: PendulumState, p: PendulumParams): PendulumState {
  const { th1, th2, w1, w2 } = s
  const { m1, m2, L1, L2, g, damping } = p

  const delta = th1 - th2
  const sinDelta = Math.sin(delta)
  const cosDelta = Math.cos(delta)
  const den = 2 * m1 + m2 - m2 * Math.cos(2 * th1 - 2 * th2)

  const a1 =
    (-g * (2 * m1 + m2) * Math.sin(th1) -
      m2 * g * Math.sin(th1 - 2 * th2) -
      2 * sinDelta * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * cosDelta)) /
      (L1 * den) -
    damping * w1

  const a2 =
    (2 *
      sinDelta *
      (w1 * w1 * L1 * (m1 + m2) +
        g * (m1 + m2) * Math.cos(th1) +
        w2 * w2 * L2 * m2 * cosDelta)) /
      (L2 * den) -
    damping * w2

  return { th1: w1, th2: w2, w1: a1, w2: a2 }
}

function step(a: PendulumState, b: PendulumState, h: number): PendulumState {
  return {
    th1: a.th1 + b.th1 * h,
    th2: a.th2 + b.th2 * h,
    w1: a.w1 + b.w1 * h,
    w2: a.w2 + b.w2 * h,
  }
}

/** Advance the state by dt seconds with one RK4 step. */
export function rk4Step(s: PendulumState, p: PendulumParams, dt: number): PendulumState {
  const k1 = derivatives(s, p)
  const k2 = derivatives(step(s, k1, dt / 2), p)
  const k3 = derivatives(step(s, k2, dt / 2), p)
  const k4 = derivatives(step(s, k3, dt), p)
  return {
    th1: s.th1 + (dt / 6) * (k1.th1 + 2 * k2.th1 + 2 * k3.th1 + k4.th1),
    th2: s.th2 + (dt / 6) * (k1.th2 + 2 * k2.th2 + 2 * k3.th2 + k4.th2),
    w1: s.w1 + (dt / 6) * (k1.w1 + 2 * k2.w1 + 2 * k3.w1 + k4.w1),
    w2: s.w2 + (dt / 6) * (k1.w2 + 2 * k2.w2 + 2 * k3.w2 + k4.w2),
  }
}

/**
 * Total mechanical energy (J). With damping = 0 this stays constant over time
 * — the live readout uses that invariance to prove the simulation is real.
 */
export function totalEnergy(s: PendulumState, p: PendulumParams): EnergyReadout {
  const { th1, th2, w1, w2 } = s
  const { m1, m2, L1, L2, g } = p
  const ke =
    0.5 * m1 * L1 * L1 * w1 * w1 +
    0.5 *
      m2 *
      (L1 * L1 * w1 * w1 +
        L2 * L2 * w2 * w2 +
        2 * L1 * L2 * w1 * w2 * Math.cos(th1 - th2))
  const pe = -(m1 + m2) * g * L1 * Math.cos(th1) - m2 * g * L2 * Math.cos(th2)
  return { ke, pe, total: ke + pe }
}

export interface BobPositions {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Screen positions of the two bobs given a pivot (px) and a scale (px per
 * metre). Y increases downward (canvas convention); since theta is measured
 * from the downward vertical, cos(theta) > 0 places a bob below its pivot.
 */
export function toCartesian(
  s: PendulumState,
  p: PendulumParams,
  pivotX: number,
  pivotY: number,
  scale: number,
): BobPositions {
  const x1 = pivotX + scale * p.L1 * Math.sin(s.th1)
  const y1 = pivotY + scale * p.L1 * Math.cos(s.th1)
  const x2 = x1 + scale * p.L2 * Math.sin(s.th2)
  const y2 = y1 + scale * p.L2 * Math.cos(s.th2)
  return { x1, y1, x2, y2 }
}

/** Smallest signed difference between two angles, wrapped to [-pi, pi]. */
export function angleDelta(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}

/**
 * Configuration-space distance between two pendulums (rad) — the chaos metric.
 * Combines both joint-angle differences; grows ~exponentially while chaotic.
 */
export function divergence(a: PendulumState, b: PendulumState): number {
  return Math.hypot(angleDelta(a.th1, b.th1), angleDelta(a.th2, b.th2))
}

/** Wrap an angle to [-pi, pi] (used for the phase-space plot). */
export function wrapAngle(a: number): number {
  let x = a
  while (x > Math.PI) x -= 2 * Math.PI
  while (x < -Math.PI) x += 2 * Math.PI
  return x
}
