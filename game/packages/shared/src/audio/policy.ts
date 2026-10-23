/**
 * Kid-safe mix numbers from docs/design/06-audio.md §4–§7.
 * Sliders, ducks, and the limiter all read this module. Do not copy the
 * numbers into the client.
 */

export const VOLUME = {
  /** Defaults, 0–100. Master 70, Music 60, SFX 80, UI 70. */
  master: 70,
  music: 60,
  sfx: 80,
  ui: 70,
  sliderMin: 0,
  sliderMax: 100,
  /** FR-08-09: a slider reaches its new level within this long. */
  sliderResponseSec: 0.1,
  headphonesTrimDb: -6,
  /** Master limiter ceiling, dBTP. */
  limiterThresholdDb: -1,
  limiterRatio: 20,
  limiterAttackSec: 0.003,
  limiterReleaseSec: 0.12,
  highpassHz: 30,
  /** No sub-bass hit louder than this at the source. */
  subBassMaxDb: -12,
  musicDuckDb: -6,
  musicDuckAttackSec: 0.02,
  musicDuckReleaseSec: 0.4,
  socialDuckDb: -4,
  qualifiedDuckDb: -9,
  spectateDuckDb: -6,
  settingsDuckDb: -6,
  errorDuckDb: -6,
  parentDuckDb: -12,
  ownBeanDb: 2,
  /** Unsolicited mix moves stay inside this window. The GO beat is the exception. */
  maxJumpLu: 6,
  jumpWindowSec: 0.4,
  fadeInSec: 2,
  restoreSec: 0.8,
  tellRolloffMin: 5,
  tellRolloffMax: 25,
  characterRolloffMin: 2,
  characterRolloffMax: 22,
  warningThrottleSec: 1.5,
  qualifyOtherThrottleSec: 0.5,
  lowpassQualifiedHz: 2000,
  lowpassOpenHz: 18000,
  /** Pulses stay under the 3 Hz photosensitivity cap. */
  cuePulseHz: 2,
  flashMaxHz: 3,
  ringMeters: 25,
  programmeTrimDb: -6,
} as const

export const VOICE_LIMITS = {
  total: 32,
  footsteps: 8,
  perObstacle: 4,
  social: 4,
  music: 6,
} as const

export const HAPTICS = {
  go: { durationMs: 90, strong: 0.45, weak: 0.25 },
  grab: { durationMs: 140, strong: 0.55, weak: 0.35 },
  qualified: { durationMs: 220, strong: 0.4, weak: 0.55 },
  /** Motion-comfort scale. */
  reduce: 0.4,
} as const

export type HapticId = keyof Omit<typeof HAPTICS, 'reduce'>

/** Perceptual slider. 0 is silence, 100 is unity, and the curve is a square. */
export function sliderGain(value: number): number {
  const unit = clamp(value, VOLUME.sliderMin, VOLUME.sliderMax) / 100
  if (unit <= 0) return 0
  return unit * unit
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20)
}

export function gainToDb(gain: number): number {
  if (gain <= 1e-6) return -120
  return 20 * Math.log10(gain)
}

/**
 * Ramp a user slider. The value is the target once `elapsed` reaches
 * `sliderResponseSec`, which is the FR-08-09 bound.
 */
export function sliderRamp(from: number, to: number, elapsed: number): number {
  if (elapsed >= VOLUME.sliderResponseSec) return to
  if (elapsed <= 0) return from
  const u = elapsed / VOLUME.sliderResponseSec
  return from + (to - from) * u
}

/**
 * Move a duck toward `target` (dB, zero or negative).
 * Tightening by 6 dB or less is immediate (sidechain attack is 20 ms, one frame).
 * A deeper duck spends that 6 dB immediately and slews the rest at 6 LU / 400 ms.
 * Release always slews, so a stinger does not pop the bed back up.
 * `fresh` is true on the frame the target changed.
 */
export function stepDuck(
  current: number,
  target: number,
  dt: number,
  fresh: boolean,
): { value: number; fresh: boolean } {
  if (Math.abs(target - current) < 0.001) return { value: target, fresh: false }
  const step = VOLUME.maxJumpLu * (dt / VOLUME.jumpWindowSec)
  if (target < current) {
    if (fresh) {
      const jumped = Math.max(target, current - VOLUME.maxJumpLu)
      if (jumped <= target + 0.001) return { value: target, fresh: false }
      return { value: Math.max(target, jumped - step), fresh: false }
    }
    return { value: Math.max(target, current - step), fresh: false }
  }
  return { value: Math.min(target, current + step), fresh: false }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
