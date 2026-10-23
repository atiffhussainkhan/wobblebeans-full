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

const KENNEY = {
  sourceRepo: 'https://github.com/atiffhussainkhan/Image',
  sourceRelease: 'mega-assets-expansion-v1',
  sourcePack: 'shorepine-kenney.zip',
  author: 'Kenney',
  license: 'CC0-1.0',
  licenseFile: 'licenses/kenney_LICENSE.txt',
}
const KAYKIT = {
  sourceRepo: 'https://github.com/atiffhussainkhan/Image',
  sourceRelease: 'mega-assets-v1',
  sourcePack: 'kaykit-character-animations-1.2.zip',
  author: 'Kay Lousberg (KayKit)',
  license: 'CC0-1.0',
  licenseFile: 'licenses/kaykit_animations_License.txt',
}

const used = [
  { path: 'animations/KayKit_AnimatedCharacter_v1.2.glb', role: 'Bean skeleton and clips (Idle, Run, Walk, Jump, Roll, LayingDownIdle, Defeat, Wave, Cheer, Dance). The Prototype Pete mesh is not drawn.', ...KAYKIT },
  { path: 'backgrounds/skybox-day.png', role: 'Day sky', ...KENNEY },
  { path: 'patterns/pattern_03.png', role: 'Hazard stripe on orange and plum blocks', ...KENNEY },
  { path: 'vfx/star_06.png', role: 'Confetti, dust and splash particles', ...KENNEY },
  { path: 'ui/star.png', role: 'Show title icon', ...KENNEY },
  { path: 'ui/multiplayer.png', role: 'Show title icon', ...KENNEY },
  { path: 'ui/information.png', role: 'Controls hint icon', ...KENNEY },
  ...[
    'obstacles/tree.glb',
    'obstacles/flowers.glb',
    'obstacles/hedge.glb',
    'obstacles/mushrooms.glb',
    'obstacles/cupcake.glb',
    'obstacles/donut-sprinkles.glb',
    'obstacles/ice-cream.glb',
    'obstacles/lollypop.glb',
    'obstacles/heart.glb',
    'obstacles/windmill.glb',
    'obstacles/castle.glb',
    'obstacles/present-a-round.glb',
    'obstacles/flag.glb',
    'obstacles/star.glb',
  ].map((path) => ({ path, role: 'Course dressing. Does not affect the physics course.', ...KENNEY })),
]

const manifest = {
  version: 1,
  generatedFor: 'wobblebeans-show',
  note: 'Used assets are CC0 packs from the Image repo GitHub Releases. The private animation repo was checked and not used (2D sprite sheets, not a 3D bean). Quaternius Ultimate Characters was reviewed and not used (human costumes, many armed). Clipart and unverified search bundles were not used. The bean body is an original mesh on the KayKit rig.',
  count: assets.length,
  used,
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
