import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NET, SAFETY, physicsHash } from '@wobblebeans/shared'
import { CLIENT_JS_GZIP_BUDGET_BYTES } from '../perf/budgets'

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))

export interface CheckResult {
  name: string
  ok: boolean
  detail: string
}

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  // Boundaries keep the Rapier wasm payload from looking like an access key.
  { name: 'cloud access key', re: /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}(?![A-Za-z0-9])/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'live secret token', re: /(?<![A-Za-z0-9])sk_live_[0-9a-zA-Z]{16,}/ },
  { name: 'forge token', re: /(?<![A-Za-z0-9])ghp_[A-Za-z0-9]{36}(?![A-Za-z0-9])/ },
]

const ANALYTICS = [
  'mixpanel',
  'amplitude',
  '@segment/analytics-node',
  'ga-gtag',
  'google-analytics',
  'react-ga',
  '@hotjar/browser',
  'fullstory',
  'posthog-js',
  '@firebase/analytics',
]

const LICENCES = [
  'assets/licenses/kenney_LICENSE.txt',
  'assets/licenses/kaykit_animations_License.txt',
  'assets/licenses/kaykit_prototype_bits_LICENSE.txt',
  'assets/licenses/quaternius_PROVENANCE.md',
]

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), 'utf8')
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, out)
    else out.push(path)
  }
}

function scanSecrets(roots: string[]): string[] {
  const hits: string[] = []
  const files: string[] = []
  for (const root of roots) walk(join(repoRoot, root), files)
  for (const file of files) {
    if (!/\.(ts|tsx|js|mjs|html|css|json)$/.test(file)) continue
    const text = readFileSync(file, 'utf8')
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.re.test(text)) hits.push(`${relative(repoRoot, file)}: ${pattern.name}`)
    }
  }
  return hits
}

function packageNames(): string[] {
  const files: string[] = []
  walk(repoRoot, files)
  const names: string[] = []
  for (const file of files) {
    if (!file.endsWith('package.json')) continue
    const json = JSON.parse(readFileSync(file, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    names.push(...Object.keys(json.dependencies ?? {}), ...Object.keys(json.devDependencies ?? {}))
  }
  return names
}

export function clientGzipBytes(): number {
  const dir = join(repoRoot, 'apps/client/dist')
  if (!existsSync(dir)) return -1
  const files: string[] = []
  walk(dir, files)
  let total = 0
  for (const file of files) {
    if (!file.endsWith('.js')) continue
    total += gzipSync(readFileSync(file)).byteLength
  }
  return total
}

export function ensureClientBuild(): void {
  const built = join(repoRoot, 'apps/client/dist/index.html')
  if (existsSync(built)) return
  const result = spawnSync('pnpm', ['--filter', '@wobblebeans/client', 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  if (result.status !== 0) throw new Error('client build failed')
}

export function runChecklist(): CheckResult[] {
  const results: CheckResult[] = []
  const push = (name: string, ok: boolean, detail: string) => results.push({ name, ok, detail })

  const expected = JSON.parse(read('docs/release/expected.json')) as {
    clientVersion: string
    protocolVersion: number
  }
  const rootPkg = JSON.parse(read('package.json')) as { version: string }
  push(
    'client version',
    rootPkg.version === expected.clientVersion,
    `${rootPkg.version} recorded as ${expected.clientVersion}`,
  )
  push(
    'protocol version',
    NET.protocolVersion === expected.protocolVersion,
    `NET.protocolVersion ${NET.protocolVersion}`,
  )

  const hash = physicsHash()
  push('physics hash', hash === physicsHash() && hash > 0, `0x${hash.toString(16)}`)

  const manifest = JSON.parse(read('assets/manifest.json')) as {
    count: number
    assets: { path: string }[]
  }
  const missing: string[] = []
  for (const asset of manifest.assets) {
    const path = join(repoRoot, 'assets', asset.path)
    if (!existsSync(path)) missing.push(asset.path)
  }
  const publicManifest = JSON.parse(read('apps/client/public/assets/manifest.json')) as { count: number }
  push(
    'asset manifest',
    manifest.count === manifest.assets.length && missing.length === 0 && publicManifest.count === manifest.count,
    `${manifest.assets.length} files, count field ${manifest.count}, missing ${missing.length}`,
  )

  const licenceGaps = LICENCES.filter((rel) => !existsSync(join(repoRoot, rel)) || statSync(join(repoRoot, rel)).size === 0)
  push('licences', licenceGaps.length === 0, licenceGaps.length === 0 ? LICENCES.join(', ') : licenceGaps.join(', '))

  const quickChatInterval = SAFETY.quickChatMinIntervalS as number
  const flagsOk =
    SAFETY.openChat === false &&
    SAFETY.voiceChat === false &&
    SAFETY.lootBoxes === false &&
    SAFETY.premiumCurrency === false &&
    SAFETY.realMoneyInMvp === false &&
    SAFETY.darkPatterns === false &&
    SAFETY.quickChatIdsOnly === true &&
    SAFETY.childPiiStore === 'ParentAccountStore' &&
    (quickChatInterval === 1.5 || quickChatInterval === 2)
  push('safety flags', flagsOk, `quick-chat interval ${quickChatInterval}s`)

  const secrets = scanSecrets(['apps', 'packages'])
  push('client and server secrets', secrets.length === 0, secrets.length === 0 ? 'none' : secrets.join('; '))

  const analytics = packageNames().filter((name) => ANALYTICS.includes(name))
  push('analytics sdks', analytics.length === 0, analytics.length === 0 ? 'none' : analytics.join(', '))

  const serverDocker = read('tools/qa/docker/Dockerfile.server')
  const clientDocker = read('tools/qa/docker/Dockerfile.client')
  push(
    'docker images',
    serverDocker.includes('HEALTHCHECK') &&
      serverDocker.includes('47221') &&
      clientDocker.includes('nginx') &&
      clientDocker.includes('VITE_SERVER_URL'),
    'server and client Dockerfiles',
  )

  return results
}

export function bundleBudgetResult(): CheckResult {
  ensureClientBuild()
  const bytes = clientGzipBytes()
  const secrets = scanSecrets(['apps/client/dist'])
  const ok = bytes >= 0 && bytes <= CLIENT_JS_GZIP_BUDGET_BYTES && secrets.length === 0
  const detail = `${bytes} gzip bytes, budget ${CLIENT_JS_GZIP_BUDGET_BYTES}, secrets ${secrets.length}`
  return { name: 'client bundle', ok, detail }
}
