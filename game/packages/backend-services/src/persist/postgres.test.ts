import { randomBytes } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createSecretBox } from '../codec'
import { ParentDirectory } from '../parent-directory'
import { PostgresDatabase } from './postgres'

const databaseUrl = process.env.DATABASE_URL
const suite = databaseUrl ? describe : describe.skip

suite('postgres ledger and parent blobs', () => {
  const db = databaseUrl ? new PostgresDatabase(databaseUrl) : null

  afterAll(async () => {
    await db?.close()
  })

  it('migrates, applies a ledger entry once, and keeps parent plaintext out of the column', async () => {
    if (!db) return
    await db.migrate()
    const input = {
      playerId: 'ply_pg',
      delta: 15,
      reason: 'show',
      sourceRef: 'show_pg',
      idempotencyKey: `pg-${Date.now()}`,
    }
    const first = await db.applyLedger(input)
    const second = await db.applyLedger(input)
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(true)
    expect(second.entry.balanceAfter).toBe(first.entry.balanceAfter)
    const directory = new ParentDirectory(createSecretBox(randomBytes(32)), db)
    const secret = 'grown-up@example.com'
    await directory.save('guardian', 'par_pg', { id: 'par_pg', contact: secret })
    const raw = await db.pool.query('SELECT cipher FROM parent_blob WHERE record_id = $1', ['par_pg'])
    const cipher = raw.rows[0]?.cipher as Buffer
    expect(Buffer.from(cipher).includes(Buffer.from(secret))).toBe(false)
    await db.append({
      id: `aud_pg_${Date.now()}`,
      actorId: 'ops',
      action: 'wallet.grant',
      target: 'ply_pg',
      at: new Date().toISOString(),
      detail: { delta: 15 },
    })
    await expect(
      db.pool.query('DELETE FROM audit_log WHERE actor_id = $1', ['ops']),
    ).rejects.toThrow(/append-only/)
  })
})
