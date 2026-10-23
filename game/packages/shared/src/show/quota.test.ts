import { describe, expect, it } from 'vitest'
import { mainShowQuotaPath, qualifyQuota, roundHalfDown } from './quota'

describe('qualify quota', () => {
  it('rounds half down and clamps between 1 and N - 1', () => {
    expect(roundHalfDown(22.4)).toBe(22)
    expect(roundHalfDown(13.2)).toBe(13)
    expect(roundHalfDown(7.8)).toBe(8)
    expect(roundHalfDown(10.5)).toBe(10)
    expect(roundHalfDown(2.5)).toBe(2)
    expect(qualifyQuota(32, 0.7)).toBe(22)
    expect(qualifyQuota(22, 0.6)).toBe(13)
    expect(qualifyQuota(13, 0.6)).toBe(8)
    expect(qualifyQuota(4, 0.5)).toBe(2)
    expect(qualifyQuota(4, 0.7)).toBe(3)
    expect(qualifyQuota(2, 0.1)).toBe(1)
    expect(qualifyQuota(8, 0.99)).toBe(7)
    expect(mainShowQuotaPath(32)).toEqual([22, 13, 8])
  })
})
