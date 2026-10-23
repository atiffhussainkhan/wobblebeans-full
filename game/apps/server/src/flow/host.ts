import type { InputFrame } from '@wobblebeans/shared'

/** Structural view of `Show`. The flow module does not import the socket server. */
export interface FlowPlayer {
  id: number
  ack: number
  queue: InputFrame[]
  lastInput: InputFrame | null
}

export interface FlowHost {
  readonly tick: number
  readonly players: ReadonlyMap<number, FlowPlayer>
  serverEvent(kind: number, subjectId: number, code: number, extra?: number): void
  beanFinished?(id: number): boolean
}

/**
 * One hook from `Show.step` (`prepare`) and the disconnect path (`onSocketClosed`).
 * `resume` is how a 60 s token comes back; Hello cannot carry it (frozen layout).
 */
export interface ShowFlow {
  prepare(host: FlowHost): void
  onSocketClosed(slotId: number): boolean
  resume(token: string, playerId: string, showId: string): number | null
}
