/**
 * Free 8-week Season Path. 70 tiers, no second track.
 * T1–T10 ramp 1,500 → 5,000 (cumulative 32,500). T11–T70 cost 5,000
 * (cumulative 332,500). Rewards are granted when the tier is earned.
 */

import { ECONOMY } from './economy'

export const SEASON = {
  id: 'S1',
  weeks: ECONOMY.season.weeks,
  tiers: ECONOMY.season.tiers,
  premiumTrack: false,
  startsUtc: '2026-10-26T10:00:00.000Z',
  endsUtc: '2026-12-21T10:00:00.000Z',
  /** Static help date. Not a countdown. */
  helpDate: '21 December 2026',
  wardrobeCopy: 'Your Season Path rewards are in your wardrobe!',
} as const

export type RewardType = 'item' | 'coins'

export interface SeasonReward {
  type: RewardType
  ref: string
  qty: number
  slot?: CosmeticSlotName
  name?: string
}

export type CosmeticSlotName =
  | 'upper'
  | 'lower'
  | 'colour'
  | 'pattern'
  | 'faceplate'
  | 'emote'
  | 'celebration'
  | 'banner'
  | 'title'

export interface SeasonTier {
  seasonId: string
  tier: number
  xpToNext: number
  cumXp: number
  rewards: SeasonReward[]
  isBig: boolean
}

const BIG: Record<number, SeasonReward[]> = {
  5: [{ type: 'item', ref: 'emote_season_1', qty: 1, slot: 'emote', name: 'Wiggle' }],
  10: [{ type: 'item', ref: 'top_choc_01', qty: 1, slot: 'upper', name: 'Cocoa top' }],
  15: [{ type: 'item', ref: 'bottom_choc_01', qty: 1, slot: 'lower', name: 'Cocoa shorts' }],
  20: [{ type: 'coins', ref: 'coins', qty: ECONOMY.coins.tierBig }],
  25: [{ type: 'item', ref: 'celebration_season_1', qty: 1, slot: 'celebration', name: 'Confetti hop' }],
  30: [{ type: 'item', ref: 'top_season_b', qty: 1, slot: 'upper', name: 'Mint top' }],
  35: [{ type: 'item', ref: 'emote_season_2', qty: 1, slot: 'emote', name: 'Sparkle' }],
  40: [{ type: 'item', ref: 'bottom_season_b', qty: 1, slot: 'lower', name: 'Mint shorts' }],
  45: [{ type: 'coins', ref: 'coins', qty: ECONOMY.coins.tierBig }],
  50: [{ type: 'item', ref: 'banner_season_anim', qty: 1, slot: 'banner', name: 'Sun crest' }],
  55: [{ type: 'item', ref: 'title_season_mid', qty: 1, slot: 'title', name: 'Show Pal' }],
  60: [{ type: 'item', ref: 'face_season_set', qty: 1, slot: 'faceplate', name: 'Star eyes' }],
  65: [{ type: 'item', ref: 'banner_season_65', qty: 1, slot: 'banner', name: 'Night ribbon' }],
  70: [
    { type: 'coins', ref: 'coins', qty: ECONOMY.coins.tierBig },
    { type: 'item', ref: 'title_season_final', qty: 1, slot: 'title', name: 'Season Star' },
  ],
}

const EARLY_CYCLE: Array<{ slot: CosmeticSlotName; name: string } | 'coins'> = [
  { slot: 'colour', name: 'Path wash' },
  { slot: 'pattern', name: 'Path pattern' },
  { slot: 'banner', name: 'Path banner' },
  'coins',
]

const LATER_CYCLE: Array<{ slot: CosmeticSlotName; name: string } | 'coins'> = [
  { slot: 'title', name: 'Path title' },
  { slot: 'faceplate', name: 'Path face' },
  'coins',
  { slot: 'pattern', name: 'Path pattern' },
]

export function tierXpCost(tier: number): number {
  if (tier < 1 || tier > ECONOMY.season.tiers) throw new Error(`tier out of range: ${tier}`)
  if (tier <= 10) {
    return Math.round(ECONOMY.season.rampFirst + (tier - 1) * (ECONOMY.season.rampLast - ECONOMY.season.rampFirst) / ECONOMY.season.rampSteps)
  }
  return ECONOMY.season.flatTierXp
}

function smallReward(tier: number, index: number, early: boolean): SeasonReward {
  const cycle = early ? EARLY_CYCLE : LATER_CYCLE
  const pick = cycle[index % cycle.length]
  if (pick === 'coins' || pick == null) {
    return { type: 'coins', ref: 'coins', qty: ECONOMY.coins.tierSmall }
  }
  return {
    type: 'item',
    ref: `${pick.slot}_s1_t${tier}`,
    qty: 1,
    slot: pick.slot,
    name: `${pick.name} ${tier}`,
  }
}

export function buildSeasonTiers(): SeasonTier[] {
  const tiers: SeasonTier[] = []
  let cum = 0
  let earlyIndex = 0
  let laterIndex = 0
  for (let tier = 1; tier <= ECONOMY.season.tiers; tier++) {
    const xpToNext = tierXpCost(tier)
    cum += xpToNext
    const isBig = tier % 5 === 0
    let rewards: SeasonReward[]
    if (isBig) {
      rewards = BIG[tier] ?? []
    } else if (tier <= 10) {
      rewards = [smallReward(tier, earlyIndex, true)]
      earlyIndex += 1
    } else {
      rewards = [smallReward(tier, laterIndex, false)]
      laterIndex += 1
    }
    tiers.push({ seasonId: SEASON.id, tier, xpToNext, cumXp: cum, rewards, isBig })
  }
  return tiers
}

export const SEASON_TIERS: readonly SeasonTier[] = buildSeasonTiers()

const TIER_BY_NUMBER = new Map(SEASON_TIERS.map((tier) => [tier.tier, tier]))

export function tierByNumber(tier: number): SeasonTier | undefined {
  return TIER_BY_NUMBER.get(tier)
}

export function tierForSeasonXp(seasonXp: number): number {
  const xp = Number.isFinite(seasonXp) ? Math.max(0, Math.floor(seasonXp)) : 0
  let reached = 0
  for (const tier of SEASON_TIERS) {
    if (xp < tier.cumXp) break
    reached = tier.tier
  }
  return reached
}

export function cumulativeXp(tier: number): number {
  if (tier <= 0) return 0
  return tierByNumber(Math.min(tier, ECONOMY.season.tiers))?.cumXp ?? 0
}

export function xpToNextReward(seasonXp: number): number {
  const xp = Math.max(0, Math.floor(seasonXp))
  const tier = tierForSeasonXp(xp)
  if (tier >= ECONOMY.season.tiers) {
    const overflow = overflowGrants(xp)
    if (overflow >= ECONOMY.coins.overflowMax) return 0
    const into = xp - ECONOMY.season.cumTier70
    return ECONOMY.coins.overflowXp - (into % ECONOMY.coins.overflowXp)
  }
  const next = tierByNumber(tier + 1)
  return next ? next.cumXp - xp : 0
}

export function overflowGrants(seasonXp: number): number {
  const xp = Math.max(0, Math.floor(seasonXp))
  if (xp <= ECONOMY.season.cumTier70) return 0
  const steps = Math.floor((xp - ECONOMY.season.cumTier70) / ECONOMY.coins.overflowXp)
  return Math.min(ECONOMY.coins.overflowMax, steps)
}

export function pathCoinsThrough(tier: number): number {
  let coins = 0
  for (const row of SEASON_TIERS) {
    if (row.tier > tier) break
    for (const reward of row.rewards) {
      if (reward.type === 'coins') coins += reward.qty
    }
  }
  return coins
}

export function playtimeSentence(seasonXp: number, xpPerHour = ECONOMY.estimateXpPerHour): string {
  const remaining = xpToNextReward(seasonXp)
  if (remaining <= 0) return 'You finished this Season Path.'
  const hours = remaining / xpPerHour
  if (hours < 1.25) return 'About 1 hour of play to the next reward.'
  const rounded = Math.max(2, Math.round(hours))
  return `About ${rounded} hours of play to the next reward.`
}

export function seasonStatus(seasonXp: number): { headline: string; playtime: string } {
  const tier = tierForSeasonXp(seasonXp)
  if (tier >= ECONOMY.season.tiers && overflowGrants(seasonXp) >= ECONOMY.coins.overflowMax) {
    return {
      headline: 'You finished this Season Path.',
      playtime: SEASON.wardrobeCopy,
    }
  }
  if (tier >= ECONOMY.season.tiers) {
    return {
      headline: 'You finished the Season Path rewards.',
      playtime: playtimeSentence(seasonXp),
    }
  }
  return {
    headline: tier === 0 ? 'Season Path' : `Season Path reward ${tier} is in your wardrobe.`,
    playtime: playtimeSentence(seasonXp),
  }
}

export function shopWeekStart(now: Date): Date {
  const origin = Date.parse(SEASON.startsUtc)
  const week = 7 * 86_400_000
  const index = Math.floor((now.getTime() - origin) / week)
  return new Date(origin + index * week)
}

export function shopWeekIndex(now: Date): number {
  const origin = Date.parse(SEASON.startsUtc)
  const week = 7 * 86_400_000
  return Math.floor((now.getTime() - origin) / week)
}

export function weeklyPeriodKey(now: Date): string {
  return shopWeekStart(now).toISOString()
}
