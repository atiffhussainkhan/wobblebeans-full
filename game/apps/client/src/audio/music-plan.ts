import {
  AUDIO,
  VOLUME,
  ambienceAudioId,
  finalMusicAudioId,
  roundIntroAudioId,
  roundMusicAudioId,
  type AudioEventId,
  type MusicStateId,
  type RoundType,
  type WorldTheme,
} from '@wobblebeans/shared'

/**
 * Adaptive music from doc 06 §2.
 * Intensity follows the round (progress, qualify pressure, the last seconds).
 * There is no streak input. Tempo does not change inside a round.
 * Stems move on bar lines, one layer per two bars, unless a new piece hard-cuts.
 */

export interface MusicLayers {
  drums: boolean
  bass: boolean
  harmony: boolean
  lead: boolean
  fun: boolean
  last: boolean
  slime: boolean
  team: boolean
}

export type LayerName = keyof MusicLayers

export interface MusicRequest {
  state: MusicStateId
  roundType: RoundType
  theme: WorldTheme
  /** 0–1 through the round clock or the qualify count. Not a win streak. */
  roundProgress: number
  qualifyPressure: boolean
  lastSeconds: boolean
  /** 0–1. Adds a bubbly layer. It is playful, not a threat tone. */
  slime: number
  teamLead: boolean
  dressingRoom: boolean
  settingsOpen: boolean
  /** 0–1. Lobby layers thicken as the room fills. Tempo stays put. */
  lobbyFill: number
}

export type MusicPattern = 'menu' | 'round' | 'final' | 'cheer'

export interface MusicPlan {
  state: MusicStateId
  theme: WorldTheme
  bed: AudioEventId
  stinger: AudioEventId | null
  ambience: AudioEventId | null
  bpm: number
  intensity: 1 | 2 | 3
  layers: MusicLayers
  pattern: MusicPattern
  /** Bed duck before the sidechain, in dB. Zero or negative. */
  duckDb: number
  lowpassHz: number
  crossfadeSec: number
  hardCut: boolean
  barSync: boolean
  bedAudible: boolean
}

export interface PatternNote {
  layer: LayerName
  /** Scale degree 0–7, or -1 for a noise hit. */
  degree: number
  eighth: number
  dur: number
  gain: number
  octave: number
}

export interface ScheduledNote {
  layer: LayerName
  freq: number
  dur: number
  gain: number
  noise: boolean
  at: number
}

const ROUND_FAMILY: readonly MusicStateId[] = [
  'roundIntro',
  'countdown',
  'play',
  'lastSeconds',
  'qualified',
  'out',
  'spectate',
  'final',
]

/** Major. The third is four semitones up, never a minor triad. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
/** Mixolydian. Same major third, with a lowered seventh. Still bright. */
const MIXO = [0, 2, 4, 5, 7, 9, 10]

export const THEME_TUNING: Record<WorldTheme, { root: number; steps: number[] }> = {
  meadow: { root: 261.63, steps: MAJOR },
  candy: { root: 392, steps: MIXO },
  frost: { root: 349.23, steps: MAJOR },
  starlight: { root: 293.66, steps: MIXO },
  splash: { root: 440, steps: MAJOR },
}

const LAYER_ORDER: LayerName[] = ['drums', 'bass', 'harmony', 'lead', 'fun', 'last', 'slime', 'team']

export function emptyLayers(): MusicLayers {
  return {
    drums: false,
    bass: false,
    harmony: false,
    lead: false,
    fun: false,
    last: false,
    slime: false,
    team: false,
  }
}

export function defaultMusicRequest(): MusicRequest {
  return {
    state: 'menu',
    roundType: 'race',
    theme: 'meadow',
    roundProgress: 0,
    qualifyPressure: false,
    lastSeconds: false,
    slime: 0,
    teamLead: false,
    dressingRoom: false,
    settingsOpen: false,
    lobbyFill: 0,
  }
}

export function isRoundFamily(state: MusicStateId): boolean {
  return ROUND_FAMILY.includes(state)
}

/** L1 until halfway, L2 after that, L3 when qualify slots are tight or the clock is in the final seconds. */
export function roundIntensity(req: MusicRequest): 1 | 2 | 3 {
  if (req.state === 'lastSeconds' || req.lastSeconds) return 3
  const racing =
    req.state === 'play' ||
    req.state === 'final' ||
    req.state === 'spectate' ||
    req.state === 'qualified' ||
    req.state === 'countdown' ||
    req.state === 'out'
  if (!racing) return 1
  if (req.qualifyPressure) return 3
  if (req.roundProgress >= 0.5) return 2
  return 1
}

export function resolveMusic(req: MusicRequest, previous: MusicPlan | null): MusicPlan {
  const intensity = roundIntensity(req)
  const transition = transitionOf(req.state)
  return {
    state: req.state,
    theme: req.theme,
    bed: bedFor(req, previous?.bed ?? null),
    stinger: entryStinger(req),
    ambience: ambienceFor(req),
    bpm: bpmFor(req, previous),
    intensity,
    layers: layersFor(req, intensity),
    pattern: patternFor(req),
    duckDb: stateDuck(req),
    lowpassHz: req.state === 'qualified' || req.state === 'spectate' ? VOLUME.lowpassQualifiedHz : VOLUME.lowpassOpenHz,
    crossfadeSec: transition.crossfadeSec,
    hardCut: transition.hardCut,
    barSync: transition.barSync,
    bedAudible: req.state !== 'roundIntro' && req.state !== 'countdown',
  }
}

export function commitLayers(
  active: MusicLayers,
  desired: MusicLayers,
  bar: number,
  lastChangeBar: number,
  force: boolean,
): { layers: MusicLayers; lastChangeBar: number; changed: boolean } {
  if (sameLayers(active, desired)) {
    return { layers: { ...active }, lastChangeBar: force ? bar : lastChangeBar, changed: false }
  }
  if (force) return { layers: { ...desired }, lastChangeBar: bar, changed: true }
  if (bar < lastChangeBar + 2) return { layers: { ...active }, lastChangeBar, changed: false }
  const next = { ...active }
  for (const key of changeOrder(active, desired)) {
    if (next[key] !== desired[key]) {
      next[key] = desired[key]
      return { layers: next, lastChangeBar: bar, changed: true }
    }
  }
  return { layers: { ...active }, lastChangeBar, changed: false }
}

export function barIndex(elapsedSec: number, bpm: number): number {
  if (elapsedSec <= 0) return 0
  return Math.floor((elapsedSec * bpm) / 60 / 4)
}

export function degreeHz(theme: WorldTheme, degree: number, octave: number): number {
  const scale = THEME_TUNING[theme]
  const wrapped = ((degree % 7) + 7) % 7
  const semi = scale.steps[wrapped]! + Math.floor(degree / 7) * 12
  return scale.root * 2 ** ((semi + octave * 12) / 12)
}

export function scheduleBed(
  plan: MusicPlan,
  layers: MusicLayers,
  from: number,
  to: number,
  origin: number,
): ScheduledNote[] {
  if (to <= from) return []
  const eighth = 60 / plan.bpm / 2
  const cycle = eighth * 16
  const pattern = PATTERNS[plan.pattern]
  const notes: ScheduledNote[] = []
  const startCycle = Math.max(0, Math.floor((from - origin) / cycle) - 1)
  const endCycle = Math.floor((to - origin) / cycle) + 1
  for (let cycleIndex = startCycle; cycleIndex <= endCycle; cycleIndex++) {
    const cycleStart = origin + cycleIndex * cycle
    for (const note of pattern) {
      if (!layers[note.layer]) continue
      const at = cycleStart + note.eighth * eighth
      const dur = note.dur * eighth
      if (at < origin || at < from || at >= to) continue
      notes.push({
        layer: note.layer,
        freq: note.degree < 0 ? 0 : degreeHz(plan.theme, note.degree, note.octave),
        dur,
        gain: note.gain,
        noise: note.degree < 0,
        at,
      })
    }
  }
  return notes
}

function transitionOf(state: MusicStateId): { crossfadeSec: number; hardCut: boolean; barSync: boolean } {
  switch (state) {
    case 'menu':
    case 'practice':
      return { crossfadeSec: 2, hardCut: false, barSync: false }
    case 'lobby':
      return { crossfadeSec: 0, hardCut: false, barSync: true }
    case 'roundIntro':
    case 'countdown':
    case 'play':
    case 'final':
      return { crossfadeSec: 0, hardCut: true, barSync: false }
    case 'spectate':
      return { crossfadeSec: 1, hardCut: false, barSync: false }
    case 'victory':
    case 'results':
      return { crossfadeSec: 0.5, hardCut: false, barSync: false }
    default:
      return { crossfadeSec: 0, hardCut: false, barSync: false }
  }
}

function bedFor(req: MusicRequest, previousBed: AudioEventId | null): AudioEventId {
  if (req.state === 'error' || req.state === 'parent') return previousBed ?? AUDIO.musMenu
  if (req.state === 'menu') return AUDIO.musMenu
  if (req.state === 'lobby') return AUDIO.musLobby
  if (req.state === 'practice') return AUDIO.musPractice
  if (req.state === 'victory') return AUDIO.musVictory
  if (req.state === 'results') return AUDIO.musResults
  if (req.state === 'final') return finalMusicAudioId(req.theme)
  return roundMusicAudioId(req.theme)
}

function entryStinger(req: MusicRequest): AudioEventId | null {
  if (req.state === 'roundIntro') return roundIntroAudioId(req.roundType)
  if (req.state === 'qualified') return AUDIO.qualified
  if (req.state === 'out') return AUDIO.greatTry
  if (req.state === 'final') return AUDIO.finalStinger
  return null
}

function ambienceFor(req: MusicRequest): AudioEventId | null {
  if (
    req.state === 'play' ||
    req.state === 'lastSeconds' ||
    req.state === 'qualified' ||
    req.state === 'spectate' ||
    req.state === 'final'
  ) {
    return ambienceAudioId(req.theme)
  }
  return null
}

function bpmFor(req: MusicRequest, previous: MusicPlan | null): number {
  if (req.state === 'lobby') return 100
  if (req.state === 'practice') return 102
  if (req.state === 'menu' || req.state === 'parent') return 104
  if (req.state === 'results') return 108
  if (req.state === 'victory') return 120
  if (req.state === 'error') return previous?.bpm ?? 104
  if (previous && isRoundFamily(req.state) && isRoundFamily(previous.state)) return previous.bpm
  return 128
}

function patternFor(req: MusicRequest): MusicPattern {
  if (req.state === 'final') return 'final'
  if (req.state === 'victory') return 'cheer'
  if (req.state === 'menu' || req.state === 'lobby' || req.state === 'practice' || req.state === 'parent' || req.state === 'results') {
    return 'menu'
  }
  if (req.state === 'error') return 'menu'
  return 'round'
}

function layersFor(req: MusicRequest, intensity: 1 | 2 | 3): MusicLayers {
  if (req.state === 'lobby') return lobbyLayers(req.lobbyFill)
  if (req.state === 'menu' || req.state === 'parent' || req.state === 'error') {
    return { ...emptyLayers(), drums: true, bass: true, harmony: true, fun: req.state === 'menu' && req.dressingRoom }
  }
  if (req.state === 'practice') return { ...emptyLayers(), drums: true, bass: true, harmony: true }
  if (req.state === 'victory' || req.state === 'results') {
    return { ...emptyLayers(), drums: true, bass: true, harmony: true, lead: true, fun: true }
  }
  return {
    drums: true,
    bass: true,
    harmony: true,
    lead: intensity >= 2,
    fun: intensity >= 3,
    last: req.state === 'lastSeconds' || req.lastSeconds,
    slime: req.slime > 0.02,
    team: req.teamLead,
  }
}

function lobbyLayers(fill: number): MusicLayers {
  const f = Math.max(0, Math.min(1, fill))
  return {
    drums: true,
    bass: f >= 0.25,
    harmony: f >= 0.5,
    lead: f >= 0.75,
    fun: false,
    last: false,
    slime: false,
    team: false,
  }
}

function stateDuck(req: MusicRequest): number {
  let duck = 0
  if (req.state === 'parent') duck = VOLUME.parentDuckDb
  else if (req.state === 'error') duck = VOLUME.errorDuckDb
  else if (req.state === 'qualified') duck = VOLUME.qualifiedDuckDb
  else if (req.state === 'spectate') duck = VOLUME.spectateDuckDb
  if (req.settingsOpen) duck = Math.min(duck, VOLUME.settingsDuckDb)
  return duck
}

function sameLayers(a: MusicLayers, b: MusicLayers): boolean {
  return LAYER_ORDER.every((key) => a[key] === b[key])
}

/** Timed layers (the final-seconds perc, the slime bubbles) take the one change slot first. */
function changeOrder(active: MusicLayers, desired: MusicLayers): LayerName[] {
  const order = [...LAYER_ORDER]
  const bump = (key: LayerName) => {
    if (!desired[key] || active[key]) return
    const index = order.indexOf(key)
    if (index > 0) {
      order.splice(index, 1)
      order.unshift(key)
    }
  }
  bump('slime')
  bump('last')
  return order
}

function note(layer: LayerName, degree: number, eighth: number, dur: number, gain: number, octave = 0): PatternNote {
  return { layer, degree, eighth, dur, gain, octave }
}

const DRUMS: PatternNote[] = [
  note('drums', -1, 0, 1, 0.08),
  note('drums', -1, 4, 1, 0.045),
  note('drums', -1, 8, 1, 0.08),
  note('drums', -1, 12, 1, 0.045),
]

const BASS: PatternNote[] = [note('bass', 0, 0, 3, 0.09), note('bass', 4, 8, 3, 0.08)]

const HARMONY: PatternNote[] = [
  note('harmony', 2, 0, 6, 0.042),
  note('harmony', 4, 0, 6, 0.036),
  note('harmony', 2, 8, 6, 0.042),
  note('harmony', 4, 8, 6, 0.036),
]

const ROUND_LEAD: PatternNote[] = [
  note('lead', 0, 0, 2, 0.06),
  note('lead', 2, 2, 2, 0.058),
  note('lead', 4, 4, 2, 0.062),
  note('lead', 2, 6, 2, 0.05),
  note('lead', 7, 8, 2, 0.06, 0),
  note('lead', 4, 12, 3, 0.055),
]

const FINAL_LEAD: PatternNote[] = [
  note('lead', 4, 0, 2, 0.062, 1),
  note('lead', 4, 3, 2, 0.05, 1),
  note('lead', 7, 6, 2, 0.06, 0),
  note('lead', 4, 8, 2, 0.058, 1),
  note('lead', 2, 11, 2, 0.05, 1),
  note('lead', 0, 14, 2, 0.06, 1),
]

const CHEER_LEAD: PatternNote[] = [
  note('lead', 0, 0, 2, 0.07, 1),
  note('lead', 4, 2, 2, 0.065, 1),
  note('lead', 7, 4, 3, 0.07, 1),
  note('lead', 4, 8, 2, 0.06, 1),
  note('lead', 7, 12, 3, 0.068, 1),
]

const FUN: PatternNote[] = [2, 6, 10, 14].map((eighth) => note('fun', -1, eighth, 1, 0.032))

const LAST: PatternNote[] = [1, 3, 5, 9, 11, 13].map((eighth) => note('last', -1, eighth, 1, 0.05))

const SLIME: PatternNote[] = [
  note('slime', 0, 0, 1, 0.04, 1),
  note('slime', 2, 4, 1, 0.034, 1),
  note('slime', 4, 8, 1, 0.036, 1),
  note('slime', 2, 12, 1, 0.032, 1),
]

const TEAM: PatternNote[] = [note('team', 4, 0, 2, 0.048, 1), note('team', 2, 2, 2, 0.042, 1)]

const PATTERNS: Record<MusicPattern, PatternNote[]> = {
  menu: [...DRUMS, ...BASS, ...HARMONY],
  round: [...DRUMS, ...BASS, ...HARMONY, ...ROUND_LEAD, ...FUN, ...LAST, ...SLIME, ...TEAM],
  final: [...DRUMS, ...BASS, ...HARMONY, ...FINAL_LEAD, ...FUN, ...LAST, ...SLIME, ...TEAM],
  cheer: [...DRUMS, ...BASS, ...HARMONY, ...CHEER_LEAD, ...FUN],
}
