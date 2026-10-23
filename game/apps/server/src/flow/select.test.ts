import { describe, expect, it } from 'vitest'
import type { LevelPlug } from '@wobblebeans/shared'
import { MVP_LEVELS } from './levels'
import { mulberry32, selectLevel, type SelectInput } from './select'

function input(partial: Partial<SelectInput> & Pick<SelectInput, 'slot' | 'playerCount'>): SelectInput {
  return {
    roundNumber: partial.slot === 'R1' ? 1 : partial.slot === 'R2' ? 2 : partial.slot === 'F' ? 4 : 3,
    playedIds: new Set(),
    lastRoundType: null,
    cohort: 'open',
    levels: MVP_LEVELS,
    freshness: () => 1,
    rng: () => 0,
    allocatedAtMs: 1_000_000,
    disabled: [],
    ...partial,
  }
}

describe('round selection', () => {
  it('is stable for a seed and does not repeat a level', () => {
    const first = selectLevel(input({ slot: 'R1', playerCount: 32, rng: mulberry32(4) }))
    const second = selectLevel(input({ slot: 'R1', playerCount: 32, rng: mulberry32(4) }))
    expect(second.level.id).toBe(first.level.id)
    const next = selectLevel(
      input({
        slot: 'R2',
        playerCount: 22,
        playedIds: new Set([first.level.id]),
        lastRoundType: first.level.roundType,
        rng: mulberry32(4),
      }),
    )
    expect(next.level.id).not.toBe(first.level.id)
    expect(next.level.roundType).not.toBe(first.level.roundType)
  })

  it('skips a level disabled at least 60 seconds before the show', () => {
    const picked = selectLevel(
      input({
        slot: 'R1',
        playerCount: 32,
        disabled: [{ id: 'knock-knock-run', disabledAtMs: 1_000_000 - 60_000 }],
      }),
    )
    expect(picked.level.id).toBe('bumpy-parade')
    const recent = selectLevel(
      input({
        slot: 'R1',
        playerCount: 32,
        rng: () => 0,
        disabled: [{ id: 'knock-knock-run', disabledAtMs: 1_000_000 - 59_000 }],
      }),
    )
    expect(recent.level.id).toBe('knock-knock-run')
  })

  it('keeps grab-steal points levels out of a new-player round 1', () => {
    const points: LevelPlug = {
      id: 'tail-chase',
      roundType: 'points',
      slots: ['R1', 'R2'],
      minPlayers: 2,
      maxPlayers: 40,
      weight: 100,
      timeLimitS: 30,
      qualifyPct: null,
      r1Safe: false,
    }
    const picked = selectLevel(
      input({
        slot: 'R1',
        playerCount: 32,
        cohort: 'new',
        levels: [...MVP_LEVELS.filter((level) => level.id !== 'tail-chase'), points],
        rng: () => 0.99,
      }),
    )
    expect(picked.level.r1Safe).toBe(true)
    expect(picked.level.roundType).toBe('course')
  })

  it('rejects a qualifier that would leave no legal final', () => {
    const wide: LevelPlug = {
      id: 'wide',
      roundType: 'course',
      slots: ['R1'],
      minPlayers: 2,
      maxPlayers: 40,
      weight: 1,
      timeLimitS: 30,
      qualifyPct: 0.9,
      r1Safe: true,
    }
    const narrow: LevelPlug = {
      id: 'narrow',
      roundType: 'course',
      slots: ['R1'],
      minPlayers: 2,
      maxPlayers: 40,
      weight: 50,
      timeLimitS: 30,
      qualifyPct: 0.3,
      r1Safe: true,
    }
    const tinyFinal: LevelPlug = {
      id: 'tiny-final',
      roundType: 'final-trophy',
      slots: ['F'],
      minPlayers: 2,
      maxPlayers: 4,
      weight: 1,
      timeLimitS: 30,
      qualifyPct: null,
      r1Safe: false,
    }
    const picked = selectLevel(
      input({
        slot: 'R1',
        playerCount: 20,
        roundNumber: 1,
        levels: [wide, narrow, tinyFinal],
        rng: () => 0.99,
      }),
    )
    expect(picked.level.id).toBe('wide')
  })

  it('chooses a final the field can actually play', () => {
    const picked = selectLevel(input({ slot: 'F', playerCount: 8, rng: () => 0 }))
    expect(picked.level.slots).toContain('F')
    expect(picked.level.maxPlayers).toBeGreaterThanOrEqual(8)
    const crowd = selectLevel(input({ slot: 'F', playerCount: 12, rng: () => 0.99 }))
    expect(crowd.level.id).toBe('tile-drop')
  })
})
