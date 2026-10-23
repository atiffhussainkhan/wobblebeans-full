import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { ServiceHealth } from './health'
import type { CoinLedger, LedgerEntry } from './ledger'

export interface AuditEvent {
  id: string
  actorId: string
  action: string
  target: string
  at: string
  detail: Record<string, number | string | boolean>
}

export interface AuditLog {
  /** True only for a durable append-only log. Memory is not enough to report ready. */
  readonly durable: boolean
  append(event: AuditEvent): Promise<void>
  recent(limit: number): Promise<AuditEvent[]>
}

export interface MfaVerifier {
  verify(actorId: string, code: string): boolean
}

export class MemoryAuditLog implements AuditLog {
  readonly durable = false
  private readonly rows: AuditEvent[] = []

  async append(event: AuditEvent): Promise<void> {
    this.rows.push({ ...event, detail: { ...event.detail } })
  }

  async recent(limit: number): Promise<AuditEvent[]> {
    return this.rows.slice(-limit).map((row) => ({ ...row, detail: { ...row.detail } }))
  }
}

/**
 * Admin mutations require MFA and an audit log.
 * `ready` stays false until the audit log is durable.
 * Coin grants always go through `CoinLedger.apply`.
 */
export class AdminService {
  readonly name = 'admin'
  private readonly sessions = new Map<string, { actorId: string; expiresAt: number }>()

  constructor(
    private readonly deps: {
      audit?: AuditLog
      ledger?: CoinLedger
      mfa?: MfaVerifier
      now?: () => number
    } = {},
  ) {}

  ready(): ServiceHealth {
    return { name: this.name, ready: this.deps.audit?.durable === true }
  }

  openSession(actorId: string, mfaCode: string, nowMs = this.deps.now?.() ?? Date.now()): { token: string; expiresAt: number } {
    if (!this.deps.mfa?.verify(actorId, mfaCode)) throw new Error('mfa failed')
    const token = randomBytes(24).toString('hex')
    const expiresAt = nowMs + 15 * 60 * 1000
    this.sessions.set(token, { actorId, expiresAt })
    return { token, expiresAt }
  }

  actor(token: string, nowMs = this.deps.now?.() ?? Date.now()): string | null {
    const row = this.sessions.get(token)
    if (!row || row.expiresAt <= nowMs) return null
    return row.actorId
  }

  async grantCoins(input: {
    token: string
    playerId: string
    delta: number
    idempotencyKey: string
    nowMs?: number
  }): Promise<LedgerEntry> {
    const actorId = this.requireActor(input.token, input.nowMs)
    const ledger = this.requireLedger()
    const audit = this.requireAudit()
    if (!Number.isInteger(input.delta) || input.delta === 0) throw new Error('delta must be a non-zero integer')
    const applied = ledger.apply({
      playerId: input.playerId,
      delta: input.delta,
      reason: 'admin',
      sourceRef: actorId,
      idempotencyKey: input.idempotencyKey,
    })
    await audit.append({
      id: `aud_${randomBytes(8).toString('hex')}`,
      actorId,
      action: 'wallet.grant',
      target: input.playerId,
      at: new Date(input.nowMs ?? Date.now()).toISOString(),
      detail: { delta: input.delta, duplicate: applied.duplicate, balanceAfter: applied.entry.balanceAfter },
    })
    return applied.entry
  }

  /** Compensating entry. The original row stays in the ledger. */
  async rollbackGrant(input: {
    token: string
    playerId: string
    delta: number
    idempotencyKey: string
    nowMs?: number
  }): Promise<LedgerEntry> {
    const actorId = this.requireActor(input.token, input.nowMs)
    const ledger = this.requireLedger()
    const audit = this.requireAudit()
    if (!Number.isInteger(input.delta) || input.delta <= 0) throw new Error('rollback delta must be positive')
    const applied = ledger.apply({
      playerId: input.playerId,
      delta: -input.delta,
      reason: 'admin_rollback',
      sourceRef: actorId,
      idempotencyKey: `${input.idempotencyKey}:rollback`,
    })
    await audit.append({
      id: `aud_${randomBytes(8).toString('hex')}`,
      actorId,
      action: 'wallet.rollback',
      target: input.playerId,
      at: new Date(input.nowMs ?? Date.now()).toISOString(),
      detail: { delta: -input.delta, duplicate: applied.duplicate, balanceAfter: applied.entry.balanceAfter },
    })
    return applied.entry
  }

  async auditRecent(token: string, limit = 50): Promise<AuditEvent[]> {
    this.requireActor(token)
    const audit = this.requireAudit()
    return audit.recent(limit)
  }

  private requireActor(token: string, nowMs?: number): string {
    const actorId = this.actor(token, nowMs)
    if (!actorId) throw new Error('admin session required')
    return actorId
  }

  private requireLedger(): CoinLedger {
    if (!this.deps.ledger) throw new Error('ledger required')
    return this.deps.ledger
  }

  private requireAudit(): AuditLog {
    if (!this.deps.audit) throw new Error('audit log required')
    return this.deps.audit
  }
}

/** Dev verifier. Production injects an IdP that already checked SSO and MFA. */
export function sharedSecretMfa(secret: string): MfaVerifier {
  const expected = Buffer.from(secret)
  return {
    verify(_actorId: string, code: string): boolean {
      const given = Buffer.from(code)
      if (given.length !== expected.length) return false
      return timingSafeEqual(given, expected)
    },
  }
}
