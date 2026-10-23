import {
  SLOT_QUALIFY_PCT,
  qualifyQuota,
  type LevelPlug,
  type RoundType,
  type ShowSlot,
} from '@wobblebeans/shared'
import { SHOW } from './constants'
import { SUMMIT_GRAB_ID, TILE_DROP_ID, tileDropQualifier } from './levels'

/**
 * Doc 01 §4.4 MVP weights. Logic is omitted until that round type ships (ISS-05).
 * A type with no legal level contributes nothing; the selector renormalises over what remains.
 */
const TYPE_WEIGHT: Record<ShowSlot, Partial<Record<RoundType, number>>> = {
  R1: { course: 80, survival: 10, points: 10 },
  R2: { course: 39, survival: 33, points: 28 },
  R3: { survival: 44, points: 34, course: 22 },
  R4: { survival: 44, points: 34, course: 22 },
  F: { 'final-survival': 1, 'final-trophy': 1 },
}

export interface SelectInput {
  slot: ShowSlot
  playerCount: number
  roundNumber: number
  playedIds: ReadonlySet<string>
  lastRoundType: RoundType | null
  cohort: 'new' | 'open'
  levels: readonly LevelPlug[]
  freshness: (levelId: string) => number
  rng: () => number
  allocatedAtMs: number
  disabled: readonly { id: string; disabledAtMs: number }[]
}

export interface SelectResult {
  level: LevelPlug
  fallback: boolean
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function family(type: RoundType): string {
  return type
}

function disabledIds(input: SelectInput): Set<string> {
  const out = new Set<string>()
  for (const row of input.disabled) {
    if (input.allocatedAtMs - row.disabledAtMs >= SHOW.disableLeadMs) out.add(row.id)
  }
  return out
}

function legal(input: SelectInput): LevelPlug[] {
  const blocked = disabledIds(input)
  return input.levels.filter((level) => {
    if (!level.slots.includes(input.slot)) return false
    if (input.playerCount < level.minPlayers || input.playerCount > level.maxPlayers) return false
    if (input.playedIds.has(level.id)) return false
    if (blocked.has(level.id)) return false
    if (input.slot === 'F' && level.roundType !== 'final-survival' && level.roundType !== 'final-trophy') return false
    if (input.cohort === 'new' && input.slot === 'R1' && !level.r1Safe) return false
    return true
  })
}

function avoidsRepeat(pool: LevelPlug[], last: RoundType | null): LevelPlug[] {
  if (!last) return pool
  const next = pool.filter((level) => family(level.roundType) !== family(last))
  return next.length > 0 ? next : pool
}

/** The next round can still become a legal Final (AD-29 look-ahead). */
export function keepsAFinal(level: LevelPlug, input: SelectInput): boolean {
  if (input.slot === 'F') return true
  const percent = level.qualifyPct ?? SLOT_QUALIFY_PCT[input.slot]
  const next = qualifyQuota(input.playerCount, percent)
  const nextIsFinal = next <= SHOW.finalMax || input.roundNumber + 1 >= SHOW.maxRounds
  if (!nextIsFinal || next <= 1) return true
  return input.levels.some((candidate) => {
    if (candidate.id === level.id) return false
    if (!candidate.slots.includes('F')) return false
    if (candidate.roundType !== 'final-survival' && candidate.roundType !== 'final-trophy') return false
    if (input.playedIds.has(candidate.id)) return false
    return next >= candidate.minPlayers && next <= candidate.maxPlayers
  })
}

function weightOf(level: LevelPlug, slot: ShowSlot, fresh: number): number {
  const typeWeight = TYPE_WEIGHT[slot][level.roundType] ?? 0
  if (typeWeight <= 0) return 0
  return typeWeight * level.weight * fresh
}

function weightedPick(levels: readonly LevelPlug[], input: SelectInput): LevelPlug {
  const weights = levels.map((level) => weightOf(level, input.slot, input.freshness(level.id)))
  const usable = weights.some((weight) => weight > 0) ? weights : levels.map((level) => level.weight)
  const total = usable.reduce((sum, weight) => sum + weight, 0)
  let cursor = input.rng() * total
  for (let i = 0; i < levels.length; i++) {
    cursor -= usable[i] ?? 0
    if (cursor <= 0) return levels[i]!
  }
  return levels[levels.length - 1]!
}

function fallback(input: SelectInput): LevelPlug {
  if (input.slot === 'F') {
    const summit = input.levels.find((level) => level.id === SUMMIT_GRAB_ID)
    if (summit && input.playerCount <= summit.maxPlayers && input.playerCount >= summit.minPlayers) return summit
    const tile = input.levels.find((level) => level.id === TILE_DROP_ID)
    if (tile) return { ...tile, roundType: 'final-survival', slots: ['F'] }
    return {
      id: TILE_DROP_ID,
      roundType: 'final-survival',
      slots: ['F'],
      minPlayers: 2,
      maxPlayers: 40,
      weight: 1,
      timeLimitS: 300,
      qualifyPct: null,
      r1Safe: false,
    }
  }
  return tileDropQualifier(input.slot)
}

export function selectLevel(input: SelectInput): SelectResult {
  const pool = avoidsRepeat(legal(input), input.lastRoundType)
  const looked = pool.filter((level) => keepsAFinal(level, input))
  const usable = looked.length > 0 ? looked : pool
  if (usable.length === 0) return { level: fallback(input), fallback: true }
  return { level: weightedPick(usable, input), fallback: false }
}
