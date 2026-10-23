import { mountCueLayer } from './cues'
import { AudioEngine } from './engine'
import { GauntletEar } from './gauntlet'
import { AUDIO_STORE_KEY, type KeyValueStore } from './settings'

/** Browser entry. Resumes on the first gesture, mutes in the background, and shows cue twins. */
export function mountGauntletAudio(doc: Document = document): GauntletEar {
  const handheld = isHandheld(doc.defaultView)
  const engine = new AudioEngine({
    store: browserStore(),
    handheld,
    fadeIn: true,
  })
  engine.attachView(mountCueLayer(doc))
  const ear = new GauntletEar(engine)
  const resume = () => engine.resume()
  doc.addEventListener('pointerdown', resume)
  doc.defaultView?.addEventListener('keydown', resume)
  doc.addEventListener('visibilitychange', () => {
    engine.setBackground(doc.visibilityState === 'hidden')
  })
  doc.defaultView?.addEventListener('pagehide', () => engine.setBackground(true))
  doc.defaultView?.addEventListener('gamepadconnected', () => engine.noteGamepads(padCount()))
  doc.defaultView?.addEventListener('gamepaddisconnected', () => engine.noteGamepads(padCount()))
  return ear
}

function isHandheld(view: Window | null | undefined): boolean {
  if (!view) return false
  const coarse = typeof view.matchMedia === 'function' && view.matchMedia('(pointer: coarse)').matches
  return coarse || view.innerWidth < 820
}

function browserStore(): KeyValueStore | null {
  try {
    const store = globalThis.localStorage
    if (!store) return null
    store.setItem(AUDIO_STORE_KEY, store.getItem(AUDIO_STORE_KEY) ?? '')
    if (store.getItem(AUDIO_STORE_KEY) === '') store.removeItem(AUDIO_STORE_KEY)
    return store
  } catch {
    return null
  }
}

function padCount(): number {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return 0
  return navigator.getGamepads().filter((pad) => pad !== null).length
}
