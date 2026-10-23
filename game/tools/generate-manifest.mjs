import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import process from 'node:process'

const root = new URL('..', import.meta.url).pathname
const assetsDir = join(root, 'assets')
const outPath = join(root, 'assets', 'manifest.json')

const files = []
await walk(assetsDir, files)
const assets = []
const licenses = []
for (const file of files.sort()) {
  const rel = relative(assetsDir, file).split('\\').join('/')
  if (rel === 'manifest.json') continue
  const info = await stat(file)
  const category = rel.startsWith('licenses/') ? 'license' : rel.split('/')[0]
  const row = { path: rel, bytes: info.size, category, license: 'CC0-1.0' }
  if (category === 'license') licenses.push(row)
  else assets.push(row)
}

const manifest = {
  version: 1,
  generatedFor: 'wobblebeans-foundation',
  note: 'CC0 packs from Kenney, KayKit and Quaternius. See assets/licenses. Do not add third-party IP.',
  count: assets.length,
  assets,
  licenses,
}
await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`wrote ${assets.length} assets to assets/manifest.json`)

const selection = await readFile(join(root, 'docs/design/ASSET_SELECTION.md'), 'utf8')
const mentioned = [...selection.matchAll(/`([A-Za-z0-9_./-]+\.(?:glb|gltf|fbx|png))`/g)].map((m) => m[1])
const havePaths = new Set(assets.map((row) => row.path))
const haveBase = new Set(assets.map((row) => row.path.split('/').pop()))
const localTops = new Set([
  'characters',
  'obstacles',
  'backgrounds',
  'patterns',
  'ui',
  'vfx',
  'animations',
  'licenses',
])
// Backticks include upstream zip paths (provenance) and the Local file column.
// Only the local slot path has to exist in assets/.
const missing = mentioned.filter((name) => {
  if (havePaths.has(name)) return false
  const top = name.split('/')[0]
  if (!localTops.has(top)) return !haveBase.has(name.split('/').pop())
  return true
})
if (missing.length) {
  console.error('ASSET_SELECTION files missing from assets/:')
  for (const name of missing) console.error(`  ${name}`)
  process.exit(1)
}

async function walk(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path, out)
    else out.push(path)
  }
}
