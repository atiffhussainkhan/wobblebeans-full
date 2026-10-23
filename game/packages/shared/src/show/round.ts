/**
 * Plug-in contract for workstream 3 levels.
 *
 * A level calls `registerLevel` with a `LevelPlug`. The show director is the
 * only caller that counts a `QualifyDecision` (doc 02, workstream 3). Overrides
 * replace a catalogue row with the same `id`, so adding a `qualify` function
 * later does not change callers that only read the metadata.
 *
 * Wire layout is unchanged. Round flow travels as `EventKind.RoundState`
 * (kind 4) with the numeric codes below — preset ids, never display strings.
 */

export const RoundStateCode = {
  Queue: 1,
  LowPop: 2,
  RoundIntro: 3,
  SpawnHold: 4,
  Countdown: 5,
  Go: 6,
  Play: 7,
  Outcome: 8,
  Interstitial: 9,
  FinalIntro: 10,
  Final: 11,
  Results: 12,
  Menu: 13,
  Aborted: 14,
  Quota: 15,
  Spectate: 16,
  Practice: 17,
} as const

export type RoundStateCodeId = (typeof RoundStateCode)[keyof typeof RoundStateCode]

export type RoundType = 'course' | 'survival' | 'points' | 'final-survival' | 'final-trophy'

export type ShowSlot = 'R1' | 'R2' | 'R3' | 'R4' | 'F'

/** Doc 01 §4.4 MVP weights are renormalised in the selector over levels that exist. */
export const SLOT_QUALIFY_PCT: Record<ShowSlot, number> = {
  R1: 0.7,
  R2: 0.6,
  R3: 0.6,
  R4: 0.6,
  F: 1,
}

export interface EntrantSample {
  slotId: number
  isBot: boolean
  eliminated: boolean
  connected: boolean
  finished: boolean
  finishTick: number | null
  alive: boolean
  /** Set when a survival / slime fall removes the bean. */
  fallTick: number | null
  score: number
  scoreTick: number | null
}

export interface RoundSample {
  tick: number
  elapsedS: number
  timeLimitS: number
  quota: number
  roundType: RoundType
  timedOut: boolean
  entrants: readonly EntrantSample[]
}

export interface QualifyDecision {
  done: boolean
  qualifiedSlotIds: number[]
  eliminatedSlotIds: number[]
  /** Final time-out or an exact tie: every qualified id wins (AD-10). */
  allWin: boolean
}

export interface LevelPlug {
  id: string
  roundType: RoundType
  slots: readonly ShowSlot[]
  minPlayers: number
  maxPlayers: number
  /** Weight inside the level's round type. */
  weight: number
  timeLimitS: number
  /**
   * When set, replaces the slot percent. Used for the Tile Drop qualifier
   * fallback (60%, doc 01 ISS-10). Null uses `SLOT_QUALIFY_PCT`.
   */
  qualifyPct: number | null
  /** Grab-steal points levels are not allowed in R1 (doc 01 ISS-11). */
  r1Safe: boolean
  /** Pure. Omit to use the director's rule for `roundType`. */
  qualify?(sample: RoundSample): QualifyDecision
}

const registry: LevelPlug[] = []

/** Dev 3 registers a level, or replaces the catalogue row with the same id. */
export function registerLevel(level: LevelPlug): void {
  const index = registry.findIndex((row) => row.id === level.id)
  if (index >= 0) registry[index] = level
  else registry.push(level)
}

export function registeredLevels(): readonly LevelPlug[] {
  return registry
}

export function slotForRound(roundNumber: number): ShowSlot {
  if (roundNumber <= 1) return 'R1'
  if (roundNumber === 2) return 'R2'
  if (roundNumber === 3) return 'R3'
  return 'R4'
}
