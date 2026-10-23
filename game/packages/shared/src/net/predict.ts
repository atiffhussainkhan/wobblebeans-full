import { NET } from './rates'
import { V3 } from '../physics/math'
import { cloneBean, type BeanState, type InputFrame } from '../physics/types'
import type { BeanWorld } from '../physics/world'
import { snapToBean, type SnapBean } from '../protocol/codec'

/**
 * Predicts the local bean and replays unacknowledged inputs when a snapshot
 * arrives. Error under 5 cm is ignored (quantisation). 5–30 cm is reported
 * so the view can ease. Above 30 cm the pose is the replay result directly.
 */
export class PredictedBean {
  readonly id: number
  private readonly inputs: InputFrame[] = []
  private seq = 0
  lastError = 0
  hardCorrected = false

  constructor(
    private readonly world: BeanWorld,
    id: number,
  ) {
    this.id = id
  }

  get state(): BeanState {
    const s = this.world.getState(this.id)
    if (!s) throw new Error(`missing predicted bean ${this.id}`)
    return s
  }

  nextSeq(): number {
    this.seq = (this.seq + 1) & 0xffff
    if (this.seq === 0) this.seq = 1
    return this.seq
  }

  /** Step the local world with a new input and remember it for replay. */
  push(frame: InputFrame): BeanState {
    this.inputs.push(frame)
    while (this.inputs.length > 64) this.inputs.shift()
    this.world.step(new Map([[this.id, frame]]))
    return this.state
  }

  /**
   * Apply an authoritative snapshot. Returns the position error between the
   * pre-reconcile pose and the replayed pose.
   */
  reconcile(serverTick: number, ackSeq: number, snap: SnapBean): number {
    const before = this.state
    const spawnIndex = before.spawnIndex
    const pending = this.inputs.filter((f) => seqAhead(f.seq, ackSeq))
    this.world.tick = serverTick
    this.world.applyState(snapToBean(snap, spawnIndex))
    for (const frame of pending) {
      this.world.step(new Map([[this.id, frame]]))
    }
    this.inputs.length = 0
    this.inputs.push(...pending)
    const after = this.state
    this.lastError = V3.dist(
      { x: before.px, y: before.py, z: before.pz },
      { x: after.px, y: after.py, z: after.pz },
    )
    this.hardCorrected = this.lastError > NET.correctionSnapM
    return this.lastError
  }

  /** Inputs waiting to be packed into the next 25 Hz packet. */
  recentFrames(redundancy = NET.inputRedundancy): InputFrame[] {
    return this.inputs.slice(-redundancy)
  }
}

function seqAhead(seq: number, ack: number): boolean {
  const d = (seq - ack) & 0xffff
  return d > 0 && d < 0x8000
}

export function cloneForDebug(state: BeanState): BeanState {
  return cloneBean(state)
}
