import { randomBytes } from 'node:crypto'
import { SHOW_RULES } from '@wobblebeans/shared'
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
}

export interface ShowAllocation {
  showId: string
  region: ShowRegion | null
  host: string
  port: number
  configVersion: string
  tokens: ConnectToken[]
  status: 'allocated' | 'shutdown'
}

export interface AllocateInput {
  showId: string
  region: string | null
  configVersion: string
  roster: readonly FleetRosterEntry[]
  nowMs: number
  tokenTtlMs?: number
}

/**
 * In-process fleet allocator. `ready()` stays false: this is not live Agones.
 * The show process on the gauntlet port does not wait on it.
 * Connect tokens are random, bound to a player id and a show id, and expire.
 */
export class FleetService {
  readonly name = 'fleet'
  private readonly allocations = new Map<string, ShowAllocation>()
  private readonly tokens = new Map<string, ConnectToken>()
  private draining = false
  private portCursor = 0

  ready(): { name: string; ready: boolean } {
    return { name: this.name, ready: false }
  }

  allocate(input: AllocateInput): ShowAllocation | null {
    if (this.draining) return null
    const region = assertRegion(input.region)
    const ttl = input.tokenTtlMs ?? SHOW_RULES.connectTokenMs
    const tokens: ConnectToken[] = []
    for (const member of input.roster) {
      if (member.isBot) continue
      const token: ConnectToken = {
        token: randomBytes(16).toString('hex'),
        playerId: member.playerId,
        showId: input.showId,
        expiresAtMs: input.nowMs + ttl,
      }
      tokens.push(token)
      this.tokens.set(token.token, token)
    }
    const allocation: ShowAllocation = {
      showId: input.showId,
      region,
      host: '127.0.0.1',
      port: 47000 + (this.portCursor % 1000),
      configVersion: input.configVersion,
      tokens,
      status: 'allocated',
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

  get(showId: string): ShowAllocation | undefined {
    return this.allocations.get(showId)
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
