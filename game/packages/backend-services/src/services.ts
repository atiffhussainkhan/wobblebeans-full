/**
 * Service facade. A modular monolith is acceptable (doc 08 §2).
 * None of these records include a contact address, a birth year, or free text.
 * The show process does not import this package and stays up when these flags are false.
 */
import { randomBytes } from 'node:crypto'
import { saltedPlayerPid } from './codec'
import type { ServiceHealth } from './health'

export type { ServiceHealth } from './health'
export { IdentityService } from './identity'
export type { PlatformId, PlayerRecord, SessionTokens, LoginResult } from './identity'
export { ProfileService, starterProfile } from './profile'
export type { PublicProfile } from './profile'
export { SocialService } from './social'
export type { FriendRequest, ParentConsentPort, SocialSnapshot } from './social'
export { MatchmakerService } from './matchmaker'
export type { QueueTicket, TicketStatus, QueueRequest, Party, PracticeOffer } from './matchmaker'
export { FleetService } from './fleet'
export type { ShowAllocation, ConnectToken, AllocateInput, FleetRosterEntry } from './fleet'
export { ProgressionService } from './progression'
export type { MatchResult, ProgressionRecord } from './progression'
export { CoinLedger, ShopCatalogue, InventoryService } from './ledger'
export type { LedgerEntry, LedgerInput, ShopItem, Entitlement } from './ledger'
export { ConfigService, eligibleLevelIds, activeEvents, xpMultiplierAt, validateLiveConfig, MVP_LEVEL_IDS, tierForSeasonXp, levelFromLifetimeXp } from './live-config'
export type { LiveConfig, PinnedShowConfig, LevelRule, LiveOpsEvent, NewsPost, SignedConfig, SeasonWindow } from './live-config'
export { AdminService, MemoryAuditLog, sharedSecretMfa } from './admin'
export type { AuditLog, AuditEvent } from './admin'
export { physicsHashAllowed, admitPhysics } from './physics-admit'
export type { ConnectAdmission } from './physics-admit'
export { settleMatch, signMatchResult, verifyMatchResult } from './settle'
export type { SignedMatchResult } from './settle'

export interface TelemetryEvent {
  name: string
  /** Rotating salted hash. Not a contact id, and not a raw player id. */
  playerPid: string
  sessionId: string
  ts: number
  payload: Record<string, number | string | boolean>
}

/** Playtest gates from doc 01 §12. Payloads are numeric reason codes. */
export const PLAYTEST_GATE = {
  tutorial: 1,
  readability: 2,
  fallFeel: 3,
  fallCost: 4,
  showLength: 5,
  newPlayerR1: 6,
  downtime: 7,
  sequencing: 8,
  kindCopy: 9,
  emotion: 10,
} as const

export type PlaytestGateId = (typeof PLAYTEST_GATE)[keyof typeof PLAYTEST_GATE]

const BANNED_TELEMETRY_KEYS = /email|birth|address|phone|ipaddress|precise.?location|free.?text/i

export function assertTelemetrySafe(event: TelemetryEvent): void {
  assertNoPersonalFields(event.payload)
  if (event.name === 'playtest_gate') {
    for (const value of Object.values(event.payload)) {
      if (typeof value !== 'number' && typeof value !== 'boolean') throw new Error('playtest payload must be numeric')
    }
  }
}

/** Reject object keys that would carry contact data or a typed note. */
export function assertNoPersonalFields(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoPersonalFields(item)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (BANNED_TELEMETRY_KEYS.test(key)) throw new Error(`telemetry key not allowed: ${key}`)
    assertNoPersonalFields(child)
  }
}

export interface SaltStore {
  put(playerId: string, salt: Buffer): Promise<void>
  get(playerId: string): Promise<Buffer | null>
  delete(playerId: string): Promise<void>
}

export class TelemetryService {
  readonly name = 'telemetry'
  readonly ingested: TelemetryEvent[] = []
  private live = false
  private readonly salts = new Map<string, Buffer>()
  private saltStore: SaltStore | null = null

  ready(): ServiceHealth {
    return { name: this.name, ready: this.live }
  }

  markLive(live = true): void {
    this.live = live
  }

  attachSalts(store: SaltStore): void {
    this.saltStore = store
  }

  ingest(event: TelemetryEvent): void {
    assertTelemetrySafe(event)
    this.ingested.push(event)
  }

  /**
   * Stable for the life of the salt. Deleting the salt makes older events
   * unlinkable: a later pid uses a new salt and cannot be matched back.
   */
  async playerPid(playerId: string): Promise<string> {
    let salt = this.salts.get(playerId)
    if (!salt && this.saltStore) {
      const loaded = await this.saltStore.get(playerId)
      if (loaded) {
        salt = loaded
        this.salts.set(playerId, salt)
      }
    }
    if (!salt) {
      salt = randomBytes(32)
      this.salts.set(playerId, salt)
      await this.saltStore?.put(playerId, salt)
    }
    return saltedPlayerPid(salt, playerId)
  }

  async deleteSalt(playerId: string): Promise<void> {
    this.salts.delete(playerId)
    await this.saltStore?.delete(playerId)
  }

  hasSalt(playerId: string): boolean {
    return this.salts.has(playerId)
  }

  async ingestPlaytest(input: {
    playerId: string
    gate: PlaytestGateId
    code: number
    value: number
    sessionId: string
    ts: number
  }): Promise<TelemetryEvent> {
    if (!Number.isInteger(input.gate) || !Number.isFinite(input.code) || !Number.isFinite(input.value)) {
      throw new Error('playtest payload must be numeric')
    }
    const event: TelemetryEvent = {
      name: 'playtest_gate',
      playerPid: await this.playerPid(input.playerId),
      sessionId: input.sessionId,
      ts: input.ts,
      payload: { gate: input.gate, code: input.code, value: input.value },
    }
    this.ingest(event)
    return event
  }
}

export const REPORT_CATEGORIES = ['unfair', 'mean', 'scary', 'bug'] as const
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

export interface SafetyReport {
  id: string
  reporterPlayerId: string
  subjectPlayerId: string
  category: ReportCategory
  showId: string
}

export class ModerationService {
  private readonly reports: SafetyReport[] = []

  file(input: Omit<SafetyReport, 'id'>): SafetyReport {
    if (!REPORT_CATEGORIES.includes(input.category)) throw new Error('unknown category')
    const report: SafetyReport = { ...input, id: `rpt_${this.reports.length + 1}` }
    this.reports.push(report)
    return report
  }

  mine(reporterPlayerId: string): SafetyReport[] {
    return this.reports.filter((report) => report.reporterPlayerId === reporterPlayerId).map((report) => ({ ...report }))
  }

  queue(): SafetyReport[] {
    return this.reports.map((report) => ({ ...report }))
  }
}
