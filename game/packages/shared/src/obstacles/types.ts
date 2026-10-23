import type { CourseBox } from '../course/foundation-gauntlet'

/**
 * Workstream 3 obstacle kit.
 * Motion is a pure function of server tick (FR-03-02). The `ragdoll` tag is
 * required on every piece (FR-03-01). Names are Wobblebeans pieces, not the
 * reference game's.
 *
 * `BoxKit` hangs off a course box at runtime. `BeanWorld` clones the course
 * before simulating so two worlds do not share triggered doors or tiles.
 * The gauntlet shuttle has no kit and keeps `moverOffset`.
 */

export type RagdollTag = 'knockdown' | 'stumble' | 'none' | 'contact'

export type KitPieceId =
  | 'swing_ball'
  | 'spin_bar'
  | 'spin_mallet'
  | 'tilt_plank'
  | 'conveyor'
  | 'bumper'
  | 'pusher'
  | 'launch_arm'
  | 'trick_door'
  | 'drop_tile'
  | 'slime'

export type MotionKind =
  | 'static'
  | 'sine'
  | 'pusher'
  | 'spin'
  | 'swing'
  | 'launch'
  | 'door'
  | 'tile'
  | 'travel'
  | 'rise'
  | 'tilt'

export type TriggerKind = 'contact' | 'touch' | 'timed' | 'none'

/** Telegraph ids for workstream 6 to register on `AUDIO`. Not sent on the wire. */
export const KIT_TELEGRAPH_AUDIO = {
  swing_ball: 'sfx_obs_swingball',
  spin_bar: 'sfx_obs_spinbar',
  spin_mallet: 'sfx_obs_spinmallet',
  tilt_plank: 'sfx_obs_tilt',
  conveyor: 'sfx_obs_conveyor',
  bumper: 'sfx_obs_bumper',
  pusher: 'sfx_obs_pusher',
  launch_arm: 'sfx_obs_launch',
  trick_door: 'sfx_obs_trickdoor',
  drop_tile: 'sfx_obs_droptile',
  slime: 'sfx_obs_slime',
} as const

export interface ObstacleSpec {
  id: KitPieceId
  /** Required. The catalogue test fails if this is missing or bumper is not `none`. */
  ragdoll: RagdollTag
  /** Seconds. 0 when the piece is not periodic. */
  period: number
  /** m/s, deg/s, or break speed, depending on the piece. */
  speed: number
  /** Horizontal impulse (m/s). Spin bar grounded hits are capped at 7.9. */
  dv: number
  dvUp: number
  /** Swing half-angle (rad), pusher stroke (m), or spin end multiplier. */
  amplitude: number
  /** Rope length, arm length, or bar reach (m). */
  length: number
  trigger: TriggerKind
  /** Anticipation before the hit. At least 0.25 s (doc 02 §9). */
  telegraphS: number
  telegraphAudio: string
}

export interface BoxKit {
  piece: KitPieceId
  motion: MotionKind
  ragdoll: RagdollTag
  phase: number
  period: number
  speed: number
  dv: number
  dvUp: number
  trigger: TriggerKind
  speedMult: number
  telegraphS: number
  axis: 'x' | 'y' | 'z'
  amplitude: number
  length: number
  /** Real trick doors break. Fake doors stay solid. */
  real: boolean
  /** Server tick when a door or tile was triggered. Null until then. */
  triggeredTick: number | null
  /** Tilt plank angle, radians, written by the course director. */
  tilt: number
  /** Spin escalate start (s), tile return delay (s), or rise time (s). */
  loop: number
  /** Spin escalate end (s), or travel origin. */
  origin: number
  dir: number
  /** Wall recycler slot, or 0. */
  slot: number
  /** Wall panel index, or 0. */
  panel: number
  /** When true, spin speed eases from `speed` to `speed * amplitude` between loop and origin. */
  escalate: boolean
  /** When true, spin speed wobbles ±10% over `period`. `length` stays the reach. */
  wobble: boolean
  /** Wall dodge phase-3 schedule. Ignored by other motions. */
  phase3: boolean
}

export interface SampledPose {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
  rot?: { x: number; y: number; z: number; w: number }
}

export type KitBox = CourseBox & { kit?: BoxKit }

export function readKit(box: CourseBox): BoxKit | null {
  return (box as KitBox).kit ?? null
}

export function attachKit(box: CourseBox, kit: BoxKit): CourseBox {
  ;(box as KitBox).kit = kit
  return box
}
