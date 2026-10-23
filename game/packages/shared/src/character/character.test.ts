import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAPSULE_CENTER, PHYSICS, feetY } from '../physics/constants'
import { makeBean, stepKinematics } from '../physics/integrate'
import { Locomotion, type BeanState, type InputFrame, type MoveResolution } from '../physics/types'
import { beanToSnap, decodeClient, decodeServer, encodeInput, encodeSnapshot } from '../protocol/codec'
import { BeanWorld } from '../physics/world'
import { DEFAULT_ASSISTS, clampAssists, jumpReleaseCut, resolveGrabButton } from './assists'
import { resolveBumps } from './bumps'
import { CLIP_SLOTS, KAYKIT_PACK, QUATERNIUS_PACK, SEAM_POSE_IDS, clipSlotFor } from './clips'
import { KEYBOARD_BINDINGS } from './bindings'
import { keyBonePose } from './pose'
import { CHARACTER } from './tuning'
import type { CourseDef } from '../course/foundation-gauntlet'

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

/** Reads locomotion through a function so a prior assignment does not narrow it. */
function locoOf(state: BeanState): Locomotion {
  return state.locomotion
}

function frame(seq: number, extra: Partial<InputFrame> = {}): InputFrame {
  return {
    seq,
    tick: seq,
    moveX: 0,
    moveZ: 0,
    jump: false,
    dive: false,
    grab: false,
    camYaw: 0,
    quickChat: 0,
    emote: 0,
    ...extra,
  }
}

describe('character state machine', () => {
  it('lets dive beat jump on the same tick', () => {
    const state = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    stepKinematics(state, frame(1, { jump: true, dive: true, moveZ: 1 }), PHYSICS.dt, flat())
    expect(state.locomotion).toBe(Locomotion.Dive)
    expect(state.airDiveUsed).toBe(true)
    expect(state.vy).toBeGreaterThan(2)
    expect(state.vy).toBeLessThan(PHYSICS.jumpVelocity)
  })

  it('grabs a bean in front and breaks free under the mash cap', () => {
    const a = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    const b = makeBean(2, 0, CAPSULE_CENTER, 0.9, 0)
    const peers = new Map<number, BeanState>([
      [1, a],
      [2, b],
    ])
    stepKinematics(a, frame(1, { grab: true }), PHYSICS.dt, flat(), undefined, { peers, authoritative: true })
    expect(a.locomotion).toBe(Locomotion.Grab)
    expect(b.locomotion).toBe(Locomotion.Grabbed)

    const far = makeBean(3, 0, CAPSULE_CENTER, 1.4, 0)
    const miss = new Map<number, BeanState>([
      [1, makeBean(1, 0, CAPSULE_CENTER, 0, 0)],
      [3, far],
    ])
    const grabber = miss.get(1)!
    stepKinematics(grabber, frame(1, { grab: true }), PHYSICS.dt, flat(), undefined, { peers: miss, authoritative: true })
    expect(grabber.locomotion).not.toBe(Locomotion.Grab)
    expect(far.locomotion).not.toBe(Locomotion.Grabbed)

    let broke = false
    for (let i = 2; i <= 100 && !broke; i++) {
      stepKinematics(a, frame(i, { grab: true }), PHYSICS.dt, flat(), undefined, { peers, authoritative: true })
      stepKinematics(b, frame(i, { jump: true }), PHYSICS.dt, flat(), undefined, { peers, authoritative: true })
      broke = b.locomotion !== Locomotion.Grabbed
    }
    expect(broke).toBe(true)
    expect(a.locomotion).not.toBe(Locomotion.Grab)
    expect(a.motion?.regrabCooldown).toBeGreaterThan(0)
  })

  it('does not predict a grab, and a grabbed pose stays put on the client', () => {
    const a = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    const b = makeBean(2, 0, CAPSULE_CENTER, 0.9, 0)
    const peers = new Map<number, BeanState>([
      [1, a],
      [2, b],
    ])
    stepKinematics(a, frame(1, { grab: true }), PHYSICS.dt, flat(), undefined, { peers, authoritative: false })
    expect(b.locomotion).not.toBe(Locomotion.Grabbed)

    b.locomotion = Locomotion.Grabbed
    b.px = 4
    stepKinematics(b, frame(2, { moveZ: 1 }), PHYSICS.dt, flat(), undefined, { peers, authoritative: false })
    expect(b.px).toBe(4)
    expect(b.locomotion).toBe(Locomotion.Grabbed)
  })

  it('throws forward when the grabber lets go', () => {
    const a = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    const b = makeBean(2, 0, CAPSULE_CENTER, 0.9, 0)
    const peers = new Map<number, BeanState>([
      [1, a],
      [2, b],
    ])
    stepKinematics(a, frame(1, { grab: true }), PHYSICS.dt, flat(), undefined, { peers, authoritative: true })
    stepKinematics(a, frame(2, { grab: false }), PHYSICS.dt, flat(), undefined, { peers, authoritative: true })
    expect(b.locomotion).not.toBe(Locomotion.Grabbed)
    expect(b.vy).toBeGreaterThanOrEqual(CHARACTER.throwUp - 0.2)
    expect(b.vz).toBeGreaterThan(1)
  })

  it('stumbles on a player bump and is running again after the stumble window', () => {
    const a = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    const b = makeBean(2, 0, CAPSULE_CENTER, 0.9, 0)
    a.vz = 9
    b.vz = -9
    resolveBumps(new Map([[1, a], [2, b]]))
    expect(a.locomotion).toBe(Locomotion.Stumble)
    expect(b.locomotion).toBe(Locomotion.Stumble)
    expect(a.locomotion).not.toBe(Locomotion.Ragdoll)
    for (let i = 1; i <= 20; i++) stepKinematics(a, frame(i), PHYSICS.dt, flat())
    expect(a.locomotion === Locomotion.Idle || a.locomotion === Locomotion.Run).toBe(true)
  })

  it('ragdolls a hard landing and gets back up to idle', () => {
    const state = makeBean(1, 0, CAPSULE_CENTER + 0.05, 0, 0)
    state.grounded = false
    state.locomotion = Locomotion.Fall
    state.vy = -22
    stepKinematics(state, frame(1), PHYSICS.dt, flat())
    expect(state.locomotion).toBe(Locomotion.Ragdoll)
    expect(state.getUpBack).toBe(true)
    let sawGetUp = false
    let stood = false
    for (let i = 2; i <= 80 && !stood; i++) {
      stepKinematics(state, frame(i, { jump: true, dive: true }), PHYSICS.dt, flat())
      const loco = locoOf(state)
      if (loco === Locomotion.GetUp) sawGetUp = true
      if (loco === Locomotion.Idle) {
        stood = true
        expect(state.motion?.immunity).toBeGreaterThan(0)
      }
      if (loco === Locomotion.Ragdoll || loco === Locomotion.GetUp) {
        expect(state.jumpBuffer).toBe(0)
        expect(state.diveBuffer).toBe(0)
      }
    }
    expect(sawGetUp).toBe(true)
    expect(stood).toBe(true)
  })

  it('cancels an emote on move and refuses one in the air or off the list', () => {
    const state = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    stepKinematics(state, frame(1, { emote: 1 }), PHYSICS.dt, flat())
    expect(state.locomotion).toBe(Locomotion.Emote)
    expect(clipSlotFor(state)).toBe('emote_wave')
    stepKinematics(state, frame(2, { moveZ: 1 }), PHYSICS.dt, flat())
    expect(state.locomotion).toBe(Locomotion.Run)

    const air = makeBean(2, 0, CAPSULE_CENTER + 2, 0, 0)
    air.grounded = false
    air.coyote = 0
    air.locomotion = Locomotion.Fall
    stepKinematics(air, frame(1, { emote: 2 }), PHYSICS.dt, flat())
    expect(air.locomotion).not.toBe(Locomotion.Emote)

    const nope = makeBean(3, 0, CAPSULE_CENTER, 0, 0)
    stepKinematics(nope, frame(1, { emote: 99 }), PHYSICS.dt, flat())
    expect(nope.locomotion).toBe(Locomotion.Idle)
  })

  it('mantles a lip and does not treat a 2 m wall as a ledge', () => {
    const lip = ledgeCourse(0.38)
    const state = makeBean(1, 0, CAPSULE_CENTER, 0, 0)
    state.grounded = false
    state.coyote = 0
    state.locomotion = Locomotion.Fall
    const ground = lipGround(0.38)
    stepKinematics(state, frame(1, { grab: true, moveZ: 1 }), PHYSICS.dt, ground, undefined, { course: lip, authoritative: true })
    expect(state.locomotion).toBe(Locomotion.Climb)
    for (let i = 2; i <= 30; i++) {
      stepKinematics(state, frame(i, { grab: true, moveZ: 1 }), PHYSICS.dt, ground, undefined, { course: lip, authoritative: true })
    }
    expect(state.locomotion).toBe(Locomotion.Run)
    expect(feetY(state.py)).toBeGreaterThan(0.3)

    const wall = ledgeCourse(2)
    const blocked = makeBean(4, 0, CAPSULE_CENTER, 0, 0)
    blocked.grounded = false
    blocked.coyote = 0
    blocked.locomotion = Locomotion.Fall
    stepKinematics(blocked, frame(1, { grab: true, moveZ: 1 }), PHYSICS.dt, flat(), undefined, { course: wall, authoritative: true })
    expect(blocked.locomotion).not.toBe(Locomotion.Climb)
  })
})

describe('replication and clips', () => {
  it('round-trips grab and the get-up flag without growing the packets', () => {
    const bytes = encodeInput([frame(4, { grab: true, jump: true })])
    expect(bytes.byteLength).toBe(2 + 13)
    const decoded = decodeClient(bytes)
    expect(decoded.type).toBe('input')
    if (decoded.type !== 'input') return
    expect(decoded.frames[0]?.grab).toBe(true)
    expect(decoded.frames[0]?.jump).toBe(true)

    const state = makeBean(3, 1, 2, 3, 0)
    state.locomotion = Locomotion.GetUp
    state.getUpBack = true
    const snap = beanToSnap(state)
    const packet = encodeSnapshot({ serverTick: 10, ackSeq: 4, beans: [snap] })
    expect(packet.byteLength).toBe(8 + 28)
    const server = decodeServer(packet)
    expect(server.type).toBe('snapshot')
    if (server.type !== 'snapshot') return
    expect(server.beans[0]?.locomotion).toBe(Locomotion.GetUp)
    expect(server.beans[0]?.getUpBack).toBe(true)
  })

  it('keeps a tumble on the server snapshot', async () => {
    const world = await BeanWorld.create()
    world.spawn(1, 0)
    const pose = world.getState(1)!
    pose.locomotion = Locomotion.Ragdoll
    pose.getUpBack = true
    world.applyState(pose)
    world.step(new Map())
    const after = world.getState(1)!
    expect(after.locomotion === Locomotion.Ragdoll || after.locomotion === Locomotion.GetUp).toBe(true)
    const snap = beanToSnap(after)
    const decoded = decodeServer(encodeSnapshot({ serverTick: world.tick, ackSeq: 1, beans: [snap] }))
    expect(decoded.type).toBe('snapshot')
    if (decoded.type !== 'snapshot') return
    expect(decoded.beans[0]?.locomotion).toBe(after.locomotion)
    world.destroy()
  })

  it('maps states onto the clip slots and keeps combat clips out', () => {
    expect(CLIP_SLOTS.length).toBeGreaterThanOrEqual(20)
    expect(SEAM_POSE_IDS).toEqual(['idle_01', 'run_fwd', 'jump_apex', 'dive_air', 'getup_back'])
    const kaykit = glbClipNames(`assets/${KAYKIT_PACK}`)
    const quaternius = new Set(
      (JSON.parse(readFileSync(`assets/${QUATERNIUS_PACK}`, 'utf8')) as { animations: { name: string }[] }).animations.map(
        (clip) => clip.name,
      ),
    )
    for (const slot of CLIP_SLOTS) {
      if (slot.pack === 'procedural') continue
      const names = slot.pack === 'kaykit' ? kaykit : quaternius
      expect(names.has(slot.clip), slot.id).toBe(true)
    }
    const banned = ['Attack', 'AttackCombo', 'AttackSpinning', 'Shoot(1h)', 'Punch', 'SwordSlash', 'Death', 'HeavyAttack']
    for (const slot of CLIP_SLOTS) expect(banned).not.toContain(slot.clip)
    expect(clipSlotFor({ locomotion: Locomotion.Run, vx: 9, vz: 0, yaw: 0 })).toBe('run_fwd')
    expect(clipSlotFor({ locomotion: Locomotion.Run, vx: 2, vz: 0, yaw: 0 })).toBe('walk_fwd')
    expect(clipSlotFor({ locomotion: Locomotion.Idle, stateTime: 7, vx: 0, vz: 0, yaw: 0 })).toBe('idle_fidget_01')
  })

  it('derives the same key bones from the same root', () => {
    const state = makeBean(1, 0, 1, 0, 0)
    state.locomotion = Locomotion.Ragdoll
    state.vy = -4
    const a = keyBonePose(state)
    const b = keyBonePose(state)
    expect(a).toEqual(b)
    state.stateTime = 0.4
    expect(keyBonePose(state).pelvis.pitch).not.toBe(a.pelvis.pitch)
  })
})

describe('kid assists', () => {
  it('keeps jump height full and defaults the comfort toggles', () => {
    const assists = clampAssists({ fixedJump: false, fov: 200, deadzone: 0, motionBlur: true, shake: 'full' })
    expect(assists.fixedJump).toBe(true)
    expect(assists.motionBlur).toBe(false)
    expect(assists.fov).toBe(85)
    expect(assists.deadzone).toBe(0.1)
    expect(clampAssists({}).deadzone).toBe(DEFAULT_ASSISTS.deadzone)
    expect(assists.shake).toBe('full')
    expect(jumpReleaseCut(assists)).toBe(1)
    expect(KEYBOARD_BINDINGS.grab).toContain('ShiftLeft')
    expect(KEYBOARD_BINDINGS.dive).toContain('ControlLeft')
    expect(KEYBOARD_BINDINGS.jump).toContain('Space')
  })

  it('drops a toggle grab that never connects', () => {
    let button = { latched: false, whiff: 0 }
    const pressed = resolveGrabButton(true, true, true, false, button, 0.02)
    button = pressed.button
    expect(pressed.grab).toBe(true)
    for (let i = 0; i < 60; i++) {
      const next = resolveGrabButton(false, false, true, false, button, 0.02)
      button = next.button
    }
    expect(button.latched).toBe(false)
  })
})

function lipGround(top: number) {
  return (state: BeanState, dx: number, dy: number, dz: number): MoveResolution => {
    const feet = feetY(state.py)
    const nextFeet = feet + dy
    const ground = state.pz + dz > 0.35 ? top : 0
    if (dy <= 0.0001 && nextFeet <= ground + 0.05) {
      return { movedX: dx, movedY: ground - feet, movedZ: dz, grounded: true }
    }
    return { movedX: dx, movedY: dy, movedZ: dz, grounded: false }
  }
}

function ledgeCourse(top: number): CourseDef {
  const hy = top / 2
  return {
    id: 'ledge-test',
    boxes: [
      {
        id: 'lip',
        hx: 1,
        hy,
        hz: 0.5,
        x: 0,
        y: hy,
        z: 0.85,
        rx: 0,
        role: 'mint',
        mover: null,
      },
    ],
    spawns: [],
    finish: { minX: 0, maxX: 1, minZ: 0, maxZ: 1, minFeetY: 0 },
    landmarks: { firstGapJumpZ: 0, stoneX: 0, stoneJumpZs: [] },
  }
}

function glbClipNames(path: string): Set<string> {
  const data = readFileSync(path)
  const jsonLength = data.readUInt32LE(12)
  const doc = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8')) as {
    animations?: { name?: string }[]
  }
  return new Set((doc.animations ?? []).map((clip) => clip.name ?? ''))
}
