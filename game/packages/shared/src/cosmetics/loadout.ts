/**
 * Dressing-room loadout. Equipping a look does not change the capsule.
 * "Surprise me" shuffles items the player already owns. It does not grant anything.
 */

import { PHYSICS } from '../physics/constants'
import {
  itemById,
  starterItemsFor,
  type CosmeticItem,
  type FaceHide,
} from './catalogue'
import type { CosmeticSlotName } from './season'

export const RENDER_LAYER_ORDER = ['colour', 'pattern', 'faceplate', 'lower', 'upper', 'effects'] as const

/** Art budget from FR-12-04. Not a physics value. */
export const WAIST_SEAM_MAX_MM = 2

export const OUTFIT_PRESET_COUNT = 3

export const EMOTE_SLOTS = 4

export interface Loadout {
  upper: string
  lower: string
  colour: string
  pattern: string
  faceplate: string
  emotes: [string, string, string, string]
  celebration: string
  banner: string
  title: string
}

export interface ResolvedLook {
  layers: typeof RENDER_LAYER_ORDER
  colourId: string
  patternId: string | null
  faceId: string | null
  faceHide: FaceHide
  lowerId: string
  upperId: string
  tintUpper: boolean
  tintLower: boolean
}

export function starterLoadout(): Loadout {
  return {
    upper: 'top_basic',
    lower: 'bottom_basic',
    colour: 'colour_berry',
    pattern: 'pat_03',
    faceplate: 'face_smile',
    emotes: ['emote_wave', 'emote_thumb', 'emote_dance', 'emote_cheer'],
    celebration: 'celebration_basic',
    banner: 'banner_basic',
    title: 'title_basic',
  }
}

export function cloneLoadout(loadout: Loadout): Loadout {
  return { ...loadout, emotes: [...loadout.emotes] }
}

export function idsInLoadout(loadout: Loadout): string[] {
  return [
    loadout.upper,
    loadout.lower,
    loadout.colour,
    loadout.pattern,
    loadout.faceplate,
    ...loadout.emotes,
    loadout.celebration,
    loadout.banner,
    loadout.title,
  ]
}

export function capsuleForLook(_loadout: Loadout): { radius: number; halfHeight: number } {
  return { radius: PHYSICS.capsuleRadius, halfHeight: PHYSICS.capsuleHalfHeight }
}

function applyItem(loadout: Loadout, row: CosmeticItem, emoteIndex = 0): Loadout {
  const next = cloneLoadout(loadout)
  switch (row.slot) {
    case 'upper':
      next.upper = row.itemId
      break
    case 'lower':
      next.lower = row.itemId
      break
    case 'colour':
      next.colour = row.itemId
      break
    case 'pattern':
      next.pattern = row.itemId
      break
    case 'faceplate':
      next.faceplate = row.itemId
      break
    case 'celebration':
      next.celebration = row.itemId
      break
    case 'banner':
      next.banner = row.itemId
      break
    case 'title':
      next.title = row.itemId
      break
    case 'emote': {
      const index = Math.max(0, Math.min(EMOTE_SLOTS - 1, emoteIndex))
      next.emotes[index] = row.itemId
      break
    }
    default:
      break
  }
  return next
}

export function previewItem(loadout: Loadout, itemId: string, emoteIndex = 0): Loadout {
  const row = itemById(itemId)
  if (!row) return cloneLoadout(loadout)
  return applyItem(loadout, row, emoteIndex)
}

export function tryEquip(
  loadout: Loadout,
  itemId: string,
  owned: ReadonlySet<string>,
  emoteIndex = 0,
): { loadout: Loadout; saved: boolean; reason: string } {
  const row = itemById(itemId)
  if (!row) return { loadout: cloneLoadout(loadout), saved: false, reason: 'missing' }
  if (row.slot === 'emote' && (emoteIndex < 0 || emoteIndex >= EMOTE_SLOTS)) {
    return { loadout: cloneLoadout(loadout), saved: false, reason: 'emote-slot' }
  }
  if (!owned.has(itemId)) return { loadout: cloneLoadout(loadout), saved: false, reason: 'unowned' }
  return { loadout: applyItem(loadout, row, emoteIndex), saved: true, reason: 'equipped' }
}

export function sanitizeLoadout(loadout: Loadout, owned: ReadonlySet<string>): Loadout {
  const fallback = starterLoadout()
  const pick = (id: string, slot: CosmeticSlotName): string => {
    const row = itemById(id)
    if (row && row.slot === slot && owned.has(id)) return id
    return slotValue(fallback, slot)
  }
  const emotes = loadout.emotes.map((id, index) => {
    const row = itemById(id)
    if (row && row.slot === 'emote' && owned.has(id)) return id
    return fallback.emotes[index] ?? fallback.emotes[0]
  }) as [string, string, string, string]
  return {
    upper: pick(loadout.upper, 'upper'),
    lower: pick(loadout.lower, 'lower'),
    colour: pick(loadout.colour, 'colour'),
    pattern: pick(loadout.pattern, 'pattern'),
    faceplate: pick(loadout.faceplate, 'faceplate'),
    emotes,
    celebration: pick(loadout.celebration, 'celebration'),
    banner: pick(loadout.banner, 'banner'),
    title: pick(loadout.title, 'title'),
  }
}

function slotValue(loadout: Loadout, slot: CosmeticSlotName): string {
  switch (slot) {
    case 'upper':
      return loadout.upper
    case 'lower':
      return loadout.lower
    case 'colour':
      return loadout.colour
    case 'pattern':
      return loadout.pattern
    case 'faceplate':
      return loadout.faceplate
    case 'celebration':
      return loadout.celebration
    case 'banner':
      return loadout.banner
    case 'title':
      return loadout.title
    case 'emote':
      return loadout.emotes[0]
    default:
      return loadout.upper
  }
}

export function resolveLook(loadout: Loadout): ResolvedLook {
  const upper = itemById(loadout.upper)
  const lower = itemById(loadout.lower)
  const hidesPattern = Boolean(upper?.hidesPattern || lower?.hidesPattern)
  const hides = [upper?.hidesFace, lower?.hidesFace]
  const faceHide: FaceHide = hides.includes('full') ? 'full' : hides.includes('eyes') ? 'eyes' : 'none'
  return {
    layers: RENDER_LAYER_ORDER,
    colourId: loadout.colour,
    patternId: hidesPattern ? null : loadout.pattern,
    faceId: faceHide === 'full' ? null : loadout.faceplate,
    faceHide,
    lowerId: lower ? loadout.lower : 'bottom_basic',
    upperId: upper ? loadout.upper : 'top_basic',
    tintUpper: upper?.traits.includes('colour_copy') ?? false,
    tintLower: lower?.traits.includes('colour_copy') ?? false,
  }
}

/** Deterministic shuffle of owned items. The seed only picks a styling, never a reward. */
export function surpriseMe(owned: ReadonlySet<string>, seed: number): Loadout {
  const rng = mulberry32(seed)
  const pick = (slot: CosmeticSlotName, fallback: string): string => {
    const choices = [...owned].filter((id) => itemById(id)?.slot === slot)
    if (choices.length === 0) return fallback
    const index = Math.floor(rng() * choices.length)
    return choices[index] ?? fallback
  }
  const base = starterLoadout()
  const emoteChoices = [...owned].filter((id) => itemById(id)?.slot === 'emote')
  const emotes: [string, string, string, string] = [base.emotes[0], base.emotes[1], base.emotes[2], base.emotes[3]]
  if (emoteChoices.length > 0) {
    const bag = [...emoteChoices]
    for (let i = 0; i < EMOTE_SLOTS; i++) {
      if (bag.length === 0) bag.push(...emoteChoices)
      const index = Math.floor(rng() * bag.length)
      const picked = bag.splice(index, 1)[0]
      if (picked) emotes[i] = picked
    }
  }
  return {
    upper: pick('upper', base.upper),
    lower: pick('lower', base.lower),
    colour: pick('colour', base.colour),
    pattern: pick('pattern', base.pattern),
    faceplate: pick('faceplate', base.faceplate),
    emotes,
    celebration: pick('celebration', base.celebration),
    banner: pick('banner', base.banner),
    title: pick('title', base.title),
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function starterLookCount(): { colours: number; patterns: number; faces: number; looks: number } {
  const colours = starterItemsFor('colour').length
  const patterns = starterItemsFor('pattern').length
  const faces = starterItemsFor('faceplate').length
  return { colours, patterns, faces, looks: colours * patterns * faces }
}
