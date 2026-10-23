import { describe, expect, it } from 'vitest'
import { HAPTICS, VOLUME, VOICE_LIMITS, dbToGain, gainToDb, sliderGain, sliderRamp, stepDuck } from './policy'

describe('kid-safe volume policy', () => {
  it('uses the design defaults and the voice caps', () => {
    expect(VOLUME.master).toBe(70)
    expect(VOLUME.music).toBe(60)
    expect(VOLUME.sfx).toBe(80)
    expect(VOLUME.ui).toBe(70)
    expect(VOLUME.headphonesTrimDb).toBe(-6)
    expect(VOLUME.limiterThresholdDb).toBe(-1)
    expect(VOLUME.highpassHz).toBe(30)
    expect(VOLUME.musicDuckDb).toBe(-6)
    expect(VOLUME.socialDuckDb).toBe(-4)
    expect(VOLUME.qualifiedDuckDb).toBe(-9)
    expect(VOICE_LIMITS.total).toBe(32)
    expect(VOICE_LIMITS.footsteps).toBe(8)
    expect(VOICE_LIMITS.perObstacle).toBe(4)
    expect(VOICE_LIMITS.social).toBe(4)
    expect(HAPTICS.go.durationMs).toBeGreaterThan(0)
  })

  it('mutes at 0, is unity at 100, and gets louder as the slider rises', () => {
    expect(sliderGain(0)).toBe(0)
    expect(sliderGain(100)).toBe(1)
    expect(sliderGain(70)).toBeGreaterThan(sliderGain(60))
    expect(sliderGain(60)).toBeGreaterThan(sliderGain(0))
    expect(sliderGain(70)).toBeCloseTo(0.49, 5)
  })

  it('reaches a new slider level by 100 ms', () => {
    expect(sliderRamp(0, 1, 0)).toBe(0)
    expect(sliderRamp(0, 1, VOLUME.sliderResponseSec)).toBe(1)
    expect(sliderRamp(0, 1, 0.05)).toBeCloseTo(0.5, 5)
    expect(sliderRamp(1, 0, VOLUME.sliderResponseSec)).toBe(0)
  })

  it('lets a 6 dB duck land immediately and slews anything deeper', () => {
    const sidechain = stepDuck(0, VOLUME.musicDuckDb, 0.016, true)
    expect(sidechain.value).toBe(-6)
    expect(sidechain.fresh).toBe(false)

    const first = stepDuck(0, VOLUME.qualifiedDuckDb, 0.016, true)
    expect(first.value).toBeGreaterThan(-9)
    expect(first.value).toBeLessThanOrEqual(-6)
    let value = first.value
    let fresh = first.fresh
    for (let i = 0; i < 40; i++) {
      const next = stepDuck(value, VOLUME.qualifiedDuckDb, 0.016, fresh)
      const jump = Math.abs(next.value - value)
      expect(jump).toBeLessThanOrEqual(VOLUME.maxJumpLu + 0.001)
      value = next.value
      fresh = next.fresh
    }
    expect(value).toBeCloseTo(-9, 1)

    let released = -6
    fresh = true
    for (let i = 0; i < 5; i++) {
      const next = stepDuck(released, 0, 0.016, fresh)
      expect(next.value - released).toBeLessThanOrEqual(VOLUME.maxJumpLu)
      released = next.value
      fresh = false
    }
    expect(released).toBeLessThan(0)
    expect(released).toBeGreaterThan(-6)
  })

  it('converts dB without inventing a boost above unity for the trims', () => {
    expect(dbToGain(0)).toBeCloseTo(1, 5)
    expect(dbToGain(-6)).toBeCloseTo(0.5012, 3)
    expect(gainToDb(dbToGain(-12))).toBeCloseTo(-12, 4)
    expect(dbToGain(VOLUME.ownBeanDb)).toBeGreaterThan(1)
    expect(dbToGain(VOLUME.ownBeanDb)).toBeLessThan(1.3)
  })
})
