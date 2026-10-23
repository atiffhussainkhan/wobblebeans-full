import { describe, expect, it } from 'vitest'
import { FleetService } from './fleet'
import { MatchmakerService } from './matchmaker'

function ids(count: number, prefix = 'p'): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`)
}

describe('matchmaking', () => {
  it('starts 32 humans immediately and backfills 10 humans with 12 bots at 60 seconds', () => {
    const full = new MatchmakerService()
    for (const playerId of ids(32)) full.queue({ playerIds: [playerId], region: 'eu-w', showsCompleted: 9, nowMs: 0 })
    const started = full.tick(0)
    expect(started).toHaveLength(32)
    expect(started[0]?.botCount).toBe(0)
    expect(started[0]?.roster).toHaveLength(32)
    expect(started[0]?.region).toBe('eu-w')

    const thin = new MatchmakerService()
    const queued = ids(10).map((playerId) =>
      thin.queue({ playerIds: [playerId], region: 'na-e', showsCompleted: 9, nowMs: 0 }),
    )
    expect(thin.tick(59_000)).toHaveLength(0)
    const filled = thin.tick(60_000)
    expect(filled).toHaveLength(10)
    expect(filled[0]?.botCount).toBe(12)
    expect(filled[0]?.roster?.filter((member) => member.isBot)).toHaveLength(12)
    expect(filled[0]?.roster).toHaveLength(22)
    expect(queued.every((ticket) => thin.get(ticket.id)?.status === 'allocated')).toBe(true)
  })

  it('refuses a show under 8 humans and offers practice at 120 seconds without requeueing', () => {
    const mm = new MatchmakerService()
    const ticket = mm.queue({ playerIds: ['solo'], region: 'eu-c', showsCompleted: 9, nowMs: 0 })
    expect(mm.tick(60_000)).toHaveLength(0)
    expect(mm.tick(120_000)).toHaveLength(0)
    expect(mm.get(ticket.id)?.status).toBe('lowpop')
    expect(mm.get(ticket.id)?.practiceOffered).toBe(true)
    const practice = mm.acceptPractice(ticket.id, 3)
    expect(practice).toMatchObject({ xpEarned: 0, coinsEarned: 0, offline: true, botCount: 3 })
    expect(mm.tick(240_000)).toHaveLength(0)
    expect(mm.get(ticket.id)?.status).toBe('practice')
  })

  it('keeps a party of 4 together and rejects a fifth', () => {
    const mm = new MatchmakerService()
    const party = mm.createParty('leader')
    mm.invite(party.id, 'm2')
    mm.invite(party.id, 'm3')
    mm.invite(party.id, 'm4')
    expect(() => mm.invite(party.id, 'm5')).toThrow(/full/)
    expect(() => mm.queueParty(party.id, 'm2', { region: 'eu-w', showsCompleted: 9 })).toThrow(/leader/)
    const ticket = mm.queueParty(party.id, 'leader', { region: 'eu-w', showsCompleted: 9, nowMs: 0 })
    for (const playerId of ids(28)) {
      mm.queue({ playerIds: [playerId], region: 'eu-w', showsCompleted: 9, nowMs: 0 })
    }
    mm.tick(0)
    const roster = mm.get(ticket.id)?.roster ?? []
    const humans = roster.filter((member) => !member.isBot).map((member) => member.playerId)
    expect(humans).toEqual(expect.arrayContaining(['leader', 'm2', 'm3', 'm4']))
  })

  it('does not mix beacon regions until the client list widens, and rejects coordinates', () => {
    const mm = new MatchmakerService()
    expect(() => mm.queue({ playerIds: ['x'], region: '51.5, -0.1' })).toThrow(/beacon/)
    for (const playerId of ids(7, 'c')) {
      mm.queue({ playerIds: [playerId], region: 'eu-c', showsCompleted: 9, nowMs: 0 })
    }
    const west = mm.queue({
      playerIds: ['west'],
      region: 'eu-w',
      widenRegions: ['eu-c'],
      showsCompleted: 9,
      nowMs: 0,
    })
    expect(mm.tick(80_000)).toHaveLength(0)
    const started = mm.tick(90_000)
    expect(started.length).toBeGreaterThan(0)
    const roster = started[0]?.roster?.map((member) => member.playerId) ?? []
    expect(roster).toContain('west')
    expect(mm.get(west.id)?.showId).toBe(started[0]?.showId)
  })

  it('keeps new players together for 20 seconds, then lets them join the casual pool', () => {
    const mm = new MatchmakerService()
    for (const playerId of ids(16, 'n')) {
      mm.queue({ playerIds: [playerId], region: 'na-w', showsCompleted: 1, nowMs: 0 })
    }
    for (const playerId of ids(16, 'v')) {
      mm.queue({ playerIds: [playerId], region: 'na-w', showsCompleted: 6, nowMs: 0 })
    }
    expect(mm.tick(10_000)).toHaveLength(0)
    const started = mm.tick(20_000)
    expect(started).toHaveLength(32)
    expect(new Set(started.map((ticket) => ticket.showId)).size).toBe(1)
    expect(started[0]?.cohort).toBe('open')
  })

  it('avoids a blocked player while another lobby can take them', () => {
    const mm = new MatchmakerService()
    mm.block('a', 'b')
    mm.queue({ playerIds: ['a'], region: 'eu-w', showsCompleted: 9, nowMs: 0 })
    for (const playerId of ids(31)) mm.queue({ playerIds: [playerId], region: 'eu-w', showsCompleted: 9, nowMs: 0 })
    mm.queue({ playerIds: ['b'], region: 'eu-w', showsCompleted: 9, nowMs: 0 })
    const started = mm.tick(0)
    const show = started.find((ticket) => ticket.playerIds.includes('a'))
    expect(show?.roster?.some((member) => member.playerId === 'b')).toBe(false)
    expect(mm.get(started[0]!.id)?.status).toBe('allocated')
  })

  it('binds a connect token to the player and the show', () => {
    const fleet = new FleetService()
    const allocation = fleet.allocate({
      showId: 'show_9',
      region: 'eu-w',
      configVersion: 'foundation-1',
      nowMs: 1_000,
      roster: [
        { playerId: 'p1', isBot: false },
        { playerId: 'bot:show_9:1', isBot: true },
      ],
    })
    const token = allocation?.tokens[0]
    expect(token?.playerId).toBe('p1')
    expect(fleet.consume(token!.token, 'p2', 'show_9', 1_000)).toBe(false)
    expect(fleet.consume(token!.token, 'p1', 'show_other', 1_000)).toBe(false)
    expect(fleet.consume(token!.token, 'p1', 'show_9', 1_000)).toBe(true)
    expect(fleet.consume(token!.token, 'p1', 'show_9', 1_000)).toBe(false)
    fleet.drain()
    expect(
      fleet.allocate({
        showId: 'show_10',
        region: 'eu-w',
        configVersion: 'foundation-1',
        nowMs: 2_000,
        roster: [{ playerId: 'p1', isBot: false }],
      }),
    ).toBeNull()
  })
})
