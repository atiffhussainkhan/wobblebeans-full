import { PHYSICS } from '../physics/constants'
import { Locomotion, type BeanState, type InputFrame } from '../physics/types'
import { ensureCharacter } from './state'
import { CHARACTER, grabCenterReach } from './tuning'

export function findGrabTarget(grabber: BeanState, peers: ReadonlyMap<number, BeanState>): BeanState | null {
  const reach = grabCenterReach()
  const faceX = Math.sin(grabber.yaw)
  const faceZ = Math.cos(grabber.yaw)
  const minDot = Math.cos(CHARACTER.grabConeHalfAngle)
  let best: BeanState | null = null
  let bestDist = reach
  for (const other of peers.values()) {
    if (other.id === grabber.id) continue
    if (!canBeGrabbed(other)) continue
    const dx = other.px - grabber.px
    const dy = other.py - grabber.py
    const dz = other.pz - grabber.pz
    if (Math.abs(dy) > 1.2) continue
    const dist = Math.hypot(dx, dz)
    if (dist > bestDist || dist < 1e-4) continue
    const dot = (dx / dist) * faceX + (dz / dist) * faceZ
    if (dot < minDot) continue
    best = other
    bestDist = dist
  }
  return best
}

function canBeGrabbed(state: BeanState): boolean {
  return (
    state.grounded &&
    (state.locomotion === Locomotion.Idle ||
      state.locomotion === Locomotion.Run ||
      state.locomotion === Locomotion.Emote ||
      state.locomotion === Locomotion.Stumble)
  )
}

export function beginGrab(grabber: BeanState, victim: BeanState): void {
  const hold = CHARACTER.grabMaxHoldPlayer
  const g = ensureCharacter(grabber)
  const v = ensureCharacter(victim)
  grabber.locomotion = Locomotion.Grab
  grabber.stateTime = 0
  g.grabPartner = victim.id
  g.grabLeft = hold
  victim.locomotion = Locomotion.Grabbed
  victim.stateTime = 0
  v.grabPartner = grabber.id
  v.grabLeft = hold
  victim.jumpBuffer = 0
  victim.diveBuffer = 0
}

export type ReleaseMode = 'throw' | 'break' | 'cap'

/** Idempotent. A second call does not throw again. */
export function releaseGrab(grabber: BeanState, victim: BeanState | undefined, mode: ReleaseMode): void {
  const g = ensureCharacter(grabber)
  if (grabber.locomotion === Locomotion.Grab) {
    grabber.locomotion = Locomotion.Idle
    grabber.stateTime = 0
    g.grabPartner = 0
    g.grabLeft = 0
    g.regrabCooldown = CHARACTER.regrabCooldown
  }
  if (!victim) return
  const v = ensureCharacter(victim)
  if (victim.locomotion !== Locomotion.Grabbed) return
  if (v.grabPartner !== 0 && v.grabPartner !== grabber.id && g.grabPartner !== victim.id) return
  v.grabPartner = 0
  v.grabLeft = 0
  victim.stateTime = 0
  victim.jumpBuffer = 0
  victim.diveBuffer = 0
  if (mode === 'throw') {
    const fx = Math.sin(grabber.yaw)
    const fz = Math.cos(grabber.yaw)
    victim.vx += fx * CHARACTER.throwForward
    victim.vz += fz * CHARACTER.throwForward
    victim.vy = Math.max(victim.vy, CHARACTER.throwUp)
    victim.grounded = false
    victim.locomotion = Locomotion.Fall
    victim.coyote = 0
    return
  }
  if (mode === 'break') {
    const dx = victim.px - grabber.px
    const dz = victim.pz - grabber.pz
    const dist = Math.hypot(dx, dz) || 1
    victim.vx += (dx / dist) * 2
    victim.vz += (dz / dist) * 2
    victim.vy = Math.max(victim.vy, CHARACTER.breakPopUp)
    victim.grounded = false
    victim.locomotion = Locomotion.Fall
    victim.coyote = 0
    return
  }
  victim.locomotion = victim.grounded ? Locomotion.Idle : Locomotion.Fall
}

export function pullSpring(victim: BeanState, grabber: BeanState, dt: number): void {
  const dx = grabber.px - victim.px
  const dz = grabber.pz - victim.pz
  const dist = Math.hypot(dx, dz)
  if (dist < 0.25) return
  const accel = (CHARACTER.pullSpring / PHYSICS.mass) * dist
  victim.vx += (dx / dist) * accel * dt
  victim.vz += (dz / dist) * accel * dt
}

/**
 * Mash credit, capped at 4 inputs per second (I-11).
 * A held break button is one edge, not a pulse every tick.
 */
export function takeBreakPulses(state: BeanState, input: InputFrame, dt: number): number {
  const motion = ensureCharacter(state)
  let pulses = 0
  if (input.jump) pulses += 1
  if (input.dive) pulses += 1
  if (input.grab && !motion.grabHeld) pulses += 1
  const mag = Math.hypot(input.moveX, input.moveZ)
  const prev = Math.hypot(motion.prevMoveX, motion.prevMoveZ)
  const dot = input.moveX * motion.prevMoveX + input.moveZ * motion.prevMoveZ
  if (mag > 0.45 && prev > 0.45 && dot < 0) pulses += 1
  motion.mashTokens = Math.min(CHARACTER.mashCapPerSec, motion.mashTokens + dt * CHARACTER.mashCapPerSec)
  const used = Math.min(pulses, motion.mashTokens)
  motion.mashTokens -= used
  return used
}
