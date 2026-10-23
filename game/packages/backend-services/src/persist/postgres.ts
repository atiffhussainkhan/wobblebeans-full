import { Pool } from 'pg'
import type { AuditEvent, AuditLog } from '../admin'
import type { PlayerRecord, PlayerRepository, PlatformId } from '../identity'
import type { LedgerEntry, LedgerInput } from '../ledger'
import { nextLedgerEntry } from '../ledger'
import type { ParentBlobStore } from '../parent-directory'
import type { ProgressionRecord } from '../progression'
import type { PublicProfile } from '../profile'
import type { SocialSnapshot } from '../social'
import { applyMigrations } from './migrate'

export class PostgresDatabase implements PlayerRepository, AuditLog, ParentBlobStore {
  readonly durable = true
  readonly pool: Pool

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl })
  }

  async migrate(): Promise<string[]> {
    return applyMigrations(this.pool)
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1')
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  async upsert(player: PlayerRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO player (player_id, platform, link_hash, mmr_mu, mmr_sigma, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (player_id) DO UPDATE SET platform = EXCLUDED.platform, link_hash = EXCLUDED.link_hash,
         mmr_mu = EXCLUDED.mmr_mu, mmr_sigma = EXCLUDED.mmr_sigma`,
      [player.playerId, player.platform, player.linkHash, player.mmrMu, player.mmrSigma, player.createdAt],
    )
    await this.addLink(player.playerId, player.platform, player.linkHash)
  }

  async addLink(playerId: string, platform: PlatformId, linkHash: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO platform_link (link_hash, platform, player_id) VALUES ($1, $2, $3)
       ON CONFLICT (link_hash) DO NOTHING`,
      [linkHash, platform, playerId],
    )
  }

  async findByLink(linkHash: string): Promise<PlayerRecord | null> {
    const result = await this.pool.query(
      `SELECT p.player_id, p.platform, p.link_hash, p.mmr_mu, p.mmr_sigma, p.created_at
       FROM platform_link l JOIN player p ON p.player_id = l.player_id
       WHERE l.link_hash = $1`,
      [linkHash],
    )
    const row = result.rows[0] as PlayerRow | undefined
    return row ? mapPlayer(row) : null
  }

  async saveProfile(profile: PublicProfile): Promise<void> {
    const loadout = {
      emoteIds: profile.emoteIds ?? [],
      celebrationId: profile.celebrationId ?? '',
      bannerId: profile.bannerId ?? '',
      titleId: profile.titleId ?? '',
      settingsPrivate: profile.settingsPrivate !== false,
    }
    await this.pool.query(
      `INSERT INTO profile (player_id, generated_name_id, locale, upper_id, lower_id, colour_id, pattern_id, face_id, loadout)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (player_id) DO UPDATE SET generated_name_id = EXCLUDED.generated_name_id, locale = EXCLUDED.locale,
         upper_id = EXCLUDED.upper_id, lower_id = EXCLUDED.lower_id, colour_id = EXCLUDED.colour_id,
         pattern_id = EXCLUDED.pattern_id, face_id = EXCLUDED.face_id, loadout = EXCLUDED.loadout`,
      [
        profile.playerId,
        profile.generatedNameId,
        profile.locale,
        profile.upperId,
        profile.lowerId,
        profile.colourId,
        profile.patternId,
        profile.faceId,
        JSON.stringify(loadout),
      ],
    )
  }

  async applyLedger(input: LedgerInput): Promise<{ entry: LedgerEntry; duplicate: boolean }> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(41021)')
      const existing = await client.query('SELECT * FROM ledger_entry WHERE idempotency_key = $1', [input.idempotencyKey])
      const found = existing.rows[0] as LedgerRow | undefined
      if (found) {
        await client.query('COMMIT')
        return { entry: mapLedger(found), duplicate: true }
      }
      const all = await client.query('SELECT * FROM ledger_entry ORDER BY created_at, id')
      const entries = (all.rows as LedgerRow[]).map(mapLedger)
      const next = nextLedgerEntry(entries, input)
      await client.query(
        `INSERT INTO ledger_entry (id, player_id, delta, reason, source_ref, idempotency_key, balance_after)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [next.entry.id, next.entry.playerId, next.entry.delta, next.entry.reason, next.entry.sourceRef, next.entry.idempotencyKey, next.entry.balanceAfter],
      )
      await client.query('COMMIT')
      return { entry: next.entry, duplicate: false }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async loadLedger(): Promise<LedgerEntry[]> {
    const result = await this.pool.query('SELECT * FROM ledger_entry ORDER BY created_at, id')
    return (result.rows as LedgerRow[]).map(mapLedger)
  }

  async saveProgress(row: ProgressionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO progression (player_id, season_id, xp, lifetime_xp, level, path_tier, trophies, challenge_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (player_id, season_id) DO UPDATE SET xp = EXCLUDED.xp, lifetime_xp = EXCLUDED.lifetime_xp,
         level = EXCLUDED.level, path_tier = EXCLUDED.path_tier, trophies = EXCLUDED.trophies,
         challenge_state = EXCLUDED.challenge_state`,
      [row.playerId, row.seasonId, row.xp, row.lifetimeXp, row.level, row.pathTier, row.trophies, JSON.stringify(row.challengeState)],
    )
  }

  async saveSocial(snapshot: SocialSnapshot): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM friendship')
      await client.query('DELETE FROM block_edge')
      await client.query('DELETE FROM mute_edge')
      for (const friend of snapshot.friends) {
        const [a, b] = friend.a < friend.b ? [friend.a, friend.b] : [friend.b, friend.a]
        await client.query('INSERT INTO friendship (player_a, player_b, since) VALUES ($1, $2, to_timestamp($3 / 1000.0))', [a, b, friend.since])
      }
      for (const block of snapshot.blocks) {
        await client.query('INSERT INTO block_edge (player_id, subject_id) VALUES ($1, $2)', [block.playerId, block.subjectId])
      }
      for (const mute of snapshot.mutes) {
        await client.query('INSERT INTO mute_edge (player_id, subject_id) VALUES ($1, $2)', [mute.playerId, mute.subjectId])
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async append(event: AuditEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_log (id, actor_id, action, target, at, detail) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [event.id, event.actorId, event.action, event.target, event.at, JSON.stringify(event.detail)],
    )
  }

  async recent(limit: number): Promise<AuditEvent[]> {
    const result = await this.pool.query('SELECT * FROM audit_log ORDER BY at DESC LIMIT $1', [limit])
    return (result.rows as AuditRow[]).map(mapAudit).reverse()
  }

  async putSalt(playerId: string, salt: Buffer): Promise<void> {
    await this.pool.query(
      `INSERT INTO telemetry_salt (player_id, salt) VALUES ($1, $2)
       ON CONFLICT (player_id) DO UPDATE SET salt = EXCLUDED.salt`,
      [playerId, salt],
    )
  }

  async getSalt(playerId: string): Promise<Buffer | null> {
    const result = await this.pool.query('SELECT salt FROM telemetry_salt WHERE player_id = $1', [playerId])
    const row = result.rows[0] as { salt: Buffer } | undefined
    return row ? Buffer.from(row.salt) : null
  }

  async deleteSalt(playerId: string): Promise<void> {
    await this.pool.query('DELETE FROM telemetry_salt WHERE player_id = $1', [playerId])
  }

  async put(kind: string, id: string, cipher: Buffer, retainUntil: string | null): Promise<void> {
    await this.pool.query(
      `INSERT INTO parent_blob (kind, record_id, cipher, retain_until) VALUES ($1, $2, $3, $4)
       ON CONFLICT (kind, record_id) DO UPDATE SET cipher = EXCLUDED.cipher, retain_until = EXCLUDED.retain_until`,
      [kind, id, cipher, retainUntil],
    )
  }

  async get(kind: string, id: string): Promise<Buffer | null> {
    const result = await this.pool.query('SELECT cipher FROM parent_blob WHERE kind = $1 AND record_id = $2', [kind, id])
    const row = result.rows[0] as { cipher: Buffer } | undefined
    return row ? Buffer.from(row.cipher) : null
  }

  async delete(kind: string, id: string): Promise<void>
  async delete(playerId: string): Promise<void>
  async delete(kindOrPlayer: string, id?: string): Promise<void> {
    if (id === undefined) {
      await this.pool.query('DELETE FROM player WHERE player_id = $1', [kindOrPlayer])
      return
    }
    await this.pool.query('DELETE FROM parent_blob WHERE kind = $1 AND record_id = $2', [kindOrPlayer, id])
  }

  async saveShowPin(pin: { showId: string; configVersion: string; region: string | null; physicsHash: number; serverBuild: string; pinnedAt: string; levels: unknown }): Promise<void> {
    await this.pool.query(
      `INSERT INTO show_pin (show_id, config_version, region, physics_hash, server_build, pinned_at, levels)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (show_id) DO NOTHING`,
      [pin.showId, pin.configVersion, pin.region, pin.physicsHash, pin.serverBuild, pin.pinnedAt, JSON.stringify(pin.levels)],
    )
  }
}

interface PlayerRow {
  player_id: string
  platform: PlatformId
  link_hash: string
  mmr_mu: number
  mmr_sigma: number
  created_at: Date | string
}

interface LedgerRow {
  id: string
  player_id: string
  delta: number
  reason: string
  source_ref: string
  idempotency_key: string
  balance_after: number
}

interface AuditRow {
  id: string
  actor_id: string
  action: string
  target: string
  at: Date | string
  detail: Record<string, number | string | boolean>
}

function mapPlayer(row: PlayerRow): PlayerRecord {
  return {
    playerId: row.player_id,
    platform: row.platform,
    linkHash: row.link_hash,
    mmrMu: row.mmr_mu,
    mmrSigma: row.mmr_sigma,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

function mapLedger(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    playerId: row.player_id,
    delta: row.delta,
    reason: row.reason,
    sourceRef: row.source_ref,
    idempotencyKey: row.idempotency_key,
    balanceAfter: row.balance_after,
  }
}

function mapAudit(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    target: row.target,
    at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
    detail: row.detail,
  }
}
