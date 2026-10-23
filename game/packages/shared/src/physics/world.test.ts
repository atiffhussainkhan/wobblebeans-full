import { afterEach, describe, expect, it } from 'vitest'
import { FOUNDATION_COURSE, moverOffset } from '../course/foundation-gauntlet'
import { CAPSULE_CENTER, feetY } from './constants'
import { makeBean } from './integrate'
import type { BeanState, InputFrame } from './types'
import { BeanWorld } from './world'

const worlds: BeanWorld[] = []

afterEach(() => {
  for (const world of worlds) world.destroy()
  worlds.length = 0
})

async function world(): Promise<BeanWorld> {
  const created = await BeanWorld.create()
  worlds.push(created)
  return created
}

function drive(state: BeanState, seq: number): InputFrame {
  const lm = FOUNDATION_COURSE.landmarks
  let moveX = 0
  let moveZ = 1
  if (state.pz > 17.5 && state.pz < 22.8 && state.px < 2.2) moveX = 1
  if (state.pz > 30 && state.pz < 47) {
    const dx = lm.stoneX - state.px
    if (Math.abs(dx) > 0.2) {
      moveX = dx > 0 ? 1 : -1
      if (state.pz < 35.6) moveZ = 0.25
    }
  }
  let jump = false
  if (state.grounded) {
    if (state.pz > lm.firstGapJumpZ && state.pz < lm.firstGapJumpZ + 1.3) jump = true
    if (state.pz > 35.2 && state.pz < 36.15 && Math.abs(state.px - lm.stoneX) < 1.8) jump = true
    if (state.pz > 42.7 && state.pz < 43.9 && Math.abs(state.px - lm.stoneX) < 1.8) jump = true
  }
  return { seq, tick: seq, moveX, moveZ, jump, dive: false, camYaw: 0, quickChat: 0, emote: 0 }
}

describe('rapier world', () => {
  it('stands on the start plaza', async () => {
    const sim = await world()
    sim.spawn(1, 0)
    for (let i = 0; i < 30; i++) sim.step(new Map())
    const state = sim.getState(1)!
    expect(state.grounded).toBe(true)
    expect(feetY(state.py)).toBeGreaterThan(-0.2)
    expect(feetY(state.py)).toBeLessThan(0.35)
  })

  it('runs forward', async () => {
    const sim = await world()
    sim.spawn(1, 0)
    const start = sim.getState(1)!.pz
    for (let i = 1; i <= 60; i++) {
      const state = sim.getState(1)!
      sim.step(new Map([[1, drive(state, i)]]))
    }
    expect(sim.getState(1)!.pz).toBeGreaterThan(start + 3)
  })

  it('matches a second world given the same inputs', async () => {
    const a = await world()
    const b = await world()
    a.spawn(1, 0)
    b.spawn(1, 0)
    for (let i = 1; i <= 90; i++) {
      const frame = drive(a.getState(1)!, i)
      a.step(new Map([[1, frame]]))
      b.step(new Map([[1, frame]]))
    }
    const sa = a.getState(1)!
    const sb = b.getState(1)!
    expect(Math.abs(sa.px - sb.px)).toBeLessThan(1e-4)
    expect(Math.abs(sa.py - sb.py)).toBeLessThan(1e-4)
    expect(Math.abs(sa.pz - sb.pz)).toBeLessThan(1e-4)
  })

  it('carries a bean standing on the shuttle', async () => {
    const sim = await world()
    const shuttle = FOUNDATION_COURSE.boxes.find((b) => b.id === 'shuttle')!
    const py = shuttle.y + shuttle.hy + CAPSULE_CENTER + 0.02
    sim.addBean(makeBean(1, shuttle.x, py, shuttle.z, 0))
    for (let i = 0; i < 8; i++) sim.step(new Map())
    const x0 = sim.getState(1)!.px
    for (let i = 0; i < 40; i++) sim.step(new Map())
    const x1 = sim.getState(1)!.px
    const expected = Math.abs(moverOffset(sim.tick, shuttle.mover!.amplitude, shuttle.mover!.period) - moverOffset(sim.tick - 40, shuttle.mover!.amplitude, shuttle.mover!.period))
    expect(Math.abs(x1 - x0)).toBeGreaterThan(0.25)
    expect(Math.abs(Math.abs(x1 - x0) - expected)).toBeLessThan(0.6)
    expect(feetY(sim.getState(1)!.py)).toBeGreaterThan(0.5)
  })

  it('clears the gauntlet with move and jump', async () => {
    const sim = await world()
    sim.spawn(1, 0)
    let finished = false
    for (let i = 1; i <= 1400 && !finished; i++) {
      const state = sim.getState(1)!
      sim.step(new Map([[1, drive(state, i)]]))
      finished = sim.getState(1)!.finished
    }
    const end = sim.getState(1)!
    expect(finished, `stopped at ${end.px.toFixed(2)}, ${feetY(end.py).toFixed(2)}, ${end.pz.toFixed(2)}`).toBe(true)
  })
})
