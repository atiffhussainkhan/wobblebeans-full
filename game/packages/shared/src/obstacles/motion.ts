import { PHYSICS } from '../physics/constants'
import { clamp } from '../physics/math'
import type { BoxKit } from './types'

const TAU = Math.PI * 2

export function smoothstep(u: number): number {
  const x = clamp(u, 0, 1)
  return x * x * (3 - 2 * x)
}

/** Integral of smoothstep from 0 to u. smoothstep(s) = 3s^2 - 2s^3. */
export function smoothstepIntegral(u: number): number {
  const x = clamp(u, 0, 1)
  return x * x * x - 0.5 * x * x * x * x
}

/**
 * Pusher stroke. Out 1/3, hold 1/6, in 1/3, hold 1/6.
 * A 3 s period is out 1.0, hold 0.5, in 1.0, hold 0.5 (doc 02 §1).
 * Returns 0 at rest and 1 fully extended.
 */
export function pusherExtension(tick: number, period: number, phase: number): number {
  const safe = period > 1e-4 ? period : 3
  const t = (tick / PHYSICS.tickHz + phase) % safe
  const u = t / safe
  const out = 1 / 3
  const hold = 1 / 6
  if (u < out) return u / out
  if (u < out + hold) return 1
  if (u < out + hold + out) return 1 - (u - out - hold) / out
  return 0
}

/** Radians of a spin bar or mallet. Escalation and wobble integrate cleanly so the angle never pops. */
export function spinRadians(tick: number, kit: Pick<BoxKit, 'speed' | 'speedMult' | 'amplitude' | 'phase' | 'period' | 'length' | 'loop' | 'origin' | 'dir' | 'escalate' | 'wobble'>): number {
  const t = tick / PHYSICS.tickHz
  const base = ((kit.speed * kit.speedMult * Math.PI) / 180) * (kit.dir || 1)
  if (kit.wobble && kit.period > 1e-4) {
    const w = TAU / kit.period
    // ±10% sine (doc 02 §4). `length` stays the bar reach, so the depth is fixed.
    const depth = 0.1
    return kit.phase + base * t - (base * depth * (Math.cos(w * t) - 1)) / w
  }
  if (kit.escalate && kit.amplitude > 1 && kit.origin > kit.loop) {
    const t0 = kit.loop
    const t1 = kit.origin
    const span = t1 - t0
    const extra = kit.amplitude - 1
    let angle: number
    if (t <= t0) angle = base * t
    else if (t >= t1) angle = base * t1 + base * span * extra * 0.5 + base * kit.amplitude * (t - t1)
    else angle = base * t + base * span * extra * smoothstepIntegral((t - t0) / span)
    return kit.phase + angle
  }
  return kit.phase + base * t
}

export function swingAngle(tick: number, period: number, phase: number, amplitude: number): number {
  const safe = period > 1e-4 ? period : 4
  const t = tick / PHYSICS.tickHz
  return Math.sin((t * TAU) / safe + phase) * amplitude
}

/**
 * Longest stretch of one period where the ball is outside `body` metres of center.
 * Used to prove the safe window is at least 1.2 s (doc 02 §2).
 */
export function swingSafeWindow(period: number, amplitude: number, rope: number, body: number): number {
  const steps = 720
  let best = 0
  let run = 0
  for (let i = 0; i < steps * 2; i++) {
    const t = (i / steps) * period
    const tick = Math.round(t * PHYSICS.tickHz)
    const theta = swingAngle(tick, period, 0, amplitude)
    const reach = Math.abs(Math.sin(theta) * rope)
    if (reach > body) {
      run += period / steps
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return Math.min(best, period)
}

export interface SlimeParams {
  graceS: number
  rate: number
  maxY: number
  startY: number
  limitS: number
  floodLeadS: number
}

/** Rising slime height. Floods to `maxY` at limit − floodLead (doc 02 §3). */
export function slimeHeight(tick: number, slime: SlimeParams): number {
  const t = tick / PHYSICS.tickHz
  if (t < slime.graceS) return slime.startY
  if (t >= slime.limitS - slime.floodLeadS) return slime.maxY
  return Math.min(slime.maxY, slime.startY + (t - slime.graceS) * slime.rate)
}

export const SLIME_RISE_LIMIT_S = 140
export const SLIME_RISE_GRACE_S = 3
export const SLIME_RISE_FLOOD_LEAD_S = 2
export const SLIME_RISE_HEIGHT = 60
export const SLIME_RISE_RATE = SLIME_RISE_HEIGHT / (SLIME_RISE_LIMIT_S - SLIME_RISE_GRACE_S - SLIME_RISE_FLOOD_LEAD_S)

/** Conservative max throw distance, 45° and the uphill gravity (an upper bound). */
export function launchReach(tipSpeed: number): { range: number; apex: number } {
  const v = tipSpeed / Math.SQRT2
  const gUp = PHYSICS.gravity
  const tUp = v / gUp
  const apex = v * tUp - 0.5 * gUp * tUp * tUp
  const gDown = PHYSICS.gravity * PHYSICS.fallGravityMult
  const tDown = Math.sqrt((2 * apex) / gDown)
  return { range: v * (tUp + tDown), apex }
}

/**
 * Horizontal throw. Returns true when the projectile meets `floorY` more than
 * `margin` metres short of the trophy. This is the launch bounds check (FR-03-10).
 */
export function throwLandsShort(
  origin: { x: number; y: number; z: number },
  trophy: { x: number; y: number; z: number },
  tipSpeed: number,
  floorY: number,
  margin = 2,
): boolean {
  const dx = trophy.x - origin.x
  const dz = trophy.z - origin.z
  const len = Math.hypot(dx, dz) || 1
  let x = origin.x
  let y = origin.y
  let z = origin.z
  const vx = (dx / len) * tipSpeed
  const vz = (dz / len) * tipSpeed
  let vy = 0
  const dt = 1 / 50
  for (let i = 0; i < 50 * 6; i++) {
    const g = vy > 0 ? PHYSICS.gravity : PHYSICS.gravity * PHYSICS.fallGravityMult
    vy -= g * dt
    x += vx * dt
    y += vy * dt
    z += vz * dt
    if (y <= floorY) {
      return Math.hypot(trophy.x - x, trophy.z - z) > margin
    }
  }
  return Math.hypot(trophy.x - x, trophy.y - y, trophy.z - z) > margin
}

export interface WallSchedule {
  phase3: boolean
  firstSpawn: number
  phase1End: number
  phase2End: number
  phase3End: number
  speedStart: number
  speedEnd: number
}

export const WALL_R2: WallSchedule = {
  phase3: false,
  firstSpawn: 2,
  phase1End: 45,
  phase2End: 87,
  phase3End: 105,
  speedStart: 3,
  speedEnd: 5,
}

export const WALL_R3: WallSchedule = { ...WALL_R2, phase3: true }

export function wallSpacing(t: number, schedule: WallSchedule): number {
  if (t < schedule.phase1End) {
    const u = t / schedule.phase1End
    return 6 + (5 - 6) * u
  }
  if (!schedule.phase3 || t < schedule.phase2End) return 4.5
  if (t >= schedule.phase3End) return 3
  const u = (t - schedule.phase2End) / (schedule.phase3End - schedule.phase2End)
  return 4.5 + (3 - 4.5) * u
}

export function wallSpawnTime(index: number, schedule: WallSchedule): number {
  let t = schedule.firstSpawn
  for (let i = 0; i < index; i++) t += wallSpacing(t, schedule)
  return t
}

export function wallSpeedAt(t: number, schedule: WallSchedule): number {
  if (!schedule.phase3 || t <= schedule.phase2End) return schedule.speedStart
  if (t >= schedule.phase3End) return schedule.speedEnd
  const u = (t - schedule.phase2End) / (schedule.phase3End - schedule.phase2End)
  return schedule.speedStart + (schedule.speedEnd - schedule.speedStart) * u
}

/** Distance a wall has travelled since its spawn, integrating the phase speed. */
export function wallTravel(spawn: number, t: number, schedule: WallSchedule): number {
  if (t <= spawn) return 0
  if (!schedule.phase3) return schedule.speedStart * (t - spawn)
  const a = spawn
  const b = t
  const p2 = schedule.phase2End
  const p3 = schedule.phase3End
  let dist = 0
  const segments: Array<[number, number]> = []
  const cuts = [a, p2, p3, b].filter((v) => v > a && v < b).sort((m, n) => m - n)
  let cursor = a
  for (const cut of cuts) {
    segments.push([cursor, cut])
    cursor = cut
  }
  segments.push([cursor, b])
  for (const [s0, s1] of segments) {
    if (s1 <= p2) dist += schedule.speedStart * (s1 - s0)
    else if (s0 >= p3) dist += schedule.speedEnd * (s1 - s0)
    else {
      const u0 = s0 - p2
      const u1 = s1 - p2
      const span = p3 - p2
      // speed = start + (end-start) * (t-p2)/span
      const k = (schedule.speedEnd - schedule.speedStart) / span
      dist += schedule.speedStart * (s1 - s0) + 0.5 * k * (u1 * u1 - u0 * u0)
    }
  }
  return dist
}

export const WALL_SLOTS = 8
export const WALL_START_X = -2
export const WALL_PANEL_Z = [-8, -4, 0, 4, 8] as const

export function wallGapPanels(index: number, t: number): number[] {
  const gaps = [index % 5]
  if (t >= 45) gaps.push((index + 2) % 5)
  return gaps
}

export interface WallPose {
  x: number
  y: number
  z: number
  active: boolean
  wallIndex: number
}

/** Recycler slots. A panel that is the gap parks under the floor. A slot stays hidden until its spawn time. */
export function wallPanelPose(tick: number, slot: number, panel: number, phase3: boolean): WallPose {
  const schedule = phase3 ? WALL_R3 : WALL_R2
  const t = tick / PHYSICS.tickHz
  for (let n = slot; n < 64; n += WALL_SLOTS) {
    const spawn = wallSpawnTime(n, schedule)
    if (t < spawn) break
    const x = WALL_START_X + wallTravel(spawn, t, schedule)
    if (x > -6 && x < 36) {
      const missing = wallGapPanels(n, t).includes(panel)
      return {
        x,
        y: missing ? -40 : 1.4,
        z: WALL_PANEL_Z[panel] ?? 0,
        active: true,
        wallIndex: n,
      }
    }
  }
  return { x: 0, y: -40, z: WALL_PANEL_Z[panel] ?? 0, active: false, wallIndex: -1 }
}

/** Next wall that still has to pass `beanX`, and the Z of one of its gaps. */
export function nextWallGap(tick: number, beanX: number, phase3: boolean): { z: number; x: number; index: number } {
  const schedule = phase3 ? WALL_R3 : WALL_R2
  const t = tick / PHYSICS.tickHz
  let best: { z: number; x: number; index: number } | null = null
  for (let n = 0; n < 48; n++) {
    const spawn = wallSpawnTime(n, schedule)
    if (spawn > t + 30) break
    const x = WALL_START_X + wallTravel(spawn, t, schedule)
    if (x < beanX - 1 || x > beanX + 18) continue
    const gap = wallGapPanels(n, t)[0] ?? 0
    const z = WALL_PANEL_Z[gap] ?? 0
    if (!best || x < best.x) best = { z, x, index: n }
  }
  return best ?? { z: 0, x: beanX + 8, index: 0 }
}

/** Drop-tile vertical offset after the first touch. Gone at 0.8 s. Optional return after `returnS`. */
export function tileDropOffset(ageS: number, returnS: number): number {
  if (ageS < 0) return 0
  if (returnS > 0 && ageS >= returnS) return 0
  if (ageS < 0.12) return -0.12 * (ageS / 0.12)
  if (ageS < 0.56) return -0.08
  if (ageS < 0.72) return -0.08 * (1 - (ageS - 0.56) / 0.16)
  if (ageS < TILE_GONE) return -0.02
  return -40
}

const TILE_GONE = 0.8

/**
 * Three beans reach `maxAngle` in about 1 s (doc 02 §2).
 * A single bean leaves the plank flat, so one player can cross with move and jump.
 * The second bean tips it halfway. The plank eases back when the crowd leaves.
 */
export function tiltStep(current: number, occupants: number, maxAngle: number, dt: number): number {
  const crowd = Math.max(0, occupants - 1)
  const target = clamp(crowd / 2, 0, 1) * maxAngle
  const rate = maxAngle / 1
  const delta = clamp(target - current, -rate * dt, rate * dt)
  return current + delta
}
