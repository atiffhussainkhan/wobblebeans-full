import { Locomotion, type BeanState } from '../physics/types'

export interface BoneAngle {
  pitch: number
  yaw: number
  roll: number
}

export interface KeyBonePose {
  pelvis: BoneAngle
  spine02: BoneAngle
  head: BoneAngle
}

/**
 * Root plus three key bones (pelvis, spine_02, head).
 * Pure function of the replicated root, so both peers draw the same tumble
 * without extra snapshot bytes (doc 03 §3.1, doc 08 §3). Limbs stay local.
 */
export function keyBonePose(state: BeanState): KeyBonePose {
  const speed = Math.hypot(state.vx, state.vz)
  const tumble = state.locomotion === Locomotion.Ragdoll
  const getUp = state.locomotion === Locomotion.GetUp
  const t = state.stateTime
  if (tumble) {
    const spin = Math.sin(t * 7.5) * 0.9 + Math.min(1, speed / 8) * 0.4
    const back = state.getUpBack ? 1 : -1
    return {
      pelvis: { pitch: back * (1.15 + spin * 0.35), yaw: 0, roll: Math.sin(t * 5) * 0.45 },
      spine02: { pitch: -back * 0.35, yaw: 0, roll: Math.sin(t * 6.5) * 0.25 },
      head: { pitch: Math.sin(t * 9) * 0.4, yaw: Math.sin(t * 4) * 0.3, roll: Math.sin(t * 8) * 0.35 },
    }
  }
  if (getUp) {
    const u = clamp01(t / 0.9)
    const back = state.getUpBack ? 1 : -1
    return {
      pelvis: { pitch: back * (1.1 * (1 - u)), yaw: 0, roll: 0 },
      spine02: { pitch: back * -0.2 * (1 - u), yaw: 0, roll: 0 },
      head: { pitch: 0.2 * (1 - u), yaw: 0, roll: 0 },
    }
  }
  const lean = clamp(state.vx * -0.02, -0.2, 0.2)
  return {
    pelvis: { pitch: 0, yaw: 0, roll: lean },
    spine02: { pitch: clamp(-state.vz * 0.02, -0.15, 0.15), yaw: 0, roll: 0 },
    head: { pitch: state.locomotion === Locomotion.Dive ? 0.4 : 0, yaw: 0, roll: 0 },
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function clamp01(v: number): number {
  return clamp(v, 0, 1)
}
