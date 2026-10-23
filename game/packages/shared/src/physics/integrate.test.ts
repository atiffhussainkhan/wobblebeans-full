import { describe, expect, it } from 'vitest'
import { CAPSULE_CENTER, PHYSICS, feetY } from './constants'
import { stepKinematics, makeBean } from './integrate'
import { Locomotion, type BeanState, type InputFrame, type MoveResolution } from './types'
import { formatDisplayName, NAME_ADJECTIVES, NAME_NOUNS } from '../names/generator'
import { SAFETY, isAllowedClientEvent, EventKind } from '../safety/rules'
import { physicsHash } from './hash'
import { encodeInput, decodeClient, encodeSnapshot, decodeServer, beanToSnap } from '../protocol/codec'
import { NET, isNearSnapshotTick } from '../net/rates'

function flat(groundFeet = 0) {
  return (state: BeanState, dx: number, dy: number, dz: number): MoveResolution => {
    const feet = feetY(state.py)
    const nextFeet = feet + dy
    if (dy <= 0.0001 && nextFeet <= groundFeet + 0.02) {
      return { movedX: dx, movedY: groundFeet - feet, movedZ: dz, grounded: true }
    }
    return { movedX: dx, movedY: dy, movedZ: dz, grounded: false }
  }
}

function hold(seq: number, moveZ = 1, jump = false, dive = false): InputFrame {
  return { seq, tick: seq, moveX: 0, moveZ, jump, dive, camYaw: 0, quickChat: 0, emote: 0 }
}

describe('locomotion', () => {
  it('reaches about 9 m/s within a quarter second', () => {
    const state = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    for (let i = 1; i <= 15; i++) stepKinematics(state, hold(i), PHYSICS.dt, flat())
    const speed = Math.hypot(state.vx, state.vz)
    expect(speed).toBeGreaterThan(8)
    expect(speed).toBeLessThanOrEqual(PHYSICS.maxSpeed + 0.05)
  })

  it('jumps about 1.5 m', () => {
    const state = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    let peak = 0
    for (let i = 1; i <= 60; i++) {
      stepKinematics(state, hold(i, 0, i === 1), PHYSICS.dt, flat())
      peak = Math.max(peak, feetY(state.py))
    }
    expect(peak).toBeGreaterThan(1.2)
    expect(peak).toBeLessThan(1.9)
    expect(state.grounded).toBe(true)
  })

  it('still jumps just after leaving a ledge', () => {
    const ledge = (state: BeanState, dx: number, dy: number, dz: number): MoveResolution => {
      const nextZ = state.pz + dz
      const feet = feetY(state.py)
      if (nextZ < 1.2 && dy <= 0.0001 && feet + dy <= 0.02) {
        return { movedX: dx, movedY: -feet, movedZ: dz, grounded: true }
      }
      return { movedX: dx, movedY: dy, movedZ: dz, grounded: false }
    }
    const state = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    let jumped = false
    for (let i = 1; i <= 80 && !jumped; i++) {
      const off = !state.grounded && state.coyote > 0 && state.coyote < PHYSICS.coyoteTime
      stepKinematics(state, hold(i, 1, off), PHYSICS.dt, ledge)
      if (off) jumped = state.vy > 3
    }
    expect(jumped).toBe(true)
  })

  it('dives once per airborne period and boosts horizontal speed', () => {
    const state = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    stepKinematics(state, hold(1, 1, true, false), PHYSICS.dt, flat())
    stepKinematics(state, hold(2, 1, false, true), PHYSICS.dt, flat())
    const speed = Math.hypot(state.vx, state.vz)
    expect(speed).toBeGreaterThanOrEqual(PHYSICS.diveHorizSpeed - 0.2)
    expect(state.airDiveUsed).toBe(true)
    const vy = state.vy
    stepKinematics(state, hold(3, 1, false, true), PHYSICS.dt, flat())
    expect(state.vy).toBeLessThan(vy + 1)
    expect(state.locomotion === Locomotion.Dive || state.locomotion === Locomotion.Fall || state.locomotion === Locomotion.Jump).toBe(true)
  })
})

describe('names and safety', () => {
  it('keeps every generated name within 16 characters', () => {
    for (let a = 0; a < NAME_ADJECTIVES.length; a++) {
      for (let n = 0; n < NAME_NOUNS.length; n++) {
        for (const num of [0, 9, 42, 99]) {
          expect(formatDisplayName(a, n, num).length).toBeLessThanOrEqual(16)
        }
      }
    }
  })

  it('keeps chat closed, voice off, and paid random rewards off', () => {
    expect(SAFETY.openChat).toBe(false)
    expect(SAFETY.voiceChat).toBe(false)
    expect(SAFETY.lootBoxes).toBe(false)
    expect(SAFETY.premiumCurrency).toBe(false)
    expect(SAFETY.realMoneyInMvp).toBe(false)
    expect(SAFETY.childPiiStore).toBe('ParentAccountStore')
    expect(isAllowedClientEvent(EventKind.QuickChat, 1)).toBe(true)
    expect(isAllowedClientEvent(EventKind.QuickChat, 99)).toBe(false)
    expect(isAllowedClientEvent(EventKind.Eliminated, 1)).toBe(false)
  })
})

describe('protocol', () => {
  it('round-trips inputs without a text field', () => {
    const bytes = encodeInput([
      { seq: 4, tick: 9, moveX: 0, moveZ: 1, jump: true, dive: false, camYaw: 0, quickChat: 2, emote: 0 },
    ])
    const decoded = decodeClient(bytes)
    expect(decoded.type).toBe('input')
    if (decoded.type !== 'input') return
    expect(decoded.frames[0]?.jump).toBe(true)
    expect(decoded.frames[0]?.quickChat).toBe(2)
    expect(JSON.stringify(decoded)).not.toMatch(/hello!/i)
    expect(bytes.byteLength).toBeLessThan(64)
  })

  it('round-trips a quantised snapshot', () => {
    const state = makeBean(3, 1.25, 2.5, 8, 1)
    state.vx = 4
    state.yaw = 0.4
    state.finished = true
    const snap = beanToSnap(state, { colourIndex: 2, adj: 1, noun: 4, num: 7 })
    const bytes = encodeSnapshot({ serverTick: 50, ackSeq: 12, beans: [snap] })
    const decoded = decodeServer(bytes)
    expect(decoded.type).toBe('snapshot')
    if (decoded.type !== 'snapshot') return
    const bean = decoded.beans[0]!
    expect(bean.id).toBe(3)
    expect(bean.finished).toBe(true)
    expect(bean.colourIndex).toBe(2)
    expect(Math.abs(bean.px - 1.25)).toBeLessThan(0.01)
    expect(Math.abs(bean.pz - 8)).toBeLessThan(0.01)
    expect(decoded.ackSeq).toBe(12)
  })

  it('publishes snapshots at 20 Hz and a stable physics hash', () => {
    const marks = [...Array(50).keys()].filter((t) => isNearSnapshotTick(t))
    expect(marks.length).toBe(NET.snapshotNearHz)
    expect(physicsHash()).toBe(physicsHash())
  })
})
