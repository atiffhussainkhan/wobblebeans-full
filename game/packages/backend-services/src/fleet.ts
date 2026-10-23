import { randomBytes } from 'node:crypto'
import type { LevelRule } from './live-config'
import { admitPhysics, type ConnectAdmission } from './physics-admit'
import { QUEUE_RULES } from './queue-rules'
import { assertRegion, type ShowRegion } from './regions'

export interface FleetRosterEntry {
  playerId: string
  isBot: boolean
}

export interface ConnectToken {
  token: string
  playerId: string
  showId: string
  expiresAtMs: number
  physicsHash?: number
  configVersion?: string
}

export interface ShowAllocation {
  showId: string
  region: ShowRegion | null
  host: string
  port: number
  configVersion: string
  physicsHash: number
  pinnedAt: string
  levels: LevelRule[]
  tokens: ConnectToken[]
  status: 'allocated' | 'shutdown'
  serverBuild: string
}

export interface AllocateInput {
  showId: string
  region: string | null
  configVersion: string
  roster: readonly FleetRosterEntry[]
  nowMs: number
  tokenTtlMs?: number
  physicsHash?: number
  pinnedAt?: string
  levels?: readonly LevelRule[]
  serverBuild?: string
  host?: string
}

/**
 * In-process fleet allocator. `ready()` stays false until a caller marks the
 * process as the allocator (the gauntlet on port 47221 does not).
 * Connect tokens are bound to a player id, a show id, and the pinned physics hash.
 */
export class FleetService {
  readonly name = 'fleet'
  private readonly allocations = new Map<string, ShowAllocation>()
  private readonly tokens = new Map<string, ConnectToken>()
  private draining = false
  private portCursor = 0
  private live = false

  ready(): { name: string; ready: boolean } {
    return { name: this.name, ready: this.live }
  }

  markLive(live = true): void {
    this.live = live
  }

  allocate(input: AllocateInput): ShowAllocation | null {
    if (this.draining) return null
    const region = assertRegion(input.region)
    const ttl = input.tokenTtlMs ?? QUEUE_RULES.connectTokenMs
    const physicsHash = input.physicsHash ?? 0
    const tokens: ConnectToken[] = []
    for (const member of input.roster) {
      if (member.isBot) continue
      const token: ConnectToken = {
        token: randomBytes(16).toString('hex'),
        playerId: member.playerId,
        showId: input.showId,
        expiresAtMs: input.nowMs + ttl,
        physicsHash,
        configVersion: input.configVersion,
      }
      tokens.push(token)
      this.tokens.set(token.token, token)
    }
    const allocation: ShowAllocation = {
      showId: input.showId,
      region,
      host: input.host ?? '127.0.0.1',
      port: 47000 + (this.portCursor % 1000),
      configVersion: input.configVersion,
      physicsHash,
      pinnedAt: input.pinnedAt ?? new Date(input.nowMs).toISOString(),
      levels: input.levels ? input.levels.map((level) => ({ ...level })) : [],
      tokens,
      status: 'allocated',
      serverBuild: input.serverBuild ?? 'dev',
    }
    this.portCursor += 1
    this.allocations.set(input.showId, allocation)
    return allocation
  }

  consume(token: string, playerId: string, showId: string, nowMs: number): boolean {
    const row = this.tokens.get(token)
    if (!row) return false
    if (row.playerId !== playerId || row.showId !== showId) return false
    if (nowMs >= row.expiresAtMs) return false
    this.tokens.delete(token)
    return true
  }

  /**
   * Connect-time check. A physics mismatch does not burn the token, so the
   * client can refresh config and present the pinned hash.
   */
  admit(
    token: string,
    playerId: string,
    showId: string,
    nowMs: number,
    clientPhysicsHash: number,
  ): ConnectAdmission & { configVersion?: string; physicsHash?: number } {
    const row = this.tokens.get(token)
    if (!row || row.playerId !== playerId || row.showId !== showId) {
      return { ok: false, reason: 'identity', refreshConfig: false }
    }
    if (nowMs >= row.expiresAtMs) return { ok: false, reason: 'expired', refreshConfig: false }
    const physics = admitPhysics(clientPhysicsHash, row.physicsHash ?? 0)
    if (!physics.ok) return { ...physics, configVersion: row.configVersion, physicsHash: row.physicsHash }
    this.tokens.delete(token)
    return { ok: true, reason: 'ok', refreshConfig: false, configVersion: row.configVersion, physicsHash: row.physicsHash }
  }

  get(showId: string): ShowAllocation | undefined {
    const allocation = this.allocations.get(showId)
    return allocation ? { ...allocation, tokens: allocation.tokens.map((token) => ({ ...token })), levels: allocation.levels.map((level) => ({ ...level })) } : undefined
  }

  /** New allocations stop. Shows already allocated keep their tokens. */
  drain(): void {
    this.draining = true
  }

  release(showId: string): void {
    const allocation = this.allocations.get(showId)
    if (!allocation) return
    for (const token of allocation.tokens) this.tokens.delete(token.token)
    allocation.status = 'shutdown'
    this.allocations.delete(showId)
  }
}
