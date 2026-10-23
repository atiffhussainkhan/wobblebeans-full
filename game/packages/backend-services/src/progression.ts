import type { ServiceHealth } from './health'
import { levelFromLifetimeXp, tierForSeasonXp, type LiveConfig } from './live-config'

export interface MatchResult {
  showId: string
  configVersion: string
  region: string
  participants: {
    playerId: string
    qualifiedRounds: number
    wonFinal: boolean
    xpEarned: number
    coinsEarned: number
  }[]
}

export interface ProgressionRecord {
  playerId: string
  seasonId: string
  xp: number
  lifetimeXp: number
  level: number
  pathTier: number
  trophies: number
  challengeState: Record<string, number>
}

/**
 * Stores XP from a signed match result. It does not write the coin ledger.
 * Game servers post the result; they do not grant coins themselves.
 */
export class ProgressionService {
  readonly name = 'progression'
  private readonly applied = new Set<string>()
  private readonly rows = new Map<string, ProgressionRecord>()
  private live = false
  private seasonId = 'season-1'
  private ramp: number[] | undefined

  ready(): ServiceHealth {
    return { name: this.name, ready: this.live }
  }

  markLive(live = true): void {
    this.live = live
  }

  useConfig(config: LiveConfig): void {
    this.seasonId = config.season?.id ?? 'season-1'
    this.ramp = config.seasonRamp
  }

  applyMatchResult(result: MatchResult, idempotencyKey: string): { accepted: boolean; duplicate: boolean } {
    if (this.applied.has(idempotencyKey)) return { accepted: true, duplicate: true }
    this.applied.add(idempotencyKey)
    for (const participant of result.participants) {
      this.addXp(participant.playerId, participant.xpEarned, participant.wonFinal)
    }
    return { accepted: true, duplicate: false }
  }

  get(playerId: string): ProgressionRecord {
    return { ...this.ensure(playerId), challengeState: { ...this.ensure(playerId).challengeState } }
  }

  claimChallenge(playerId: string, challengeId: string): { claimed: boolean; duplicate: boolean } {
    const row = this.ensure(playerId)
    if (row.challengeState[challengeId] === -1) return { claimed: true, duplicate: true }
    row.challengeState[challengeId] = -1
    return { claimed: true, duplicate: false }
  }

  challengeClaimed(playerId: string, challengeId: string): boolean {
    return this.ensure(playerId).challengeState[challengeId] === -1
  }

  erase(playerId: string): void {
    this.rows.delete(this.key(playerId))
  }

  snapshot(): ProgressionRecord[] {
    return [...this.rows.values()].map((row) => ({ ...row, challengeState: { ...row.challengeState } }))
  }

  private addXp(playerId: string, xp: number, wonFinal: boolean): void {
    const row = this.ensure(playerId)
    const gain = Math.max(0, xp)
    row.xp += gain
    row.lifetimeXp += gain
    row.level = levelFromLifetimeXp(row.lifetimeXp)
    row.pathTier = tierForSeasonXp(row.xp, this.ramp)
    if (wonFinal) row.trophies += 1
  }

  private ensure(playerId: string): ProgressionRecord {
    const key = this.key(playerId)
    const existing = this.rows.get(key)
    if (existing) return existing
    const created: ProgressionRecord = {
      playerId,
      seasonId: this.seasonId,
      xp: 0,
      lifetimeXp: 0,
      level: 1,
      pathTier: 0,
      trophies: 0,
      challengeState: {},
    }
    this.rows.set(key, created)
    return created
  }

  private key(playerId: string): string {
    return `${playerId}|${this.seasonId}`
  }
}
