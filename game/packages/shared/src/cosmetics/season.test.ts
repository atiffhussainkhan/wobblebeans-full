import { describe, expect, it } from 'vitest'
import {
  SEASON,
  SEASON_TIERS,
  cumulativeXp,
  overflowGrants,
  pathCoinsThrough,
  playtimeSentence,
  seasonStatus,
  shopWeekIndex,
  tierForSeasonXp,
  tierXpCost,
} from './season'
import { ECONOMY } from './economy'

describe('season path', () => {
  it('ramps the first ten tiers to 32500 and the full path to 332500', () => {
    const ramp = Array.from({ length: 10 }, (_, index) => tierXpCost(index + 1))
    expect(ramp.reduce((sum, cost) => sum + cost, 0)).toBe(ECONOMY.season.cumTier10)
    expect(cumulativeXp(10)).toBe(32_500)
    expect(cumulativeXp(70)).toBe(ECONOMY.season.cumTier70)
    expect(SEASON_TIERS).toHaveLength(70)
    expect(SEASON.premiumTrack).toBe(false)
  })

  it('grants a free track with costume halves by tier 40 and fourteen small coin tiers', () => {
    const coins = SEASON_TIERS.flatMap((tier) => tier.rewards.filter((reward) => reward.type === 'coins'))
    expect(coins.filter((reward) => reward.qty === 500)).toHaveLength(3)
    expect(coins.filter((reward) => reward.qty === 100).map((reward) => reward.qty)).toHaveLength(14)
    const halves = SEASON_TIERS.filter((tier) =>
      tier.rewards.some((reward) => reward.slot === 'upper' || reward.slot === 'lower'),
    )
    expect(halves.length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...halves.map((tier) => tier.tier))).toBeLessThanOrEqual(40)
    const refs = SEASON_TIERS.flatMap((tier) => tier.rewards.map((reward) => reward.ref))
    expect(refs.filter((ref) => ref.startsWith('emote_season_'))).toHaveLength(2)
    expect(refs.filter((ref) => ref.startsWith('celebration_'))).toHaveLength(1)
    expect(refs.filter((ref) => ref.startsWith('banner_')).length).toBeGreaterThanOrEqual(2)
    expect(refs.filter((ref) => ref.startsWith('title_')).length).toBeGreaterThanOrEqual(2)
    expect(pathCoinsThrough(51)).toBe(2_000)
    expect(pathCoinsThrough(70)).toBe(2_900)
    expect(SEASON_TIERS.some((tier) => tier.rewards.some((reward) => reward.ref.includes('premium')))).toBe(false)
  })

  it('hits the published weekly checkpoints', () => {
    expect([2, 4, 6, 8].map((week) => tierForSeasonXp(30_000 * week))).toEqual([15, 27, 39, 51])
    expect(tierForSeasonXp(58_900 * 2)).toBe(27)
    expect(tierForSeasonXp(58_900 * 4)).toBe(50)
    expect(tierForSeasonXp(58_900 * 6)).toBe(70)
    expect(overflowGrants(58_900 * 8)).toBe(13)
    expect(tierForSeasonXp(110_300 * 2)).toBe(47)
    expect(tierForSeasonXp(110_300 * 4)).toBe(70)
    expect(overflowGrants(110_300 * 8)).toBe(20)
  })

  it('opens on a Monday at 10:00 and describes playtime without a countdown', () => {
    const start = new Date(SEASON.startsUtc)
    expect(start.getUTCDay()).toBe(1)
    expect(start.getUTCHours()).toBe(10)
    expect(SEASON.helpDate).toBe('21 December 2026')
    expect(shopWeekIndex(new Date('2026-11-02T09:59:00.000Z'))).toBe(0)
    expect(shopWeekIndex(new Date('2026-11-02T10:00:00.000Z'))).toBe(1)
    expect(playtimeSentence(0)).toBe('About 1 hour of play to the next reward.')
    expect(seasonStatus(ECONOMY.season.cumTier70 + ECONOMY.coins.overflowXp * ECONOMY.coins.overflowMax).headline).toBe(
      'You finished this Season Path.',
    )
    expect(JSON.stringify(seasonStatus(0))).not.toMatch(/ends in|countdown|streak|hurry/i)
  })
})
