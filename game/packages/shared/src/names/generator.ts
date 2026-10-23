/** Curated display names. Adjective + Noun + 2 digits, max 16 characters. No free text. */
export const NAME_ADJECTIVES = [
  'Bouncy',
  'Giggly',
  'Sunny',
  'Peppy',
  'Jolly',
  'Dizzy',
  'Snug',
  'Perky',
  'Merry',
  'Zippy',
  'Rosy',
  'Plucky',
  'Spry',
  'Cosy',
  'Nimble',
  'Tiny',
  'Lucky',
  'Fancy',
  'Brave',
  'Swift',
] as const

export const NAME_NOUNS = [
  'Bean',
  'Sprout',
  'Pebble',
  'Button',
  'Marble',
  'Acorn',
  'Muffin',
  'Cookie',
  'Pickle',
  'Turnip',
  'Noodle',
  'Berry',
  'Cloud',
  'Puddle',
  'Pip',
  'Waffle',
] as const

export interface GeneratedName {
  adj: number
  noun: number
  num: number
  text: string
}

export function formatDisplayName(adj: number, noun: number, num: number): string {
  const a = NAME_ADJECTIVES[Math.abs(adj) % NAME_ADJECTIVES.length] ?? 'Bouncy'
  const n = NAME_NOUNS[Math.abs(noun) % NAME_NOUNS.length] ?? 'Bean'
  const nn = String(Math.abs(num) % 100).padStart(2, '0')
  return `${a} ${n} ${nn}`
}

/** Stable name from a show slot. Not a lookup of any personal record. */
export function nameForSlot(slot: number): GeneratedName {
  const adj = Math.abs(slot * 3) % NAME_ADJECTIVES.length
  const noun = Math.abs(slot * 5 + 1) % NAME_NOUNS.length
  const num = Math.abs(slot * 7 + 3) % 100
  return { adj, noun, num, text: formatDisplayName(adj, noun, num) }
}

export const BEAN_COLOURS = [
  { upper: '#E8336B', lower: '#F2E6C9', ink: '#1F2140' },
  { upper: '#2D7DD2', lower: '#BFE8D2', ink: '#1F2140' },
  { upper: '#3DBB6B', lower: '#1F2140', ink: '#FFFDF7' },
  { upper: '#7A2E8E', lower: '#FFD93B', ink: '#1F2140' },
  { upper: '#FF6B5B', lower: '#22C3E6', ink: '#1F2140' },
  { upper: '#F4C430', lower: '#6B4A3A', ink: '#1F2140' },
  { upper: '#9B5DE5', lower: '#9BE15D', ink: '#1F2140' },
  { upper: '#2F8F8A', lower: '#FFB627', ink: '#1F2140' },
] as const

export function colourForSlot(slot: number): (typeof BEAN_COLOURS)[number] {
  const row = BEAN_COLOURS[Math.abs(slot) % BEAN_COLOURS.length]
  return row ?? BEAN_COLOURS[0]
}
