import { BeanWorld, NET, type InputFrame } from '@wobblebeans/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { CLIENT_SIM_STEP_P99_MS } from './budgets'
import { mean, percentile, roundMs } from './stats'

const worlds: BeanWorld[] = []
afterEach(() => {
  for (const world of worlds) world.destroy()
  worlds.length = 0
})

function frame(seq: number): InputFrame {
  return { seq, tick: seq, moveX: 0, moveZ: 1, jump: seq % 40 === 0, dive: false, camYaw: 0, quickChat: 0, emote: 0 }
}

describe('client sim budget', () => {
  it('keeps one predicted bean inside the 2.5 ms step', async () => {
    const world = await BeanWorld.create()
    worlds.push(world)
    world.spawn(1, 0)
    const samples: number[] = []
    const batches: number[] = []
    for (let seq = 1; seq <= 160; seq++) {
      const t0 = performance.now()
      world.step(new Map([[1, frame(seq)]]))
      const dt = performance.now() - t0
      if (seq > 40) samples.push(dt)
      if (seq > 40 && seq % 10 === 0) {
        const b0 = performance.now()
        for (let extra = 0; extra < 10; extra++) world.step(new Map([[1, frame(seq + extra)]]))
        batches.push(performance.now() - b0)
      }
    }
    const stepP99 = percentile(samples, 99)
    const batchP99 = percentile(batches, 99)
    console.log(
      `client sim p99 ${roundMs(stepP99)} ms, 10-step replay p99 ${roundMs(batchP99)} ms (design replay ${2} ms, interp delay ${NET.interpDelayMs} ms)`,
    )
    expect(stepP99).toBeLessThanOrEqual(CLIENT_SIM_STEP_P99_MS)
    expect(mean(samples)).toBeLessThanOrEqual(CLIENT_SIM_STEP_P99_MS)
    expect(batchP99).toBeLessThanOrEqual(CLIENT_SIM_STEP_P99_MS * 10)
    const state = world.getState(1)
    expect(state && Number.isFinite(state.px) && Number.isFinite(state.pz)).toBe(true)
  })
})
