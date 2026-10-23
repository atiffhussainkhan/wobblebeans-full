import { registerLevel, type LevelPlug } from '../show/round'
import { BEAM_HOP, buildBeamHop } from './levels/beam-hop'
import { BUMPY_PARADE, buildBumpyParade } from './levels/bumpy-parade'
import { KNOCK_KNOCK_RUN, buildKnockKnock } from './levels/knock-knock-run'
import { SLIME_RISE, buildSlimeRise } from './levels/slime-rise'
import { SUMMIT_GRAB, buildSummitGrab } from './levels/summit-grab'
import { TAIL_CHASE, buildTailChase } from './levels/tail-chase'
import { TILE_DROP, buildTileDrop } from './levels/tile-drop'
import { WALL_DODGE, buildWallDodge } from './levels/wall-dodge'
import type { LevelDef } from './schema'

/**
 * Workstream 3 level table.
 *
 * CourseDef is unchanged. Kit data hangs off a box at runtime and is not part of
 * courseHash or physicsHash, so the gauntlet join check stays valid.
 *
 * Welcome cannot name a course: its byte layout is frozen. LEVEL_CODE is the
 * preset id stream 4 can put in an existing event code. Strings stay off the wire.
 *
 * The live gauntlet client keeps predicting the foundation course until that
 * event exists. `levels.html` runs each course locally so the layouts are playable
 * without a protocol change.
 *
 * Falls: the director banks a checkpoint when feet drop below -3 m. The frozen
 * world only teleports at -6 m, and one tick cannot cross that span, so the
 * checkpoint wins on a normal fall.
 */

export const LEVEL_CODE = {
  knock_knock_run: 1,
  bumpy_parade: 2,
  slime_rise: 3,
  beam_hop: 4,
  wall_dodge: 5,
  tail_chase: 6,
  tile_drop: 7,
  summit_grab: 8,
} as const

export type LevelId = keyof typeof LEVEL_CODE

const byCourse = new Map<string, LevelDef>()

function storeLevel(level: LevelDef): LevelDef {
  byCourse.set(level.course.id, level)
  return level
}

export function levelForCourse(courseId: string): LevelDef | null {
  return byCourse.get(courseId) ?? null
}

export function levelById(id: string): LevelDef | null {
  for (const level of byCourse.values()) {
    if (level.record.id === id && level.course.id === id) return level
  }
  return null
}

export const SHOW_LEVELS: readonly LevelDef[] = [
  KNOCK_KNOCK_RUN,
  BUMPY_PARADE,
  SLIME_RISE,
  BEAM_HOP,
  WALL_DODGE,
  TAIL_CHASE,
  TILE_DROP,
  SUMMIT_GRAB,
].map(storeLevel)

storeLevel(buildKnockKnock({ variant: 'easy' }))
storeLevel(buildKnockKnock({ variant: 'faster' }))
storeLevel(buildBumpyParade({ variant: 'easy' }))
storeLevel(buildSlimeRise({ variant: 'easy' }))
storeLevel(buildSlimeRise({ variant: 'faster' }))
storeLevel(buildBeamHop({ variant: 'r3' }))
storeLevel(buildWallDodge({ variant: 'r3' }))
storeLevel(buildTailChase({ variant: 'r3' }))

/**
 * Same ids, slots, and limits as the Main Show catalogue (PR 2 `MVP_LEVELS`).
 * `registerLevel` replaces a catalogue row with this id. Course geometry stays
 * on the snake_case `CourseDef`; `levelForPlug` is the join.
 * Qualify stays on the show director's round-type rule (bots included).
 */
export const PLUG_COURSE_ID = {
  'knock-knock-run': 'knock_knock_run',
  'bumpy-parade': 'bumpy_parade',
  'slime-rise': 'slime_rise',
  'beam-hop': 'beam_hop',
  'wall-dodge': 'wall_dodge',
  'tail-chase': 'tail_chase',
  'tile-drop': 'tile_drop',
  'summit-grab': 'summit_grab',
} as const

const SHOW_PLUGS: readonly LevelPlug[] = [
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

for (const plug of SHOW_PLUGS) registerLevel(plug)

export function levelForPlug(plugId: string): LevelDef | null {
  const courseId = PLUG_COURSE_ID[plugId as keyof typeof PLUG_COURSE_ID]
  return courseId ? levelForCourse(courseId) : null
}

export interface ShowCourseOpts {
  players?: number
  variant?: string
  seed?: number
}

/** Build the course the show should simulate. Disabled named swaps stay callable but flagged. */
export function courseForShow(id: string, opts: ShowCourseOpts = {}): LevelDef {
  const variant = opts.variant ?? 'base'
  const players = opts.players ?? 10
  if (id === 'tile_drop' && variant === 'base' && players >= 8 && players <= 12) return TILE_DROP
  let level: LevelDef
  switch (id) {
    case 'knock_knock_run':
      level = buildKnockKnock({
        variant: variant === 'easy' || variant === 'faster' ? variant : 'base',
        seed: opts.seed ?? 1,
      })
      break
    case 'bumpy_parade':
      level = buildBumpyParade({ variant: variant === 'easy' || variant === 'swap' ? variant : 'base' })
      break
    case 'slime_rise':
      level = buildSlimeRise({ variant: variant === 'easy' || variant === 'faster' ? variant : 'base' })
      break
    case 'beam_hop':
      level = buildBeamHop({ variant: variant === 'r3' ? 'r3' : 'r2' })
      break
    case 'wall_dodge':
      level = buildWallDodge({ variant: variant === 'r3' ? 'r3' : 'r2' })
      break
    case 'tail_chase':
      level = buildTailChase({ variant: variant === 'r3' ? 'r3' : 'r2' })
      break
    case 'tile_drop':
      level = buildTileDrop({ players, variant: variant === 'return' ? 'return' : 'base' })
      break
    case 'summit_grab':
      level = buildSummitGrab({ variant: variant === 'windy' ? 'windy' : 'base' })
      break
    default:
      throw new Error(`unknown level ${id}`)
  }
  return storeLevel(level)
}
