import { AUDIO, audioDef, type AudioEventId } from '@wobblebeans/shared'

/**
 * Original toy-synth recipes. No samples, no lyrics, no voice.
 * One-shots stay under 3 s (stingers under 4 s) and peaks stay under −3 dBFS
 * before the bus trim. Reward jingles are three musical notes, not a coin shower.
 */

export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise'
export type FilterKind = 'lowpass' | 'highpass' | 'bandpass'

export interface Tone {
  wave: Wave
  freq: number
  freqEnd?: number
  at: number
  dur: number
  gain: number
  filter?: FilterKind
  filterHz?: number
  filterQ?: number
  attack: number
  release: number
}

export interface Recipe {
  tones: Tone[]
  loop: boolean
  /** Variation picks a row. Trick doors use this for thunk vs boing. */
  alts?: Tone[][]
}

interface Spec {
  kind: 'glide' | 'tap' | 'noise' | 'melody' | 'chord' | 'hum' | 'air'
  pitch: number
  ratio?: number
  dur?: number
  gain?: number
  wave?: Wave
  filter?: FilterKind
  filterHz?: number
  steps?: number[]
  step?: number
}

const OVERRIDES: Record<string, Spec> = {
  [AUDIO.jump]: { kind: 'glide', pitch: 520, ratio: 1.55, dur: 0.12, gain: 0.22, wave: 'sine' },
  [AUDIO.land]: { kind: 'tap', pitch: 180, dur: 0.1, gain: 0.2 },
  [AUDIO.landHard]: { kind: 'noise', pitch: 140, dur: 0.16, gain: 0.24, filter: 'lowpass', filterHz: 500 },
  [AUDIO.dive]: { kind: 'noise', pitch: 900, dur: 0.22, gain: 0.18, filter: 'highpass', filterHz: 700 },
  [AUDIO.diveSlide]: { kind: 'air', pitch: 640, gain: 0.07, filter: 'bandpass', filterHz: 900 },
  [AUDIO.grabStart]: { kind: 'glide', pitch: 280, ratio: 0.62, dur: 0.2, gain: 0.2, wave: 'sine' },
  [AUDIO.grabHold]: { kind: 'air', pitch: 420, gain: 0.045, filter: 'bandpass', filterHz: 500 },
  [AUDIO.grabRelease]: { kind: 'glide', pitch: 300, ratio: 1.7, dur: 0.1, gain: 0.18 },
  [AUDIO.breakFree]: { kind: 'glide', pitch: 620, ratio: 0.45, dur: 0.08, gain: 0.2 },
  [AUDIO.bump]: { kind: 'tap', pitch: 150, dur: 0.09, gain: 0.22 },
  [AUDIO.stumble]: { kind: 'melody', pitch: 240, steps: [0, 2, 4], step: 0.09, gain: 0.16, wave: 'sine' },
  [AUDIO.ragdoll]: { kind: 'glide', pitch: 360, ratio: 0.4, dur: 0.28, gain: 0.16, wave: 'triangle' },
  [AUDIO.recover]: { kind: 'glide', pitch: 280, ratio: 2, dur: 0.18, gain: 0.18 },
  [AUDIO.fallOff]: { kind: 'glide', pitch: 1400, ratio: 0.24, dur: 0.7, gain: 0.16, wave: 'sine' },
  [AUDIO.respawn]: { kind: 'melody', pitch: 880, steps: [0, 4, 7], step: 0.07, gain: 0.16, wave: 'triangle' },
  [AUDIO.oobWarn]: { kind: 'melody', pitch: 660, steps: [0, 4], step: 0.14, gain: 0.14, wave: 'sine' },
  [AUDIO.slimeOut]: { kind: 'melody', pitch: 220, steps: [0, 4, 0], step: 0.1, gain: 0.16, wave: 'sine' },
  [AUDIO.quickChat]: { kind: 'melody', pitch: 740, steps: [0], step: 0.07, dur: 0.08, gain: 0.12 },
  [AUDIO.emoteWave]: { kind: 'melody', pitch: 520, steps: [0, 4], step: 0.1, gain: 0.12 },
  [AUDIO.emoteCheer]: { kind: 'melody', pitch: 640, steps: [0, 7], step: 0.09, gain: 0.13 },
  [AUDIO.emoteDance]: { kind: 'melody', pitch: 480, steps: [0, 4, 7], step: 0.08, gain: 0.12 },
  [AUDIO.celebWave]: { kind: 'melody', pitch: 523, steps: [0, 4, 7], step: 0.11, gain: 0.15 },
  [AUDIO.celebCheer]: { kind: 'melody', pitch: 587, steps: [0, 4, 7, 12], step: 0.1, gain: 0.15 },
  [AUDIO.celebDance]: { kind: 'melody', pitch: 494, steps: [0, 7, 4, 12], step: 0.1, gain: 0.15 },
  [AUDIO.checkpoint]: { kind: 'melody', pitch: 784, steps: [0, 7], step: 0.12, gain: 0.18, wave: 'triangle' },
  [AUDIO.swingBall]: { kind: 'glide', pitch: 180, ratio: 1.25, dur: 0.35, gain: 0.14, wave: 'sawtooth', filter: 'lowpass', filterHz: 700 },
  [AUDIO.spinBar]: { kind: 'air', pitch: 180, gain: 0.06, filter: 'bandpass', filterHz: 420 },
  [AUDIO.spinMallet]: { kind: 'noise', pitch: 300, dur: 0.18, gain: 0.16, filter: 'bandpass', filterHz: 600 },
  [AUDIO.tiltPlank]: { kind: 'glide', pitch: 140, ratio: 1.4, dur: 0.4, gain: 0.12, wave: 'sawtooth', filter: 'lowpass', filterHz: 600 },
  [AUDIO.conveyor]: { kind: 'air', pitch: 110, gain: 0.05, filter: 'lowpass', filterHz: 400 },
  [AUDIO.bumper]: { kind: 'tap', pitch: 200, dur: 0.08, gain: 0.2 },
  [AUDIO.pusher]: { kind: 'glide', pitch: 160, ratio: 0.7, dur: 0.28, gain: 0.16, wave: 'triangle' },
  [AUDIO.launchArm]: { kind: 'glide', pitch: 220, ratio: 2.4, dur: 0.32, gain: 0.18, wave: 'sine' },
  [AUDIO.dropTileWarn]: { kind: 'melody', pitch: 300, steps: [0, 2, 0, 2], step: 0.06, gain: 0.12, wave: 'triangle' },
  [AUDIO.dropTileDrop]: { kind: 'glide', pitch: 420, ratio: 0.35, dur: 0.16, gain: 0.18 },
  [AUDIO.trickdoor]: { kind: 'tap', pitch: 130, dur: 0.1, gain: 0.2 },
  [AUDIO.slimeRise]: { kind: 'air', pitch: 240, gain: 0.05, filter: 'lowpass', filterHz: 500 },
  [AUDIO.boingglove]: { kind: 'glide', pitch: 180, ratio: 2.8, dur: 0.22, gain: 0.2 },
  [AUDIO.swinglog]: { kind: 'glide', pitch: 150, ratio: 1.3, dur: 0.4, gain: 0.14, wave: 'sawtooth', filter: 'lowpass', filterHz: 650 },
  [AUDIO.count3]: { kind: 'melody', pitch: 523.25, steps: [0], dur: 0.16, gain: 0.16, wave: 'triangle' },
  [AUDIO.count2]: { kind: 'melody', pitch: 659.25, steps: [0], dur: 0.16, gain: 0.16, wave: 'triangle' },
  [AUDIO.count1]: { kind: 'melody', pitch: 783.99, steps: [0], dur: 0.16, gain: 0.17, wave: 'triangle' },
  [AUDIO.countGo]: { kind: 'chord', pitch: 523.25, steps: [0, 4, 7], dur: 0.28, gain: 0.16, wave: 'triangle' },
  [AUDIO.uiWarning]: { kind: 'melody', pitch: 440, steps: [0, 4, 0], step: 0.12, gain: 0.13, wave: 'sine' },
  [AUDIO.qualified]: { kind: 'melody', pitch: 523.25, steps: [0, 4, 7, 12], step: 0.16, gain: 0.18, wave: 'triangle' },
  [AUDIO.greatTry]: { kind: 'melody', pitch: 523.25, steps: [0, 4, 7, 12], step: 0.22, gain: 0.15, wave: 'sine' },
  [AUDIO.finalStinger]: { kind: 'melody', pitch: 392, steps: [0, 7, 12, 16], step: 0.16, gain: 0.17, wave: 'triangle' },
  [AUDIO.introRace]: { kind: 'melody', pitch: 523.25, steps: [0, 4, 7, 12], step: 0.14, gain: 0.16 },
  [AUDIO.introSurvival]: { kind: 'melody', pitch: 494, steps: [0, 7, 4, 12], step: 0.15, gain: 0.16 },
  [AUDIO.introTeam]: { kind: 'melody', pitch: 440, steps: [0, 4, 0, 7], step: 0.15, gain: 0.16 },
  [AUDIO.introHunt]: { kind: 'melody', pitch: 587, steps: [7, 4, 7, 12], step: 0.13, gain: 0.16 },
  [AUDIO.introFinal]: { kind: 'melody', pitch: 392, steps: [0, 7, 12, 19], step: 0.16, gain: 0.17 },
  [AUDIO.rewardXp]: { kind: 'melody', pitch: 784, steps: [0, 4, 7], step: 0.11, gain: 0.14 },
  [AUDIO.rewardCoins]: { kind: 'melody', pitch: 880, steps: [0, 4, 7], step: 0.12, gain: 0.13 },
  [AUDIO.rewardItem]: { kind: 'melody', pitch: 698, steps: [0, 4, 7], step: 0.12, gain: 0.14 },
  [AUDIO.uiPurchase]: { kind: 'melody', pitch: 520, steps: [0], dur: 0.07, gain: 0.1, wave: 'sine' },
  [AUDIO.uiError]: { kind: 'melody', pitch: 392, steps: [0, 4], step: 0.12, gain: 0.1, wave: 'sine' },
  [AUDIO.endWhistle]: { kind: 'melody', pitch: 880, steps: [0, 5], step: 0.14, gain: 0.12, wave: 'sine' },
  [AUDIO.lastSecondsTick]: { kind: 'melody', pitch: 988, steps: [0], dur: 0.05, gain: 0.1 },
  [AUDIO.huntTailLost]: { kind: 'melody', pitch: 520, steps: [0, 4], step: 0.1, gain: 0.13 },
  [AUDIO.qualifiedOther]: { kind: 'melody', pitch: 740, steps: [0, 7], step: 0.06, gain: 0.08 },
  [AUDIO.teamScoreOwn]: { kind: 'melody', pitch: 660, steps: [0, 4], step: 0.08, gain: 0.14 },
  [AUDIO.teamScoreOther]: { kind: 'melody', pitch: 520, steps: [0, 4], step: 0.08, gain: 0.1 },
}

export function recipeFor(id: AudioEventId): Recipe | null {
  const def = audioDef(id)
  if (def.group === 'music') return null
  const spec = OVERRIDES[id] ?? family(id, def.loop)
  const recipe = build(spec, def.loop)
  if (id === AUDIO.trickdoor) {
    const boing = build({ kind: 'glide', pitch: 240, ratio: 1.9, dur: 0.16, gain: 0.18 }, false)
    recipe.alts = [recipe.tones, boing.tones]
  }
  return recipe
}

export function recipePeak(recipe: Recipe): number {
  const tones = recipe.tones
  const end = tones.reduce((max, tone) => Math.max(max, tone.at + tone.dur), 0)
  let peak = 0
  for (let t = 0; t <= end; t += 0.005) {
    let sum = 0
    for (const tone of tones) {
      if (t >= tone.at && t < tone.at + tone.dur) sum += tone.gain
    }
    if (sum > peak) peak = sum
  }
  return peak
}

export function recipeLength(recipe: Recipe): number {
  return recipe.tones.reduce((max, tone) => Math.max(max, tone.at + tone.dur), 0)
}

function family(id: string, loop: boolean): Spec {
  const pitch = 180 + (hash(id) % 520)
  if (id.startsWith('amb_')) return { kind: 'air', pitch: 300 + (hash(id) % 200), gain: 0.04, filter: 'lowpass', filterHz: 800 }
  if (id.startsWith('ui_')) return { kind: 'melody', pitch: 500 + (hash(id) % 400), steps: [0], dur: 0.06, gain: 0.1 }
  if (id.startsWith('sfx_char_footstep')) return { kind: 'tap', pitch: footPitch(id), dur: 0.05, gain: 0.16 }
  if (loop) {
    if (/hover|light|plate|gate/.test(id)) return { kind: 'hum', pitch, gain: 0.05 }
    return { kind: 'air', pitch, gain: 0.055, filter: 'bandpass', filterHz: 700 }
  }
  if (/bubble|blub/.test(id)) return { kind: 'melody', pitch: 360, steps: [0, 5], step: 0.08, gain: 0.14 }
  if (/chime|zoom|spark/.test(id)) return { kind: 'melody', pitch, steps: [0, 4, 7], step: 0.08, gain: 0.14 }
  if (/click|button|flip|pin|clack/.test(id)) return { kind: 'tap', pitch: 480, dur: 0.04, gain: 0.16 }
  if (/whoosh|tube|fan|wind|mallet/.test(id)) return { kind: 'noise', pitch, dur: 0.2, gain: 0.14, filter: 'bandpass', filterHz: 900 }
  return { kind: 'tap', pitch, dur: 0.09, gain: 0.16 }
}

function footPitch(id: string): number {
  if (id.endsWith('metal')) return 720
  if (id.endsWith('wood')) return 280
  if (id.endsWith('slime')) return 180
  if (id.endsWith('ice')) return 860
  if (id.endsWith('water')) return 400
  return 340
}

function hash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function build(spec: Spec, loop: boolean): Recipe {
  const gain = spec.gain ?? 0.16
  const wave = spec.wave ?? 'sine'
  switch (spec.kind) {
    case 'glide':
      return {
        loop,
        tones: [
          tone({
            wave,
            freq: spec.pitch,
            freqEnd: spec.pitch * (spec.ratio ?? 1.4),
            dur: spec.dur ?? 0.16,
            gain,
            filter: spec.filter,
            filterHz: spec.filterHz,
          }),
        ],
      }
    case 'tap':
      return {
        loop,
        tones: [
          tone({ wave: 'noise', freq: spec.pitch, dur: spec.dur ?? 0.06, gain: gain * 0.8, filter: 'lowpass', filterHz: spec.filterHz ?? 1400, attack: 0.002, release: 0.03 }),
          tone({ wave: 'sine', freq: spec.pitch, dur: Math.min(0.08, spec.dur ?? 0.06), gain: gain * 0.7, attack: 0.002, release: 0.03 }),
        ],
      }
    case 'noise':
      return {
        loop,
        tones: [
          tone({
            wave: 'noise',
            freq: spec.pitch,
            dur: spec.dur ?? 0.18,
            gain,
            filter: spec.filter ?? 'bandpass',
            filterHz: spec.filterHz ?? spec.pitch,
            filterQ: 0.8,
          }),
        ],
      }
    case 'melody':
      return { loop, tones: sequence(spec, false) }
    case 'chord':
      return { loop, tones: sequence(spec, true) }
    case 'hum':
      return {
        loop: true,
        tones: [tone({ wave: 'sine', freq: spec.pitch, dur: 1, gain, attack: 0.05, release: 0.08 })],
      }
    case 'air':
      return {
        loop: true,
        tones: [
          tone({
            wave: 'noise',
            freq: spec.pitch,
            dur: 1,
            gain,
            filter: spec.filter ?? 'bandpass',
            filterHz: spec.filterHz ?? 800,
            filterQ: 0.7,
            attack: 0.05,
            release: 0.08,
          }),
        ],
      }
  }
}

function sequence(spec: Spec, chord: boolean): Tone[] {
  const steps = spec.steps ?? [0]
  const step = spec.step ?? 0.12
  const gain = spec.gain ?? 0.15
  return steps.map((semi, index) =>
    tone({
      wave: spec.wave ?? 'triangle',
      freq: spec.pitch * 2 ** (semi / 12),
      at: chord ? 0 : index * step,
      dur: spec.dur ?? step * 0.92,
      gain,
      attack: 0.008,
      release: 0.05,
    }),
  )
}

function tone(partial: Omit<Tone, 'at' | 'attack' | 'release'> & { at?: number; attack?: number; release?: number }): Tone {
  return {
    at: 0,
    attack: 0.008,
    release: 0.04,
    ...partial,
  }
}
