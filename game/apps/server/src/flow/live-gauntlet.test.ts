import { describe, expect, it } from 'vitest'
import { EventKind, RoundStateCode } from '@wobblebeans/shared'
import { createLiveGauntlet } from './live-gauntlet'
import type { FlowHost } from './host'

function host(): FlowHost & { events: number[] } {
  const events: number[] = []
  return {
    tick: 0,
    players: new Map(),
    events,
    serverEvent(_kind, _id, code) {
      events.push(code)
    },
    beanFinished() {
      return false
    },
  }
}

describe('live gauntlet show', () => {
  it('counts in, then opens play, without a text payload', () => {
    const flow = createLiveGauntlet()
    const show = host()
    for (let i = 0; i < 80; i++) flow.prepare(show)
    expect(show.events[0]).toBe(RoundStateCode.RoundIntro)
    expect(show.events).toContain(RoundStateCode.Countdown)
    for (let i = 0; i < 150; i++) flow.prepare(show)
    expect(show.events).toContain(RoundStateCode.Go)
    expect(show.events.every((code) => code !== EventKind.QuickChat || typeof code === 'number')).toBe(true)
  })
})
