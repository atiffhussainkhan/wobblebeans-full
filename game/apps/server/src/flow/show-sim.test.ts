import { describe, expect, it } from 'vitest'
import {
  EventKind,
  RoundStateCode,
  qualifyQuota,
  type LevelPlug,
} from '@wobblebeans/shared'
import { ShowCheckpointStore } from './checkpoint'
import { SHOW } from './constants'
import { ShowDirector, runUntilSettled, type RosterMember } from './director'
import { scriptedShowDriver } from './driver'
import { PracticePlayground } from './practice'
import { REWARD } from './rewards'

const fast = { intro: 1, spawnHold: 1, countdown: 3, outcome: 1, interstitial: 1, results: 1 }

function roster(humans: number, bots = 0): RosterMember[] {
  const rows: RosterMember[] = []
  for (let i = 1; i <= humans; i++) rows.push({ slotId: i, playerId: `p${i}`, isBot: false, showsCompleted: 9 })
  for (let i = 1; i <= bots; i++) {
    rows.push({ slotId: humans + i, playerId: `bot:${i}`, isBot: true })
  }
  return rows
}

function director(rosterRows: RosterMember[], extra: Partial<ConstructorParameters<typeof ShowDirector>[0]> = {}) {
  return new ShowDirector({
    showId: 'show-sim',
    configVersion: 'foundation-1',
    region: 'eu-w',
    seed: 3,
    roster: rosterRows,
    phaseTicks: fast,
    driver: scriptedShowDriver(),
    ...extra,
  })
}

describe('show director', () => {
  it('runs a 4-bean show, emits round state, and refuses a final of only bots', () => {
    const show = director(roster(4))
    expect(show.inputLocked).toBe(true)
    runUntilSettled(show)
    const codes = show.events.filter((event) => event.kind === EventKind.RoundState).map((event) => event.code)
    expect(codes).toContain(RoundStateCode.FinalIntro)
    expect(codes).toContain(RoundStateCode.Countdown)
    expect(codes).toContain(RoundStateCode.Go)
    expect(codes.indexOf(RoundStateCode.Final)).toBeGreaterThan(codes.indexOf(RoundStateCode.Go))
    expect(codes).toContain(RoundStateCode.Results)
    expect(codes).toContain(RoundStateCode.Menu)
    expect(show.winners).toHaveLength(1)
    expect(show.winners[0]?.isBot).toBe(false)
    expect(show.phase).toBe('menu')
    expect(show.playAgain()).toEqual({ requeued: false })

    const bots = director(roster(0, 4), { showId: 'bots-only' })
    runUntilSettled(bots)
    const botCodes = bots.events.filter((event) => event.kind === EventKind.RoundState).map((event) => event.code)
    expect(botCodes).not.toContain(RoundStateCode.Final)
    expect(botCodes).not.toContain(RoundStateCode.FinalIntro)
    expect(bots.finalDidStart).toBe(false)
    expect(bots.winners).toHaveLength(0)
    expect(bots.toMatchResult()).toBeNull()
  })

  it('lets every human still in win a final that times out', () => {
    const level: LevelPlug = {
      id: 'summit-grab',
      roundType: 'final-trophy',
      slots: ['F'],
      minPlayers: 2,
      maxPlayers: 10,
      weight: 1,
      timeLimitS: 0.02,
      qualifyPct: null,
      r1Safe: false,
    }
    const show = director(roster(4), { levels: [level], driver: { tick() {} }, seed: 1 })
    runUntilSettled(show)
    expect(show.winners).toHaveLength(4)
    expect(show.winners.every((winner) => !winner.isBot)).toBe(true)
  })

  it('qualifies 32 → 22 → 13 → 8 and then a final, with bots kept out of that final', () => {
    const store = new ShowCheckpointStore()
    const applied = new Set<string>()
    const applyOnce = (showId: string) => {
      if (applied.has(showId)) return { duplicate: true }
      applied.add(showId)
      return { duplicate: false }
    }
    const show = director(roster(32), {
      showId: 'show-32',
      checkpoints: store,
      onResult: (result) => applyOnce(result.showId),
    })
    runUntilSettled(show)
    expect(show.qualifierPath).toEqual([22, 13, 8])
    expect(show.finalDidStart).toBe(true)
    expect(show.finalists).toHaveLength(8)
    expect(show.finalists.every((finalist) => !finalist.isBot)).toBe(true)
    expect(show.winners).toHaveLength(1)
    const result = show.toMatchResult()
    expect(result?.participants).toHaveLength(32)
    const champion = result?.participants.find((row) => row.playerId === 'p1')
    expect(champion).toMatchObject({
      qualifiedRounds: 3,
      wonFinal: true,
      xpEarned: REWARD.xpParticipation + REWARD.xpQualifiedRound * 3 + REWARD.xpReachedFinal + REWARD.xpWin,
      coinsEarned: REWARD.coinsShow + REWARD.coinsPerQualifiedRound * 3 + REWARD.coinsWin,
    })
    const firstOut = result?.participants.find((row) => row.playerId === 'p32')
    expect(firstOut).toMatchObject({ qualifiedRounds: 0, wonFinal: false, xpEarned: REWARD.xpParticipation, coinsEarned: REWARD.coinsShow })
    expect(store.latest('show-32')?.completedRounds).toBe(4)
    expect(applyOnce(result!.showId).duplicate).toBe(true)

    const withBots = director(roster(22, 10), { showId: 'show-bots' })
    runUntilSettled(withBots)
    expect(withBots.qualifierPath).toEqual([22, 13, 8])
    expect(withBots.finalists.every((finalist) => !finalist.isBot)).toBe(true)
    expect(withBots.winners.every((winner) => !winner.isBot)).toBe(true)
    expect(withBots.toMatchResult()?.participants.some((row) => row.playerId.startsWith('bot:'))).toBe(false)
  })

  it('does not shrink the quota when someone disconnects, and bounds reconnect', () => {
    const show = director(roster(16), { driver: { tick() {} }, showId: 'show-dc' })
    let guard = 0
    while (show.phase !== 'play' && guard < 5_000) {
      show.step()
      guard += 1
    }
    const quota = show.quota
    expect(quota).toBe(qualifyQuota(16, 0.7))
    expect(show.onSocketClosed(16)).toBe(true)
    const token = show.reconnectTokenFor('p16')
    expect(token).toBeTruthy()
    expect(show.resume(token!, 'p16', 'show-other')).toBeNull()
    expect(show.resume(token!, 'p1', show.showId)).toBeNull()
    expect(show.resume(token!, 'p16', show.showId)).toBe(16)
    expect(show.resume(token!, 'p16', show.showId)).toBeNull()
    expect(show.onSocketClosed(16)).toBe(true)
    expect(show.resume(show.reconnectTokenFor('p16')!, 'p16', show.showId)).toBe(16)
    expect(show.onSocketClosed(16)).toBe(false)
    expect(show.quota).toBe(quota)

    const expiring = director(roster(16), { driver: { tick() {} }, showId: 'show-expire' })
    guard = 0
    while (expiring.phase !== 'play' && guard < 5_000) {
      expiring.step()
      guard += 1
    }
    const frozen = expiring.quota
    expect(expiring.onSocketClosed(16)).toBe(true)
    expiring.step(Math.ceil(SHOW.reconnectMs / 20) + 5)
    expect(expiring.quota).toBe(frozen)
    expect(expiring.events.some((event) => event.kind === EventKind.Eliminated && event.subjectId === 16)).toBe(true)
    expect(expiring.resume(expiring.reconnectTokenFor('p16') ?? 'gone', 'p16', expiring.showId)).toBeNull()
  })

  it('checkpoints completed rounds and does not invent a winner after a crash', () => {
    const store = new ShowCheckpointStore()
    const show = director(roster(32), { showId: 'show-crash', checkpoints: store })
    let guard = 0
    while (show.qualifierPath.length < 1 && guard < 20_000) {
      show.step()
      guard += 1
    }
    guard = 0
    while ((show.round < 2 || show.phase !== 'play') && guard < 20_000) {
      show.step()
      guard += 1
    }
    const result = show.abort()
    expect(show.phase).toBe('aborted')
    expect(result?.participants.every((row) => row.wonFinal === false)).toBe(true)
    expect(Math.max(...(result?.participants.map((row) => row.qualifiedRounds) ?? [0]))).toBe(1)
    expect(store.latest('show-crash')?.completedRounds).toBe(1)
    expect(show.playAgain().requeued).toBe(false)
  })

  it('gives practice no rewards', () => {
    const practice = new PracticePlayground('p1', 3)
    expect(practice.rewards).toEqual({ xpEarned: 0, coinsEarned: 0 })
    expect(practice.matchResult()).toBeNull()
    const frames = practice.step(4)
    expect(frames).toHaveLength(3)
    expect(frames.every((frame) => frame.quickChat === 0 && frame.emote === 0 && frame.moveZ < 1)).toBe(true)
    expect(() => new PracticePlayground('p1', SHOW.practiceMaxBots + 1)).toThrow(/practice/)
  })
})
