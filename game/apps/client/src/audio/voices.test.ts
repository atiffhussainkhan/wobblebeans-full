import type { VoiceGroup } from '@wobblebeans/shared'
import { describe, expect, it } from 'vitest'
import { VoiceAllocator } from './voices'

function ask(
  voices: VoiceAllocator,
  partial: { group?: VoiceGroup; priority?: number; distance?: number; obstacleId?: string | null; music?: boolean; now?: number },
) {
  return voices.request({
    group: partial.group ?? 'character',
    priority: partial.priority ?? 55,
    distance: partial.distance ?? 0,
    obstacleId: partial.obstacleId ?? null,
    music: partial.music ?? false,
    now: partial.now ?? 0,
  })
}

describe('voice allocator', () => {
  it('keeps the eight nearest footsteps and rejects a farther step', () => {
    const voices = new VoiceAllocator()
    for (let i = 0; i < 8; i++) expect(ask(voices, { group: 'footstep', distance: i, now: i }).ok).toBe(true)
    const farther = ask(voices, { group: 'footstep', distance: 20, now: 9 })
    expect(farther.ok).toBe(false)
    const closer = ask(voices, { group: 'footstep', distance: 0.2, now: 10 })
    expect(closer.ok).toBe(true)
    expect(closer.stole).not.toBeNull()
    expect(voices.count()).toBe(8)
  })

  it('lets a tell steal a lower-priority voice once the bus is full', () => {
    const voices = new VoiceAllocator()
    for (let i = 0; i < 32; i++) expect(ask(voices, { priority: 55, now: i }).ok).toBe(true)
    const tell = ask(voices, { group: 'obstacle', priority: 80, obstacleId: 'sfx_obs_swingball', now: 40 })
    expect(tell.ok).toBe(true)
    expect(tell.stole).not.toBeNull()
    expect(voices.count()).toBe(32)
    const same = ask(voices, { priority: 55, now: 41 })
    expect(same.ok).toBe(false)
  })

  it('caps music polyphony at six by retiring the oldest note', () => {
    const voices = new VoiceAllocator()
    const first = ask(voices, { group: 'music', music: true, priority: 5, now: 1 })
    for (let i = 0; i < 5; i++) expect(ask(voices, { group: 'music', music: true, priority: 5, now: i + 2 }).ok).toBe(true)
    const seventh = ask(voices, { group: 'music', music: true, priority: 5, now: 8 })
    expect(seventh.ok).toBe(true)
    expect(seventh.stole).toBe(first.token)
    expect(voices.count((slot) => slot.music)).toBe(6)
  })
})
