import { PHYSICS } from '../physics/constants'
import { wrapAngle } from '../physics/math'
import type { BeanState, InputFrame } from '../physics/types'
import { spinRadians } from '../obstacles/motion'
import { nextWallGap } from '../obstacles/motion'
import type { BoxKit } from '../obstacles/types'
import type { RoutePoint } from './schema'

function frame(seq: number, moveX: number, moveZ: number, jump: boolean): InputFrame {
  return { seq, tick: seq, moveX, moveZ, jump, dive: false, camYaw: 0, quickChat: 0, emote: 0 }
}

/** Hold forward, steer into a lane, jump on the fixed lip marks. Dive stays false. */
export function forwardJumpDriver(jumpZs: readonly number[], laneX = 0) {
  return (state: BeanState, seq: number): InputFrame => {
    let jump = false
    if (state.grounded) {
      for (const z of jumpZs) {
        if (state.pz > z && state.pz < z + 1.05) jump = true
      }
    }
    const steer = Math.max(-1, Math.min(1, (laneX - state.px) * 2))
    return frame(seq, steer, 1, jump)
  }
}

function segmentProgress(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax
  const abz = bz - az
  const ab2 = abx * abx + abz * abz || 1
  return ((px - ax) * abx + (pz - az) * abz) / ab2
}

/** Follow the move-and-jump line. Dive stays false. */
export function routeDriver(route: readonly RoutePoint[]) {
  let index = 0
  return (state: BeanState, seq: number): InputFrame => {
    if (route.length === 0) return frame(seq, 0, 1, false)
    while (index < route.length - 1) {
      const point = route[index]!
      const next = route[index + 1]!
      if (segmentProgress(state.px, state.pz, point.x, point.z, next.x, next.z) < 0.82) break
      index += 1
    }
    const anchor = route[index]!
    const target = route[Math.min(index + 1, route.length - 1)]!
    const dx = target.x - state.px
    const dz = target.z - state.pz
    const len = Math.hypot(dx, dz) || 1
    const lip = Math.hypot(state.px - anchor.x, state.pz - anchor.z)
    const jump = Boolean(state.grounded && anchor.jump && lip < 1.35)
    return frame(seq, dx / len, dz / len, jump)
  }
}

export function wallDriver(phase3: boolean, homeX: number) {
  return (state: BeanState, seq: number, tick: number): InputFrame => {
    const gap = nextWallGap(tick, state.px, phase3)
    const dz = Math.max(-1, Math.min(1, gap.z - state.pz))
    const dx = Math.max(-1, Math.min(1, homeX - state.px))
    return frame(seq, dx, dz, false)
  }
}

const BEAM_KIT: Pick<BoxKit, 'speed' | 'speedMult' | 'amplitude' | 'phase' | 'period' | 'length' | 'loop' | 'origin' | 'dir' | 'escalate' | 'wobble'> = {
  speed: 40,
  speedMult: 1,
  amplitude: 2.6,
  phase: 0,
  period: 0,
  length: 0,
  loop: 10,
  origin: 85,
  dir: 1,
  escalate: true,
  wobble: false,
}

/** Stay off the hub and jump when the low bar swings through. */
export function beamDriver(homeX: number, homeZ: number) {
  return (state: BeanState, seq: number, tick: number): InputFrame => {
    const dx = homeX - state.px
    const dz = homeZ - state.pz
    const len = Math.hypot(dx, dz) || 1
    const ang = Math.atan2(state.px, state.pz)
    const bar = spinRadians(tick, BEAM_KIT)
    const near = Math.abs(wrapAngle(bar - ang)) < 0.62 || Math.abs(wrapAngle(bar + Math.PI - ang)) < 0.62
    const jump = Boolean(state.grounded && near)
    const scale = Math.min(1, len)
    return frame(seq, (dx / len) * scale, (dz / len) * scale, jump)
  }
}

export function ticksFor(seconds: number): number {
  return Math.round(seconds * PHYSICS.tickHz)
}
