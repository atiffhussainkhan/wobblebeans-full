import type { BoxKit, KitPieceId, MotionKind, ObstacleSpec } from './types'

/**
 * The eleven MVP pieces (doc 02 §9). Defaults are the v3 tuning baseline.
 * Conveyor speed is clamped at 3.6 m/s (AD-08). Bumper ragdoll is `none` (AD-07).
 * A spin bar's grounded hit is a stumble capped under the knockdown threshold (I-10).
 */

export const CONVEYOR_SPEED_CAP = 3.6
export const SPIN_STUMBLE_DV_CAP = 7.9
export const DOOR_BREAK_SPEED = 3
export const DOOR_DESPAWN_S = 0.3
export const TILE_VANISH_S = 0.8
export const TELEGRAPH_MIN_S = 0.25
export const GAP_JUMP_MAX = 3
export const GAP_DIVE_MAX = 5
export const SPAWN_SPACING_MIN = 1.2
export const CHECKPOINT_FALL_BUDGET_S = 12
export const LAUNCH_TIP_SPEED = 20

export const OBSTACLE_KIT: readonly ObstacleSpec[] = [
  {
    id: 'swing_ball',
    ragdoll: 'knockdown',
    period: 4,
    speed: 0,
    dv: 14,
    dvUp: 5,
    amplitude: 0.65,
    length: 6,
    trigger: 'contact',
    telegraphS: 0.5,
    telegraphAudio: 'sfx_obs_swingball',
  },
  {
    id: 'spin_bar',
    ragdoll: 'contact',
    period: 0,
    speed: 40,
    dv: 9,
    dvUp: 0,
    amplitude: 1,
    length: 8,
    trigger: 'contact',
    telegraphS: 0.5,
    telegraphAudio: 'sfx_obs_spinbar',
  },
  {
    id: 'spin_mallet',
    ragdoll: 'knockdown',
    period: 0,
    speed: 90,
    dv: 12,
    dvUp: 4,
    amplitude: 1,
    length: 2,
    trigger: 'contact',
    telegraphS: 0.5,
    telegraphAudio: 'sfx_obs_spinmallet',
  },
  {
    id: 'tilt_plank',
    ragdoll: 'none',
    period: 1,
    speed: 0,
    dv: 0,
    dvUp: 0,
    amplitude: (25 * Math.PI) / 180,
    length: 0,
    trigger: 'contact',
    telegraphS: 0.25,
    telegraphAudio: 'sfx_obs_tilt',
  },
  {
    id: 'conveyor',
    ragdoll: 'none',
    period: 0,
    speed: 3.5,
    dv: 0,
    dvUp: 0,
    amplitude: 0,
    length: 0,
    trigger: 'none',
    telegraphS: 0.25,
    telegraphAudio: 'sfx_obs_conveyor',
  },
  {
    id: 'bumper',
    ragdoll: 'none',
    period: 4,
    speed: 1.5,
    dv: 10,
    dvUp: 0,
    amplitude: (1.5 * 4) / (Math.PI * 2),
    length: 0.75,
    trigger: 'contact',
    telegraphS: 0.25,
    telegraphAudio: 'sfx_obs_bumper',
  },
  {
    id: 'pusher',
    ragdoll: 'stumble',
    period: 3,
    speed: 4,
    dv: 10,
    dvUp: 0,
    amplitude: 4,
    length: 0,
    trigger: 'contact',
    telegraphS: 0.4,
    telegraphAudio: 'sfx_obs_pusher',
  },
  {
    id: 'launch_arm',
    ragdoll: 'knockdown',
    period: 0,
    speed: 120,
    dv: LAUNCH_TIP_SPEED,
    dvUp: 0,
    amplitude: 0,
    length: 6,
    trigger: 'contact',
    telegraphS: 0.4,
    telegraphAudio: 'sfx_obs_launch',
  },
  {
    id: 'trick_door',
    ragdoll: 'none',
    period: DOOR_DESPAWN_S,
    speed: DOOR_BREAK_SPEED,
    dv: 0,
    dvUp: 0,
    amplitude: 0,
    length: 0,
    trigger: 'contact',
    telegraphS: 0.25,
    telegraphAudio: 'sfx_obs_trickdoor',
  },
  {
    id: 'drop_tile',
    ragdoll: 'none',
    period: TILE_VANISH_S,
    speed: 0,
    dv: 0,
    dvUp: 0,
    amplitude: 0,
    length: 0,
    trigger: 'touch',
    telegraphS: 0.56,
    telegraphAudio: 'sfx_obs_droptile',
  },
  {
    id: 'slime',
    ragdoll: 'none',
    period: 0,
    speed: 60 / (140 - 3 - 2),
    dv: 0,
    dvUp: 0,
    amplitude: 0,
    length: 0,
    trigger: 'contact',
    telegraphS: 0.25,
    telegraphAudio: 'sfx_obs_slime',
  },
] as const

const BY_ID = new Map<KitPieceId, ObstacleSpec>(OBSTACLE_KIT.map((spec) => [spec.id, spec]))

export function kitSpec(id: KitPieceId): ObstacleSpec {
  const spec = BY_ID.get(id)
  if (!spec || spec.ragdoll === undefined) {
    throw new Error(`obstacle kit piece ${id} is missing its ragdoll tag`)
  }
  return spec
}

export function clampConveyor(speed: number): number {
  const sign = Math.sign(speed) || 1
  return sign * Math.min(Math.abs(speed), CONVEYOR_SPEED_CAP)
}

export function makeKit(piece: KitPieceId, motion: MotionKind, extra: Partial<BoxKit> = {}): BoxKit {
  const spec = kitSpec(piece)
  const kit: BoxKit = {
    piece,
    motion,
    ragdoll: spec.ragdoll,
    phase: 0,
    period: spec.period,
    speed: piece === 'conveyor' ? clampConveyor(spec.speed) : spec.speed,
    dv: spec.dv,
    dvUp: spec.dvUp,
    trigger: spec.trigger,
    speedMult: 1,
    telegraphS: spec.telegraphS,
    axis: 'y',
    amplitude: spec.amplitude,
    length: spec.length,
    real: false,
    triggeredTick: null,
    tilt: 0,
    loop: 0,
    origin: 0,
    dir: 1,
    slot: 0,
    panel: 0,
    escalate: false,
    wobble: false,
    phase3: false,
    ...extra,
  }
  if (kit.piece === 'conveyor') kit.speed = clampConveyor(kit.speed)
  if (kit.telegraphS < TELEGRAPH_MIN_S) kit.telegraphS = TELEGRAPH_MIN_S
  return kit
}

/** Grounded spin-bar contact stays a stumble. Air contact is a knockdown (I-10). */
export function spinBarHit(grounded: boolean, dv: number): { tag: 'stumble' | 'knockdown'; dv: number } {
  if (grounded) return { tag: 'stumble', dv: Math.min(dv, SPIN_STUMBLE_DV_CAP) }
  return { tag: 'knockdown', dv }
}
