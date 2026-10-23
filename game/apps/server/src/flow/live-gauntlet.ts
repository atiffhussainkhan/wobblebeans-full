import { EventKind, RoundStateCode } from '@wobblebeans/shared'
import type { FlowHost, ShowFlow } from './host'

const INTRO_TICKS = 80
const COUNTDOWN_TICKS = 150
const OUTCOME_TICKS = 90

type Phase = 'intro' | 'countdown' | 'play' | 'outcome'

/**
 * Dev show on the foundation gauntlet.
 * The full director (workstream 4) needs a filled lobby. This hook lets
 * `pnpm dev` still run intro, a 3-count, play, and a finish beat with
 * whoever is connected. It does not change the wire layout.
 */
export function createLiveGauntlet(): ShowFlow {
  let phase: Phase = 'intro'
  let age = 0
  let announced = false
  const celebrated = new Set<number>()

  function announce(host: FlowHost, code: number): void {
    host.serverEvent(EventKind.RoundState, 0, code, 0)
  }

  function enter(host: FlowHost, next: Phase): void {
    phase = next
    age = 0
    announced = true
    if (next === 'intro') announce(host, RoundStateCode.RoundIntro)
    else if (next === 'countdown') announce(host, RoundStateCode.Countdown)
    else if (next === 'play') {
      announce(host, RoundStateCode.Play)
      announce(host, RoundStateCode.Go)
    } else announce(host, RoundStateCode.Outcome)
  }

  return {
    prepare(host: FlowHost): void {
      if (!announced) enter(host, 'intro')
      age += 1
      const locked = phase === 'intro' || phase === 'countdown'
      if (locked) {
        for (const player of host.players.values()) {
          if (player.lastInput) {
            player.lastInput = { ...player.lastInput, moveX: 0, moveZ: 0, jump: false, dive: false }
          }
          for (const frame of player.queue) {
            frame.moveX = 0
            frame.moveZ = 0
            frame.jump = false
            frame.dive = false
          }
        }
      }
      if (phase === 'intro' && age >= INTRO_TICKS) enter(host, 'countdown')
      else if (phase === 'countdown' && age >= COUNTDOWN_TICKS) enter(host, 'play')
      else if (phase === 'play' && host.beanFinished) {
        for (const player of host.players.values()) {
          if (celebrated.has(player.id)) continue
          if (host.beanFinished(player.id)) {
            celebrated.add(player.id)
            enter(host, 'outcome')
            break
          }
        }
      } else if (phase === 'outcome' && age >= OUTCOME_TICKS) enter(host, 'play')
    },
    onSocketClosed(): boolean {
      return false
    },
    resume(): number | null {
      return null
    },
  }
}
