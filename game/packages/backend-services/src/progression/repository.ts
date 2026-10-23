/**
 * Persistence ports for workstream 9.
 *
 * `src/persist/` is not in this tree yet. MemoryProgressionRepository and
 * MemoryLedgerRepository are the stand-ins. A database adapter should
 * implement these two interfaces and commit a ledger append together with
 * the player row.
 *
 * Show servers must not write these stores. ProgressionService is the writer.
 * Parent contact fields do not belong on either record.
 */

import type { PlayerProgressRecord } from './record'
import type { LedgerEntry } from './types'

export interface ProgressionRepository {
  load(playerId: string): PlayerProgressRecord | undefined
  save(record: PlayerProgressRecord): void
}

export interface LedgerRepository {
  readAll(): readonly LedgerEntry[]
  findByIdempotencyKey(key: string): LedgerEntry | undefined
  append(entry: LedgerEntry): void
}

export class MemoryProgressionRepository implements ProgressionRepository {
  private readonly rows = new Map<string, PlayerProgressRecord>()

  load(playerId: string): PlayerProgressRecord | undefined {
    const row = this.rows.get(playerId)
    return row ? structuredClone(row) : undefined
  }

  save(record: PlayerProgressRecord): void {
    this.rows.set(record.playerId, structuredClone(record))
  }
}

export class MemoryLedgerRepository implements LedgerRepository {
  private readonly entries: LedgerEntry[] = []

  readAll(): readonly LedgerEntry[] {
    return this.entries
  }

  findByIdempotencyKey(key: string): LedgerEntry | undefined {
    return this.entries.find((entry) => entry.idempotencyKey === key)
  }

  append(entry: LedgerEntry): void {
    this.entries.push(entry)
  }
}
