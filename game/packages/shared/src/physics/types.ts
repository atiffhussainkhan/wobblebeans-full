export enum Locomotion {
  Idle = 0,
  Run = 1,
  Jump = 2,
  Fall = 3,
  Dive = 4,
  DiveSlide = 5,
  /** Holding a player or reaching. Server-owned for other beans (D-04). */
  Grab = 6,
  Climb = 7,
  /** Being held. Pose comes from the server snapshot, not prediction. */
  Grabbed = 8,
  Stumble = 9,
  Ragdoll = 10,
  GetUp = 11,
  Emote = 12,
  /** Dive recovery after the belly slide. Jump-cancel lives here. */
  Recover = 13,
}

/**
 * Timers that belong to one bean and are not all on the wire.
 * `coyote` carries the ragdoll settle clock while tumbling, and snapshot
 * flag bit 4 carries `getUpBack`. See docs/ADR-001-engine.md.
 */
export interface CharacterMotion {
  grabPartner: number
  /** Seconds left before a player grab force-releases. */
  grabLeft: number
  regrabCooldown: number
  hardLand: boolean
  immunity: number
  emoteId: number
  settleHold: number
  mashTokens: number
  prevMoveX: number
  prevMoveZ: number
  grabHeld: boolean
  mantleFromX: number
  mantleFromY: number
  mantleFromZ: number
  mantleToX: number
  mantleToY: number
  mantleToZ: number
  bumpCooldown: number
}

export interface InputFrame {
  seq: number
  /** Simulation tick this step was sampled on. */
  tick: number
  /** Strafe, -1..1, camera space. */
  moveX: number
  /** Forward, -1..1, camera space. */
  moveZ: number
  jump: boolean
  dive: boolean
  /**
   * Hold. Packed in the existing input button byte, bit 2.
   * Omitted means false so older frames still decode.
   */
  grab?: boolean
  /** Radians. 0 looks along +Z. */
  camYaw: number
  /** 0 = none. Preset id, never text. */
  quickChat: number
  emote: number
}

export function emptyInput(seq = 0, tick = 0): InputFrame {
  return {
    seq,
    tick,
    moveX: 0,
    moveZ: 0,
    jump: false,
    dive: false,
    grab: false,
    camYaw: 0,
    quickChat: 0,
    emote: 0,
  }
}

export interface BeanState {
  id: number
  px: number
  py: number
  pz: number
  vx: number
  vy: number
  vz: number
  yaw: number
  grounded: boolean
  coyote: number
  jumpBuffer: number
  diveBuffer: number
  airDiveUsed: boolean
  locomotion: Locomotion
  stateTime: number
  landCooldown: number
  lastSeq: number
  finished: boolean
  onMover: boolean
  spawnIndex: number
  /** Get-up clip faces the back. Snapshot flag bit 4. Absent means false. */
  getUpBack?: boolean
  motion?: CharacterMotion
}

export function cloneBean(s: BeanState): BeanState {
  return { ...s }
}

/**
 * Floor and zone hooks owned by the obstacle kit (doc 03 §2.5).
 * The foundation course uses the neutral default.
 */
export interface SurfaceModifiers {
  accelMult: number
  decelMult: number
  speedMult: number
  gravityMult: number
  externalAccelX: number
  externalAccelY: number
  externalAccelZ: number
  platformVelocityX: number
  platformVelocityY: number
  platformVelocityZ: number
  /** Bounce pads and bumpers (AD-07). Absent means ragdoll is allowed. */
  suppressRagdoll?: boolean
}

export const NEUTRAL_SURFACE: SurfaceModifiers = {
  accelMult: 1,
  decelMult: 1,
  speedMult: 1,
  gravityMult: 1,
  externalAccelX: 0,
  externalAccelY: 0,
  externalAccelZ: 0,
  platformVelocityX: 0,
  platformVelocityY: 0,
  platformVelocityZ: 0,
}

export interface MoveResolution {
  movedX: number
  movedY: number
  movedZ: number
  grounded: boolean
}
