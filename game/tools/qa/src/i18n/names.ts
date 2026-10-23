import { NAME_ADJECTIVES, NAME_NOUNS } from '@wobblebeans/shared'

/** Generated names stay in the Adjective + Noun + two digits pattern. FR-11-05: word lists are curated per language, not free-text translation. */
export const NAME_LOCALES = ['en-GB', 'en-US'] as const
export type NameLocale = (typeof NAME_LOCALES)[number]

export const NAME_MAX_CHARS = 16

/**
 * en-GB is the shared generator list (it already uses Cosy).
 * en-US changes that one spelling. It is not a pseudo-localisation of the phrase.
 */
export const NAME_LISTS: Record<NameLocale, { adjectives: readonly string[]; nouns: readonly string[] }> = {
  'en-GB': {
    adjectives: NAME_ADJECTIVES,
    nouns: NAME_NOUNS,
  },
  'en-US': {
    adjectives: NAME_ADJECTIVES.map((word) => (word === 'Cosy' ? 'Cozy' : word)),
    nouns: NAME_NOUNS,
  },
}

export function formatLocaleName(locale: NameLocale, adj: number, noun: number, num: number): string {
  const list = NAME_LISTS[locale]
  const adjective = list.adjectives[Math.abs(adj) % list.adjectives.length] ?? 'Bouncy'
  const nounWord = list.nouns[Math.abs(noun) % list.nouns.length] ?? 'Bean'
  const digits = String(Math.abs(num) % 100).padStart(2, '0')
  return `${adjective} ${nounWord} ${digits}`
}

export function longestName(locale: NameLocale): string {
  const list = NAME_LISTS[locale]
  let best = ''
  for (const adjective of list.adjectives) {
    for (const nounWord of list.nouns) {
      const text = `${adjective} ${nounWord} 00`
      if (text.length > best.length) best = text
    }
  }
  return best
}
