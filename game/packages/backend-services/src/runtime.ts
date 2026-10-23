import { randomBytes } from 'node:crypto'
import { AdminService, sharedSecretMfa, type AuditLog } from './admin'
import { createSecretBox } from './codec'
import { ConfigService, type LiveConfig } from './live-config'
import { FleetService } from './fleet'
import type { ServiceHealth } from './health'
import { IdentityService } from './identity'
import { InventoryService, ShopCatalogue, type CoinLedger, type LedgerInput } from './ledger'
import { CoinLedger as Ledger } from './ledger'
import { MatchmakerService } from './matchmaker'
import { ParentDirectory, MemoryParentBlobs, type ParentBlobStore } from './parent-directory'
import { PostgresDatabase } from './persist/postgres'
import { memoryJsonStore, type JsonStore } from './persist/json-store'
import { ProfileService } from './profile'
import { ProgressionService } from './progression'
import { QUEUE_RULES } from './queue-rules'
import { SocialService, type ParentConsentPort } from './social'
import { TelemetryService } from './services'
import { signMatchResult, verifyMatchResult, type SignedMatchResult } from './settle'

export interface Backend {
  identity: IdentityService
  profile: ProfileService
  social: SocialService
  matchmaker: MatchmakerService
  fleet: FleetService
  progression: ProgressionService
  ledger: CoinLedger
  shop: ShopCatalogue
  inventory: InventoryService
  config: ConfigService
  telemetry: TelemetryService
  admin: AdminService
  directory: ParentDirectory
  db: PostgresDatabase | null
  sessions: JsonStore
  configKey: string
  matchKey: string
  flags: { playerId: string; showId: string; code: number }[]
  health: () => ServiceHealth[]
  applyCoins: (input: LedgerInput) => Promise<{ entry: LedgerInput & { id: string; balanceAfter: number }; duplicate: boolean }>
  close: () => Promise<void>
}

export interface BackendEnv {
  databaseUrl?: string
  sessionStore?: JsonStore
  parentKey?: Buffer
  configKey?: string
  matchKey?: string
  sessionSecret?: string
  platformPepper?: string
  capacity?: number
  now?: () => number
  audit?: AuditLog
  mfaSecret?: string
  consent?: ParentConsentPort
  physicsHash?: number
  seedConfig?: boolean
}

export async function createBackend(env: BackendEnv = {}): Promise<Backend> {
  const db = env.databaseUrl ? new PostgresDatabase(env.databaseUrl) : null
  if (db) {
    await db.migrate()
    await db.ping()
  }
  const sessions = env.sessionStore ?? memoryJsonStore()
  const config = new ConfigService()
  if (env.physicsHash !== undefined) config.current = { ...config.current, physicsHash: env.physicsHash }
  const ledger = new Ledger()
  if (db) ledger.hydrate(await db.loadLedger())
  const identity = new IdentityService({
    pepper: env.platformPepper,
    sessionSecret: env.sessionSecret,
    capacity: env.capacity,
    now: env.now,
    accountCreationEnabled: () => config.current.accountCreationEnabled,
  })
  if (db) identity.attach(db)
  identity.attachSessions(sessions)
  identity.markLive(true)
  const profile = new ProfileService()
  profile.markLive(true)
  const social = new SocialService()
  social.markLive(true)
  if (env.consent) social.setConsent(env.consent)
  const fleet = new FleetService()
  fleet.markLive(true)
  const matchmaker = new MatchmakerService(fleet, { config, configVersion: config.current.version })
  matchmaker.markLive(true)
  const progression = new ProgressionService()
  progression.markLive(true)
  progression.useConfig(config.current)
  const telemetry = new TelemetryService()
  telemetry.markLive(true)
  if (db) {
    telemetry.attachSalts({
      put: (playerId, salt) => db.putSalt(playerId, salt),
      get: (playerId) => db.getSalt(playerId),
      delete: (playerId) => db.deleteSalt(playerId),
    })
  }
  const audit = env.audit ?? db ?? undefined
  const admin = new AdminService({
    audit,
    ledger,
    mfa: env.mfaSecret ? sharedSecretMfa(env.mfaSecret) : undefined,
    now: env.now,
  })
  const parentKey = env.parentKey ?? randomBytes(32)
  const blobs: ParentBlobStore = db ?? new MemoryParentBlobs()
  const directory = new ParentDirectory(createSecretBox(parentKey), blobs)
  const shop = new ShopCatalogue()
  const inventory = new InventoryService()
  const configKey = env.configKey ?? 'dev-config-key'
  const matchKey = env.matchKey ?? 'dev-match-key'
  if (env.seedConfig) seedFoundation(config, configKey, env.physicsHash ?? config.current.physicsHash)

  const backend: Backend = {
    identity,
    profile,
    social,
    matchmaker,
    fleet,
    progression,
    ledger,
    shop,
    inventory,
    config,
    telemetry,
    admin,
    directory,
    db,
    sessions,
    configKey,
    matchKey,
    flags: [],
    health: () => [
      identity.ready(),
      profile.ready(),
      social.ready(),
      matchmaker.ready(),
      fleet.ready(),
      progression.ready(),
      { name: 'ledger', ready: true },
      config.ready(),
      telemetry.ready(),
      { name: 'moderation', ready: false },
      admin.ready(),
    ],
    applyCoins: async (input) => {
      if (db) {
        const result = await db.applyLedger(input)
        ledger.hydrate(await db.loadLedger())
        return result
      }
      return ledger.apply(input)
    },
    close: async () => {
      await sessions.close()
      await db?.close()
    },
  }
  return backend
}

export function seedFoundation(config: ConfigService, key: string, physicsHash: number, at = new Date()): LiveConfig {
  const start = Date.parse('2026-01-05T00:00:00.000Z')
  const bundle: LiveConfig = {
    ...config.current,
    version: 'seed-1',
    physicsHash,
    schemaVersion: 1,
    accountCreationEnabled: true,
    friendRequestsEnabled: false,
    coinShopEnabled: false,
    season: {
      id: 'season-1',
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(start + QUEUE_RULES.seasonMs).toISOString(),
    },
    news: [
      {
        id: 'news-welcome',
        titleLocKey: 'news.welcome.title',
        bodyLocKey: 'news.welcome.body',
        reviewId: 'review-news-welcome',
        publishedAt: '2026-01-05T00:00:00.000Z',
      },
    ],
  }
  config.propose(bundle, 'seed-author')
  config.approve('seed-1', 'seed-reviewer-a')
  config.approve('seed-1', 'seed-reviewer-b')
  config.sign('seed-1', key)
  return config.activate('seed-1', 'seed-operator', 'global', 0, at)
}

export function readSignedMatch(body: SignedMatchResult, key: string): SignedMatchResult {
  if (!verifyMatchResult(body, key)) throw new Error('match result signature')
  return body
}

export { signMatchResult }
