import { MemoryLedgerRepository, type LedgerRepository } from './repository'
import type { LedgerCurrency, LedgerEntry, LedgerKind } from './types'

/**
 * Append-only wallet. Balance is the sum of the rows.
 * A second apply of the same idempotency key returns the original row.
 */
export class CoinLedger {
  private readonly store: LedgerRepository
  private readonly now: () => Date

  constructor(store?: LedgerRepository, now: () => Date = () => new Date()) {
    this.store = store ?? new MemoryLedgerRepository()
    this.now = now
  }

  balance(playerId: string): number {
    return this.balanceOf(playerId, 'coins')
  }

  xp(playerId: string): number {
    return this.balanceOf(playerId, 'xp')
  }

  balanceOf(playerId: string, currency: LedgerCurrency): number {
    return this.store
      .readAll()
      .filter((entry) => entry.playerId === playerId && (entry.currency ?? 'coins') === currency)
      .reduce((sum, entry) => sum + entry.delta, 0)
  }

  findByKey(idempotencyKey: string): LedgerEntry | undefined {
    return this.store.findByIdempotencyKey(idempotencyKey)
  }

  history(playerId?: string): readonly LedgerEntry[] {
    const rows = this.store.readAll()
    return playerId ? rows.filter((entry) => entry.playerId === playerId) : [...rows]
  }

  apply(input: Omit<LedgerEntry, 'id' | 'balanceAfter'>): { entry: LedgerEntry; duplicate: boolean } {
    const existing = this.store.findByIdempotencyKey(input.idempotencyKey)
    if (existing) return { entry: existing, duplicate: true }
    const currency = input.currency ?? 'coins'
    const kind: LedgerKind = input.kind ?? (input.delta < 0 ? 'spend' : 'grant')
    if (input.delta < 0 && this.balanceOf(input.playerId, currency) + input.delta < 0) {
      throw new Error('short')
    }
    const entry: LedgerEntry = Object.freeze({
      ...input,
      currency,
      kind,
      tsUtc: input.tsUtc ?? this.now().toISOString(),
      id: `led_${this.store.readAll().length + 1}`,
      balanceAfter: this.balanceOf(input.playerId, currency) + input.delta,
    })
    this.store.append(entry)
    return { entry, duplicate: false }
  }
}
