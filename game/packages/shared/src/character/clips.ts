import { Locomotion } from '../physics/types'

export type ClipLayer = 'full' | 'lower' | 'upper' | 'face' | 'additive'
export type ClipPack = 'kaykit' | 'quaternius' | 'procedural'

export interface ClipSlot {
  id: string
  layer: ClipLayer
  loop: boolean
  /** One of the five seam-test poses (doc 03 §3.1). */
  seam: boolean
  pack: ClipPack
  /** Clip name inside the pack. Empty when the pose is procedural. */
  clip: string
  phase?: readonly [number, number]
  note: string
}

/**
 * Locomotion and action slots from doc 03 §3.2.
 * Combat clips in the CC0 packs (Attack, Shoot, Punch, SwordSlash, Death)
 * are intentionally unused.
 */
export const CLIP_SLOTS: readonly ClipSlot[] = [
  { id: 'idle_01', layer: 'full', loop: true, seam: true, pack: 'kaykit', clip: 'Idle', note: 'Idle rest' },
  { id: 'idle_fidget_01', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Interact', note: 'Fidget after 6 s' },
  { id: 'idle_fidget_02', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Cheer', note: 'Fidget' },
  { id: 'idle_fidget_03', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'PickUp', note: 'Fidget' },
  { id: 'walk_fwd', layer: 'lower', loop: true, seam: false, pack: 'kaykit', clip: 'Walk', note: 'Speed blend under 4.5 m/s' },
  { id: 'run_fwd', layer: 'lower', loop: true, seam: true, pack: 'kaykit', clip: 'Run', note: 'Speed blend toward 9 m/s' },
  { id: 'run_lean_L', layer: 'additive', loop: true, seam: false, pack: 'kaykit', clip: 'DashLeft', note: 'Additive lean' },
  { id: 'run_lean_R', layer: 'additive', loop: true, seam: false, pack: 'kaykit', clip: 'DashRight', note: 'Additive lean' },
  { id: 'jump_takeoff', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Jump', phase: [0, 0.18], note: 'Takeoff' },
  { id: 'jump_rise', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Jump', phase: [0.18, 0.45], note: 'Rise' },
  { id: 'jump_apex', layer: 'full', loop: false, seam: true, pack: 'kaykit', clip: 'Jump', phase: [0.45, 0.7], note: 'Apex' },
  { id: 'fall_loop', layer: 'full', loop: true, seam: false, pack: 'kaykit', clip: 'Jump', phase: [0.7, 1.05], note: 'Fall' },
  { id: 'land_soft', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Hop', note: 'Soft land overlay' },
  { id: 'land_hard', layer: 'full', loop: false, seam: false, pack: 'quaternius', clip: 'RecieveHit', note: 'Hard stumble land' },
  { id: 'dive_start', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'DashFront', note: 'Dive start' },
  { id: 'dive_air', layer: 'full', loop: true, seam: true, pack: 'kaykit', clip: 'Roll', note: 'Air dive' },
  { id: 'dive_belly_slide', layer: 'full', loop: true, seam: false, pack: 'kaykit', clip: 'Roll', phase: [0.35, 0.8], note: 'Belly slide' },
  { id: 'dive_getup', layer: 'full', loop: false, seam: false, pack: 'quaternius', clip: 'StandUp', note: 'Cancel mark at 0.40 s' },
  { id: 'grab_reach', layer: 'upper', loop: false, seam: false, pack: 'kaykit', clip: 'PickUp', note: 'Reach' },
  { id: 'grab_hold_loop', layer: 'upper', loop: true, seam: false, pack: 'kaykit', clip: 'Interact', note: 'Hold' },
  { id: 'grab_release', layer: 'upper', loop: false, seam: false, pack: 'kaykit', clip: 'Throw', phase: [0, 0.25], note: 'Let go' },
  { id: 'grab_throw', layer: 'upper', loop: false, seam: false, pack: 'kaykit', clip: 'Throw', note: 'Throw' },
  { id: 'grab_carry_loop', layer: 'upper', loop: true, seam: false, pack: 'quaternius', clip: 'Run_Carry', note: 'Object socket, no MVP prop yet' },
  { id: 'grabbed_struggle_loop', layer: 'upper', loop: true, seam: false, pack: 'quaternius', clip: 'RecieveHit', note: 'Struggle' },
  { id: 'ledge_hang', layer: 'full', loop: true, seam: false, pack: 'kaykit', clip: 'Climbing', phase: [0, 0.4], note: 'Hang' },
  { id: 'ledge_mantle', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Climbing', note: 'Mantle 0.45 s' },
  { id: 'stumble_fwd', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'DashFront', note: 'Impact forward' },
  { id: 'stumble_back', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'DashBack', note: 'Impact back' },
  { id: 'stumble_L', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'DashLeft', note: 'Impact left' },
  { id: 'stumble_R', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'DashRight', note: 'Impact right' },
  { id: 'ragdoll_pose_blend', layer: 'full', loop: true, seam: false, pack: 'kaykit', clip: 'LayingDownIdle', note: 'Blend under the procedural tumble' },
  { id: 'getup_front', layer: 'full', loop: false, seam: false, pack: 'quaternius', clip: 'StandUp', note: 'Face-down get-up' },
  { id: 'getup_back', layer: 'full', loop: false, seam: true, pack: 'quaternius', clip: 'StandUp', note: 'Face-up get-up' },
  { id: 'respawn_pop', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Hop', note: 'Appear' },
  { id: 'emote_wave', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Wave', note: 'Friendly' },
  { id: 'emote_cheer', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Cheer', note: 'Friendly' },
  { id: 'emote_dance', layer: 'full', loop: true, seam: false, pack: 'kaykit', clip: 'Dance', note: 'Friendly' },
  { id: 'celebrate_qualify', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Cheer', note: 'Qualify' },
  { id: 'celebrate_win', layer: 'full', loop: false, seam: false, pack: 'quaternius', clip: 'Victory', note: 'Win' },
  { id: 'sad_eliminated', layer: 'full', loop: false, seam: false, pack: 'kaykit', clip: 'Defeat', note: 'Gentle, non-shaming' },
  { id: 'face_happy', layer: 'face', loop: true, seam: false, pack: 'procedural', clip: '', note: 'Smile' },
  { id: 'face_effort', layer: 'face', loop: true, seam: false, pack: 'procedural', clip: '', note: 'Grab and climb' },
  { id: 'face_surprised', layer: 'face', loop: true, seam: false, pack: 'procedural', clip: '', note: 'Air' },
  { id: 'face_dizzy', layer: 'face', loop: true, seam: false, pack: 'procedural', clip: '', note: 'Tumble' },
  { id: 'face_determined', layer: 'face', loop: true, seam: false, pack: 'procedural', clip: '', note: 'Dive' },
] as const

export const SEAM_POSE_IDS = CLIP_SLOTS.filter((slot) => slot.seam).map((slot) => slot.id)

export const KAYKIT_PACK = 'animations/KayKit_AnimatedCharacter_v1.2.glb'
export const QUATERNIUS_PACK = 'animations/Casual_Female.gltf'

export function clipById(id: string): ClipSlot | undefined {
  return CLIP_SLOTS.find((slot) => slot.id === id)
}

export interface ClipSampleState {
  locomotion: Locomotion
  stateTime?: number
  vx: number
  vz: number
  yaw: number
  getUpBack?: boolean
  emoteId?: number
}

/** Which clip the split rig should be playing for this replicated pose. */
export function clipSlotFor(state: ClipSampleState): string {
  const t = state.stateTime ?? 0
  switch (state.locomotion) {
    case Locomotion.Idle: {
      if (t > 6) {
        const fidgets = ['idle_fidget_01', 'idle_fidget_02', 'idle_fidget_03']
        return fidgets[Math.floor((t - 6) / 3) % 3]!
      }
      return 'idle_01'
    }
    case Locomotion.Run:
      return Math.hypot(state.vx, state.vz) < 4.5 ? 'walk_fwd' : 'run_fwd'
    case Locomotion.Jump:
      if (t < 0.18) return 'jump_takeoff'
      if (t < 0.4) return 'jump_rise'
      return 'jump_apex'
    case Locomotion.Fall:
      return 'fall_loop'
    case Locomotion.Dive:
      return t < 0.16 ? 'dive_start' : 'dive_air'
    case Locomotion.DiveSlide:
      return 'dive_belly_slide'
    case Locomotion.Recover:
      return 'dive_getup'
    case Locomotion.Grab:
      return t < 0.22 ? 'grab_reach' : 'grab_hold_loop'
    case Locomotion.Grabbed:
      return 'grabbed_struggle_loop'
    case Locomotion.Climb:
      return t < 0.16 ? 'ledge_hang' : 'ledge_mantle'
    case Locomotion.Stumble:
      return stumbleSlot(state)
    case Locomotion.Ragdoll:
      return 'ragdoll_pose_blend'
    case Locomotion.GetUp:
      return state.getUpBack ? 'getup_back' : 'getup_front'
    case Locomotion.Emote:
      if (state.emoteId === 2) return 'emote_cheer'
      if (state.emoteId === 3) return 'emote_dance'
      return 'emote_wave'
    default:
      return 'idle_01'
  }
}

export function faceFor(locomotion: Locomotion): string {
  if (locomotion === Locomotion.Ragdoll || locomotion === Locomotion.GetUp) return 'face_dizzy'
  if (locomotion === Locomotion.Dive || locomotion === Locomotion.DiveSlide) return 'face_determined'
  if (locomotion === Locomotion.Grab || locomotion === Locomotion.Climb || locomotion === Locomotion.Grabbed) return 'face_effort'
  if (locomotion === Locomotion.Jump || locomotion === Locomotion.Fall) return 'face_surprised'
  return 'face_happy'
}

function stumbleSlot(state: ClipSampleState): string {
  const fx = Math.sin(state.yaw)
  const fz = Math.cos(state.yaw)
  const rx = Math.cos(state.yaw)
  const rz = -Math.sin(state.yaw)
  const forward = state.vx * fx + state.vz * fz
  const right = state.vx * rx + state.vz * rz
  if (Math.abs(right) > Math.abs(forward) + 0.2) return right > 0 ? 'stumble_R' : 'stumble_L'
  return forward >= 0 ? 'stumble_fwd' : 'stumble_back'
}

export function locomotionName(locomotion: Locomotion): string {
  switch (locomotion) {
    case Locomotion.Idle:
      return 'Standing'
    case Locomotion.Run:
      return 'Running'
    case Locomotion.Jump:
      return 'Jumping'
    case Locomotion.Fall:
      return 'Falling'
    case Locomotion.Dive:
      return 'Diving'
    case Locomotion.DiveSlide:
      return 'Sliding'
    case Locomotion.Recover:
      return 'Recovering'
    case Locomotion.Grab:
      return 'Grabbing'
    case Locomotion.Climb:
      return 'Climbing'
    case Locomotion.Grabbed:
      return 'Caught'
    case Locomotion.Stumble:
      return 'Whoa'
    case Locomotion.Ragdoll:
      return 'Tumbling'
    case Locomotion.GetUp:
      return 'Getting up'
    case Locomotion.Emote:
      return 'Cheering'
    default:
      return 'Standing'
  }
}
