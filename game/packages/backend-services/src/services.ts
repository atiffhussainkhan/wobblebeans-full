/**
 * MVP service stubs. A modular monolith is acceptable (doc 08 §2).
 * None of these records include a contact address, a birth year, or free text.
 *
 * Progression, the coin ledger, and the shop catalogue live in ./progression.
 * Workstream 9 can replace the in-memory repositories without changing callers.
 */

import { MemoryMatchAttestation } from './progression/attest'
import { ProgressionService } from './progression/service'
import type { ProfileCosmeticStore } from './progression/service'

export type { MatchResult, MatchParticipant, LedgerEntry, ShopItem } from './progression/types'
export { CoinLedger } from './progression/ledger'
export { ShopCatalogue } from './progression/shop-service'
export { ProgressionService, MemoryMatchAttestation }

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

/** Attested applier. The memory attestation stands in until workstream 9 ships the server key. */
export function createProgressionService(options?: {
  profiles?: ProfileCosmeticStore
  now?: () => Date
}): ProgressionService {
  return new ProgressionService({
    requireAttestation: true,
    attestation: new MemoryMatchAttestation(),
    profiles: options?.profiles,
    now: options?.now,
  })
}
