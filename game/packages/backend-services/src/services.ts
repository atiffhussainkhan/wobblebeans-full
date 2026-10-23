/**
 * MVP service stubs. A modular monolith is acceptable (doc 08 §2).
 * None of these records include a contact address, a birth year, or free text.
 */

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

export interface ServiceHealth {
  name: string
  ready: boolean
}

export class IdentityService {
  readonly name = 'identity'
  ready(): ServiceHealth {
    return { name: this.name, ready: false }
  }
}

export interface PublicProfile {
  playerId: string
  generatedNameId: number
  locale: string
  upperId: string
  lowerId: string
  colourId: string
  patternId: string
  faceId: string
}

export class ProfileService {
  readonly name = 'profile'
  private readonly profiles = new Map<string, PublicProfile>()

  put(profile: PublicProfile): void {
    this.profiles.set(profile.playerId, { ...profile })
  }

  get(playerId: string): PublicProfile | undefined {
    const row = this.profiles.get(playerId)
    return row ? { ...row } : undefined
  }
}

export class SocialService {
  readonly name = 'social'
  ready(): ServiceHealth {
    return { name: this.name, ready: false }
  }
}

export interface QueueTicket {
  id: string
  playerIds: string[]
  /** Chosen from ping beacons, never from a precise location. */
  region: string | null
  status: 'queued' | 'allocated' | 'cancelled'
}

export class MatchmakerService {
  readonly name = 'matchmaker'
  queue(_ticket: { playerIds: string[] }): QueueTicket {
    return { id: 'unallocated', playerIds: _ticket.playerIds, region: null, status: 'queued' }
  }
}

export class FleetService {
  readonly name = 'fleet'
  ready(): ServiceHealth {
    return { name: this.name, ready: false }
  }
}

export class ProgressionService {
  readonly name = 'progression'
  private readonly applied = new Set<string>()

  applyMatchResult(result: MatchResult, idempotencyKey: string): { accepted: boolean; duplicate: boolean } {
    if (this.applied.has(idempotencyKey)) return { accepted: true, duplicate: true }
    this.applied.add(idempotencyKey)
    void result
    return { accepted: true, duplicate: false }
  }
}

export interface LedgerEntry {
  id: string
  playerId: string
  delta: number
  reason: string
  sourceRef: string
  idempotencyKey: string
  balanceAfter: number
}

export class CoinLedger {
  private readonly entries: LedgerEntry[] = []

  balance(playerId: string): number {
    return this.entries.filter((e) => e.playerId === playerId).reduce((sum, e) => sum + e.delta, 0)
  }

  apply(input: Omit<LedgerEntry, 'id' | 'balanceAfter'>): { entry: LedgerEntry; duplicate: boolean } {
    const existing = this.entries.find((e) => e.idempotencyKey === input.idempotencyKey)
    if (existing) return { entry: existing, duplicate: true }
    const entry: LedgerEntry = {
      ...input,
      id: `led_${this.entries.length + 1}`,
      balanceAfter: this.balance(input.playerId) + input.delta,
    }
    this.entries.push(entry)
    return { entry, duplicate: false }
  }
}

export interface ShopItem {
  id: string
  name: string
  priceCoins: number
  slot: 'upper' | 'lower' | 'pattern' | 'colour' | 'face' | 'emote'
}

/** Direct prices in Coins. No random reward, no premium currency. */
export class ShopCatalogue {
  readonly items: ShopItem[] = [
    { id: 'top-berry', name: 'Berry vest', priceCoins: 200, slot: 'upper' },
    { id: 'legs-oat', name: 'Oat shorts', priceCoins: 200, slot: 'lower' },
    { id: 'pat-hearts', name: 'Heart pattern', priceCoins: 150, slot: 'pattern' },
    { id: 'emote-wave', name: 'Wave', priceCoins: 100, slot: 'emote' },
  ]

  purchase(ledger: CoinLedger, playerId: string, itemId: string, idempotencyKey: string): { ok: boolean; reason: string } {
    const item = this.items.find((row) => row.id === itemId)
    if (!item) return { ok: false, reason: 'missing' }
    if (ledger.balance(playerId) < item.priceCoins) return { ok: false, reason: 'short' }
    ledger.apply({
      playerId,
      delta: -item.priceCoins,
      reason: 'shop',
      sourceRef: item.id,
      idempotencyKey,
    })
    return { ok: true, reason: 'bought' }
  }
}

export interface LiveConfig {
  version: string
  physicsHash: number
  accountCreationEnabled: boolean
  friendRequestsEnabled: boolean
  coinShopEnabled: boolean
}

export class ConfigService {
  current: LiveConfig = {
    version: 'foundation-1',
    physicsHash: 0,
    accountCreationEnabled: true,
    friendRequestsEnabled: false,
    coinShopEnabled: false,
  }
}

export interface TelemetryEvent {
  name: string
  /** Rotating salted hash. Not a contact id, and not a raw player id. */
  playerPid: string
  sessionId: string
  ts: number
  payload: Record<string, number | string | boolean>
}

const BANNED_TELEMETRY_KEYS = /email|birth|address|phone|ipaddress|precise.?location|free.?text/i

export function assertTelemetrySafe(event: TelemetryEvent): void {
  for (const key of Object.keys(event.payload)) {
    if (BANNED_TELEMETRY_KEYS.test(key)) throw new Error(`telemetry key not allowed: ${key}`)
  }
}

export class TelemetryService {
  readonly ingested: TelemetryEvent[] = []
  ingest(event: TelemetryEvent): void {
    assertTelemetrySafe(event)
    this.ingested.push(event)
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
}

export class AdminService {
  readonly name = 'admin'
  /** SSO + MFA and an audit log land with the real service. The stub cannot grant coins. */
  ready(): ServiceHealth {
    return { name: this.name, ready: false }
  }
}
