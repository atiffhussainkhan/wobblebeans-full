import { COPY, type CopyEntry, type StringId } from './copy'

export type LocaleId = 'en-GB' | 'en-US'

const ACCENT: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú',
  A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú',
}

export function entry(id: StringId): CopyEntry {
  return COPY[id]
}

/** ICU-ish fill: `{name}` and `{count, plural, one {# bean} other {# beans}}`. */
export function fill(template: string, vars: Record<string, string | number>, locale: LocaleId): string {
  const plural = /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g
  const withPlurals = template.replace(plural, (_all, name: string, one: string, other: string) => {
    const n = Number(vars[name] ?? 0)
    const branch = n === 1 ? one : other
    return branch.replaceAll('#', formatNum(locale, n))
  })
  return withPlurals.replace(/\{(\w+)\}/g, (_all, name: string) => {
    const value = vars[name]
    return value == null ? '' : String(value)
  })
}

export function t(id: StringId, locale: LocaleId, vars?: Record<string, string | number>): string {
  const raw = COPY[id][locale]
  return vars ? fill(raw, vars, locale) : raw
}

export function formatNum(locale: LocaleId, n: number): string {
  return new Intl.NumberFormat(locale).format(n)
}

export function formatDay(locale: LocaleId, iso: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

export function formatClockTime(locale: LocaleId, now: number): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(now))
}

/** Pseudo-loc: accents, brackets, and about 40% extra width. Placeholders stay. */
export function pseudo(text: string): string {
  const parts = text.split(/(\{[^}]+\})/g)
  const body = parts.map((part) => {
    if (part.startsWith('{')) return part
    const accented = part.replace(/[aeiouAEIOU]/g, (ch) => ACCENT[ch] ?? ch)
    return `${accented}${'·'.repeat(Math.ceil(part.length * 0.4))}`
  }).join('')
  return `[${body}]`
}

export function wordCount(text: string): number {
  const plural = /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/
  const match = plural.exec(text)
  if (match) {
    const one = wordCount(match[2]!.replaceAll('#', '1'))
    const other = wordCount(match[3]!.replaceAll('#', '2'))
    const rest = text.replace(match[0], ' ')
    return wordCount(rest) + Math.max(one, other)
  }
  const normalized = text.replace(/\{[^}]+\}/g, 'n')
  const bits = normalized.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  if (!bits) return 0
  return bits.split(/\s+/).length
}

export const BANNED_PHRASES: RegExp[] = [
  /\bhurry\b/i,
  /\blast chance\b/i,
  /\bact now\b/i,
  /\bdon'?t miss\b/i,
  /\blimited time\b/i,
  /\byou lose\b/i,
  /\byou failed\b/i,
  /\bbuy now\b/i,
  /\bstupid\b/i,
  /\bdumb\b/i,
  /\bhate\b/i,
  /\bkill\b/i,
  /\bdie\b/i,
  /\bdeath\b/i,
  new RegExp(`\\b${['ga', 'cha'].join('')}\\b`, 'i'),
  /\bonly \d+ left\b/i,
]

export function bannedHit(text: string): string | null {
  for (const rule of BANNED_PHRASES) {
    if (rule.test(text)) return rule.source
  }
  return null
}

export const SEASON_END_ISO = '2026-12-20T18:00:00.000Z'
