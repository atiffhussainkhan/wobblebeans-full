import { PHYSICS } from '../physics/constants'

/**
 * Tuning from docs/design/03-character-controls.md §2 that is not already
 * in PHYSICS. Speed, gravity, jump, and dive stay in PHYSICS so physicsHash
 * does not move. Do not copy those numbers here.
 */
export const CHARACTER = {
  grabRange: 1,
  grabConeHalfAngle: (45 * Math.PI) / 180,
  /**
   * Capsules meet at 1.0 m centre-to-centre. The extra 0.15 m is a magnet so
   * a touch still connects when the solver keeps a hair of separation.
   * Centre reach = max(grabRange, capsule diameter) + magnet = 1.15 m.
   */
  grabMagnet: 0.15,
  grabMaxHoldPlayer: 3,
  regrabCooldown: 1.5,
  breakFreePerInput: 0.25,
  victimSpeedMult: 0.45,
  grabberSpeedMult: 0.6,
  pullSpring: 200,
  throwForward: 4,
  throwUp: 2,
  /** Toggle with no target lets go so a child is not stuck slow (I-04). */
  toggleWhiffRelease: 1,
  ledgeMantleTime: 0.45,
  ledgeMaxHeight: 0.4,
  stumbleDv: 4,
  knockdownDv: 8,
  playerBumpCapDv: 5,
  stumbleTime: 0.3,
  stumbleControl: 0.4,
  hardStumbleTime: 0.35,
  landStumbleVy: -18,
  landKnockdownVy: -20,
  settleSpeed: 1.5,
  settleHold: 0.2,
  getUpTime: 0.9,
  ragdollMax: 3,
  knockdownImmunity: 0.5,
  /** Spawn forgiveness. The frozen kill plane still teleports immediately. */
  spawnImmunity: 1,
  mashCapPerSec: 4,
  emoteMax: 2.2,
  /** Break-free pop, friendlier than the throw. */
  breakPopUp: 2,
} as const

export function grabCenterReach(): number {
  const touch = PHYSICS.capsuleRadius * 2
  return Math.max(CHARACTER.grabRange, touch) + CHARACTER.grabMagnet
}
