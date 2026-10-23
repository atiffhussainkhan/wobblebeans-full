import { NET } from '../net/rates'
import { feetY } from '../physics/constants'
import { Locomotion, type BeanState, type InputFrame } from '../physics/types'

export const Msg = {
  Hello: 1,
  Welcome: 2,
  Input: 3,
  Snapshot: 4,
  Ping: 5,
  Pong: 6,
  Event: 7,
  Reject: 8,
} as const

export const RejectReason = {
  Version: 1,
  Physics: 2,
  Full: 3,
} as const

export interface Hello {
  type: 'hello'
  version: number
  physicsHash: number
}

export interface Welcome {
  type: 'welcome'
  playerId: number
  serverTick: number
  physicsHash: number
  colourIndex: number
  adj: number
  noun: number
  num: number
  spawnIndex: number
}

export interface Reject {
  type: 'reject'
  reason: number
}

export interface InputMsg {
  type: 'input'
  frames: InputFrame[]
}

export interface SnapBean {
  id: number
  px: number
  py: number
  pz: number
  yaw: number
  vx: number
  vy: number
  vz: number
  locomotion: Locomotion
  grounded: boolean
  finished: boolean
  airDiveUsed: boolean
  onMover: boolean
  /** Snapshot flag bit 4. Absent on older snapshots means false. */
  getUpBack?: boolean
  coyote: number
  jumpBuffer: number
  diveBuffer: number
  landCooldown: number
  stateTime: number
  lastSeq: number
  colourIndex: number
  adj: number
  noun: number
  num: number
}

export interface SnapshotMsg {
  type: 'snapshot'
  serverTick: number
  ackSeq: number
  beans: SnapBean[]
}

export interface PingMsg {
  type: 'ping'
  clientTimeMs: number
}

export interface PongMsg {
  type: 'pong'
  clientTimeMs: number
  serverTick: number
}

/** Reliable event. `code` is a preset id or a server enum. No text payload. */
export interface EventMsg {
  type: 'event'
  kind: number
  subjectId: number
  code: number
  extra: number
}

export type ServerMsg = Welcome | Reject | SnapshotMsg | PongMsg | EventMsg
export type ClientMsg = Hello | InputMsg | PingMsg | EventMsg

function encI16(v: number, scale: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(v * scale)))
}

function decI16(q: number, scale: number): number {
  return q / scale
}

function encUnit(v: number): number {
  return Math.max(-127, Math.min(127, Math.round(v * 127)))
}

function encYaw(yaw: number): number {
  const tau = Math.PI * 2
  const n = ((yaw % tau) + tau) % tau
  return Math.round((n / tau) * 65535) & 0xffff
}

function decYaw(q: number): number {
  return (q / 65535) * Math.PI * 2
}

function encTime(seconds: number): number {
  return Math.max(0, Math.min(255, Math.round(seconds * NET.tickHz)))
}

function decTime(ticks: number): number {
  return ticks / NET.tickHz
}

const FRAME = 13
const BEAN = 28

export function encodeHello(hash: number, version = NET.protocolVersion): Uint8Array {
  const b = new Uint8Array(6)
  const v = new DataView(b.buffer)
  v.setUint8(0, Msg.Hello)
  v.setUint8(1, version)
  v.setUint32(2, hash, true)
  return b
}

export function encodeWelcome(w: Omit<Welcome, 'type'>): Uint8Array {
  const b = new Uint8Array(15)
  const v = new DataView(b.buffer)
  v.setUint8(0, Msg.Welcome)
  v.setUint8(1, w.playerId)
  v.setUint32(2, w.serverTick, true)
  v.setUint32(6, w.physicsHash, true)
  v.setUint8(10, w.colourIndex)
  v.setUint8(11, w.adj)
  v.setUint8(12, w.noun)
  v.setUint8(13, w.num)
  v.setUint8(14, w.spawnIndex)
  return b
}

export function encodeReject(reason: number): Uint8Array {
  return Uint8Array.of(Msg.Reject, reason)
}

export function encodeInput(frames: InputFrame[]): Uint8Array {
  const count = Math.min(frames.length, NET.inputRedundancy)
  const slice = frames.slice(frames.length - count)
  const b = new Uint8Array(2 + count * FRAME)
  const v = new DataView(b.buffer)
  v.setUint8(0, Msg.Input)
  v.setUint8(1, count)
  slice.forEach((f, i) => {
    const o = 2 + i * FRAME
    v.setUint16(o, f.seq & 0xffff, true)
    v.setUint32(o + 2, f.tick >>> 0, true)
    v.setInt8(o + 6, encUnit(f.moveX))
    v.setInt8(o + 7, encUnit(f.moveZ))
    let buttons = 0
    if (f.jump) buttons |= 1
    if (f.dive) buttons |= 2
    if (f.grab) buttons |= 4
    v.setUint8(o + 8, buttons)
    v.setUint16(o + 9, encYaw(f.camYaw), true)
    v.setUint8(o + 11, f.quickChat & 0xff)
    v.setUint8(o + 12, f.emote & 0xff)
  })
  return b
}

export function encodeSnapshot(msg: Omit<SnapshotMsg, 'type'>): Uint8Array {
  const b = new Uint8Array(8 + msg.beans.length * BEAN)
  const v = new DataView(b.buffer)
  v.setUint8(0, Msg.Snapshot)
  v.setUint32(1, msg.serverTick, true)
  v.setUint16(5, msg.ackSeq & 0xffff, true)
  v.setUint8(7, msg.beans.length)
  msg.beans.forEach((bean, i) => {
    const o = 8 + i * BEAN
    v.setUint8(o, bean.id)
    v.setInt16(o + 1, encI16(bean.px, NET.posScale), true)
    v.setInt16(o + 3, encI16(bean.py, NET.posScale), true)
    v.setInt16(o + 5, encI16(bean.pz, NET.posScale), true)
    v.setUint16(o + 7, encYaw(bean.yaw), true)
    v.setInt16(o + 9, encI16(bean.vx, NET.velScale), true)
    v.setInt16(o + 11, encI16(bean.vy, NET.velScale), true)
    v.setInt16(o + 13, encI16(bean.vz, NET.velScale), true)
    v.setUint8(o + 15, bean.locomotion)
    let flags = 0
    if (bean.grounded) flags |= 1
    if (bean.finished) flags |= 2
    if (bean.airDiveUsed) flags |= 4
    if (bean.onMover) flags |= 8
    if (bean.getUpBack) flags |= 16
    v.setUint8(o + 16, flags)
    v.setUint8(o + 17, encTime(bean.coyote))
    v.setUint8(o + 18, encTime(bean.jumpBuffer))
    v.setUint8(o + 19, encTime(bean.diveBuffer))
    v.setUint8(o + 20, encTime(bean.landCooldown))
    v.setUint8(o + 21, encTime(bean.stateTime))
    v.setUint16(o + 22, bean.lastSeq & 0xffff, true)
    v.setUint8(o + 24, bean.colourIndex)
    v.setUint8(o + 25, bean.adj)
    v.setUint8(o + 26, bean.noun)
    v.setUint8(o + 27, bean.num)
  })
  return b
}

export function encodePing(clientTimeMs: number): Uint8Array {
  const b = new Uint8Array(5)
  const v = new DataView(b.buffer)
  v.setUint8(0, Msg.Ping)
  v.setUint32(1, clientTimeMs >>> 0, true)
  return b
}

export function encodePong(clientTimeMs: number, serverTick: number): Uint8Array {
  const b = new Uint8Array(9)
  const v = new DataView(b.buffer)
  v.setUint8(0, Msg.Pong)
  v.setUint32(1, clientTimeMs >>> 0, true)
  v.setUint32(5, serverTick, true)
  return b
}

export function encodeEvent(kind: number, subjectId: number, code: number, extra = 0): Uint8Array {
  const b = new Uint8Array(7)
  const v = new DataView(b.buffer)
  v.setUint8(0, Msg.Event)
  v.setUint8(1, kind)
  v.setUint8(2, subjectId)
  v.setUint16(3, code, true)
  v.setUint16(5, extra, true)
  return b
}

export function decodeClient(buf: Uint8Array): ClientMsg {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const type = v.getUint8(0)
  if (type === Msg.Hello) {
    return { type: 'hello', version: v.getUint8(1), physicsHash: v.getUint32(2, true) }
  }
  if (type === Msg.Input) {
    const count = v.getUint8(1)
    const frames: InputFrame[] = []
    for (let i = 0; i < count; i++) {
      const o = 2 + i * FRAME
      const buttons = v.getUint8(o + 8)
      frames.push({
        seq: v.getUint16(o, true),
        tick: v.getUint32(o + 2, true),
        moveX: v.getInt8(o + 6) / 127,
        moveZ: v.getInt8(o + 7) / 127,
        jump: (buttons & 1) !== 0,
        dive: (buttons & 2) !== 0,
        grab: (buttons & 4) !== 0,
        camYaw: decYaw(v.getUint16(o + 9, true)),
        quickChat: v.getUint8(o + 11),
        emote: v.getUint8(o + 12),
      })
    }
    return { type: 'input', frames }
  }
  if (type === Msg.Ping) {
    return { type: 'ping', clientTimeMs: v.getUint32(1, true) }
  }
  if (type === Msg.Event) {
    return {
      type: 'event',
      kind: v.getUint8(1),
      subjectId: v.getUint8(2),
      code: v.getUint16(3, true),
      extra: v.getUint16(5, true),
    }
  }
  throw new Error(`bad client message ${type}`)
}

export function decodeServer(buf: Uint8Array): ServerMsg {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const type = v.getUint8(0)
  if (type === Msg.Welcome) {
    return {
      type: 'welcome',
      playerId: v.getUint8(1),
      serverTick: v.getUint32(2, true),
      physicsHash: v.getUint32(6, true),
      colourIndex: v.getUint8(10),
      adj: v.getUint8(11),
      noun: v.getUint8(12),
      num: v.getUint8(13),
      spawnIndex: v.getUint8(14),
    }
  }
  if (type === Msg.Reject) return { type: 'reject', reason: v.getUint8(1) }
  if (type === Msg.Pong) {
    return { type: 'pong', clientTimeMs: v.getUint32(1, true), serverTick: v.getUint32(5, true) }
  }
  if (type === Msg.Event) {
    return {
      type: 'event',
      kind: v.getUint8(1),
      subjectId: v.getUint8(2),
      code: v.getUint16(3, true),
      extra: v.getUint16(5, true),
    }
  }
  if (type === Msg.Snapshot) {
    const serverTick = v.getUint32(1, true)
    const ackSeq = v.getUint16(5, true)
    const count = v.getUint8(7)
    const beans: SnapBean[] = []
    for (let i = 0; i < count; i++) {
      const o = 8 + i * BEAN
      const flags = v.getUint8(o + 16)
      beans.push({
        id: v.getUint8(o),
        px: decI16(v.getInt16(o + 1, true), NET.posScale),
        py: decI16(v.getInt16(o + 3, true), NET.posScale),
        pz: decI16(v.getInt16(o + 5, true), NET.posScale),
        yaw: decYaw(v.getUint16(o + 7, true)),
        vx: decI16(v.getInt16(o + 9, true), NET.velScale),
        vy: decI16(v.getInt16(o + 11, true), NET.velScale),
        vz: decI16(v.getInt16(o + 13, true), NET.velScale),
        locomotion: v.getUint8(o + 15) as Locomotion,
        grounded: (flags & 1) !== 0,
        finished: (flags & 2) !== 0,
        airDiveUsed: (flags & 4) !== 0,
        onMover: (flags & 8) !== 0,
        getUpBack: (flags & 16) !== 0,
        coyote: decTime(v.getUint8(o + 17)),
        jumpBuffer: decTime(v.getUint8(o + 18)),
        diveBuffer: decTime(v.getUint8(o + 19)),
        landCooldown: decTime(v.getUint8(o + 20)),
        stateTime: decTime(v.getUint8(o + 21)),
        lastSeq: v.getUint16(o + 22, true),
        colourIndex: v.getUint8(o + 24),
        adj: v.getUint8(o + 25),
        noun: v.getUint8(o + 26),
        num: v.getUint8(o + 27),
      })
    }
    return { type: 'snapshot', serverTick, ackSeq, beans }
  }
  throw new Error(`bad server message ${type}`)
}

export function beanToSnap(
  state: BeanState,
  cosmetic: { colourIndex: number; adj: number; noun: number; num: number } = {
    colourIndex: 0,
    adj: 0,
    noun: 0,
    num: 0,
  },
): SnapBean {
  return {
    id: state.id,
    px: state.px,
    py: state.py,
    pz: state.pz,
    yaw: state.yaw,
    vx: state.vx,
    vy: state.vy,
    vz: state.vz,
    locomotion: state.locomotion,
    grounded: state.grounded,
    finished: state.finished,
    airDiveUsed: state.airDiveUsed,
    onMover: state.onMover,
    getUpBack: state.getUpBack === true,
    coyote: state.coyote,
    jumpBuffer: state.jumpBuffer,
    diveBuffer: state.diveBuffer,
    landCooldown: state.landCooldown,
    stateTime: state.stateTime,
    lastSeq: state.lastSeq,
    colourIndex: cosmetic.colourIndex,
    adj: cosmetic.adj,
    noun: cosmetic.noun,
    num: cosmetic.num,
  }
}

export function snapToBean(snap: SnapBean, spawnIndex: number): BeanState {
  return {
    ...snap,
    spawnIndex,
    finished: snap.finished,
  }
}

export function feetOf(snap: SnapBean): number {
  return feetY(snap.py)
}
