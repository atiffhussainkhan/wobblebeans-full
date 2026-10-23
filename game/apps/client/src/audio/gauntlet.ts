import { AUDIO, DT, EventKind, Locomotion, emoteAudioId, type AudioEventId } from '@wobblebeans/shared'
import type { ListenerPose } from './cues'
import type { AudioEngine } from './engine'

export interface EarPose {
  locomotion: Locomotion
  grounded: boolean
  vx: number
  vy: number
  vz: number
  px: number
  py: number
  pz: number
  finished: boolean
}

/**
 * A full jump lands near −9 m/s. Harder than that is a fall, not a hop.
 * The number is a sound choice; the sim still uses PHYSICS for the motion.
 */
export const HARD_LAND_VY = -12

interface Pending {
  left: number
  id: AudioEventId
  pose: EarPose
}

/**
 * Turns the gauntlet's predicted bean into audio events.
 * Jump, land, dive, slide, fall, respawn, and the qualify stinger come from
 * locomotion. Quick-chat and emotes come from the server event.
 */
export class GauntletEar {
  private prev: EarPose | null = null
  private slide = false
  private stepAcc = 0
  private introLeft = 0
  private pending: Pending[] = []

  constructor(private readonly engine: AudioEngine) {}

  beforeStep(state: EarPose): void {
    this.prev = copyPose(state)
  }

  afterStep(state: EarPose): void {
    const before = this.prev
    this.prev = copyPose(state)
    if (!before) return

    if (state.locomotion === Locomotion.Jump && before.locomotion !== Locomotion.Jump) {
      this.engine.play(AUDIO.jump, placed(state))
    }
    if (state.locomotion === Locomotion.Dive && before.locomotion !== Locomotion.Dive) {
      this.engine.play(AUDIO.dive, placed(state))
    }
    const sliding = state.locomotion === Locomotion.DiveSlide
    if (sliding && !this.slide) {
      this.slide = true
      this.engine.play(AUDIO.diveSlide, placed(state))
    }
    if (!sliding && this.slide) {
      this.slide = false
      this.engine.stop(AUDIO.diveSlide)
    }

    if (!before.finished && state.finished) this.engine.setShow({ state: 'qualified' })

    const teleported = Math.hypot(state.px - before.px, state.py - before.py, state.pz - before.pz) > 1.5
    if (teleported) {
      this.engine.play(AUDIO.fallOff, placed(before))
      this.pending.push({ left: 0.15, id: AUDIO.respawn, pose: copyPose(state) })
      this.stepAcc = 0
      return
    }

    const landed =
      state.grounded &&
      !before.grounded &&
      (before.locomotion === Locomotion.Jump || before.locomotion === Locomotion.Fall)
    if (landed) {
      this.engine.play(before.vy < HARD_LAND_VY ? AUDIO.landHard : AUDIO.land, placed(state))
      this.stepAcc = 0
    }

    if (state.grounded && state.locomotion === Locomotion.Run && !this.slide && !landed) {
      this.stepAcc += DT
      const speed = Math.hypot(state.vx, state.vz)
      const interval = Math.max(0.28, Math.min(0.5, 0.42 - 0.012 * speed))
      if (this.stepAcc >= interval) {
        this.stepAcc = 0
        this.engine.play(AUDIO.footstepDefault, placed(state))
      }
    } else if (!state.grounded) {
      this.stepAcc = 0
    }
  }

  frame(dt: number): void {
    if (this.introLeft > 0) {
      const state = this.engine.musicState()
      if (state === 'qualified' || state === 'out' || state === 'victory' || state === 'results') this.introLeft = 0
      else {
        this.introLeft -= dt
        if (this.introLeft <= 0) this.engine.setShow({ state: 'play', roundType: 'race', theme: 'meadow' })
      }
    }
    this.pending = this.pending.filter((item) => {
      item.left -= dt
      if (item.left > 0) return true
      this.engine.play(item.id, placed(item.pose))
      return false
    })
    this.engine.update(dt)
  }

  /** Race intro, then the play bed. The gauntlet has no countdown of its own. */
  onWelcome(): void {
    this.introLeft = 2.2
    this.engine.setShow({ state: 'roundIntro', roundType: 'race', theme: 'meadow', roundProgress: 0 })
  }

  onDrop(): void {
    this.introLeft = 0
    this.engine.setShow({ state: 'error' })
  }

  onError(): void {
    this.engine.play(AUDIO.uiError)
  }

  onSocial(kind: number, playerId: number, code: number, self: boolean, pos?: { x: number; y: number; z: number }): void {
    const at = { self, playerId, x: pos?.x, y: pos?.y, z: pos?.z }
    if (kind === EventKind.QuickChat) this.engine.play(AUDIO.quickChat, at)
    if (kind === EventKind.Emote) {
      const id = emoteAudioId(code)
      if (id) this.engine.play(id, at)
    }
  }

  setListener(pose: ListenerPose): void {
    this.engine.setListener(pose)
  }
}

function placed(pose: EarPose): { self: true; x: number; y: number; z: number } {
  return { self: true, x: pose.px, y: pose.py, z: pose.pz }
}

function copyPose(state: EarPose): EarPose {
  return {
    locomotion: state.locomotion,
    grounded: state.grounded,
    vx: state.vx,
    vy: state.vy,
    vz: state.vz,
    px: state.px,
    py: state.py,
    pz: state.pz,
    finished: state.finished,
  }
}
