/**
 * UI tokens. Doc 04 §8.1 placeholders are replaced with the doc 05 palette:
 * Berry, Night Ink, and Cloud are the brand trio. Fall Guys pink/blue/yellow
 * is not the chrome. Primary is a deepened Berry so Cloud text clears 4.5:1
 * (bright Berry #E8336B is about 4.0:1 and stays a decoration only).
 */

export const PALETTE = {
  sky: '#E8F6FF',
  oat: '#F2E6C9',
  mint: '#BFE8D2',
  cocoa: '#6B4A3A',
  hazard: '#FF7A1A',
  plum: '#7A2E8E',
  lemon: '#FFD93B',
  cyan: '#22C3E6',
  lime: '#9BE15D',
  goo: '#2F8F8A',
  ink: '#1F2140',
  cloud: '#FFFDF7',
  berry: '#E8336B',
  primary: '#C81E50',
  sun: '#FFB627',
  success: '#1B7A34',
  warn: '#B83A0C',
  teamA: '#FF6B5B',
  teamB: '#2D7DD2',
  teamC: '#3DBB6B',
  teamD: '#C4920A',
} as const

export type Palette = { [K in keyof typeof PALETTE]: string }

/** Functional colours remap. Shapes and patterns stay put (never hue alone). */
export const CVD: Record<'protan' | 'deutan' | 'tritan', Partial<Palette>> = {
  protan: {
    teamA: '#0072B2',
    teamB: '#E69F00',
    teamC: '#009E73',
    teamD: '#CC79A7',
    hazard: '#E69F00',
    success: '#0072B2',
    warn: '#D55E00',
    berry: '#0072B2',
  },
  deutan: {
    teamA: '#D55E00',
    teamB: '#0072B2',
    teamC: '#F0E442',
    teamD: '#CC79A7',
    hazard: '#D55E00',
    success: '#0072B2',
    warn: '#E69F00',
  },
  tritan: {
    teamA: '#D55E00',
    teamB: '#CC6677',
    teamC: '#117733',
    teamD: '#882255',
    cyan: '#882255',
    sun: '#CC6677',
    success: '#117733',
    warn: '#882255',
  },
}

export type CvdMode = 'off' | 'protan' | 'deutan' | 'tritan'

export function paletteFor(mode: CvdMode): Palette {
  if (mode === 'off') return { ...PALETTE }
  return { ...PALETTE, ...CVD[mode] }
}

export const TYPE = {
  hud: 32,
  body: 28,
  secondary: 24,
  adult: 24,
  h1: 64,
} as const

export const TARGET = {
  min: 64,
  primary: 96,
  gap: 16,
  focus: 4,
} as const

export const MOTION = {
  fast: 150,
  base: 250,
  /** Reduced motion keeps fades at or under this. */
  reduced: 150,
  /** 500 ms is 2 Hz, under the 3 Hz flash cap. */
  flashMs: 500,
} as const

export const RADIUS = { s: 12, m: 20, l: 32 } as const

/**
 * Doc 04 draws the round card for 4 s. The show director (workstream 4) uses
 * a 6 s intro, a 2 s hold, and a 3 s countdown. The shell follows the director
 * so the HUD and the server agree when that stream lands.
 */
export const TIMING = {
  introMs: 6000,
  holdMs: 2000,
  countMs: 3000,
  playMs: 12000,
  lobbyMs: 3500,
  qualifiedMs: 2500,
  spectateMs: 8000,
  tallyMs: 3000,
  toastMs: 3000,
  lockMs: 5 * 60 * 1000,
  reconnectMs: 61_000,
  stationReplayMs: 20_000,
  showMinutes: 45,
  attempts: 3,
  rerolls: 5,
  displayRoundMs: 40_000,
  lateMs: 15_000,
  maxChildren: 4,
} as const

export const TEAMS = {
  a: { shape: 'triangle', pattern: 'stripe' },
  b: { shape: 'circle', pattern: 'dot' },
  c: { shape: 'square', pattern: 'cross' },
  d: { shape: 'star', pattern: 'wave' },
} as const

export type TeamId = keyof typeof TEAMS

export function contrast(hexA: string, hexB: string): number {
  const L1 = luminance(hexA)
  const L2 = luminance(hexB)
  const hi = Math.max(L1, L2)
  const lo = Math.min(L1, L2)
  return (hi + 0.05) / (lo + 0.05)
}

export function cssVars(mode: CvdMode, textScale: number): Record<string, string> {
  const p = paletteFor(mode)
  const scale = textScale / 100
  return {
    '--sky': p.sky,
    '--oat': p.oat,
    '--mint': p.mint,
    '--cocoa': p.cocoa,
    '--hazard': p.hazard,
    '--plum': p.plum,
    '--lemon': p.lemon,
    '--cyan': p.cyan,
    '--lime': p.lime,
    '--goo': p.goo,
    '--ink': p.ink,
    '--cloud': p.cloud,
    '--berry': p.berry,
    '--primary': p.primary,
    '--sun': p.sun,
    '--success': p.success,
    '--warn': p.warn,
    '--team-a': p.teamA,
    '--team-b': p.teamB,
    '--team-c': p.teamC,
    '--team-d': p.teamD,
    '--text-scale': String(scale),
    '--gap': `${TARGET.gap}px`,
    '--target': `${TARGET.min}px`,
    '--primary-h': `${TARGET.primary}px`,
    '--radius-s': `${RADIUS.s}px`,
    '--radius-m': `${RADIUS.m}px`,
    '--radius-l': `${RADIUS.l}px`,
    '--motion-fast': `${MOTION.fast}ms`,
    '--motion-base': `${MOTION.base}ms`,
    '--flash': `${MOTION.flashMs}ms`,
  }
}

function luminance(hex: string): number {
  const n = hex.replace('#', '')
  const r = channel(parseInt(n.slice(0, 2), 16))
  const g = channel(parseInt(n.slice(2, 4), 16))
  const b = channel(parseInt(n.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
] as const

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const

/** Closed word list for the parent-gate sum. Not a text field. */
export function numberWords(n: number): string {
  const v = Math.abs(Math.trunc(n))
  if (v < 20) return ONES[v] ?? 'zero'
  const ten = Math.floor(v / 10)
  const one = v % 10
  const stem = TENS[ten] ?? 'ninety'
  return one ? `${stem}-${ONES[one]}` : stem
}

export function makeChallenge(seed: number): { a: number; b: number } {
  let s = Math.abs(Math.trunc(seed)) + 17
  for (let i = 0; i < 24; i++) {
    s = (s * 17 + 3) % 997
    const a = 16 + (s % 30)
    const b = 16 + ((s * 3) % 30)
    if (a + b >= 32 && a + b <= 99) return { a, b }
  }
  return { a: 24, b: 27 }
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
