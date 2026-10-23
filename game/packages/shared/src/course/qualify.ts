import type { QualifyMode } from './schema'

/**
 * Pure qualify rules. The show director is the only caller that counts.
 * Disconnects are already `eliminated` when they reach this function, and
 * they do not change `quota` (FR-01-04). That subtraction happens before the call.
 */

export interface RoundActor {
  id: number
  eliminated: boolean
  finishTick: number | null
  elimTick: number | null
  score: number
  trophyTick: number | null
}

export type QualifyReason = 'playing' | 'quota' | 'timer' | 'impossible' | 'winner' | 'tie'

export interface QualifyResult {
  ended: boolean
  reason: QualifyReason
  qualifiedIds: number[]
}

export interface QualifyOpts {
  mode: QualifyMode
  /** When false, Tile Drop uses the survival quota instead of last-bean (I-5). */
  final: boolean
  quota: number
  tick: number
  limitTick: number
}

export function qualifyRound(actors: readonly RoundActor[], opts: QualifyOpts): QualifyResult {
  const mode = opts.mode === 'last-standing' && !opts.final ? 'survival' : opts.mode
  switch (mode) {
    case 'race':
      return qualifyRace(actors, opts)
    case 'survival':
      return qualifySurvival(actors, opts)
    case 'points':
      return qualifyPoints(actors, opts)
    case 'last-standing':
      return qualifyLastStanding(actors, opts)
    case 'trophy':
      return qualifyTrophy(actors, opts)
    default:
      return { ended: false, reason: 'playing', qualifiedIds: [] }
  }
}

function qualifyRace(actors: readonly RoundActor[], opts: QualifyOpts): QualifyResult {
  const finished = actors
    .filter((actor) => actor.finishTick != null && !actor.eliminated)
    .sort((a, b) => a.finishTick! - b.finishTick! || a.id - b.id)
  const racing = actors.filter((actor) => !actor.eliminated && actor.finishTick == null)
  if (finished.length >= opts.quota) {
    return { ended: true, reason: 'quota', qualifiedIds: finished.slice(0, opts.quota).map((actor) => actor.id) }
  }
  if (finished.length + racing.length < opts.quota) {
    return { ended: true, reason: 'impossible', qualifiedIds: finished.map((actor) => actor.id) }
  }
  if (opts.tick >= opts.limitTick) {
    return { ended: true, reason: 'timer', qualifiedIds: finished.slice(0, opts.quota).map((actor) => actor.id) }
  }
  return { ended: false, reason: 'playing', qualifiedIds: [] }
}

function qualifySurvival(actors: readonly RoundActor[], opts: QualifyOpts): QualifyResult {
  const alive = actors.filter((actor) => !actor.eliminated)
  if (alive.length <= opts.quota) {
    return { ended: true, reason: 'quota', qualifiedIds: alive.map((actor) => actor.id) }
  }
  if (opts.tick >= opts.limitTick) {
    return { ended: true, reason: 'timer', qualifiedIds: alive.map((actor) => actor.id) }
  }
  return { ended: false, reason: 'playing', qualifiedIds: [] }
}

function qualifyPoints(actors: readonly RoundActor[], opts: QualifyOpts): QualifyResult {
  if (opts.tick < opts.limitTick) return { ended: false, reason: 'playing', qualifiedIds: [] }
  const holders = actors.filter((actor) => !actor.eliminated && actor.score > 0)
  return { ended: true, reason: 'timer', qualifiedIds: holders.map((actor) => actor.id) }
}

function qualifyLastStanding(actors: readonly RoundActor[], opts: QualifyOpts): QualifyResult {
  const alive = actors.filter((actor) => !actor.eliminated)
  if (alive.length === 1) {
    return { ended: true, reason: 'winner', qualifiedIds: [alive[0]!.id] }
  }
  if (alive.length === 0) {
    const ticks = actors.map((actor) => actor.elimTick ?? -1)
    const latest = Math.max(...ticks)
    const group = actors.filter((actor) => actor.elimTick === latest)
    return {
      ended: true,
      reason: group.length > 1 ? 'tie' : 'winner',
      qualifiedIds: group.map((actor) => actor.id),
    }
  }
  if (opts.tick >= opts.limitTick) {
    return { ended: true, reason: 'tie', qualifiedIds: alive.map((actor) => actor.id) }
  }
  return { ended: false, reason: 'playing', qualifiedIds: [] }
}

function qualifyTrophy(actors: readonly RoundActor[], opts: QualifyOpts): QualifyResult {
  const grabs = actors.filter((actor) => !actor.eliminated && actor.trophyTick != null)
  if (grabs.length) {
    const best = Math.min(...grabs.map((actor) => actor.trophyTick!))
    const winners = grabs.filter((actor) => actor.trophyTick === best)
    return {
      ended: true,
      reason: winners.length > 1 ? 'tie' : 'winner',
      qualifiedIds: winners.map((actor) => actor.id),
    }
  }
  if (opts.tick >= opts.limitTick) {
    const alive = actors.filter((actor) => !actor.eliminated)
    return { ended: true, reason: 'tie', qualifiedIds: alive.map((actor) => actor.id) }
  }
  return { ended: false, reason: 'playing', qualifiedIds: [] }
}

/** Seeded shuffle so a show can hand tails to exactly `count` players. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pickTailHolders(ids: readonly number[], count: number, seed: number): number[] {
  const bag = [...ids]
  const rand = mulberry32(seed || 1)
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const swap = bag[i]!
    bag[i] = bag[j]!
    bag[j] = swap
  }
  return bag.slice(0, Math.max(0, Math.min(count, bag.length)))
}
