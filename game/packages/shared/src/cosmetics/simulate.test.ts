import { describe, expect, it } from 'vitest'
import { ECONOMY } from './economy'
import { impliedShowXpPerWeek, simulateSeason, simulateSegment, SEGMENTS } from './simulate'

describe('economy simulation', () => {
  it('reaches the published tiers from the weekly XP table', () => {
    const [casual, regular, hardcore] = simulateSeason()
    expect(casual?.tiersByWeek).toEqual([9, 15, 21, 27, 33, 39, 45, 51])
    expect([casual?.tiersByWeek[1], casual?.tiersByWeek[3], casual?.tiersByWeek[5], casual?.tiersByWeek[7]]).toEqual([
      15, 27, 39, 51,
    ])
    expect(regular?.tiersByWeek[1]).toBe(27)
    expect(regular?.tiersByWeek[3]).toBe(50)
    expect(regular?.tier).toBe(70)
    expect(regular?.overflowGrants).toBe(13)
    expect(hardcore?.tiersByWeek[1]).toBe(47)
    expect(hardcore?.tier).toBe(70)
    expect(hardcore?.overflowGrants).toBe(20)
  })

  it('accounts show coins, dailies, path coins, and overflow separately', () => {
    const casual = simulateSegment(SEGMENTS[0]!)
    expect(casual.showCoins).toBe(2_500)
    expect(casual.showCoinsUncapped).toBe(2_500)
    expect(casual.dailyCoins).toBe(1_200)
    expect(casual.pathCoins).toBe(2_000)
    expect(casual.overflowCoins).toBe(0)
    expect(casual.coins).toBe(5_700)
    expect(casual.longerThanDefaultBreak).toBe(false)

    const regular = simulateSegment(SEGMENTS[1]!)
    expect(regular.showCoins).toBe(5_000)
    expect(regular.dailyCoins).toBe(3_000)
    expect(regular.pathCoins).toBe(2_900)
    expect(regular.overflowCoins).toBe(1_300)
    expect(regular.coins).toBe(12_200)
    expect(regular.longerThanDefaultBreak).toBe(true)

    const hardcore = simulateSegment(SEGMENTS[2]!)
    expect(hardcore.showCoinsUncapped).toBe(25_950)
    expect(hardcore.showCoins).toBe(18_940)
    expect(hardcore.dailyCoins).toBe(4_200)
    expect(hardcore.pathCoins).toBe(2_900)
    expect(hardcore.overflowCoins).toBe(2_000)
    expect(hardcore.coins).toBe(28_040)
    expect(hardcore.showCoins).toBeLessThan(hardcore.showCoinsUncapped)
    expect(hardcore.longerThanDefaultBreak).toBe(true)
  })

  it('derives show XP from the weekly total without adding challenges twice', () => {
    expect(impliedShowXpPerWeek(SEGMENTS[0]!)).toBe(6_000)
    expect(impliedShowXpPerWeek(SEGMENTS[1]!)).toBe(14_400)
    expect(impliedShowXpPerWeek(SEGMENTS[2]!)).toBe(58_800)
    expect(ECONOMY.coins.showBase).toBe(10)
    expect(ECONOMY.coins.perRound).toBe(5)
    expect(ECONOMY.coins.win).toBe(25)
  })
})
