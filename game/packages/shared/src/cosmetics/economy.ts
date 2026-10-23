/**
 * Progression numbers from docs/design/07-progression-rewards.md.
 * Coin rates are the retuned ones (10 + 5 per round + 25 for a win).
 * Other packages import these. Do not copy them into a second file.
 */

export const ECONOMY = {
  xp: {
    participation: 100,
    perQualifiedRound: 150,
    reachedFinal: 200,
    win: 500,
    teamRoundWin: 50,
    restedPerFullUtcDay: 1000,
    restedCap: 3000,
    dailyChallenge: 1500,
    weeklyChallenge: 4000,
    seasonChallenge: 10000,
    levelXp: 25000,
  },
  coins: {
    showBase: 10,
    perRound: 5,
    win: 25,
    dailyChallenge: 25,
    /** Show-coin soft cap. Further show coins pay at `showSoftRate`. */
    showSoftCap: 300,
    showSoftRate: 0.25,
    tierSmall: 100,
    tierBig: 500,
    overflowStep: 100,
    overflowXp: 10000,
    overflowMax: 20,
  },
  season: {
    weeks: 8,
    tiers: 70,
    rampFirst: 1500,
    rampLast: 5000,
    rampSteps: 9,
    flatTierXp: 5000,
    cumTier10: 32500,
    cumTier70: 332500,
  },
  shop: {
    undoHours: 24,
    rotationItems: 12,
    rotationSets: 2,
    returnWithinWeeks: 12,
    commonFullCostume: 2000,
    specialFullCostume: 5000,
  },
  challenges: {
    dailySlots: 3,
    weeklySlots: 5,
    seasonStages: 5,
    dailyBankDays: 7,
    bankedDailySlots: 21,
    swapsPerDay: 1,
    textMaxChars: 40,
  },
  wellbeing: {
    breakDefaultMin: 60,
    breakMin: 30,
    breakMax: 120,
    sessionReviewMinutes: 120,
  },
  /** Pace used only to estimate playtime. Not a streak and not a booster. */
  estimateXpPerHour: 2400,
  maxRoundsInShow: 5,
  /** Finals hold at most 10 beans, so a place number above this is dropped. */
  maxFinalPlacement: 10,
  /** Level cosmetics are generated through this level. The badge number is not capped. */
  levelRewardCap: 400,
} as const

/** Defaults sit inside the ranges published in doc 07 §1. */
export const ECONOMY_RANGES = {
  participationXp: [50, 150],
  qualifiedRoundXp: [100, 250],
  finalXp: [100, 300],
  winXp: [300, 800],
  teamXp: [0, 100],
  restedPerDay: [0, 1500],
  flatTierXp: [4000, 6500],
  dailyChallengeCoins: [25, 50],
  showSoftCap: [200, 600],
} as const

export const DAILY_REFRESH_HOUR_UTC = 10

export type ShowKind = 'main' | 'practice' | 'private'

export interface ShowFactsInput {
  qualifiedRounds?: number
  roundsPlayed?: number
  reachedFinal?: boolean
  wonFinal?: boolean
  quit?: boolean
  teamRoundWins?: number
  teamRoundsPlayed?: number
  racesFinished?: number
  showKind?: ShowKind
  finalPlacement?: number | null
}

export interface ShowFacts {
  practice: boolean
  quit: boolean
  qualifiedRounds: number
  roundsPlayed: number
  reachedFinal: boolean
  wonFinal: boolean
  teamRoundWins: number
  teamRoundsPlayed: number
  racesFinished: number
  finalPlacement: number | null
}

export interface RewardLine {
  code: number
  kind: 'xp' | 'coins'
  text: string
  amount: number
}

export interface ShowMedal {
  kind: 'round' | 'finalist' | 'trophy'
  round: number | null
  label: string
  art: string
}

export interface ShowRewards {
  xpTotal: number
  /** Show coins before the daily soft cap. */
  coinRaw: number
  participationXp: number
  restedBonus: number
  lines: RewardLine[]
  medals: ShowMedal[]
  placement: number | null
}

export const RewardCode = {
  ParticipationXp: 1,
  QualifiedRoundXp: 2,
  FinalXp: 3,
  WinXp: 4,
  TeamXp: 5,
  RestedXp: 6,
  ShowCoin: 7,
  RoundCoin: 8,
  WinCoin: 9,
} as const

const ROUND_ART = [
  'ui/flat_medal1.png',
  'ui/flat_medal2.png',
  'ui/flat_medal3.png',
  'ui/flat_medal4.png',
] as const

function clampInt(value: number | undefined, fallback: number, max: number): number {
  if (value == null || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(max, Math.floor(value)))
}

export function normalizeShowFacts(input: ShowFactsInput): ShowFacts {
  const showKind = input.showKind ?? 'main'
  const practice = showKind === 'practice' || showKind === 'private'
  const quit = input.quit === true
  const qualifiedRounds = clampInt(input.qualifiedRounds, 0, ECONOMY.maxRoundsInShow)
  const roundsPlayed = clampInt(
    input.roundsPlayed,
    qualifiedRounds,
    ECONOMY.maxRoundsInShow,
  )
  const wonFinal = input.wonFinal === true
  const reachedFinal = input.reachedFinal === true || wonFinal
  const teamRoundWins = clampInt(input.teamRoundWins, 0, ECONOMY.maxRoundsInShow)
  const teamRoundsPlayed = clampInt(
    input.teamRoundsPlayed,
    teamRoundWins,
    ECONOMY.maxRoundsInShow,
  )
  let finalPlacement: number | null = null
  if (
    reachedFinal &&
    input.finalPlacement != null &&
    Number.isFinite(input.finalPlacement) &&
    input.finalPlacement >= 1 &&
    input.finalPlacement <= ECONOMY.maxFinalPlacement
  ) {
    finalPlacement = Math.floor(input.finalPlacement)
  }
  return {
    practice,
    quit,
    qualifiedRounds,
    roundsPlayed,
    reachedFinal,
    wonFinal,
    teamRoundWins,
    teamRoundsPlayed,
    racesFinished: clampInt(input.racesFinished, 0, ECONOMY.maxRoundsInShow),
    finalPlacement,
  }
}

/**
 * Itemised XP and coins for one show.
 * Quit keeps round XP and per-round coins already earned, and drops the
 * participation XP and the flat show-coin grant. Practice and private
 * shows pay nothing.
 */
export function showRewards(input: ShowFactsInput & { practice?: boolean }, restedBank = 0): ShowRewards {
  const facts = input.practice ? null : normalizeShowFacts(input)
  if (!facts || facts.practice) {
    return {
      xpTotal: 0,
      coinRaw: 0,
      participationXp: 0,
      restedBonus: 0,
      lines: [],
      medals: [],
      placement: null,
    }
  }

  const lines: RewardLine[] = []
  const participationXp = facts.quit ? 0 : ECONOMY.xp.participation
  if (participationXp > 0) {
    lines.push({
      code: RewardCode.ParticipationXp,
      kind: 'xp',
      text: 'Played the show',
      amount: participationXp,
    })
  }
  for (let round = 1; round <= facts.qualifiedRounds; round++) {
    lines.push({
      code: RewardCode.QualifiedRoundXp,
      kind: 'xp',
      text: `Qualified round ${round}`,
      amount: ECONOMY.xp.perQualifiedRound,
    })
  }
  if (facts.reachedFinal) {
    lines.push({
      code: RewardCode.FinalXp,
      kind: 'xp',
      text: 'Reached the Final',
      amount: ECONOMY.xp.reachedFinal,
    })
  }
  if (facts.wonFinal) {
    lines.push({
      code: RewardCode.WinXp,
      kind: 'xp',
      text: 'Trophy',
      amount: ECONOMY.xp.win,
    })
  }
  if (facts.teamRoundWins > 0) {
    lines.push({
      code: RewardCode.TeamXp,
      kind: 'xp',
      text: 'Team round',
      amount: ECONOMY.xp.teamRoundWin * facts.teamRoundWins,
    })
  }

  const showXp = lines.filter((line) => line.kind === 'xp').reduce((sum, line) => sum + line.amount, 0)
  const rested = applyRested(showXp, Math.max(0, restedBank))
  if (rested.bonus > 0) {
    lines.push({
      code: RewardCode.RestedXp,
      kind: 'xp',
      text: 'Welcome back',
      amount: rested.bonus,
    })
  }

  const baseCoins = facts.quit ? 0 : ECONOMY.coins.showBase
  if (baseCoins > 0) {
    lines.push({
      code: RewardCode.ShowCoin,
      kind: 'coins',
      text: 'Played the show',
      amount: baseCoins,
    })
  }
  for (let round = 1; round <= facts.roundsPlayed; round++) {
    lines.push({
      code: RewardCode.RoundCoin,
      kind: 'coins',
      text: `Round ${round}`,
      amount: ECONOMY.coins.perRound,
    })
  }
  if (facts.wonFinal) {
    lines.push({
      code: RewardCode.WinCoin,
      kind: 'coins',
      text: 'Trophy',
      amount: ECONOMY.coins.win,
    })
  }
  const coinRaw = lines.filter((line) => line.kind === 'coins').reduce((sum, line) => sum + line.amount, 0)

  return {
    xpTotal: showXp + rested.bonus,
    coinRaw,
    participationXp,
    restedBonus: rested.bonus,
    lines,
    medals: medalsFor(facts),
    placement: facts.finalPlacement,
  }
}

function medalsFor(facts: ShowFacts): ShowMedal[] {
  const medals: ShowMedal[] = []
  for (let round = 1; round <= facts.roundsPlayed; round++) {
    const art = ROUND_ART[(round - 1) % ROUND_ART.length] ?? ROUND_ART[0]
    medals.push({ kind: 'round', round, label: `Round ${round}`, art })
  }
  if (facts.reachedFinal) {
    medals.push({ kind: 'finalist', round: null, label: 'Final', art: 'ui/flat_medal4.png' })
  }
  if (facts.wonFinal) {
    medals.push({ kind: 'trophy', round: null, label: 'Trophy', art: 'ui/trophy.png' })
  }
  return medals
}

export function levelForXp(lifetimeXp: number): number {
  const xp = Number.isFinite(lifetimeXp) ? Math.max(0, Math.floor(lifetimeXp)) : 0
  return Math.floor(xp / ECONOMY.xp.levelXp) + 1
}

export function fullUtcDaysBetween(earlierIso: string, later: Date): number {
  const a = Date.parse(`${earlierIso.slice(0, 10)}T00:00:00.000Z`)
  const b = Date.parse(`${later.toISOString().slice(0, 10)}T00:00:00.000Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/** Bank rested XP for whole UTC days away. Absence fills the bank. It never expires as a streak. */
export function accrueRested(bank: number, lastPlayIso: string | null, now: Date): number {
  const safe = Math.max(0, Math.min(ECONOMY.xp.restedCap, Math.floor(bank)))
  if (!lastPlayIso) return safe
  const days = fullUtcDaysBetween(lastPlayIso, now)
  if (days <= 0) return safe
  return Math.min(ECONOMY.xp.restedCap, safe + days * ECONOMY.xp.restedPerFullUtcDay)
}

/** Double show XP until the rested bank is used up. The bonus is the extra half. */
export function applyRested(showXp: number, bank: number): { xp: number; bank: number; bonus: number } {
  const xp = Math.max(0, Math.floor(showXp))
  const saved = Math.max(0, Math.floor(bank))
  if (xp === 0 || saved === 0) return { xp, bank: saved, bonus: 0 }
  const bonus = Math.min(saved, xp)
  return { xp: xp + bonus, bank: saved - bonus, bonus }
}

/**
 * First `cap` raw show-coins in a day pay in full. The rest pay at `rate`,
 * rounded down so a grant is a whole number of coins.
 */
export function coinsAfterSoftCap(
  rawAlreadyToday: number,
  rawGrant: number,
  cap = ECONOMY.coins.showSoftCap,
  rate = ECONOMY.coins.showSoftRate,
): number {
  if (rawGrant <= 0) return 0
  const already = Math.max(0, rawAlreadyToday)
  const room = Math.max(0, cap - already)
  const full = Math.min(rawGrant, room)
  const reduced = rawGrant - full
  return full + Math.floor(reduced * rate)
}

export function shiftedUtcDate(now: Date, hour = DAILY_REFRESH_HOUR_UTC): string {
  const shifted = new Date(now.getTime() - hour * 3_600_000)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const d = String(shifted.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addUtcDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)
  return new Date(t).toISOString().slice(0, 10)
}

export interface WellbeingInput {
  continuousPlayMinutes: number
  breakMinutes: number
  breakEnabled: boolean
  dailyLimitMinutes: number | null
  playedTodayMinutes: number
}

export interface WellbeingNotice {
  showBreak: boolean
  limitReached: boolean
  message: string | null
  okLabel: 'OK'
}

export function clampBreakMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return ECONOMY.wellbeing.breakDefaultMin
  return Math.max(ECONOMY.wellbeing.breakMin, Math.min(ECONOMY.wellbeing.breakMax, Math.floor(minutes)))
}

/** Shown at the next show end. One OK button. No second button that starts another show. */
export function showEndWellbeing(input: WellbeingInput): WellbeingNotice {
  const breakMinutes = clampBreakMinutes(input.breakMinutes)
  const showBreak = input.breakEnabled && input.continuousPlayMinutes >= breakMinutes
  const limitReached =
    input.dailyLimitMinutes != null &&
    input.dailyLimitMinutes > 0 &&
    input.playedTodayMinutes >= input.dailyLimitMinutes
  let message: string | null = null
  if (limitReached) {
    message = "That's all the play time for today. Your rewards are saved."
  } else if (showBreak) {
    message = 'Time for a stretch break!'
  }
  return { showBreak, limitReached, message, okLabel: 'OK' }
}
