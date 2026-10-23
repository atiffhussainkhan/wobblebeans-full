import { VOLUME } from '@wobblebeans/shared'
import type { HapticMode } from './haptics'

export const AUDIO_STORE_KEY = 'wobblebeans.audio.v1'

export type SoundRingMode = 'auto' | 'on' | 'off'

export interface AudioSettings {
  master: number
  music: number
  sfx: number
  ui: number
  musicMuted: boolean
  sfxMuted: boolean
  headphones: boolean
  mono: boolean
  balance: number
  haptics: HapticMode
  motionComfort: boolean
  soundRing: SoundRingMode
  soundIcons: boolean
  /** Null means the parent has not set a cap. */
  parentMax: number | null
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
  }
}

export function defaultSettings(handheld: boolean): AudioSettings {
  return {
    master: VOLUME.master,
    music: VOLUME.music,
    sfx: VOLUME.sfx,
    ui: VOLUME.ui,
    musicMuted: false,
    sfxMuted: false,
    /** Headphones trim defaults on for a handheld, off for a desk. */
    headphones: handheld,
    mono: false,
    balance: 0,
    haptics: 'full',
    motionComfort: false,
    soundRing: 'auto',
    soundIcons: false,
    parentMax: null,
  }
}

export function loadSettings(store: KeyValueStore | null, handheld: boolean): AudioSettings {
  const base = defaultSettings(handheld)
  if (!store) return base
  const raw = store.getItem(AUDIO_STORE_KEY)
  if (!raw) return base
  try {
    const parsed = JSON.parse(raw) as Partial<AudioSettings>
    return {
      master: unit(parsed.master, base.master),
      music: unit(parsed.music, base.music),
      sfx: unit(parsed.sfx, base.sfx),
      ui: unit(parsed.ui, base.ui),
      musicMuted: bool(parsed.musicMuted, false),
      sfxMuted: bool(parsed.sfxMuted, false),
      headphones: bool(parsed.headphones, base.headphones),
      mono: bool(parsed.mono, false),
      balance: clampNum(parsed.balance, -1, 1, 0),
      haptics: parsed.haptics === 'reduced' || parsed.haptics === 'off' ? parsed.haptics : 'full',
      motionComfort: bool(parsed.motionComfort, false),
      soundRing: parsed.soundRing === 'on' || parsed.soundRing === 'off' ? parsed.soundRing : 'auto',
      soundIcons: bool(parsed.soundIcons, false),
      parentMax: parsed.parentMax === null || parsed.parentMax === undefined ? null : unit(parsed.parentMax, VOLUME.sliderMax),
    }
  } catch {
    return base
  }
}

export function saveSettings(store: KeyValueStore | null, settings: AudioSettings): void {
  if (!store) return
  store.setItem(AUDIO_STORE_KEY, JSON.stringify(settings))
}

function unit(value: unknown, fallback: number): number {
  return clampNum(value, VOLUME.sliderMin, VOLUME.sliderMax, fallback)
}

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}
