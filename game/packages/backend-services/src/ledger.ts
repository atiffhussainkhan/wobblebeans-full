export interface LedgerEntry {
  id: string
  playerId: string
  delta: number
  reason: string
  sourceRef: string
  idempotencyKey: string
  balanceAfter: number
}

export type LedgerInput = Omit<LedgerEntry, 'id' | 'balanceAfter'>

export function balanceOf(entries: readonly LedgerEntry[], playerId: string): number {
  return entries.filter((entry) => entry.playerId === playerId).reduce((sum, entry) => sum + entry.delta, 0)
}

export function nextLedgerEntry(
  entries: readonly LedgerEntry[],
  input: LedgerInput,
): { entry: LedgerEntry; duplicate: boolean } {
  const existing = entries.find((entry) => entry.idempotencyKey === input.idempotencyKey)
  if (existing) return { entry: existing, duplicate: true }
  const entry: LedgerEntry = {
    ...input,
    id: `led_${entries.length + 1}`,
    balanceAfter: balanceOf(entries, input.playerId) + input.delta,
  }
  return { entry, duplicate: false }
}

/**
 * Append-only coin ledger. Balance is the sum of the entries.
 * A second apply of the same idempotency key is a no-op.
 */
export class CoinLedger {
  private readonly entries: LedgerEntry[] = []

  balance(playerId: string): number {
    return balanceOf(this.entries, playerId)
  }

  list(playerId: string): LedgerEntry[] {
    return this.entries.filter((entry) => entry.playerId === playerId).map((entry) => ({ ...entry }))
  }

  apply(input: LedgerInput): { entry: LedgerEntry; duplicate: boolean } {
    const result = nextLedgerEntry(this.entries, input)
    if (!result.duplicate) this.entries.push(result.entry)
    return { entry: { ...result.entry }, duplicate: result.duplicate }
  }

  hydrate(entries: readonly LedgerEntry[]): void {
    this.entries.length = 0
    for (const entry of entries) this.entries.push({ ...entry })
  }

  snapshot(): LedgerEntry[] {
    return this.entries.map((entry) => ({ ...entry }))
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

export interface Entitlement {
  playerId: string
  itemId: string
  source: string
  grantedAt: number
  revokedAt: number | null
  usedAt: number | null
}

/** Owned items. Undo is a compensating ledger entry, never a deleted row. */
export class InventoryService {
  private readonly rows: Entitlement[] = []

  grant(playerId: string, itemId: string, source: string, grantedAt: number): Entitlement {
    const existing = this.rows.find((row) => row.playerId === playerId && row.itemId === itemId && row.revokedAt === null)
    if (existing) return { ...existing }
    const row: Entitlement = { playerId, itemId, source, grantedAt, revokedAt: null, usedAt: null }
    this.rows.push(row)
    return { ...row }
  }

  list(playerId: string): Entitlement[] {
    return this.rows.filter((row) => row.playerId === playerId && row.revokedAt === null).map((row) => ({ ...row }))
  }

  markUsed(playerId: string, itemId: string, at: number): void {
    const row = this.rows.find((entry) => entry.playerId === playerId && entry.itemId === itemId && entry.revokedAt === null)
    if (row && row.usedAt === null) row.usedAt = at
  }

  /**
   * 24 h undo if the item has not been used. Refund goes through the ledger.
   */
  undoUnused(ledger: CoinLedger, playerId: string, itemId: string, nowMs: number, priceCoins: number, idempotencyKey: string): { ok: boolean; reason: string } {
    const row = this.rows.find((entry) => entry.playerId === playerId && entry.itemId === itemId && entry.revokedAt === null)
    if (!row) return { ok: false, reason: 'missing' }
    if (row.usedAt !== null) return { ok: false, reason: 'used' }
    if (nowMs - row.grantedAt > 24 * 60 * 60 * 1000) return { ok: false, reason: 'late' }
    ledger.apply({
      playerId,
      delta: priceCoins,
      reason: 'undo',
      sourceRef: itemId,
      idempotencyKey,
    })
    row.revokedAt = nowMs
    return { ok: true, reason: 'undone' }
  }
}
