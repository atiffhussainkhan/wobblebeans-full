import { describe, expect, it } from 'vitest'
import { botInput, createBotMind } from './brain'

describe('bots', () => {
  it('uses the human input frame and never chats or emotes', () => {
    const mind = createBotMind(3, 1)
    const frame = botInput(mind, 10, false)
    expect(frame.moveZ).toBe(1)
    expect(frame.quickChat).toBe(0)
    expect(frame.emote).toBe(0)
    const practice = botInput(createBotMind(1, 1), 10, true)
    expect(practice.moveZ).toBeLessThan(frame.moveZ)
    expect(practice.quickChat).toBe(0)
  })

  it('stays near a tenth of a millisecond per bot', () => {
    const minds = Array.from({ length: 12 }, (_, index) => createBotMind(index + 1))
    const start = performance.now()
    for (let tick = 0; tick < 2000; tick++) {
      for (const mind of minds) botInput(mind, tick, false)
    }
    const elapsed = performance.now() - start
    const perBotStep = elapsed / (12 * 2000)
    expect(perBotStep).toBeLessThan(0.1)
  })
})
