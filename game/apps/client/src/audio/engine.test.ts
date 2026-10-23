import {
  AUDIO,
  HAPTICS,
  KIT_AUDIO,
  VOLUME,
  audioDef,
  listAudioIds,
  sliderGain,
} from '@wobblebeans/shared'
import { describe, expect, it } from 'vitest'
import { AudioEngine } from './engine'
import { createFakeHost } from './fake-host'
import type { HapticPulse } from './haptics'
import { memoryStore } from './settings'

function engine(extra: { handheld?: boolean; fadeIn?: boolean; now?: () => number; pulses?: HapticPulse[] } = {}) {
  return new AudioEngine({
    store: memoryStore(),
    handheld: extra.handheld ?? false,
    fadeIn: extra.fadeIn ?? false,
    now: extra.now,
    hapticSink: extra.pulses ? (pulse) => extra.pulses!.push(pulse) : () => {},
  })
}

describe('audio engine', () => {
  it('plays every catalogue id, and gameplay cues survive a mute', () => {
    for (const id of listAudioIds()) {
      const bus = engine()
      const played = bus.play(id, { self: true, x: 1, y: 0, z: 1 })
      const def = audioDef(id)
      expect(played.id).toBe(id)
      expect(played.bus).toBe(def.bus)
      if (def.group === 'music') {
        expect(played.dropped).toBe(true)
        expect(played.reason).toBe('bed')
      } else {
        expect(played.dropped, id).toBe(false)
      }
      if (def.gameplayRelevant) expect(played.visual?.cueId).toBe(def.visualCueId)
    }
  })

  it('keeps music and effects on separate sliders', () => {
    const bus = engine()
    bus.setMusicMuted(true)
    const jump = bus.play(AUDIO.jump, { self: true })
    expect(jump.dropped).toBe(false)
    expect(jump.bus).toBe('sfx_char')
    expect(bus.snapshot().musicGain).toBe(0)
    bus.setSfxMuted(true)
    expect(bus.play(AUDIO.jump, { self: true }).reason).toBe('muted')
  })

  it('still shows the fall vignette and the sound ring when the master is zero', () => {
    const bus = engine()
    bus.setMaster(0)
    const fall = bus.play(AUDIO.fallOff, { self: true })
    expect(fall.reason).toBe('muted')
    expect(fall.visual?.cueId).toBe('cue_fall_vignette')
    expect(bus.snapshot().ring).toBe(true)
  })

  it('throttles warnings and other-player qualifies', () => {
    let now = 0
    const bus = engine({ now: () => now })
    expect(bus.play(AUDIO.uiWarning).dropped).toBe(false)
    now = 1000
    expect(bus.play(AUDIO.uiWarning).reason).toBe('throttle')
    now = 1000 + VOLUME.warningThrottleSec * 1000
    expect(bus.play(AUDIO.uiWarning).dropped).toBe(false)

    now = 0
    const other = engine({ now: () => now })
    expect(other.play(AUDIO.qualifiedOther).dropped).toBe(false)
    now = 200
    expect(other.play(AUDIO.qualifiedOther).reason).toBe('throttle')
    now = VOLUME.qualifyOtherThrottleSec * 1000
    expect(other.play(AUDIO.qualifiedOther).dropped).toBe(false)
  })

  it('drops social sounds from a blocked player and still plays your own', () => {
    const bus = engine()
    bus.block(4)
    expect(bus.play(AUDIO.emoteWave, { playerId: 4, self: false }).reason).toBe('blocked')
    expect(bus.play(AUDIO.emoteWave, { playerId: 4, self: true }).dropped).toBe(false)
  })

  it('defaults headphones from the device and remembers a slider', () => {
    expect(engine({ handheld: false }).snapshot().headphones).toBe(false)
    expect(engine({ handheld: true }).snapshot().headphones).toBe(true)
    const store = memoryStore()
    const first = new AudioEngine({ store, handheld: false, fadeIn: false, hapticSink: () => {} })
    first.setMusic(40)
    const second = new AudioEngine({ store, handheld: false, fadeIn: false, hapticSink: () => {} })
    expect(second.getSettings().music).toBe(40)
  })

  it('ducks the bed for GO and social sounds for a tell', () => {
    const go = engine()
    go.play(AUDIO.countGo)
    expect(go.snapshot().duckDb).toBeLessThanOrEqual(VOLUME.musicDuckDb)
    const tell = engine()
    tell.play(AUDIO.swingBall, { x: 1, y: 0, z: 0 })
    expect(tell.snapshot().socialDuckDb).toBeCloseTo(VOLUME.socialDuckDb, 2)
  })

  it('haptics follow GO, grab, and qualify, and comfort turns them down', () => {
    const pulses: HapticPulse[] = []
    const bus = engine({ pulses })
    bus.play(AUDIO.countGo)
    bus.play(AUDIO.grabStart, { self: true })
    bus.setShow({ state: 'qualified' })
    expect(pulses.map((pulse) => pulse.id)).toEqual(['go', 'grab', 'qualified'])

    const quiet = engine()
    quiet.setHaptics('off')
    expect(quiet.play(AUDIO.countGo).haptic).toBeNull()

    const comfort = engine()
    comfort.setMotionComfort(true)
    expect(comfort.play(AUDIO.countGo).haptic!.strong).toBeLessThan(HAPTICS.go.strong)
  })

  it('obeys a parent cap, fades in, and reaches a slider within 100 ms', () => {
    const capped = engine()
    capped.setParentMax(0)
    expect(capped.play(AUDIO.jump).reason).toBe('muted')

    const fading = new AudioEngine({ store: memoryStore(), handheld: false, fadeIn: true, hapticSink: () => {} })
    expect(fading.snapshot().fade).toBe(0)
    fading.resume()
    fading.update(VOLUME.fadeInSec)
    expect(fading.snapshot().fade).toBe(1)

    const sliders = engine()
    const tick = sliders.setUi(100)
    expect(tick?.dropped).toBe(false)
    sliders.update(VOLUME.sliderResponseSec)
    expect(sliders.snapshot().uiGain).toBe(1)
    expect(sliders.setUi(0)?.reason).toBe('muted')
    expect(sliderGain(0)).toBe(0)
  })

  it('rejects a ninth far footstep and still voices a tell over a full bus', () => {
    const steps = engine()
    steps.setListener({ x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 1 })
    for (let i = 1; i <= 8; i++) {
      expect(steps.play(AUDIO.footstepDefault, { self: true, x: i, y: 0, z: 0 }).dropped).toBe(false)
    }
    expect(steps.play(AUDIO.footstepDefault, { self: true, x: 15, y: 0, z: 0 }).reason).toBe('voices')

    const full = engine()
    for (let i = 0; i < 32; i++) expect(full.play(AUDIO.bump).dropped).toBe(false)
    expect(full.play(AUDIO.swingBall, { x: 1, y: 0, z: 0 }).dropped).toBe(false)
  })

  it('plays the survival intro, then the round bed, and every kit piece', () => {
    const bus = engine()
    const intro = bus.setShow({ state: 'roundIntro', roundType: 'survival', theme: 'meadow' })
    expect(intro.stinger).toBe(AUDIO.introSurvival)
    expect(bus.snapshot().voiced).toContain(AUDIO.introSurvival)
    bus.setShow({ state: 'play', theme: 'meadow' })
    expect(bus.snapshot().bpm).toBe(128)
    const before = bus.snapshot().silentNotes
    bus.update(0.5)
    expect(bus.snapshot().silentNotes).toBeGreaterThan(before)

    const kit = engine()
    for (const id of Object.values(KIT_AUDIO)) {
      expect(kit.play(id, { x: 1, y: 0, z: 0 }).dropped, id).toBe(false)
    }
  })

  it('starts real nodes on a host for a jump and for the play bed', () => {
    const fake = createFakeHost()
    const bus = new AudioEngine({
      store: memoryStore(),
      host: fake.host,
      handheld: false,
      fadeIn: false,
      hapticSink: () => {},
    })
    expect(bus.play(AUDIO.jump, { self: true }).dropped).toBe(false)
    expect(fake.starts()).toBeGreaterThan(0)
    const afterJump = fake.starts()
    bus.setShow({ state: 'play', theme: 'candy' })
    bus.update(0.5)
    expect(fake.starts()).toBeGreaterThan(afterJump)
    expect(bus.snapshot().silentNotes).toBe(0)
  })

  it('aims the sound ring at an off-screen tell', () => {
    const bus = engine()
    bus.setListener({ x: 0, y: 1, z: 0, fx: 0, fy: 0, fz: 1 })
    const played = bus.play(AUDIO.swingBall, { x: 10, y: 1, z: 0 })
    expect(played.visual?.edgeAngle).not.toBeNull()
    expect(Math.abs(played.visual!.edgeAngle!)).toBeGreaterThan(0.55)
  })
})
