import type { CourseDef } from '../course/foundation-gauntlet'
import { PHYSICS, feetY } from '../physics/constants'
import type { BeanState } from '../physics/types'
import { CHARACTER } from './tuning'

export interface LedgeHit {
  x: number
  z: number
  top: number
  height: number
}

/**
 * Lip catch. The top must sit within grab.ledgeMaxHeight of the feet and
 * above the walkable step, so a 2 m wall stays out of reach (I-08).
 */
export function findLedge(
  state: BeanState,
  course: CourseDef,
  dirX: number,
  dirZ: number,
): LedgeHit | null {
  const len = Math.hypot(dirX, dirZ)
  if (len < 0.2) return null
  const fx = dirX / len
  const fz = dirZ / len
  const feet = feetY(state.py)
  let best: LedgeHit | null = null
  for (const box of course.boxes) {
    if (box.mover) continue
    if (Math.abs(box.rx) > 0.25) continue
    const top = box.y + box.hy
    const height = top - feet
    if (height < PHYSICS.stepOffset || height > CHARACTER.ledgeMaxHeight + 1e-4) continue
    const px = state.px + fx * 0.42
    const pz = state.pz + fz * 0.48
    if (Math.abs(px - box.x) > box.hx + 0.08) continue
    if (Math.abs(pz - box.z) > box.hz + 0.08) continue
    const ahead = (box.x - state.px) * fx + (box.z - state.pz) * fz
    if (ahead < 0.05) continue
    if (!best || height < best.height) best = { x: box.x, z: box.z, top, height }
  }
  return best
}
