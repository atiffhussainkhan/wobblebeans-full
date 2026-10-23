import { Locomotion, type BeanState } from '../physics/types'
import { ensureCharacter } from './state'
import { CHARACTER } from './tuning'

/**
 * Player-player bumps. Δv is capped below knockdown so a bean never
 * ragdolls another bean (doc 03 §5, built-in forgiveness).
 */
export function resolveBumps(states: ReadonlyMap<number, BeanState>): void {
  const ids = [...states.keys()].sort((a, b) => a - b)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = states.get(ids[i]!)
      const b = states.get(ids[j]!)
      if (!a || !b) continue
      bumpPair(a, b)
    }
  }
}

function bumpPair(a: BeanState, b: BeanState): void {
  const dx = b.px - a.px
  const dz = b.pz - a.pz
  const dist = Math.hypot(dx, dz)
  const touch = 1.05
  if (dist > touch || dist < 1e-4) return
  if (Math.abs(a.py - b.py) > 1.25) return
  const nx = dx / dist
  const nz = dz / dist
  const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz
  const closing = -rel
  if (closing < CHARACTER.stumbleDv) return
  const dv = Math.min(closing, CHARACTER.playerBumpCapDv)
  a.vx -= nx * dv * 0.5
  a.vz -= nz * dv * 0.5
  b.vx += nx * dv * 0.5
  b.vz += nz * dv * 0.5
  tryStumble(a, dv, nx, nz)
  tryStumble(b, dv, -nx, -nz)
}

function tryStumble(state: BeanState, dv: number, fromX: number, fromZ: number): void {
  const motion = ensureCharacter(state)
  if (motion.immunity > 0 || motion.bumpCooldown > 0) return
  if (dv < CHARACTER.stumbleDv) return
  if (dv >= CHARACTER.knockdownDv) return
  if (!canStumble(state.locomotion)) return
  state.locomotion = Locomotion.Stumble
  state.stateTime = 0
  state.jumpBuffer = 0
  state.diveBuffer = 0
  motion.hardLand = false
  motion.bumpCooldown = 0.35
  const awayX = -fromX
  const awayZ = -fromZ
  const faceX = Math.sin(state.yaw)
  const faceZ = Math.cos(state.yaw)
  state.getUpBack = awayX * faceX + awayZ * faceZ > 0
}

function canStumble(loco: Locomotion): boolean {
  return (
    loco === Locomotion.Idle ||
    loco === Locomotion.Run ||
    loco === Locomotion.Jump ||
    loco === Locomotion.Fall ||
    loco === Locomotion.Emote
  )
}
