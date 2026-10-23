import { describe, expect, it } from 'vitest'
import { distanceGain, ringAngle, type ListenerPose } from './cues'

const listener: ListenerPose = { x: 0, y: 1, z: 0, fx: 0, fy: 0, fz: 1 }

describe('sound ring', () => {
  it('points at off-screen sources and ignores ones that are ahead, close, or too far', () => {
    const right = ringAngle(listener, { x: 10, y: 1, z: 0 }, 25)
    expect(right).not.toBeNull()
    expect(right!).toBeGreaterThan(0.55)
    expect(ringAngle(listener, { x: 0, y: 1, z: 10 }, 25)).toBeNull()
    expect(ringAngle(listener, { x: 0.2, y: 1, z: 0.2 }, 25)).toBeNull()
    expect(ringAngle(listener, { x: 0, y: 1, z: 40 }, 25)).toBeNull()
    expect(ringAngle(null, { x: 10, y: 1, z: 0 }, 25)).toBeNull()
  })

  it('uses linear rolloff', () => {
    expect(distanceGain(2, 5, 25)).toBe(1)
    expect(distanceGain(25, 5, 25)).toBe(0)
    expect(distanceGain(15, 5, 25)).toBeCloseTo(0.5, 5)
  })
})
