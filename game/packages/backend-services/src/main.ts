import { physicsHash } from '@wobblebeans/shared'
import { ParentAccountStore } from './parent-account'
import { keyFromEnv } from './codec'
import { startGateway } from './gateway'
import { rememberParentWrites } from './parent-directory'
import { redisJsonStore } from './persist/redis-store'
import { createBackend } from './runtime'

/**
 * Backend gateway. The show process on port 47221 is a different program and
 * must not receive PARENT_DATA_KEY. `pnpm dev` does not start this process.
 */
const databaseUrl = process.env.DATABASE_URL
const parentKey = process.env.PARENT_DATA_KEY ? keyFromEnv(process.env.PARENT_DATA_KEY, 'PARENT_DATA_KEY') : undefined
if (databaseUrl && !parentKey) {
  console.error('PARENT_DATA_KEY is required when DATABASE_URL is set')
  process.exit(1)
}

const redisUrl = process.env.REDIS_URL
const sessions = redisUrl ? redisJsonStore(redisUrl) : undefined
if (sessions) await sessions.ping()

const backend = await createBackend({
  databaseUrl,
  sessionStore: sessions,
  parentKey,
  configKey: process.env.CONFIG_SIGNING_KEY,
  matchKey: process.env.MATCH_RESULT_KEY,
  sessionSecret: process.env.SESSION_SECRET,
  platformPepper: process.env.PLATFORM_PEPPER,
  mfaSecret: process.env.ADMIN_MFA_SECRET,
  capacity: process.env.LOGIN_CAPACITY ? Number(process.env.LOGIN_CAPACITY) : undefined,
  physicsHash: physicsHash(),
  seedConfig: process.env.WOBBLE_SEED_CONFIG === '1',
})

const parents = new ParentAccountStore()
rememberParentWrites(parents, backend.directory)

const port = Number(process.env.PORT ?? 8088)
const gateway = await startGateway(backend, { port })
console.log(`[backend] listening on ${gateway.port}`)

async function shutdown(): Promise<void> {
  await gateway.close()
  await backend.close()
}

process.on('SIGINT', () => {
  void shutdown().then(() => process.exit(0))
})
process.on('SIGTERM', () => {
  void shutdown().then(() => process.exit(0))
})
