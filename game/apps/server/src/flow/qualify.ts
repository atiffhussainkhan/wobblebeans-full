import type { EntrantSample, QualifyDecision, RoundSample, RoundType } from '@wobblebeans/shared'

const OPEN: QualifyDecision = {
  done: false,
  qualifiedSlotIds: [],
  eliminatedSlotIds: [],
  allWin: false,
}

function done(qualified: readonly EntrantSample[], eliminated: readonly EntrantSample[], allWin = false): QualifyDecision {
  return {
    done: true,
    qualifiedSlotIds: qualified.map((e) => e.slotId),
    eliminatedSlotIds: eliminated.map((e) => e.slotId),
    allWin,
  }
}

function byFinish(a: EntrantSample, b: EntrantSample): number {
  const at = a.finishTick ?? Number.MAX_SAFE_INTEGER
  const bt = b.finishTick ?? Number.MAX_SAFE_INTEGER
  if (at !== bt) return at - bt
  if (a.isBot !== b.isBot) return a.isBot ? 1 : -1
  return a.slotId - b.slotId
}

function byScore(a: EntrantSample, b: EntrantSample): number {
  if (a.score !== b.score) return b.score - a.score
  if (a.isBot !== b.isBot) return a.isBot ? 1 : -1
  const at = a.scoreTick ?? Number.MAX_SAFE_INTEGER
  const bt = b.scoreTick ?? Number.MAX_SAFE_INTEGER
  if (at !== bt) return at - bt
  return a.slotId - b.slotId
}

/** First `quota` finishers. Everyone still racing qualifies when the spots can cover them. */
export function evaluateCourse(sample: RoundSample): QualifyDecision {
  const racing = sample.entrants.filter((e) => !e.eliminated)
  const finished = racing.filter((e) => e.finished).sort(byFinish)
  const pending = racing.filter((e) => !e.finished)
  const quota = sample.quota
  if (finished.length >= quota) {
    const qualified = finished.slice(0, quota)
    const qualifiedIds = new Set(qualified.map((e) => e.slotId))
    return done(
      qualified,
      racing.filter((e) => !qualifiedIds.has(e.slotId)),
    )
  }
  if (pending.length <= quota - finished.length) {
    return done([...finished, ...pending], [])
  }
  if (sample.timedOut) return done(finished, pending)
  return OPEN
}

/** Ends when the living field fits the quota, or on the timer (everyone still in qualifies). */
export function evaluateSurvival(sample: RoundSample): QualifyDecision {
  const alive = sample.entrants.filter((e) => !e.eliminated && e.alive)
  const out = sample.entrants.filter((e) => e.eliminated || !e.alive)
  if (alive.length <= sample.quota || sample.timedOut) return done(alive, out)
  return OPEN
}

export function evaluatePoints(sample: RoundSample): QualifyDecision {
  if (!sample.timedOut) return OPEN
  const ranked = sample.entrants.filter((e) => !e.eliminated).sort(byScore)
  return done(ranked.slice(0, sample.quota), ranked.slice(sample.quota))
}

/** Last standing wins. A same-tick wipe is a tie. Time-out: everyone still in wins. */
export function evaluateFinalSurvival(sample: RoundSample): QualifyDecision {
  const humans = sample.entrants.filter((e) => !e.isBot)
  const alive = humans.filter((e) => !e.eliminated && e.alive)
  const rest = sample.entrants.filter((e) => !alive.some((a) => a.slotId === e.slotId))
  if (sample.timedOut) return done(alive, rest, true)
  if (alive.length === 1) return done(alive, rest, false)
  if (alive.length === 0) {
    const ticks = humans.map((e) => e.fallTick ?? -1)
    const latest = Math.max(-1, ...ticks)
    const tied = latest >= 0 ? humans.filter((e) => e.fallTick === latest) : []
    const tiedIds = new Set(tied.map((e) => e.slotId))
    return done(
      tied,
      sample.entrants.filter((e) => !tiedIds.has(e.slotId)),
      tied.length !== 1,
    )
  }
  return OPEN
}

/** First grab wins. Equal server tick: everyone who grabbed on that tick wins. Time-out: field wins. */
export function evaluateFinalTrophy(sample: RoundSample): QualifyDecision {
  const humans = sample.entrants.filter((e) => !e.isBot && !e.eliminated)
  const grabbed = humans.filter((e) => e.finished).sort(byFinish)
  if (grabbed.length > 0) {
    const first = grabbed[0]!.finishTick
    const tied = grabbed.filter((e) => e.finishTick === first)
    const tiedIds = new Set(tied.map((e) => e.slotId))
    return done(
      tied,
      sample.entrants.filter((e) => !tiedIds.has(e.slotId)),
      tied.length > 1,
    )
  }
  if (sample.timedOut) {
    return done(
      humans,
      sample.entrants.filter((e) => e.isBot || e.eliminated),
      true,
    )
  }
  return OPEN
}

export function evaluateRound(sample: RoundSample): QualifyDecision {
  switch (sample.roundType) {
    case 'course':
      return evaluateCourse(sample)
    case 'survival':
      return evaluateSurvival(sample)
    case 'points':
      return evaluatePoints(sample)
    case 'final-survival':
      return evaluateFinalSurvival(sample)
    case 'final-trophy':
      return evaluateFinalTrophy(sample)
    default: {
      const exhaustive: never = sample.roundType
      throw new Error(`unknown round type ${exhaustive as RoundType}`)
    }
  }
}
