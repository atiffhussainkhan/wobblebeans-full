import { AUDIO, EventKind, Locomotion } from '@wobblebeans/shared'
import { describe, expect, it } from 'vitest'
import { AudioEngine } from './engine'
import { GauntletEar, type EarPose } from './gauntlet'
import { memoryStore } from './settings'

function pose(partial: Partial<EarPose> = {}): EarPose {
  return {
    locomotion: Locomotion.Idle,
    grounded: true,
    vx: 0,
    vy: 0,
    vz: 0,
    px: 0,
    py: 0,
    pz: 0,
    finished: false,
    ...partial,
  }
}

function rig() {
  const bus = new AudioEngine({ store: memoryStore(), handheld: false, fadeIn: false, hapticSink: () => {} })
  return { bus, ear: new GauntletEar(bus) }
}

describe('gauntlet ear', () => {
  it('plays jump on the take-off and not while idle', () => {
    const { bus, ear } = rig()
    ear.beforeStep(pose())
    ear.afterStep(pose())
    expect(bus.snapshot().voiced).not.toContain(AUDIO.jump)
    ear.beforeStep(pose())
    ear.afterStep(pose({ locomotion: Locomotion.Jump, grounded: false, vy: 7.5 }))
    expect(bus.snapshot().voiced.filter((id) => id === AUDIO.jump)).toHaveLength(1)
    ear.beforeStep(pose({ locomotion: Locomotion.Jump, grounded: false }))
    ear.afterStep(pose({ locomotion: Locomotion.Jump, grounded: false }))
    expect(bus.snapshot().voiced.filter((id) => id === AUDIO.jump)).toHaveLength(1)
  })

  it('lands soft from a hop and hard from a fall', () => {
    const soft = rig()
    soft.ear.beforeStep(pose({ locomotion: Locomotion.Jump, grounded: false, vy: -9 }))
    soft.ear.afterStep(pose({ locomotion: Locomotion.Idle, grounded: true, vy: 0 }))
    expect(soft.bus.snapshot().voiced).toContain(AUDIO.land)
    expect(soft.bus.snapshot().voiced).not.toContain(AUDIO.landHard)

    const hard = rig()
    hard.ear.beforeStep(pose({ locomotion: Locomotion.Fall, grounded: false, vy: -16 }))
    hard.ear.afterStep(pose({ locomotion: Locomotion.Idle, grounded: true, vy: 0 }))
    expect(hard.bus.snapshot().voiced).toContain(AUDIO.landHard)
  })

  it('starts the slide loop on DiveSlide and sequences fall then respawn', () => {
    const { bus, ear } = rig()
    ear.beforeStep(pose())
    ear.afterStep(pose({ locomotion: Locomotion.Dive, grounded: false }))
    expect(bus.snapshot().voiced).toContain(AUDIO.dive)
    ear.beforeStep(pose({ locomotion: Locomotion.Dive, grounded: false }))
    ear.afterStep(pose({ locomotion: Locomotion.DiveSlide, grounded: true }))
    expect(bus.snapshot().voiced).toContain(AUDIO.diveSlide)

    const fall = rig()
    fall.ear.beforeStep(pose({ py: 1 }))
    fall.ear.afterStep(pose({ py: 1, pz: 3 }))
    expect(fall.bus.snapshot().voiced).toContain(AUDIO.fallOff)
    expect(fall.bus.snapshot().voiced).not.toContain(AUDIO.respawn)
    fall.ear.frame(0.2)
    expect(fall.bus.snapshot().voiced).toContain(AUDIO.respawn)
  })

  it('holds a race intro, then play, and stays on qualified after the finish', () => {
    const intro = rig()
    intro.ear.onWelcome()
    expect(intro.bus.musicState()).toBe('roundIntro')
    intro.ear.frame(2.3)
    expect(intro.bus.musicState()).toBe('play')

    const finish = rig()
    finish.ear.onWelcome()
    finish.ear.beforeStep(pose())
    finish.ear.afterStep(pose({ finished: true }))
    expect(finish.bus.musicState()).toBe('qualified')
    expect(finish.bus.snapshot().voiced).toContain(AUDIO.qualified)
    finish.ear.frame(3)
    expect(finish.bus.musicState()).toBe('qualified')
  })

  it('plays quick chat, and a block silences that bean', () => {
    const { bus, ear } = rig()
    ear.onSocial(EventKind.QuickChat, 2, 1, true)
    expect(bus.snapshot().voiced).toContain(AUDIO.quickChat)
    bus.block(4)
    ear.onSocial(EventKind.Emote, 4, 1, false)
    expect(bus.snapshot().voiced).not.toContain(AUDIO.emoteWave)
    ear.onSocial(EventKind.Emote, 4, 1, true)
    expect(bus.snapshot().voiced).toContain(AUDIO.emoteWave)
  })

  it('steps while running, a few taps and not a drum roll', () => {
    const { bus, ear } = rig()
    const running = pose({ locomotion: Locomotion.Run, grounded: true, vx: 9 })
    for (let i = 0; i < 40; i++) {
      ear.beforeStep(running)
      ear.afterStep(running)
    }
    const steps = bus.snapshot().voiced.filter((id) => id === AUDIO.footstepDefault).length
    expect(steps).toBeGreaterThan(1)
    expect(steps).toBeLessThan(20)
  })
})
