import type { LevelPlug } from '@wobblebeans/shared'

/**
 * MVP round catalogue (doc 02, round-doc names).
 * Dev 3 owns the `CourseDef` for each id. Register a `LevelPlug` with the same
 * id to attach a pure `qualify` function; the director merges it over this row.
 * Geometry does not live here.
 */
export const MVP_LEVELS: readonly LevelPlug[] = [
  {
    id: 'knock-knock-run',
    roundType: 'course',
    slots: ['R1', 'R2'],
    minPlayers: 8,
    maxPlayers: 40,
    weight: 1,
    timeLimitS: 180,
    qualifyPct: null,
    r1Safe: true,
  },
  {
    id: 'bumpy-parade',
    roundType: 'course',
    slots: ['R1'],
    minPlayers: 8,
    maxPlayers: 40,
    weight: 1,
    timeLimitS: 180,
    qualifyPct: null,
    r1Safe: true,
  },
  {
    id: 'slime-rise',
    roundType: 'course',
    slots: ['R2', 'R3', 'R4'],
    minPlayers: 8,
    maxPlayers: 32,
    weight: 1,
    timeLimitS: 140,
    qualifyPct: null,
    r1Safe: false,
  },
  {
    id: 'beam-hop',
    roundType: 'survival',
    slots: ['R2', 'R3', 'R4'],
    minPlayers: 8,
    maxPlayers: 40,
    weight: 1,
    timeLimitS: 90,
    qualifyPct: null,
    r1Safe: false,
  },
  {
    id: 'wall-dodge',
    roundType: 'survival',
    slots: ['R2', 'R3', 'R4'],
    minPlayers: 8,
    maxPlayers: 40,
    weight: 1,
    timeLimitS: 105,
    qualifyPct: null,
    r1Safe: false,
  },
  {
    id: 'tail-chase',
    roundType: 'points',
    slots: ['R2', 'R3', 'R4'],
    minPlayers: 8,
    maxPlayers: 40,
    weight: 1,
    timeLimitS: 120,
    qualifyPct: null,
    /** Grab-steal. Banned from R1 (doc 01 ISS-11). */
    r1Safe: false,
  },
  {
    id: 'tile-drop',
    roundType: 'final-survival',
    slots: ['F'],
    minPlayers: 2,
    maxPlayers: 40,
    weight: 1,
    timeLimitS: 300,
    qualifyPct: null,
    r1Safe: false,
  },
  {
    id: 'summit-grab',
    roundType: 'final-trophy',
    slots: ['F'],
    minPlayers: 2,
    maxPlayers: 10,
    weight: 1,
    timeLimitS: 300,
    qualifyPct: null,
    r1Safe: false,
  },
]

export const TILE_DROP_ID = 'tile-drop'
export const SUMMIT_GRAB_ID = 'summit-grab'

/** Non-final empty-slot fallback: Tile Drop with a 60% quota and a 1:45 limit (ISS-10). */
export function tileDropQualifier(slot: LevelPlug['slots'][number]): LevelPlug {
  return {
    id: TILE_DROP_ID,
    roundType: 'survival',
    slots: [slot],
    minPlayers: 2,
    maxPlayers: 40,
    weight: 1,
    timeLimitS: 105,
    qualifyPct: 0.6,
    r1Safe: true,
  }
}

export function mergeLevels(base: readonly LevelPlug[], registered: readonly LevelPlug[]): LevelPlug[] {
  const map = new Map(base.map((level) => [level.id, { ...level }]))
  for (const level of registered) {
    const prev = map.get(level.id)
    map.set(level.id, prev ? { ...prev, ...level, slots: level.slots.length > 0 ? level.slots : prev.slots } : { ...level })
  }
  return [...map.values()]
}
