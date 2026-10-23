import { describe, expect, it } from 'vitest'
import type { EntrantSample, RoundSample } from '@wobblebeans/shared'
import { qualifyQuota } from '@wobblebeans/shared'
import { evaluateRound } from './qualify'

function entrant(partial: Partial<EntrantSample> & Pick<EntrantSample, 'slotId'>): EntrantSample {
  return {
    isBot: false,
    eliminated: false,
    connected: true,
    finished: false,
    finishTick: null,
    alive: true,
    fallTick: null,
    score: 0,
    scoreTick: null,
    ...partial,
  }
}

function sample(partial: Partial<RoundSample> & Pick<RoundSample, 'roundType' | 'entrants'>): RoundSample {
  return {
    tick: 1,
    elapsedS: 1,
    timeLimitS: 30,
    quota: 2,
    timedOut: false,
    ...partial,
  }
}

describe('qualify rules', () => {
  it('qualifies the first two of four beans in a race', () => {
    const quota = qualifyQuota(4, 0.5)
    expect(quota).toBe(2)
    const decision = evaluateRound(
      sample({
        roundType: 'course',
        quota,
        entrants: [
          entrant({ slotId: 1, finished: true, finishTick: 3 }),
          entrant({ slotId: 2, finished: true, finishTick: 4 }),
          entrant({ slotId: 3, finished: true, finishTick: 9 }),
          entrant({ slotId: 4 }),
        ],
      }),
    )
    expect(decision.done).toBe(true)
    expect(decision.qualifiedSlotIds).toEqual([1, 2])
    expect(decision.eliminatedSlotIds).toEqual([3, 4])
  })

  it('qualifies everyone still racing when the remaining spots cover them', () => {
    const decision = evaluateRound(
      sample({
        roundType: 'course',
        quota: 3,
        entrants: [
          entrant({ slotId: 1, finished: true, finishTick: 1 }),
          entrant({ slotId: 2 }),
          entrant({ slotId: 3 }),
        ],
      }),
    )
    expect(decision.qualifiedSlotIds.sort()).toEqual([1, 2, 3])
  })

  it('keeps a survival round open until the living field fits the quota', () => {
    const open = evaluateRound(
      sample({
        roundType: 'survival',
        quota: 1,
        entrants: [
          entrant({ slotId: 1 }),
          entrant({ slotId: 2 }),
          entrant({ slotId: 3, alive: false, eliminated: true }),
        ],
      }),
    )
    expect(open.done).toBe(false)
    const closed = evaluateRound(
      sample({
        roundType: 'survival',
        quota: 1,
        timedOut: true,
        entrants: [entrant({ slotId: 1 }), entrant({ slotId: 2 }), entrant({ slotId: 3, alive: false })],
      }),
    )
    expect(closed.qualifiedSlotIds.sort()).toEqual([1, 2])
    expect(closed.allWin).toBe(false)
  })

  it('ranks a tied points score with humans above bots and takes exactly the quota', () => {
    const decision = evaluateRound(
      sample({
        roundType: 'points',
        quota: 1,
        timedOut: true,
        entrants: [
          entrant({ slotId: 1, isBot: true, score: 5, scoreTick: 1 }),
          entrant({ slotId: 2, score: 5, scoreTick: 4 }),
        ],
      }),
    )
    expect(decision.qualifiedSlotIds).toEqual([2])
  })

  it('gives a final time-out to everyone still in', () => {
    const decision = evaluateRound(
      sample({
        roundType: 'final-trophy',
        quota: 1,
        timedOut: true,
        entrants: [entrant({ slotId: 1 }), entrant({ slotId: 2 }), entrant({ slotId: 3, isBot: true })],
      }),
    )
    expect(decision.allWin).toBe(true)
    expect(decision.qualifiedSlotIds.sort()).toEqual([1, 2])
  })

  it('treats a same-tick survival wipe as a shared win', () => {
    const decision = evaluateRound(
      sample({
        roundType: 'final-survival',
        quota: 1,
        entrants: [
          entrant({ slotId: 1, alive: false, eliminated: true, fallTick: 8 }),
          entrant({ slotId: 2, alive: false, eliminated: true, fallTick: 8 }),
        ],
      }),
    )
    expect(decision.done).toBe(true)
    expect(decision.allWin).toBe(true)
    expect(decision.qualifiedSlotIds.sort()).toEqual([1, 2])
  })
})
