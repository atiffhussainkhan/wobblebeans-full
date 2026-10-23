/**
 * Eight-week progression check from doc 07 §10.
 * Tier checkpoints use the published weekly XP totals.
 * Coins use the retuned rates, the free-path grants, and the show-coin soft cap.
 * The published coin totals are approximate; this model is the exact integer rule.
 */

import { ECONOMY, coinsAfterSoftCap, showRewards } from './economy'
import { overflowGrants, pathCoinsThrough, tierByNumber, tierForSeasonXp } from './season'

export interface SegmentSpec {
  id: 'casual' | 'regular' | 'hardcore'
  xpPerWeek: number
  weeks: number
  showsPerWeek: number
  playDaysPerWeek: number
  winsPerSeason: number
  dailiesPerWeek: number
  weekliesPerWeek: number
  restedXpPerWeek: number
  /** Rounds the bean starts. Coins pay 5 per started round. */
  roundsPerShow: number
  hoursPerPlayDay: number
  /** Doc 07 §10 retuned column. Approximate. */
  publishedCoins: number
}

export const SEGMENTS: readonly SegmentSpec[] = [
  {
    id: 'casual',
    xpPerWeek: 30_000,
    weeks: 8,
    showsPerWeek: 15,
    playDaysPerWeek: 3,
    winsPerSeason: 4,
    dailiesPerWeek: 6,
    weekliesPerWeek: 3,
    restedXpPerWeek: 3_000,
    roundsPerShow: 2,
    hoursPerPlayDay: 1,
    publishedCoins: 4_800,
  },
  {
    id: 'regular',
    xpPerWeek: 58_900,
    weeks: 8,
    showsPerWeek: 30,
    playDaysPerWeek: 5,
    winsPerSeason: 8,
    dailiesPerWeek: 15,
    weekliesPerWeek: 5,
    restedXpPerWeek: 2_000,
    roundsPerShow: 2,
    hoursPerPlayDay: 1.2,
    publishedCoins: 10_900,
  },
  {
    id: 'hardcore',
    xpPerWeek: 110_300,
    weeks: 8,
    showsPerWeek: 105,
    playDaysPerWeek: 7,
    winsPerSeason: 30,
    dailiesPerWeek: 21,
    weekliesPerWeek: 5,
    restedXpPerWeek: 0,
    roundsPerShow: 4,
    hoursPerPlayDay: 3,
    publishedCoins: 25_300,
  },
]

export interface SegmentResult {
  id: SegmentSpec['id']
  tiersByWeek: number[]
  tier: number
  overflowGrants: number
  coins: number
  showCoins: number
  showCoinsUncapped: number
  dailyCoins: number
  pathCoins: number
  overflowCoins: number
  longerThanDefaultBreak: boolean
  publishedCoins: number
}

/** Weekly XP in the table is show XP plus dailies, weeklies, and rested. */
export function impliedShowXpPerWeek(spec: SegmentSpec): number {
  return (
    spec.xpPerWeek -
    spec.dailiesPerWeek * ECONOMY.xp.dailyChallenge -
    spec.weekliesPerWeek * ECONOMY.xp.weeklyChallenge -
    spec.restedXpPerWeek
  )
}

function tierCoins(tier: number): number {
  const row = tierByNumber(tier)
  if (!row) return 0
  return row.rewards.filter((reward) => reward.type === 'coins').reduce((sum, reward) => sum + reward.qty, 0)
}

export function simulateSegment(spec: SegmentSpec): SegmentResult {
  let seasonXp = 0
  let tier = 0
  let pathCoins = 0
  let overflow = 0
  let overflowCoins = 0
  const tiersByWeek: number[] = []
  for (let week = 0; week < spec.weeks; week++) {
    seasonXp += spec.xpPerWeek
    const nextTier = tierForSeasonXp(seasonXp)
    while (tier < nextTier) {
      tier += 1
      pathCoins += tierCoins(tier)
    }
    const nextOverflow = overflowGrants(seasonXp)
    while (overflow < nextOverflow) {
      overflow += 1
      overflowCoins += ECONOMY.coins.overflowStep
    }
    tiersByWeek.push(tier)
  }

  const shows = spec.showsPerWeek * spec.weeks
  const showsPerDay = spec.showsPerWeek / spec.playDaysPerWeek
  const days = spec.playDaysPerWeek * spec.weeks
  const winEvery = Math.max(1, Math.floor(shows / Math.max(1, spec.winsPerSeason)))
  let showCoins = 0
  let showCoinsUncapped = 0
  let winsGranted = 0
  let showIndex = 0
  for (let day = 0; day < days; day++) {
    let rawToday = 0
    for (let slot = 0; slot < showsPerDay; slot++) {
      const win = winsGranted < spec.winsPerSeason && showIndex % winEvery === 0
      if (win) winsGranted += 1
      const raw = showRewards({
        roundsPlayed: spec.roundsPerShow,
        qualifiedRounds: 0,
        wonFinal: win,
        quit: false,
      }).coinRaw
      showCoins += coinsAfterSoftCap(rawToday, raw)
      showCoinsUncapped += raw
      rawToday += raw
      showIndex += 1
    }
  }

  const dailyCoins = spec.dailiesPerWeek * spec.weeks * ECONOMY.coins.dailyChallenge
  return {
    id: spec.id,
    tiersByWeek,
    tier,
    overflowGrants: overflow,
    coins: showCoins + dailyCoins + pathCoins + overflowCoins,
    showCoins,
    showCoinsUncapped,
    dailyCoins,
    pathCoins,
    overflowCoins,
    longerThanDefaultBreak: spec.hoursPerPlayDay * 60 > ECONOMY.wellbeing.breakDefaultMin,
    publishedCoins: spec.publishedCoins,
  }
}

export function simulateSeason(): SegmentResult[] {
  return SEGMENTS.map((spec) => simulateSegment(spec))
}

export function pathCoinsAtPublishedTier(spec: SegmentSpec): number {
  const tier = tierForSeasonXp(spec.xpPerWeek * spec.weeks)
  return pathCoinsThrough(tier)
}
