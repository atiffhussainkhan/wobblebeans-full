import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import process from 'node:process'

const root = new URL('..', import.meta.url).pathname
const roots = ['apps', 'packages', 'tools']
const banned = [
  { re: /getUserMedia|mediaDevices|webkitSpeech|SpeechRecognition/, why: 'voice or microphone access' },
  { re: /webkitGetUserMedia|mozGetUserMedia/, why: 'legacy microphone access' },
  { re: /<textarea|contenteditable/i, why: 'free-text editing' },
  { re: /<input\b/i, why: 'text entry (use a button)' },
  { re: /createElement\(\s*['"]input['"]\s*\)/, why: 'text entry (use a button)' },
  { re: /\bcustomName\b|\bnameInput\b|\bfreeText\b/, why: 'custom name or free text' },
  { re: /\bprompt\s*\(/, why: 'browser text prompt' },
  { re: /type\s*=\s*['"]text['"]/i, why: 'text input' },
  { re: /openChat:\s*true|voiceChat:\s*true|lootBoxes:\s*true|premiumCurrency:\s*true|realMoneyInMvp:\s*true|darkPatterns:\s*true/, why: 'safety flag turned on' },
  { re: /loot\s+box|loot-box|\bgacha\b/i, why: 'paid random rewards' },
]

const allowEmail = new Set([
  'packages/backend-services/src/parent-account.ts',
  'packages/backend-services/src/parent-account.test.ts',
  'packages/backend-services/src/services.ts',
  'packages/backend-services/src/services.test.ts',
])
const allowBirth = new Set([
  'packages/backend-services/src/parent-account.ts',
  'packages/backend-services/src/parent-account.test.ts',
])
const skip = new Set(['tools/check-safety.mjs'])

const files = []
for (const dir of roots) {
  await walk(join(root, dir), files)
}

const failures = []
for (const file of files) {
  if (!/\.(ts|tsx|js|mjs|html|css)$/.test(file)) continue
  const rel = relative(root, file)
  if (skip.has(rel)) continue
  const raw = await readFile(file, 'utf8')
  const text = stripComments(raw)
  for (const rule of banned) {
    if (rule.re.test(text)) failures.push(`${rel}: ${rule.why}`)
  }
  if (/\bemail\b/i.test(text) && !allowEmail.has(rel)) {
    failures.push(`${rel}: contact field outside ParentAccountStore`)
  }
  if (/birthYear|birth_year|dateOfBirth/i.test(text) && !allowBirth.has(rel)) {
    failures.push(`${rel}: birth data outside ParentAccountStore`)
  }
  if ((rel.startsWith('apps/client/') || rel.startsWith('apps/server/')) && /@wobblebeans\/backend-services/.test(text)) {
    failures.push(`${rel}: show client or show server imports the parent store`)
  }
}

const rulesPath = join(root, 'packages/shared/src/safety/rules.ts')
const rulesCode = stripComments(await readFile(rulesPath, 'utf8'))
const flagChecks = [
  ['openChat', false],
  ['voiceChat', false],
  ['lootBoxes', false],
  ['premiumCurrency', false],
  ['realMoneyInMvp', false],
  ['darkPatterns', false],
]
for (const [flag] of flagChecks) {
  if (!new RegExp(`${flag}:\\s*false`).test(rulesCode)) failures.push(`SAFETY.${flag} must stay false`)
}
if (!/quickChatMinIntervalS:\s*2\b/.test(rulesCode)) {
  failures.push('quick chat interval must be 2 seconds')
}
const phrases = [...rulesCode.matchAll(/text:\s*(['"])(.*?)\1/g)].map((match) => match[2])
if (phrases.length < 8 || phrases.length > 16) {
  failures.push(`quick chat launch set must be 8 to 16 phrases, found ${phrases.length}`)
}
const insults = /stupid|idiot|dumb|hate|loser|shut up|kill|ugly/i
for (const phrase of phrases) {
  if (insults.test(phrase)) failures.push(`quick chat phrase is not neutral: ${phrase}`)
}

if (failures.length) {
  console.error('Child-safety check failed:')
  for (const line of failures) console.error(`  ${line}`)
  process.exit(1)
}
console.log(`safety check ok (${files.length} files)`)

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1')
}

async function walk(dir, out) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path, out)
    else out.push(path)
  }
}
