import { HAPTICS, type HapticId } from '@wobblebeans/shared'

export interface HapticPulse {
  id: HapticId
  durationMs: number
  strong: number
  weak: number
}

export type HapticMode = 'full' | 'reduced' | 'off'

/** GO, grab, and qualified. Motion comfort and the reduced setting scale them down. */
export function resolveHaptic(id: HapticId | null, mode: HapticMode, motionComfort: boolean): HapticPulse | null {
  if (!id || mode === 'off') return null
  const src = HAPTICS[id]
  const scale = mode === 'reduced' || motionComfort ? HAPTICS.reduce : 1
  return {
    id,
    durationMs: src.durationMs,
    strong: round3(src.strong * scale),
    weak: round3(src.weak * scale),
  }
}

export function fireHaptic(pulse: HapticPulse | null): void {
  if (!pulse || typeof navigator === 'undefined') return
  const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
  for (const pad of pads) {
    if (!pad) continue
    const actuator = pad.vibrationActuator
    if (actuator && typeof actuator.playEffect === 'function') {
      void actuator.playEffect('dual-rumble', {
        duration: pulse.durationMs,
        startDelay: 0,
        strongMagnitude: pulse.strong,
        weakMagnitude: pulse.weak,
      })
    }
  }
  if (typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pulse.durationMs)
    } catch {
      /* some browsers throw if vibration is blocked */
    }
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}
