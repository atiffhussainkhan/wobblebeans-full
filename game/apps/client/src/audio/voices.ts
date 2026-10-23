import { VOICE_LIMITS, type VoiceGroup } from '@wobblebeans/shared'

export interface VoiceRequest {
  group: VoiceGroup
  priority: number
  distance: number
  /** Obstacle event id, so one spinning piece cannot fill the bus. */
  obstacleId: string | null
  music: boolean
  now: number
}

interface Slot {
  token: number
  group: VoiceGroup
  priority: number
  distance: number
  obstacleId: string | null
  music: boolean
  startedAt: number
}

/** Public view of a live voice. The token stays inside the allocator. */
export interface VoiceSlotView {
  group: VoiceGroup
  priority: number
  distance: number
  music: boolean
}

/**
 * 32 real voices. Footsteps keep the 8 nearest, each obstacle id keeps 4,
 * social keeps 4. A new voice may steal a lower priority one. It never
 * steals something more important (own bean > tells > gameplay UI > the rest).
 */
export class VoiceAllocator {
  private slots: Slot[] = []
  private next = 1

  request(req: VoiceRequest): { ok: boolean; token: number; stole: number | null } {
    const stole = this.makeRoom(req)
    if (stole === 'reject') return { ok: false, token: 0, stole: null }
    const token = this.next++
    this.slots.push({
      token,
      group: req.group,
      priority: req.priority,
      distance: req.distance,
      obstacleId: req.obstacleId,
      music: req.music,
      startedAt: req.now,
    })
    return { ok: true, token, stole }
  }

  release(token: number): void {
    this.slots = this.slots.filter((slot) => slot.token !== token)
  }

  count(pred: (slot: VoiceSlotView) => boolean = () => true): number {
    return this.slots.filter(pred).length
  }

  private makeRoom(req: VoiceRequest): number | null | 'reject' {
    if (req.music) {
      const music = this.slots.filter((slot) => slot.music)
      if (music.length >= VOICE_LIMITS.music) {
        const oldest = oldestOf(music)
        this.release(oldest.token)
        return oldest.token
      }
    }
    if (req.group === 'footstep') {
      const steps = this.slots.filter((slot) => slot.group === 'footstep')
      if (steps.length >= VOICE_LIMITS.footsteps) {
        const farthest = steps.reduce((a, b) => (b.distance > a.distance ? b : a))
        if (req.distance >= farthest.distance) return 'reject'
        this.release(farthest.token)
        return farthest.token
      }
    }
    if (req.group === 'social') {
      const social = this.slots.filter((slot) => slot.group === 'social')
      if (social.length >= VOICE_LIMITS.social) {
        const victim = lowest(social)
        if (!victim || req.priority < victim.priority) return 'reject'
        this.release(victim.token)
        return victim.token
      }
    }
    if (req.obstacleId) {
      const same = this.slots.filter((slot) => slot.obstacleId === req.obstacleId)
      if (same.length >= VOICE_LIMITS.perObstacle) {
        const victim = oldestOf(same)
        if (req.priority < victim.priority) return 'reject'
        this.release(victim.token)
        return victim.token
      }
    }
    if (this.slots.length >= VOICE_LIMITS.total) {
      const victim = lowest(this.slots.filter((slot) => slot.priority < req.priority))
      if (!victim) return 'reject'
      this.release(victim.token)
      return victim.token
    }
    return null
  }
}

function oldestOf(slots: Slot[]): Slot {
  return slots.reduce((a, b) => (b.startedAt < a.startedAt ? b : a))
}

function lowest(slots: Slot[]): Slot | null {
  if (!slots.length) return null
  return slots.reduce((a, b) => (b.priority < a.priority || (b.priority === a.priority && b.startedAt < a.startedAt) ? b : a))
}
