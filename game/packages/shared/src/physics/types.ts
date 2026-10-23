export enum Locomotion {
  Idle = 0,
  Run = 1,
  Jump = 2,
  Fall = 3,
  Dive = 4,
  DiveSlide = 5,
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
