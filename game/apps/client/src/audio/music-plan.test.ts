import { AUDIO, VOLUME, WORLD_THEMES, type WorldTheme } from '@wobblebeans/shared'
import { describe, expect, it } from 'vitest'
import {
  commitLayers,
  defaultMusicRequest,
  degreeHz,
  emptyLayers,
  resolveMusic,
  scheduleBed,
  type MusicLayers,
  type MusicRequest,
} from './music-plan'

function req(partial: Partial<MusicRequest> = {}): MusicRequest {
  return { ...defaultMusicRequest(), ...partial }
}

describe('music plan', () => {
  it('follows the round, not a streak', () => {
    const early = resolveMusic(req({ state: 'play', roundProgress: 0 }), null)
    const late = resolveMusic(req({ state: 'play', roundProgress: 0.5 }), null)
    const pressure = resolveMusic(req({ state: 'play', qualifyPressure: true }), null)
    const hurry = resolveMusic(req({ state: 'lastSeconds' }), early)
    expect(early.intensity).toBe(1)
    expect(early.layers.lead).toBe(false)
    expect(late.intensity).toBe(2)
    expect(late.layers.lead).toBe(true)
    expect(late.layers.fun).toBe(false)
    expect(pressure.intensity).toBe(3)
    expect(pressure.layers.fun).toBe(true)
    expect(hurry.intensity).toBe(3)
    expect(hurry.bpm).toBe(early.bpm)
    expect(hurry.layers.last).toBe(true)
  })

  it('maps show states to beds, ducks, and entry stingers', () => {
    const menu = resolveMusic(req(), null)
    expect(menu.crossfadeSec).toBe(2)
    expect(menu.bpm).toBeGreaterThanOrEqual(95)
    expect(menu.bpm).toBeLessThanOrEqual(110)
    expect(resolveMusic(req({ dressingRoom: true }), null).layers.fun).toBe(true)

    const lobby = resolveMusic(req({ state: 'lobby', lobbyFill: 1 }), null)
    expect(lobby.bpm).toBe(100)
    expect(lobby.layers.lead).toBe(true)
    expect(lobby.layers.fun).toBe(false)
    expect(lobby.barSync).toBe(true)

    expect(resolveMusic(req({ state: 'parent' }), null).duckDb).toBe(VOLUME.parentDuckDb)
    expect(resolveMusic(req({ settingsOpen: true }), null).duckDb).toBe(VOLUME.settingsDuckDb)

    const play = resolveMusic(req({ state: 'play' }), null)
    const qualified = resolveMusic(req({ state: 'qualified' }), play)
    expect(qualified.duckDb).toBe(VOLUME.qualifiedDuckDb)
    expect(qualified.lowpassHz).toBe(VOLUME.lowpassQualifiedHz)
    expect(qualified.stinger).toBe(AUDIO.qualified)

    const out = resolveMusic(req({ state: 'out' }), play)
    expect(out.stinger).toBe(AUDIO.greatTry)

    const victory = resolveMusic(req({ state: 'victory' }), null)
    const results = resolveMusic(req({ state: 'results' }), null)
    expect(victory.bed).not.toBe(results.bed)

    const final = resolveMusic(req({ state: 'final', theme: 'meadow' }), play)
    expect(final.bpm).toBe(128)
    expect(play.bpm).toBe(128)
  })

  it('keeps every theme on a major third and gives the final its own lead', () => {
    for (const theme of WORLD_THEMES) {
      const root = degreeHz(theme, 0, 0)
      const third = degreeHz(theme, 2, 0)
      expect(third / root).toBeCloseTo(2 ** (4 / 12), 5)
    }
    const roundLead = leadFreqs('play', 'meadow')
    const finalLead = leadFreqs('final', 'meadow')
    expect(roundLead.length).toBeGreaterThan(0)
    expect(finalLead.join(',')).not.toBe(roundLead.join(','))
  })

  it('moves one layer per two bars, and the last-seconds perc takes the first slot', () => {
    const active: MusicLayers = { ...emptyLayers(), drums: true, bass: true, harmony: true }
    const desired: MusicLayers = { ...active, lead: true, fun: true, last: true }
    const held = commitLayers(active, desired, 1, 0, false)
    expect(held.changed).toBe(false)
    expect(held.layers.last).toBe(false)
    const stepped = commitLayers(active, desired, 2, 0, false)
    expect(stepped.layers.last).toBe(true)
    expect(stepped.layers.lead).toBe(false)
    expect(stepped.layers.fun).toBe(false)
    const forced = commitLayers(active, desired, 0, 0, true)
    expect(forced.layers).toEqual(desired)
  })
})

function leadFreqs(state: 'play' | 'final', theme: WorldTheme): number[] {
  const plan = resolveMusic(req({ state, theme }), null)
  const layers = { ...emptyLayers(), lead: true }
  const twoBars = ((60 / plan.bpm) * 4) * 2
  return scheduleBed(plan, layers, 0, twoBars, 0)
    .filter((note) => note.layer === 'lead')
    .map((note) => note.freq)
}
