import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EMOTES, QUICK_CHAT, formatDisplayName, nameForSlot } from '@wobblebeans/shared'
import { CATALOGUE, entryById, visibleText, wordCount, type Locale } from './catalogue'
import { formatMessage } from './format'
import { fitText, referenceBox, type Viewport } from './layout'
import { quotedUiText, readClientSources, visibleHtmlText } from './literals'
import { NAME_LISTS, NAME_LOCALES, NAME_MAX_CHARS, formatLocaleName, longestName } from './names'
import { longString, pseudoLocalise, pseudoTargetLength } from './pseudo'

const LOCALES: Locale[] = ['en-GB', 'en-US']
const VIEWPORTS: Viewport[] = ['1280x720', '390x844']
const SPLIT = new Set(['settings.colour', 'settings.favourite'])

describe('string catalogue', () => {
  it('has a unique id, context, screen, and expansion cap on every key', () => {
    const ids = CATALOGUE.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const entry of CATALOGUE) {
      expect(entry.context.length).toBeGreaterThan(0)
      expect(entry.screenshot.length).toBeGreaterThan(0)
      expect(entry.screen.length).toBeGreaterThan(0)
      expect(entry.maxLength).toBeGreaterThanOrEqual(pseudoTargetLength(visibleText(entry, 'en-GB')))
      expect(entry.maxLength).toBeGreaterThanOrEqual(pseudoTargetLength(visibleText(entry, 'en-US')))
    }
  })

  it('keeps shipped copy in the client and has no orphan literal', () => {
    const { html, main } = readClientSources()
    const files: Record<string, string> = {
      'apps/client/index.html': html,
      'apps/client/src/main.ts': main,
    }
    for (const entry of CATALOGUE) {
      if (!entry.literalIn) continue
      const file = files[entry.literalIn]
      expect(file, entry.id).toBeTruthy()
      expect(file).toContain(entry.text['en-GB'])
    }
    const literals = [...visibleHtmlText(html), ...quotedUiText(main)]
    const covered = new Set<string>()
    for (const entry of CATALOGUE) {
      for (const locale of LOCALES) {
        covered.add(entry.text[locale])
        covered.add(visibleText(entry, locale, 1))
        covered.add(visibleText(entry, locale, 2))
      }
    }
    const missing = [...new Set(literals)].filter((literal) => !covered.has(literal))
    expect(missing).toEqual([])
  })

  it('uses separate en-GB and en-US values only for the spelling splits', () => {
    const splits = CATALOGUE.filter((entry) => entry.text['en-GB'] !== entry.text['en-US']).map((entry) => entry.id)
    expect(splits.sort()).toEqual([...SPLIT].sort())
    expect(entryById('settings.colour').text['en-US']).toBe('Color')
    expect(entryById('settings.favourite').text['en-US']).toBe('Favorite')
  })

  it('renders the roster plural without concatenation', () => {
    const template = entryById('hud.count').text['en-GB']
    expect(formatMessage(template, { count: 1 })).toBe('1 bean')
    expect(formatMessage(template, { count: 2 })).toBe('2 beans')
    expect(readClientSources().main).toContain('1 bean')
  })

  it('matches the shared quick-chat and emote catalogues', () => {
    for (const phrase of QUICK_CHAT) {
      expect(entryById(`quickchat.${phrase.id}`).text['en-GB']).toBe(phrase.text)
    }
    for (const emote of EMOTES) {
      expect(entryById(`emote.${emote.id}`).text['en-GB']).toBe(emote.name)
    }
  })

  it('keeps the known long child sentences from growing', () => {
    const long = CATALOGUE.filter((entry) => entry.audience === 'child' && wordCount(visibleText(entry, 'en-GB')) > 8)
      .map((entry) => entry.id)
      .sort()
    expect(long).toEqual(['error.full', 'error.offline', 'error.physics', 'error.stale', 'status.friend'])
    const buttons = CATALOGUE.filter((entry) => entry.kind === 'button')
    for (const button of buttons) expect(wordCount(button.text['en-GB'])).toBeLessThanOrEqual(4)
  })
})

describe('pseudo-localisation', () => {
  it('adds accents, brackets, and 40% length', () => {
    const sample = pseudoLocalise('Jump')
    expect(sample.startsWith('[')).toBe(true)
    expect(sample.endsWith(']')).toBe(true)
    expect(sample).toContain('û')
    expect(sample.length).toBe(pseudoTargetLength('Jump'))
    expect(sample.length).toBeGreaterThanOrEqual(Math.ceil('Jump'.length * 1.4))
    for (const entry of CATALOGUE) {
      for (const locale of LOCALES) {
        const shown = visibleText(entry, locale)
        expect(pseudoLocalise(shown).length).toBe(pseudoTargetLength(shown))
      }
    }
  })

  it('fits 40% text, 150% text, and 150% text with long strings in the reference layout', () => {
    for (const entry of CATALOGUE) {
      const shown = visibleText(entry, 'en-GB')
      const pseudo = pseudoLocalise(shown)
      const long = longString(shown, entry.maxLength)
      for (const viewport of VIEWPORTS) {
        const box = referenceBox(entry.kind, viewport)
        expect(fitText(box, pseudo, 1).ok, `${entry.id} pseudo ${viewport}`).toBe(true)
        expect(fitText(box, shown, 1.5).ok, `${entry.id} 150% ${viewport}`).toBe(true)
        expect(fitText(box, long, 1.5).ok, `${entry.id} 150% long ${viewport}`).toBe(true)
      }
    }
  })

  it('rejects a fixed box that clips a long string at 150%', () => {
    const text = longString(visibleText(entryById('error.offline'), 'en-GB'), entryById('error.offline').maxLength)
    const clipped = fitText(
      { viewport: '390x844', maxWidthPx: 48, maxHeightPx: 24, fontPx: 28, wrap: false, grow: false },
      text,
      1.5,
    )
    expect(clipped.ok).toBe(false)
  })
})

describe('generated names', () => {
  it('stays within 16 characters for every curated word list', () => {
    expect(NAME_LISTS['en-GB'].adjectives).toContain('Cosy')
    expect(NAME_LISTS['en-US'].adjectives).toContain('Cozy')
    expect(NAME_LISTS['en-US'].adjectives).not.toContain('Cosy')
    for (const locale of NAME_LOCALES) {
      expect(longestName(locale).length).toBeLessThanOrEqual(NAME_MAX_CHARS)
      const list = NAME_LISTS[locale]
      for (let adj = 0; adj < list.adjectives.length; adj++) {
        for (let noun = 0; noun < list.nouns.length; noun++) {
          const text = formatLocaleName(locale, adj, noun, 99)
          expect(text.length).toBeLessThanOrEqual(NAME_MAX_CHARS)
          expect(text).not.toMatch(/\[|·/)
          expect(text).toMatch(/^\p{L}+ \p{L}+ \d{2}$/u)
        }
      }
    }
  })

  it('does not pseudo-localise the English generator', () => {
    for (let slot = 0; slot < 64; slot++) {
      const generated = nameForSlot(slot)
      expect(generated.text.length).toBeLessThanOrEqual(16)
      expect(formatDisplayName(generated.adj, generated.noun, generated.num)).toBe(generated.text)
      expect(generated.text).not.toContain('[')
    }
    const source = readFileSync(new URL('../../../../packages/shared/src/names/generator.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('pseudoLocalise')
  })
})
