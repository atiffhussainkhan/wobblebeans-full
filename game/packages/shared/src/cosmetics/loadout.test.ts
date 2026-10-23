import { describe, expect, it } from 'vitest'
import { PHYSICS } from '../physics/constants'
import { itemById, starterItemsFor } from './catalogue'
import {
  capsuleForLook,
  previewItem,
  resolveLook,
  sanitizeLoadout,
  starterLoadout,
  starterLookCount,
  surpriseMe,
  tryEquip,
} from './loadout'

describe('dressing loadout', () => {
  it('builds 432 starter looks and does not resize the capsule', () => {
    expect(starterLookCount()).toEqual({ colours: 12, patterns: 6, faces: 6, looks: 432 })
    const look = starterLoadout()
    expect(capsuleForLook(look)).toEqual({
      radius: PHYSICS.capsuleRadius,
      halfHeight: PHYSICS.capsuleHalfHeight,
    })
    expect(PHYSICS.capsuleRadius).toBe(0.5)
    expect(PHYSICS.capsuleHalfHeight).toBe(0.3)
    expect(itemById('emote_wave')?.wireEmoteCode).toBe(1)
    expect(itemById('emote_cheer')?.wireEmoteCode).toBe(2)
    expect(itemById('emote_dance')?.wireEmoteCode).toBe(3)
    expect(itemById('emote_thumb')?.wireEmoteCode).toBeUndefined()
  })

  it('surprises only from owned items', () => {
    const owned = new Set(starterItemsFor().map((row) => row.itemId))
    const looks = Array.from({ length: 50 }, (_, seed) => surpriseMe(owned, seed + 1))
    for (const look of looks) {
      const ids = [look.upper, look.lower, look.colour, look.pattern, look.faceplate, look.celebration, look.banner, look.title, ...look.emotes]
      expect(ids.every((id) => owned.has(id))).toBe(true)
    }
    const distinct = new Set(looks.map((look) => look.colour + look.pattern + look.faceplate))
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('occludes face or pattern in art only and refuses an unowned equip', () => {
    const hood = resolveLook(previewItem(starterLoadout(), 'top_hood'))
    expect(hood.faceHide).toBe('full')
    expect(hood.faceId).toBeNull()
    const paint = resolveLook(previewItem(starterLoadout(), 'top_paint'))
    expect(paint.patternId).toBeNull()
    const basic = resolveLook(starterLoadout())
    expect(basic.tintUpper).toBe(true)
    expect(basic.tintLower).toBe(true)
    const owned = new Set(starterItemsFor().map((row) => row.itemId))
    expect(tryEquip(starterLoadout(), 'colour_coral', owned).saved).toBe(false)
    expect(tryEquip(starterLoadout(), 'emote_wave', owned, 4).reason).toBe('emote-slot')
    const cleaned = sanitizeLoadout({ ...starterLoadout(), colour: 'colour_coral' }, owned)
    expect(cleaned.colour).toBe('colour_berry')
  })
})
