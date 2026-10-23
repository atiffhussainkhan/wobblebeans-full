import { describe, expect, it } from 'vitest'
import { PHYSICS, SAFETY } from '../index'
import {
  ECONOMY,
  ECONOMY_RANGES,
  accrueRested,
  applyRested,
  clampBreakMinutes,
  coinsAfterSoftCap,
  fullUtcDaysBetween,
  levelForXp,
  normalizeShowFacts,
  shiftedUtcDate,
  showEndWellbeing,
  showRewards,
} from './economy'

describe('show rewards', () => {
  it('pays participation and one qualified round, and ignores a client total', () => {
    const rewards = showRewards({ qualifiedRounds: 1, xpEarned: 99999 } as never)
    expect(rewards.xpTotal).toBe(250)
    expect(rewards.coinRaw).toBe(15)
    expect(rewards.participationXp).toBe(ECONOMY.xp.participation)
    expect(rewards.lines.every((line) => !/lose|lost|fail|dead/i.test(line.text))).toBe(true)
  })

  it('keeps round rewards when a player quits and drops only the show grants', () => {
    const rewards = showRewards({ qualifiedRounds: 2, roundsPlayed: 2, quit: true })
    expect(rewards.xpTotal).toBe(300)
    expect(rewards.coinRaw).toBe(10)
    expect(rewards.participationXp).toBe(0)
    expect(rewards.medals.map((medal) => medal.label)).toEqual(['Round 1', 'Round 2'])
  })

  it('pays nothing for practice and private shows', () => {
    expect(showRewards({ showKind: 'practice', qualifiedRounds: 5, wonFinal: true }).xpTotal).toBe(0)
    expect(showRewards({ showKind: 'private', roundsPlayed: 4 }).coinRaw).toBe(0)
    expect(showRewards({ practice: true, qualifiedRounds: 3 }).coinRaw).toBe(0)
  })

  it('adds final, trophy, and team lines without a place above 10', () => {
    const rewards = showRewards({
      qualifiedRounds: 1,
      roundsPlayed: 1,
      wonFinal: true,
      teamRoundWins: 2,
      finalPlacement: 32,
    })
    expect(rewards.xpTotal).toBe(100 + 150 + 200 + 500 + 100)
    expect(rewards.coinRaw).toBe(10 + 5 + 25)
    expect(rewards.placement).toBeNull()
    expect(rewards.medals.some((medal) => medal.kind === 'trophy' && medal.art === 'ui/trophy.png')).toBe(true)
    expect(rewards.medals.some((medal) => medal.kind === 'finalist')).toBe(true)
    const placed = showRewards({ reachedFinal: true, finalPlacement: 3, roundsPlayed: 1 })
    expect(placed.placement).toBe(3)
  })

  it('doubles show XP from the rested bank and caps the bank at 3000', () => {
    expect(accrueRested(0, '2026-10-23T12:00:00.000Z', new Date('2026-10-26T08:00:00.000Z'))).toBe(3000)
    expect(accrueRested(0, '2026-10-01T00:00:00.000Z', new Date('2026-10-20T00:00:00.000Z'))).toBe(3000)
    expect(fullUtcDaysBetween('2026-10-26T01:00:00.000Z', new Date('2026-10-26T23:00:00.000Z'))).toBe(0)
    const doubled = showRewards({ qualifiedRounds: 1 }, 3000)
    expect(doubled.xpTotal).toBe(500)
    expect(doubled.restedBonus).toBe(250)
    expect(applyRested(250, 3000)).toEqual({ xp: 500, bank: 2750, bonus: 250 })
  })
})

describe('levels, coins, and breaks', () => {
  it('levels from lifetime XP and stops cosmetic steps at the published cap', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(100_000)).toBe(5)
    expect(levelForXp(ECONOMY.xp.levelXp * ECONOMY.levelRewardCap)).toBe(ECONOMY.levelRewardCap + 1)
  })

  it('pays the first 300 show coins in full and floors the rest per grant', () => {
    expect(coinsAfterSoftCap(290, 20)).toBe(12)
    expect(coinsAfterSoftCap(300, 20)).toBe(5)
    expect(coinsAfterSoftCap(0, 20)).toBe(20)
    expect(coinsAfterSoftCap(0, 0)).toBe(0)
  })

  it('rolls the show-coin day at 10:00 UTC', () => {
    expect(shiftedUtcDate(new Date('2026-10-26T09:59:00.000Z'))).toBe('2026-10-25')
    expect(shiftedUtcDate(new Date('2026-10-26T10:00:00.000Z'))).toBe('2026-10-26')
  })

  it('shows one stretch message and never a second play button', () => {
    expect(showEndWellbeing({
      continuousPlayMinutes: 60,
      breakMinutes: 60,
      breakEnabled: true,
      dailyLimitMinutes: null,
      playedTodayMinutes: 0,
    }).message).toBe('Time for a stretch break!')
    expect(showEndWellbeing({
      continuousPlayMinutes: 59,
      breakMinutes: 60,
      breakEnabled: true,
      dailyLimitMinutes: null,
      playedTodayMinutes: 0,
    }).message).toBeNull()
    expect(showEndWellbeing({
      continuousPlayMinutes: 200,
      breakMinutes: 60,
      breakEnabled: false,
      dailyLimitMinutes: null,
      playedTodayMinutes: 0,
    }).showBreak).toBe(false)
    const limited = showEndWellbeing({
      continuousPlayMinutes: 10,
      breakMinutes: 60,
      breakEnabled: true,
      dailyLimitMinutes: 60,
      playedTodayMinutes: 60,
    })
    expect(limited.message).toBe("That's all the play time for today. Your rewards are saved.")
    expect(limited.okLabel).toBe('OK')
    expect(clampBreakMinutes(10)).toBe(30)
    expect(clampBreakMinutes(500)).toBe(120)
  })

  it('keeps the published defaults inside their ranges and leaves safety switches off', () => {
    expect(ECONOMY.xp.participation).toBeGreaterThanOrEqual(ECONOMY_RANGES.participationXp[0])
    expect(ECONOMY.xp.participation).toBeLessThanOrEqual(ECONOMY_RANGES.participationXp[1])
    expect(ECONOMY.coins.showSoftCap).toBeGreaterThanOrEqual(ECONOMY_RANGES.showSoftCap[0])
    expect(SAFETY.lootBoxes).toBe(false)
    expect(SAFETY.premiumCurrency).toBe(false)
    expect(SAFETY.realMoneyInMvp).toBe(false)
    expect(PHYSICS.capsuleRadius).toBe(0.5)
    expect(PHYSICS.capsuleHalfHeight).toBe(0.3)
    const facts = normalizeShowFacts({ roundsPlayed: 9, qualifiedRounds: 9, finalPlacement: 0 })
    expect(facts.roundsPlayed).toBe(5)
    expect(facts.finalPlacement).toBeNull()
  })
})
