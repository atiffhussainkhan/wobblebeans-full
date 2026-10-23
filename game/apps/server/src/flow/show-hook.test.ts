import { afterEach, describe, expect, it } from 'vitest'
import { BeanWorld, RoundStateCode, decodeServer, type InputFrame } from '@wobblebeans/shared'
import { ShowDirector } from './director'
import type { FlowPlayer } from './host'
import { Show } from '../show'

const stops: Array<() => Promise<void>> = []
afterEach(async () => {
  while (stops.length) await stops.pop()?.()
})

describe('show hook', () => {
  it('locks input until GO and drives bots through the same input path', async () => {
    const world = await BeanWorld.create()
    stops.push(async () => world.destroy())
    const show = new Show(world)
    const human = show.addPlayer()
    const other = show.addPlayer()
    const director = new ShowDirector({
      showId: 'show-hook',
      configVersion: 'foundation-1',
      region: 'eu-w',
      seed: 1,
      roster: [
        { slotId: human.id, playerId: 'h1', isBot: false },
        { slotId: other.id, playerId: 'h2', isBot: false },
      ],
      phaseTicks: { intro: 1, spawnHold: 1, countdown: 3, outcome: 1, interstitial: 1, results: 1 },
    })
    show.flow = director
    const humanStart = show.state(human.id)!.pz
    const otherStart = show.state(other.id)!.pz
    let humanSeq = 1
    let guard = 0
    const seen: number[] = []
    while (director.inputLocked && guard < 30) {
      show.pushInputs(human.id, [
        {
          seq: humanSeq++,
          tick: humanSeq,
          moveX: 0,
          moveZ: 1,
          jump: false,
          dive: false,
          camYaw: 0,
          quickChat: 0,
          emote: 0,
        },
      ])
      const step = show.step()
      for (const bytes of step.events) {
        const message = decodeServer(bytes)
        if (message.type === 'event') seen.push(message.code)
      }
      expect(show.state(human.id)!.pz).toBeCloseTo(humanStart, 4)
      expect(show.state(other.id)!.pz).toBeCloseTo(otherStart, 4)
      guard += 1
    }
    expect(director.phase === 'play' || director.phase === 'final').toBe(true)
    expect(seen).toContain(RoundStateCode.Go)
    for (let i = 0; i < 40; i++) {
      show.pushInputs(human.id, [
        {
          seq: humanSeq++,
          tick: humanSeq,
          moveX: 0,
          moveZ: 1,
          jump: false,
          dive: false,
          camYaw: 0,
          quickChat: 0,
          emote: 0,
        },
      ])
      show.step()
    }
    expect(show.state(human.id)!.pz).toBeGreaterThan(humanStart + 1)
    expect(show.state(other.id)!.pz).toBeCloseTo(otherStart, 4)

    const bot = botPlayer()
    const qualifier = new ShowDirector({
      showId: 'show-bots',
      configVersion: 'foundation-1',
      region: 'eu-w',
      seed: 2,
      roster: [
        ...Array.from({ length: 10 }, (_, index) => ({ slotId: index + 1, playerId: `h${index + 1}`, isBot: false })),
        { slotId: bot.id, playerId: 'bot:1', isBot: true },
      ],
      phaseTicks: { intro: 1, spawnHold: 1, countdown: 3, outcome: 1, interstitial: 1, results: 1 },
    })
    let botGuard = 0
    while (qualifier.inputLocked && botGuard < 30) {
      qualifier.step()
      botGuard += 1
    }
    qualifier.prepare({
      tick: 20,
      players: new Map<number, FlowPlayer>([[bot.id, bot]]),
      serverEvent() {},
    })
    expect(bot.queue.some((frame) => frame.moveZ === 1 && frame.quickChat === 0 && frame.emote === 0)).toBe(true)

    expect(show.removePlayer(human.id)).toBeUndefined()
    expect(show.players.has(human.id)).toBe(true)
    const token = director.reconnectTokenFor('h1')
    expect(show.resume(token!, 'h1', 'show-hook')?.id).toBe(human.id)
    show.removePlayer(human.id)
    show.resume(director.reconnectTokenFor('h1')!, 'h1', 'show-hook')
    show.removePlayer(human.id)
    expect(show.players.has(human.id)).toBe(false)
  })
})

function botPlayer(): FlowPlayer & { id: number } {
  return {
    id: 11,
    ack: 0,
    queue: [] as InputFrame[],
    lastInput: null,
  }
}
