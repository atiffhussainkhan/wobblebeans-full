import {
  ECONOMY,
  accrueRested,
  coinsAfterSoftCap,
  currentDailyPeriod,
  currentWeeklyPeriod,
  dailyStillBanked,
  dailiesFor,
  idsInLoadout,
  levelForXp,
  levelRewardItem,
  metricDelta,
  overflowGrants,
  seasonStages,
  shiftedUtcDate,
  showRewards,
  templateById,
  templatesFor,
  tierByNumber,
  tierForSeasonXp,
  weekliesFor,
  type ActivityDelta,
  type ChallengeTemplate,
  type ShowFacts,
} from '@wobblebeans/shared'
import type { ChallengeRow, InventoryRow, PlayerProgressRecord } from './record'
import { emptyRecord, isOwned } from './record'
import type { LedgerSource, LedgerWrite } from './types'

export type { LedgerWrite } from './types'

export function freshRecord(playerId: string, now: Date): PlayerProgressRecord {
  const record = emptyRecord(playerId, now)
  refreshChallenges(record, now)
  return record
}

export function giveItem(
  record: PlayerProgressRecord,
  itemId: string,
  source: string,
  now: Date,
  purchaseKey: string | null,
): void {
  if (isOwned(record, itemId)) return
  const row: InventoryRow = {
    itemId,
    acquiredTs: now.toISOString(),
    source,
    seen: source === 'starter',
    usedInMatch: false,
    revokedTs: null,
    purchaseKey,
  }
  record.inventory.push(row)
}

export function refreshChallenges(record: PlayerProgressRecord, now: Date): void {
  record.challenges = record.challenges.filter((row) => {
    if (row.kind !== 'daily' || row.completedAt) return true
    return dailyStillBanked(row.periodKey, now)
  })
  const today = currentDailyPeriod(now)
  const todays = record.challenges.filter((row) => row.kind === 'daily' && row.periodKey === today)
  if (todays.length === 0) {
    const open = record.challenges.filter((row) => row.kind === 'daily' && !row.completedAt).length
    const room = ECONOMY.challenges.bankedDailySlots - open
    for (const template of dailiesFor(today).slice(0, Math.max(0, room))) {
      record.challenges.push(newChallenge(template, today))
    }
  }
  const week = currentWeeklyPeriod(now)
  if (!record.challenges.some((row) => row.kind === 'weekly' && row.periodKey === week)) {
    for (const template of weekliesFor(week)) record.challenges.push(newChallenge(template, week))
  }
  if (!record.challenges.some((row) => row.kind === 'season')) {
    for (const template of seasonStages()) record.challenges.push(newChallenge(template, record.seasonId))
  }
}

function newChallenge(template: ChallengeTemplate, periodKey: string): ChallengeRow {
  return {
    challengeId: template.id,
    kind: template.kind,
    periodKey,
    progress: 0,
    completedAt: null,
    swapped: false,
  }
}

export function swapDailyChallenge(
  record: PlayerProgressRecord,
  challengeId: string,
  now: Date,
): { ok: boolean; reason: string } {
  const today = currentDailyPeriod(now)
  const used = record.dailySwaps[today] ?? 0
  if (used >= ECONOMY.challenges.swapsPerDay) return { ok: false, reason: 'swap-used' }
  const row = record.challenges.find(
    (candidate) =>
      candidate.challengeId === challengeId &&
      candidate.kind === 'daily' &&
      !candidate.completedAt &&
      dailyStillBanked(candidate.periodKey, now),
  )
  if (!row) return { ok: false, reason: 'missing' }
  const current = templateById(row.challengeId)
  if (!current) return { ok: false, reason: 'missing' }
  const active = new Set(
    record.challenges.filter((candidate) => candidate.kind === 'daily' && !candidate.completedAt).map((candidate) => candidate.challengeId),
  )
  const next = templatesFor('daily', current.difficulty).find((template) => !active.has(template.id))
  if (!next) return { ok: false, reason: 'no-swap' }
  row.challengeId = next.id
  row.progress = 0
  row.swapped = true
  record.dailySwaps[today] = used + 1
  return { ok: true, reason: 'swapped' }
}

export function applyActivity(
  record: PlayerProgressRecord,
  activity: ActivityDelta,
  now: Date,
  writes: LedgerWrite[],
): void {
  refreshChallenges(record, now)
  for (const row of record.challenges) {
    if (row.completedAt) continue
    if (row.kind === 'daily' && !dailyStillBanked(row.periodKey, now)) continue
    const template = templateById(row.challengeId)
    if (!template) continue
    const delta = metricDelta(template.metric, activity)
    if (delta <= 0) continue
    row.progress = Math.min(template.target, row.progress + delta)
    if (row.progress < template.target) continue
    row.completedAt = now.toISOString()
    if (template.xp > 0) {
      grantXp(
        record,
        template.xp,
        {
          playerId: record.playerId,
          reason: 'challenge',
          sourceRef: template.id,
          idempotencyKey: `xp:challenge:${template.id}:${record.playerId}:${row.periodKey}`,
          source: 'challenge',
        },
        now,
        writes,
      )
    }
    if (template.coins > 0) {
      writes.push({
        playerId: record.playerId,
        delta: template.coins,
        reason: 'challenge',
        sourceRef: template.id,
        idempotencyKey: `coin:challenge:${template.id}:${record.playerId}:${row.periodKey}`,
        currency: 'coins',
        kind: 'grant',
        source: 'challenge',
      })
    }
    if (template.itemId) giveItem(record, template.itemId, template.kind, now, null)
  }
}

export function grantXp(
  record: PlayerProgressRecord,
  amount: number,
  source: {
    playerId: string
    reason: string
    sourceRef: string
    idempotencyKey: string
    source: LedgerSource
  },
  now: Date,
  writes: LedgerWrite[],
): void {
  const xp = Math.max(0, Math.floor(amount))
  if (xp > 0) {
    record.lifetimeXp += xp
    record.seasonXp += xp
  }
  writes.push({
    ...source,
    delta: xp,
    currency: 'xp',
    kind: 'grant',
  })
  resolveLevels(record, now)
  resolveSeason(record, now, writes)
}

export function resolveLevels(record: PlayerProgressRecord, now: Date): void {
  const level = Math.min(levelForXp(record.lifetimeXp), ECONOMY.levelRewardCap)
  for (let step = 5; step <= level; step += 5) {
    if (record.levelRewards.includes(step)) continue
    const reward = levelRewardItem(step)
    if (reward) giveItem(record, reward.itemId, 'level', now, null)
    record.levelRewards.push(step)
  }
}

export function resolveSeason(record: PlayerProgressRecord, now: Date, writes: LedgerWrite[]): void {
  const tier = tierForSeasonXp(record.seasonXp)
  while (record.tier < tier) {
    record.tier += 1
    const def = tierByNumber(record.tier)
    if (!def) break
    for (const reward of def.rewards) {
      if (reward.type === 'coins') {
        writes.push({
          playerId: record.playerId,
          delta: reward.qty,
          reason: 'tier',
          sourceRef: `${record.seasonId}:${record.tier}`,
          idempotencyKey: `coin:tier:${record.seasonId}:${record.tier}:${record.playerId}`,
          currency: 'coins',
          kind: 'grant',
          source: 'tier',
        })
      } else {
        giveItem(record, reward.ref, 'seasonpath_free', now, null)
      }
    }
  }
  const overflow = overflowGrants(record.seasonXp)
  while (record.overflowGrants < overflow) {
    const index = record.overflowGrants
    record.overflowGrants += 1
    writes.push({
      playerId: record.playerId,
      delta: ECONOMY.coins.overflowStep,
      reason: 'overflow',
      sourceRef: `${record.seasonId}:${index}`,
      idempotencyKey: `coin:overflow:${record.seasonId}:${index}:${record.playerId}`,
      currency: 'coins',
      kind: 'grant',
      source: 'overflow',
    })
  }
}

export interface ShowApplyResult {
  duplicate: boolean
  writes: LedgerWrite[]
  xp: number
  coins: number
}

export function applyShowToRecord(
  record: PlayerProgressRecord,
  input: { showId: string; facts: ShowFacts; now: Date },
): ShowApplyResult {
  if (record.settledShowIds.includes(input.showId)) {
    return { duplicate: true, writes: [], xp: 0, coins: 0 }
  }
  const writes: LedgerWrite[] = []
  const { facts, now, showId } = input
  if (facts.practice) {
    record.restedBank = accrueRested(record.restedBank, record.lastPlayUtc, now)
    record.lastPlayUtc = now.toISOString()
  } else {
    const bank = accrueRested(record.restedBank, record.lastPlayUtc, now)
    const rewards = showRewards(
      {
        qualifiedRounds: facts.qualifiedRounds,
        roundsPlayed: facts.roundsPlayed,
        reachedFinal: facts.reachedFinal,
        wonFinal: facts.wonFinal,
        quit: facts.quit,
        teamRoundWins: facts.teamRoundWins,
        showKind: 'main',
        finalPlacement: facts.finalPlacement,
      },
      bank,
    )
    record.restedBank = bank - rewards.restedBonus
    record.lastPlayUtc = now.toISOString()
    grantXp(
      record,
      rewards.xpTotal,
      {
        playerId: record.playerId,
        reason: 'show',
        sourceRef: showId,
        idempotencyKey: `xp:show:${showId}:${record.playerId}`,
        source: 'show',
      },
      now,
      writes,
    )
    const day = shiftedUtcDate(now)
    const rawAlready = record.showCoinRawByDay[day] ?? 0
    const paid = coinsAfterSoftCap(rawAlready, rewards.coinRaw)
    record.showCoinRawByDay[day] = rawAlready + rewards.coinRaw
    writes.push({
      playerId: record.playerId,
      delta: paid,
      reason: 'show',
      sourceRef: showId,
      idempotencyKey: `coin:show:${showId}:${record.playerId}`,
      currency: 'coins',
      kind: 'grant',
      source: 'show',
    })
    if (facts.wonFinal) record.trophies += 1
    for (const itemId of idsInLoadout(record.loadout)) {
      const row = record.inventory.find((candidate) => candidate.itemId === itemId && candidate.revokedTs == null)
      if (row) row.usedInMatch = true
    }
    applyActivity(record, activityFromShowFacts(facts), now, writes)
    record.lastShow = {
      showId,
      xp: rewards.xpTotal,
      coins: paid,
      lines: rewards.lines,
      medals: rewards.medals,
      placement: rewards.placement,
    }
    record.settledShowIds.push(showId)
    return { duplicate: false, writes, xp: rewards.xpTotal, coins: paid }
  }

  writes.push({
    playerId: record.playerId,
    delta: 0,
    reason: 'show',
    sourceRef: showId,
    idempotencyKey: `xp:show:${showId}:${record.playerId}`,
    currency: 'xp',
    kind: 'grant',
    source: 'show',
  })
  writes.push({
    playerId: record.playerId,
    delta: 0,
    reason: 'show',
    sourceRef: showId,
    idempotencyKey: `coin:show:${showId}:${record.playerId}`,
    currency: 'coins',
    kind: 'grant',
    source: 'show',
  })
  record.settledShowIds.push(showId)
  record.lastShow = { showId, xp: 0, coins: 0, lines: [], medals: [], placement: null }
  return { duplicate: false, writes, xp: 0, coins: 0 }
}

function activityFromShowFacts(facts: ShowFacts): ActivityDelta {
  if (facts.practice) {
    return {
      showsPlayed: 0,
      roundsQualified: 0,
      racesFinished: 0,
      finalsReached: 0,
      emotesLobby: 0,
      teamRounds: 0,
    }
  }
  const played = !facts.quit || facts.roundsPlayed > 0 || facts.qualifiedRounds > 0
  return {
    showsPlayed: played ? 1 : 0,
    roundsQualified: facts.qualifiedRounds,
    racesFinished: facts.racesFinished,
    finalsReached: facts.reachedFinal ? 1 : 0,
    emotesLobby: 0,
    teamRounds: facts.teamRoundsPlayed,
  }
}
