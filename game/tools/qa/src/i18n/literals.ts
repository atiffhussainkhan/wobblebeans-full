import { readFileSync } from 'node:fs'

export function visibleHtmlText(html: string): string[] {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  const bits: string[] = []
  for (const match of noScript.matchAll(/aria-label="([^"]*)"/g)) bits.push(match[1] ?? '')
  for (const match of noScript.matchAll(/<title>([^<]*)<\/title>/g)) bits.push(match[1] ?? '')
  for (const match of noScript.matchAll(/>([^<]+)</g)) bits.push(match[1] ?? '')
  return bits.map((bit) => bit.replace(/\s+/g, ' ').trim()).filter((bit) => /[A-Za-z0-9]/.test(bit))
}

/** Single-quoted UI sentences on one line. Log lines are dropped so diagnostics are not catalogue keys. */
export function quotedUiText(source: string): string[] {
  const found: string[] = []
  for (const line of source.split('\n')) {
    if (/console\.\w+\(/.test(line)) continue
    const stripped = line.replace(/\/\/.*$/, '')
    for (const match of stripped.matchAll(/'([^']*\s[^']*)'/g)) {
      const text = match[1]
      if (text && /[A-Za-z]/.test(text)) found.push(text)
    }
  }
  return found
}

export function readClientSources(): { html: string; main: string } {
  const root = new URL('../../../../', import.meta.url)
  return {
    html: readFileSync(new URL('apps/client/index.html', root), 'utf8'),
    main: readFileSync(new URL('apps/client/src/main.ts', root), 'utf8'),
  }
}
