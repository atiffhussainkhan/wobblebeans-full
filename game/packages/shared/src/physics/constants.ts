/**
 * Deterministic tuning baseline from docs/design/03-character-controls.md.
 * Client and server import this object. A show refuses clients whose
 * physicsHash() does not match (doc 08 §10, issue I-09).
 * Do not scatter these numbers through gameplay code.
 */
export const PHYSICS = {
  tickHz: 50,
  dt: 1 / 50,

  maxSpeed: 9,
  minWalkSpeed: 2,
  stickDeadzone: 0.15,
  accel: 45,
  decel: 60,
  reverseAccel: 90,
  turnRateDeg: 720,

  slopeLimitDeg: 45,
  stepOffset: 0.35,

  jumpHeight: 1.5,
  timeToApex: 0.4,
  /** Derived: 2 * height / timeToApex^2 = 18.75 */
  gravity: 18.75,
  /** Derived: gravity * timeToApex = 7.5 */
  jumpVelocity: 7.5,
  fallGravityMult: 1.5,
  terminalVelocity: 25,
  releaseCutMult: 1,
  airAccel: 18,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  landCooldown: 0.05,

  diveHorizSpeed: 11,
  diveVertSpeed: 3,
  diveSlideDecel: 14,
  diveRecoveryTime: 0.55,
  diveCancelToJumpAfter: 0.4,
  diveBuffer: 0.1,

  capsuleRadius: 0.5,
  /** Cylindrical half-length. Total height = 2 * (half + radius) = 1.6 m. */
  capsuleHalfHeight: 0.3,
  mass: 60,

  respawnY: -6,
  respawnDelay: 1.5,
} as const

export const CAPSULE_CENTER = PHYSICS.capsuleRadius + PHYSICS.capsuleHalfHeight

export const DT = PHYSICS.dt

export function feetY(centerY: number): number {
  return centerY - CAPSULE_CENTER
}

export function centerYFromFeet(feet: number): number {
  return feet + CAPSULE_CENTER
}
