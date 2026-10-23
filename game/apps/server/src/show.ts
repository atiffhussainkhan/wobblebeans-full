import {
  BeanWorld,
  EventKind,
  NET,
  beanToSnap,
  createSocialGate,
  stepSocialGate,
  encodeEvent,
  encodeSnapshot,
  isAllowedClientEvent,
  isFarSnapshotTick,
  isNearSnapshotTick,
  nameForSlot,
  type BeanState,
  type InputFrame,
  type SnapBean,
  type SocialGateState,
} from '@wobblebeans/shared'
import type { ShowFlow } from './flow/host'

export interface ShowPlayer {
  id: number
  ack: number
  colourIndex: number
  adj: number
  noun: number
  num: number
  spawnIndex: number
  queue: InputFrame[]
  lastInput: InputFrame | null
  lastSocialTick: number
  quickChatAllowed: boolean
  social: SocialGateState
}

export interface ShowStep {
  /** Personalised snapshots, only on a snapshot tick. */
  snapshots: Map<number, Uint8Array> | null
  events: Uint8Array[]
}

/**
 * One authoritative show. Owns qualification-relevant state for the slice
 * (poses, finish, preset events). It does not store child personal data.
 */
export class Show {
  readonly players = new Map<number, ShowPlayer>()
  /**
   * Workstream 4 director. Absent on the gauntlet, so this file's input and
   * snapshot behaviour stays as the foundation left it.
   */
  flow: ShowFlow | null = null
  private nextId = 1
  private readonly events: Uint8Array[] = []

  constructor(readonly world: BeanWorld) {}

  get tick(): number {
    return this.world.tick
  }

  get full(): boolean {
    return this.players.size >= NET.maxPlayers
  }

  addPlayer(): ShowPlayer {
    if (this.full) throw new Error('show full')
    const id = this.nextId++
    const spawnIndex = (id - 1) % this.world.course.spawns.length
    this.world.spawn(id, spawnIndex)
    const name = nameForSlot(id)
    const player: ShowPlayer = {
      id,
      ack: 0,
      colourIndex: (id - 1) % 8,
      adj: name.adj,
      noun: name.noun,
      num: name.num,
      spawnIndex,
      queue: [],
      lastInput: null,
      lastSocialTick: -1000,
      quickChatAllowed: true,
      social: createSocialGate(),
    }
    this.players.set(id, player)
    return player
  }

  removePlayer(id: number): void {
    // Suspend for a reconnect token when a director is attached. Otherwise drop.
    if (this.flow?.onSocketClosed(id)) return
    this.players.delete(id)
    this.world.removeBean(id)
  }

  /** Side channel for a reconnect token. Hello's byte layout cannot carry one. */
  resume(token: string, playerId: string, showId: string): ShowPlayer | null {
    const slot = this.flow?.resume(token, playerId, showId)
    if (slot === undefined || slot === null) return null
    return this.players.get(slot) ?? null
  }

  beanFinished(id: number): boolean {
    return this.world.getState(id)?.finished ?? false
  }

  serverEvent(kind: number, subjectId: number, code: number, extra = 0): void {
    this.events.push(encodeEvent(kind, subjectId, code, extra))
  }

  pushInputs(id: number, frames: InputFrame[]): void {
    const player = this.players.get(id)
    if (!player) return
    for (const frame of frames) {
      const seq = frame.seq & 0xffff
      if (!ahead(seq, player.ack)) continue
      if (player.queue.some((q) => (q.seq & 0xffff) === seq)) continue
      player.queue.push({ ...frame, seq })
    }
    player.queue.sort((a, b) => delta(a.seq, b.seq))
    if (player.queue.length > 32) player.queue.splice(0, player.queue.length - 32)
  }

  pushClientEvent(id: number, kind: number, code: number): boolean {
    if (!isAllowedClientEvent(kind, code)) return false
    return this.emitSocial(id, kind, code)
  }

  step(): ShowStep {
    // Workstream 4: one director call. The input and snapshot code below is unchanged.
    this.flow?.prepare(this)
    for (const player of this.players.values()) {
      while (player.queue.length > 0 && !ahead(player.queue[0]!.seq, player.ack)) {
        player.queue.shift()
      }
      const next = player.queue[0]
      if (!next || !ahead(next.seq, player.ack)) continue
      player.queue.shift()
      player.ack = next.seq & 0xffff
      if (next.quickChat) this.emitSocial(player.id, EventKind.QuickChat, next.quickChat)
      if (next.emote) this.emitSocial(player.id, EventKind.Emote, next.emote)
      player.lastInput = next
      this.consumed.set(player.id, next)
    }
    for (const player of this.players.values()) {
      if (this.consumed.has(player.id) || !player.lastInput) continue
      this.consumed.set(player.id, {
        ...player.lastInput,
        jump: false,
        dive: false,
        quickChat: 0,
        emote: 0,
        seq: player.ack,
      })
    }

    this.world.step(this.consumed)
    this.consumed.clear()

    const events = this.events.splice(0, this.events.length)
    if (!isNearSnapshotTick(this.world.tick)) return { snapshots: null, events }

    const snapshots = new Map<number, Uint8Array>()
    for (const player of this.players.values()) {
      snapshots.set(player.id, encodeSnapshot(this.snapshotFor(player)))
    }
    return { snapshots, events }
  }

  state(id: number): BeanState | undefined {
    return this.world.getState(id)
  }

  private readonly consumed = new Map<number, InputFrame>()

  private snapshotFor(player: ShowPlayer): { serverTick: number; ackSeq: number; beans: SnapBean[] } {
    const mine = this.world.getState(player.id)
    const beans: SnapBean[] = []
    for (const id of this.world.ids()) {
      const state = this.world.getState(id)
      if (!state || !mine) continue
      const dist = Math.hypot(state.px - mine.px, state.pz - mine.pz)
      const far = dist > NET.interestNearM
      if (far && !isFarSnapshotTick(this.world.tick) && id !== player.id) continue
      const owner = this.players.get(id)
      beans.push(
        beanToSnap(state, {
          colourIndex: owner?.colourIndex ?? 0,
          adj: owner?.adj ?? 0,
          noun: owner?.noun ?? 0,
          num: owner?.num ?? 0,
        }),
      )
    }
    return { serverTick: this.world.tick, ackSeq: player.ack, beans }
  }

  /** Parent control. Quick-chat drops immediately; emotes stay on the shared preset gate. */
  setQuickChatAllowed(id: number, allowed: boolean): void {
    const player = this.players.get(id)
    if (!player) return
    player.quickChatAllowed = allowed
  }

  private emitSocial(id: number, kind: number, code: number): boolean {
    const player = this.players.get(id)
    if (!player) return false
    if (!isAllowedClientEvent(kind, code)) return false
    if (kind === EventKind.QuickChat && !player.quickChatAllowed) return false
    const decision = stepSocialGate(player.social, { kind, code, targetId: 0, tick: this.world.tick })
    player.social = decision.state
    if (!decision.allow) return false
    player.lastSocialTick = this.world.tick
    this.events.push(encodeEvent(kind, id, code, 0))
    return true
  }
}

function ahead(seq: number, ack: number): boolean {
  const d = (seq - ack) & 0xffff
  return d > 0 && d < 0x8000
}

function delta(a: number, b: number): number {
  const d = (a - b) & 0xffff
  return d < 0x8000 ? d : d - 0x10000
}
