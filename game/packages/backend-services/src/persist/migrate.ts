import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pool, PoolClient } from 'pg'

const here = dirname(fileURLToPath(import.meta.url))

export async function migrationSql(): Promise<{ id: string; sql: string }[]> {
  const dir = join(here, '..', '..', 'migrations')
  const names = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()
  const files: { id: string; sql: string }[] = []
  for (const name of names) {
    files.push({ id: name, sql: await readFile(join(dir, name), 'utf8') })
  }
  return files
}

export async function applyMigrations(pool: Pool): Promise<string[]> {
  const files = await migrationSql()
  const client = await pool.connect()
  const applied: string[] = []
  try {
    await ensureMigrationTable(client)
    for (const file of files) {
      const existing = await client.query('SELECT 1 FROM schema_migrations WHERE id = $1', [file.id])
      if (existing.rowCount) continue
      await client.query('BEGIN')
      try {
        await client.query(file.sql)
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file.id])
        await client.query('COMMIT')
        applied.push(file.id)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    client.release()
  }
  return applied
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)
}
