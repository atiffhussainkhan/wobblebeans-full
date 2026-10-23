import { EMOTES, QUICK_CHAT } from '@wobblebeans/shared'
import { formatMessage } from './format'
import { pseudoLocalise } from './pseudo'

export const LOCALES = ['en-GB', 'en-US'] as const
export type Locale = (typeof LOCALES)[number]
export type Audience = 'child' | 'adult'
export type StringKind = 'title' | 'text' | 'button' | 'label'

export interface StringEntry {
  id: string
  context: string
  /** Cap for the visible string after +40% expansion. */
  maxLength: number
  screenshot: string
  audience: Audience
  kind: StringKind
  /** Doc 04 screen id, or the gauntlet shell when the screen is the foundation HUD. */
  screen: string
  text: Record<Locale, string>
  /** Shipped copy must appear in this file. Locale-split strings that are not on screen yet omit it. */
  literalIn?: string
  icu?: boolean
}

interface Draft {
  id: string
  context: string
  screenshot: string
  audience: Audience
  kind: StringKind
  screen: string
  text: Record<Locale, string>
  literalIn?: string
  icu?: boolean
}

function visible(text: string): string {
  return formatMessage(text, { count: 99 })
}

function line(draft: Draft): StringEntry {
  const shown = [visible(draft.text['en-GB']), visible(draft.text['en-US'])]
  const maxLength = Math.max(...shown.map((text) => pseudoLocalise(text).length))
  const entry: StringEntry = { ...draft, maxLength }
  return entry
}

const client = 'apps/client/src/main.ts'
const html = 'apps/client/index.html'

const copy: Draft[] = [
  {
    id: 'brand.name',
    context: 'Wordmark in the title and the HUD brand bar.',
    screenshot: 'gauntlet#brand',
    audience: 'child',
    kind: 'title',
    screen: 'SC-05',
    text: { 'en-GB': 'Wobblebeans', 'en-US': 'Wobblebeans' },
    literalIn: html,
  },
  {
    id: 'hud.roster',
    context: 'Roster landmark for assistive tech.',
    screenshot: 'gauntlet#roster',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'Beans in this show', 'en-US': 'Beans in this show' },
    literalIn: html,
  },
  {
    id: 'hud.count',
    context: 'How many beans are in the show. Plural, no string concatenation.',
    screenshot: 'gauntlet#roster',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    icu: true,
    text: {
      'en-GB': '{count, plural, one {# bean} other {# beans}}',
      'en-US': '{count, plural, one {# bean} other {# beans}}',
    },
  },
  {
    id: 'hud.you',
    context: 'Suffix on the local bean in the roster.',
    screenshot: 'gauntlet#roster',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': '(you)', 'en-US': '(you)' },
    literalIn: client,
  },
  {
    id: 'hud.beanFallback',
    context: 'Name shown before a remote bean snapshot arrives.',
    screenshot: 'gauntlet#bubble',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'Bean', 'en-US': 'Bean' },
    literalIn: client,
  },
  {
    id: 'controls.move',
    context: 'Keyboard legend.',
    screenshot: 'gauntlet#controls',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'Move', 'en-US': 'Move' },
    literalIn: html,
  },
  {
    id: 'controls.wasd',
    context: 'Move keys.',
    screenshot: 'gauntlet#controls',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'WASD', 'en-US': 'WASD' },
    literalIn: html,
  },
  {
    id: 'controls.jump',
    context: 'Jump button and keyboard legend.',
    screenshot: 'gauntlet#jump',
    audience: 'child',
    kind: 'button',
    screen: 'SC-05',
    text: { 'en-GB': 'Jump', 'en-US': 'Jump' },
    literalIn: html,
  },
  {
    id: 'controls.space',
    context: 'Jump key.',
    screenshot: 'gauntlet#controls',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'Space', 'en-US': 'Space' },
    literalIn: html,
  },
  {
    id: 'controls.dive',
    context: 'Dive button and keyboard legend.',
    screenshot: 'gauntlet#dive',
    audience: 'child',
    kind: 'button',
    screen: 'SC-05',
    text: { 'en-GB': 'Dive', 'en-US': 'Dive' },
    literalIn: html,
  },
  {
    id: 'controls.shift',
    context: 'Dive key.',
    screenshot: 'gauntlet#controls',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'Shift', 'en-US': 'Shift' },
    literalIn: html,
  },
  {
    id: 'controls.look',
    context: 'Camera legend.',
    screenshot: 'gauntlet#controls',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'Look', 'en-US': 'Look' },
    literalIn: html,
  },
  {
    id: 'controls.lookKeys',
    context: 'Camera controls. Keys, not a sentence.',
    screenshot: 'gauntlet#controls',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'drag or Q E', 'en-US': 'drag or Q E' },
    literalIn: html,
  },
  {
    id: 'controls.hello',
    context: 'Quick-chat legend. Preset ids, not a text field.',
    screenshot: 'gauntlet#controls',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'Hello', 'en-US': 'Hello' },
    literalIn: html,
  },
  {
    id: 'controls.helloKeys',
    context: 'Quick-chat keys 1 through 6.',
    screenshot: 'gauntlet#controls',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': '1–6', 'en-US': '1–6' },
    literalIn: html,
  },
  {
    id: 'status.warming',
    context: 'Boot status before the socket opens.',
    screenshot: 'gauntlet#status',
    audience: 'child',
    kind: 'text',
    screen: 'SC-05',
    text: { 'en-GB': 'Warming up the show…', 'en-US': 'Warming up the show…' },
    literalIn: html,
  },
  {
    id: 'net.connecting',
    context: 'Net pill before the first hello.',
    screenshot: 'gauntlet#net',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'Connecting', 'en-US': 'Connecting' },
    literalIn: html,
  },
  {
    id: 'net.live',
    context: 'Net pill once the socket is open.',
    screenshot: 'gauntlet#net',
    audience: 'child',
    kind: 'label',
    screen: 'SC-05',
    text: { 'en-GB': 'In the show', 'en-US': 'In the show' },
    literalIn: client,
  },
  {
    id: 'status.friend',
    context: 'Alone on the gauntlet.',
    screenshot: 'gauntlet#status',
    audience: 'child',
    kind: 'text',
    screen: 'SC-05',
    text: {
      'en-GB': 'Gauntlet is live. Open another tab to bring a friend.',
      'en-US': 'Gauntlet is live. Open another tab to bring a friend.',
    },
    literalIn: client,
  },
  {
    id: 'status.together',
    context: 'Two or more beans on the same server.',
    screenshot: 'gauntlet#status',
    audience: 'child',
    kind: 'text',
    screen: 'SC-05',
    text: {
      'en-GB': 'Everyone here is on the same server.',
      'en-US': 'Everyone here is on the same server.',
    },
    literalIn: client,
  },
  {
    id: 'status.reconnecting',
    context: 'Socket dropped.',
    screenshot: 'gauntlet#status',
    audience: 'child',
    kind: 'text',
    screen: 'SC-05',
    text: { 'en-GB': 'The show dropped. Reconnecting…', 'en-US': 'The show dropped. Reconnecting…' },
    literalIn: client,
  },
  {
    id: 'banner.finish',
    context: 'Local bean crossed the finish.',
    screenshot: 'gauntlet#banner',
    audience: 'child',
    kind: 'title',
    screen: 'SC-05',
    text: { 'en-GB': 'You made it!', 'en-US': 'You made it!' },
    literalIn: client,
  },
  {
    id: 'error.offline',
    context: 'The show server did not answer.',
    screenshot: 'gauntlet#error',
    audience: 'child',
    kind: 'text',
    screen: 'SC-14',
    text: {
      'en-GB': 'Could not reach the show server. Is `pnpm dev` running?',
      'en-US': 'Could not reach the show server. Is `pnpm dev` running?',
    },
    literalIn: client,
  },
  {
    id: 'error.physics',
    context: 'Hello rejected because the physics hash differs.',
    screenshot: 'gauntlet#error',
    audience: 'child',
    kind: 'text',
    screen: 'SC-14',
    text: {
      'en-GB': 'Physics config does not match the server. Refresh the page.',
      'en-US': 'Physics config does not match the server. Refresh the page.',
    },
    literalIn: client,
  },
  {
    id: 'error.full',
    context: 'The show refused another bean.',
    screenshot: 'gauntlet#error',
    audience: 'child',
    kind: 'text',
    screen: 'SC-14',
    text: {
      'en-GB': 'This show is full. Try again in a moment.',
      'en-US': 'This show is full. Try again in a moment.',
    },
    literalIn: client,
  },
  {
    id: 'error.stale',
    context: 'Protocol version rejected.',
    screenshot: 'gauntlet#error',
    audience: 'child',
    kind: 'text',
    screen: 'SC-14',
    text: {
      'en-GB': 'This client is out of date. Refresh the page.',
      'en-US': 'This client is out of date. Refresh the page.',
    },
    literalIn: client,
  },
  {
    id: 'settings.colour',
    context: 'US and UK spelling are separate values (doc 04 L1). Not on the gauntlet yet.',
    screenshot: 'SC-09#colour',
    audience: 'child',
    kind: 'label',
    screen: 'SC-09',
    text: { 'en-GB': 'Colour', 'en-US': 'Color' },
  },
  {
    id: 'settings.favourite',
    context: 'US and UK spelling are separate values (doc 04 L1). Not on the gauntlet yet.',
    screenshot: 'SC-09#favourite',
    audience: 'child',
    kind: 'label',
    screen: 'SC-09',
    text: { 'en-GB': 'Favourite', 'en-US': 'Favorite' },
  },
]

const quickChat: Draft[] = QUICK_CHAT.map((phrase) => ({
  id: `quickchat.${phrase.id}`,
  context: 'Preset quick-chat phrase. The wire carries the numeric id only.',
  screenshot: 'gauntlet#bubble',
  audience: 'child' as const,
  kind: 'text' as const,
  screen: 'SC-05',
  text: { 'en-GB': phrase.text, 'en-US': phrase.text },
}))

const emotes: Draft[] = EMOTES.map((emote) => ({
  id: `emote.${emote.id}`,
  context: 'Emote label. The wire carries the numeric id only.',
  screenshot: 'gauntlet#emote',
  audience: 'child' as const,
  kind: 'label' as const,
  screen: 'SC-05',
  text: { 'en-GB': emote.name, 'en-US': emote.name },
}))

export const CATALOGUE: readonly StringEntry[] = [...copy, ...quickChat, ...emotes].map(line)

export function entryById(id: string): StringEntry {
  const found = CATALOGUE.find((entry) => entry.id === id)
  if (!found) throw new Error(`missing string ${id}`)
  return found
}

/** Visible copy, with plurals rendered. `count` only affects ICU rows. */
export function visibleText(entry: StringEntry, locale: Locale, count = 99): string {
  return formatMessage(entry.text[locale], { count })
}

export function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length
}
