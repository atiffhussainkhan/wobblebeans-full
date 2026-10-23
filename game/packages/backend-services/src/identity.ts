import { randomBytes } from 'node:crypto'
import { hmacEqual, hmacHex, platformLinkHash, uuidv7 } from './codec'
import { QUEUE_RULES } from './queue-rules'
import type { ServiceHealth } from './health'
import type { JsonStore } from './persist/json-store'

export type PlatformId = 'steam' | 'epic' | 'device'

export interface PlayerRecord {
  playerId: string
  platform: PlatformId
  linkHash: string
  mmrMu: number
  mmrSigma: number
  createdAt: string
}

export interface SessionTokens {
  accessToken: string
  refreshToken: string
  playerId: string
  accessExpiresAt: number
  refreshExpiresAt: number
}

export interface LoginResult {
  queued: boolean
  position?: number
  session?: SessionTokens
  playerId?: string
  created?: boolean
}

interface RefreshRow {
  playerId: string
  expiresAt: number
}

interface ReconnectRow {
  playerId: string
  showId: string
  expiresAt: number
  uses: number
}

export interface PlayerRepository {
  upsert(player: PlayerRecord): Promise<void>
  addLink(playerId: string, platform: PlatformId, linkHash: string): Promise<void>
  findByLink(linkHash: string): Promise<PlayerRecord | null>
  delete(playerId: string): Promise<void>
}

/**
 * Platform linking and sessions. The platform subject is hashed with a pepper
 * and is not stored. Other services only see `playerId`.
 */
export class IdentityService {
  readonly name = 'identity'
  private live = false
  private readonly players = new Map<string, PlayerRecord>()
  private readonly byLink = new Map<string, string>()
  private readonly linksOf = new Map<string, Set<string>>()
  private readonly refresh = new Map<string, RefreshRow>()
  private readonly deniedAccess = new Set<string>()
  private readonly reconnects = new Map<string, ReconnectRow>()
  private readonly reconnectCounts = new Map<string, number>()
  private queueDepth = 0
  private repo: PlayerRepository | null = null
  private sessions: JsonStore | null = null

  constructor(
    private readonly opts: {
      pepper?: string
      sessionSecret?: string
      capacity?: number
      now?: () => number
      accountCreationEnabled?: () => boolean
    } = {},
  ) {}

  ready(): ServiceHealth {
    return { name: this.name, ready: this.live }
  }

  markLive(live = true): void {
    this.live = live
  }

  attach(repo: PlayerRepository): void {
    this.repo = repo
  }

  /** Refresh tokens. Access tokens stay signed and short-lived. */
  attachSessions(store: JsonStore): void {
    this.sessions = store
  }

  get(playerId: string): PlayerRecord | undefined {
    const row = this.players.get(playerId)
    return row ? { ...row } : undefined
  }

  async login(input: {
    platform: PlatformId
    subject: string
    nowMs?: number
  }): Promise<LoginResult> {
    if (!input.subject || input.subject.length > 200) throw new Error('platform subject is required')
    if (input.platform !== 'steam' && input.platform !== 'epic' && input.platform !== 'device') {
      throw new Error('unknown platform')
    }
    const now = input.nowMs ?? this.opts.now?.() ?? Date.now()
    this.dropExpired(now)
    const active = await this.activeSessions()
    const capacity = this.opts.capacity ?? 10_000
    if (capacity > 0 && active / capacity > QUEUE_RULES.loginQueueRatio) {
      this.queueDepth += 1
      return { queued: true, position: this.queueDepth }
    }
    const pepper = this.opts.pepper ?? 'dev-platform-pepper'
    const linkHash = platformLinkHash(pepper, input.platform, input.subject)
    let playerId = this.byLink.get(linkHash)
    let created = false
    if (!playerId && this.repo) {
      const loaded = await this.repo.findByLink(linkHash)
      if (loaded) {
        this.remember(loaded)
        playerId = loaded.playerId
      }
    }
    if (!playerId) {
      const enabled = this.opts.accountCreationEnabled?.() ?? true
      if (!enabled) throw new Error('account creation is off')
      const player: PlayerRecord = {
        playerId: uuidv7(now),
        platform: input.platform,
        linkHash,
        mmrMu: 25,
        mmrSigma: 8.333,
        createdAt: new Date(now).toISOString(),
      }
      this.remember(player)
      await this.repo?.upsert(player)
      playerId = player.playerId
      created = true
    }
    const session = await this.issueSession(playerId, now)
    return { queued: false, session, playerId, created }
  }

  /** Link another platform onto an existing player. The raw subject is not kept. */
  async linkPlatform(playerId: string, platform: PlatformId, subject: string): Promise<void> {
    const player = this.players.get(playerId)
    if (!player) throw new Error('unknown player')
    const pepper = this.opts.pepper ?? 'dev-platform-pepper'
    const linkHash = platformLinkHash(pepper, platform, subject)
    if (this.byLink.has(linkHash) && this.byLink.get(linkHash) !== playerId) throw new Error('platform already linked')
    this.byLink.set(linkHash, playerId)
    const owned = this.linksOf.get(playerId) ?? new Set<string>()
    owned.add(linkHash)
    this.linksOf.set(playerId, owned)
    await this.repo?.addLink(playerId, platform, linkHash)
  }

  verifyAccess(token: string, nowMs = this.opts.now?.() ?? Date.now()): string | null {
    const payload = readAccess(token, this.secret())
    if (!payload) return null
    if (payload.exp <= nowMs) return null
    if (this.deniedAccess.has(payload.jti)) return null
    return payload.sub
  }

  async refreshSession(refreshToken: string, nowMs = this.opts.now?.() ?? Date.now()): Promise<SessionTokens | null> {
    const row = await this.readRefresh(refreshToken)
    if (!row || row.expiresAt <= nowMs) return null
    await this.deleteRefresh(refreshToken)
    return this.issueSession(row.playerId, nowMs)
  }

  async logout(accessToken: string, refreshToken?: string): Promise<void> {
    const payload = readAccess(accessToken, this.secret())
    if (payload) this.deniedAccess.add(payload.jti)
    if (refreshToken) await this.deleteRefresh(refreshToken)
  }

  async queueStatus(): Promise<{ depth: number; accepting: boolean; load: number }> {
    const capacity = this.opts.capacity ?? 10_000
    const active = await this.activeSessions()
    const load = capacity === 0 ? 1 : active / capacity
    return { depth: this.queueDepth, accepting: load <= QUEUE_RULES.loginQueueRatio, load }
  }

  /**
   * Reconnect token bound to a player and a show. At most 2 per show, 60 s each.
   */
  issueReconnect(playerId: string, showId: string, nowMs = Date.now()): { token: string; expiresAt: number } | { error: 'limit' } {
    const countKey = `${playerId}|${showId}`
    const issued = this.reconnectCounts.get(countKey) ?? 0
    if (issued >= QUEUE_RULES.maxReconnects) return { error: 'limit' }
    const token = randomBytes(16).toString('hex')
    const expiresAt = nowMs + QUEUE_RULES.reconnectMs
    this.reconnects.set(token, { playerId, showId, expiresAt, uses: 0 })
    this.reconnectCounts.set(countKey, issued + 1)
    return { token, expiresAt }
  }

  redeemReconnect(token: string, playerId: string, showId: string, nowMs = Date.now()): boolean {
    const row = this.reconnects.get(token)
    if (!row) return false
    if (row.playerId !== playerId || row.showId !== showId) return false
    if (nowMs >= row.expiresAt) return false
    this.reconnects.delete(token)
    return true
  }

  async erase(playerId: string): Promise<void> {
    const player = this.players.get(playerId)
    if (player) this.byLink.delete(player.linkHash)
    for (const hash of this.linksOf.get(playerId) ?? []) this.byLink.delete(hash)
    this.linksOf.delete(playerId)
    this.players.delete(playerId)
    for (const [token, row] of this.refresh) {
      if (row.playerId === playerId) await this.deleteRefresh(token)
    }
    await this.repo?.delete(playerId)
  }

  private remember(player: PlayerRecord): void {
    this.players.set(player.playerId, player)
    this.byLink.set(player.linkHash, player.playerId)
    const owned = this.linksOf.get(player.playerId) ?? new Set<string>()
    owned.add(player.linkHash)
    this.linksOf.set(player.playerId, owned)
  }

  private async issueSession(playerId: string, nowMs: number): Promise<SessionTokens> {
    const accessExpiresAt = nowMs + QUEUE_RULES.accessTtlMs
    const refreshExpiresAt = nowMs + QUEUE_RULES.refreshTtlMs
    const jti = randomBytes(8).toString('hex')
    const accessToken = signAccess({ sub: playerId, exp: accessExpiresAt, jti }, this.secret())
    const refreshToken = randomBytes(24).toString('hex')
    const row = { playerId, expiresAt: refreshExpiresAt }
    this.refresh.set(refreshToken, row)
    const ttl = Math.max(1, Math.ceil((refreshExpiresAt - nowMs) / 1000))
    await this.sessions?.set(`refresh:${refreshToken}`, JSON.stringify(row), ttl)
    await this.sessions?.add('refresh:count', 1)
    return { accessToken, refreshToken, playerId, accessExpiresAt, refreshExpiresAt }
  }

  private async readRefresh(token: string): Promise<RefreshRow | null> {
    const local = this.refresh.get(token)
    if (local) return local
    const raw = await this.sessions?.get(`refresh:${token}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RefreshRow
    this.refresh.set(token, parsed)
    return parsed
  }

  private async deleteRefresh(token: string): Promise<void> {
    const had = this.refresh.delete(token)
    const remote = await this.sessions?.get(`refresh:${token}`)
    if (remote) {
      await this.sessions?.del(`refresh:${token}`)
      await this.sessions?.add('refresh:count', -1)
    } else if (had && this.sessions) {
      await this.sessions.add('refresh:count', -1)
    }
  }

  private async activeSessions(): Promise<number> {
    if (!this.sessions) return this.refresh.size
    const raw = await this.sessions.get('refresh:count')
    return raw ? Number(raw) : this.refresh.size
  }

  private dropExpired(nowMs: number): void {
    for (const [token, row] of this.refresh) {
      if (row.expiresAt <= nowMs) this.refresh.delete(token)
    }
  }

  private secret(): string {
    return this.opts.sessionSecret ?? 'dev-session-secret'
  }
}

function signAccess(payload: { sub: string; exp: number; jti: string }, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = hmacHex(body, secret)
  return `${body}.${sig}`
}

function readAccess(token: string, secret: string): { sub: string; exp: number; jti: string } | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const body = parts[0] ?? ''
  const sig = parts[1] ?? ''
  if (!hmacEqual(hmacHex(body, secret), sig)) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { sub?: string; exp?: number; jti?: string }
    if (!parsed.sub || !parsed.exp || !parsed.jti) return null
    return { sub: parsed.sub, exp: parsed.exp, jti: parsed.jti }
  } catch {
    return null
  }
}
