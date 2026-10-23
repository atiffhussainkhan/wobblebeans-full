/**
 * Dressing-room catalogue for workstream 5.
 * Workstream 7 should drive prices through DressingPort instead of editing screens.
 * Equip never changes the movement capsule.
 */
import type { StringId } from '../copy'

export type DressTab =
  | 'colour' | 'pattern' | 'face' | 'upper' | 'lower'
  | 'emote' | 'celebration' | 'banner' | 'title'

export type Rarity = 'common' | 'uncommon' | 'rare'

export interface ItemDef {
  id: string
  tab: DressTab
  label: StringId
  rarity: Rarity
  how: StringId
  /** Coin price when the shop is allowed. Null means it is not sold. */
  price: number | null
  swatch?: string
  ownedStart: boolean
}

export const DRESS_TABS: DressTab[] = [
  'colour', 'pattern', 'face', 'upper', 'lower', 'emote', 'celebration', 'banner', 'title',
]

export const ITEMS: ItemDef[] = [
  { id: 'col-berry', tab: 'colour', label: 'item.berry', rarity: 'common', how: 'how.start', price: null, swatch: '#E8336B', ownedStart: true },
  { id: 'col-oat', tab: 'colour', label: 'item.oat', rarity: 'common', how: 'how.start', price: null, swatch: '#F2E6C9', ownedStart: true },
  { id: 'col-mint', tab: 'colour', label: 'item.mint', rarity: 'common', how: 'how.start', price: null, swatch: '#BFE8D2', ownedStart: true },
  { id: 'col-plum', tab: 'colour', label: 'item.plum', rarity: 'rare', how: 'how.season12', price: null, swatch: '#7A2E8E', ownedStart: false },
  { id: 'pat-plain', tab: 'pattern', label: 'item.plain', rarity: 'common', how: 'how.start', price: null, ownedStart: true },
  { id: 'pat-hearts', tab: 'pattern', label: 'item.hearts', rarity: 'uncommon', how: 'how.season12', price: 150, ownedStart: false },
  { id: 'face-smile', tab: 'face', label: 'item.smile', rarity: 'common', how: 'how.start', price: null, ownedStart: true },
  { id: 'face-wink', tab: 'face', label: 'item.wink', rarity: 'uncommon', how: 'how.shows', price: null, ownedStart: false },
  { id: 'top-cloud', tab: 'upper', label: 'item.cloud', rarity: 'common', how: 'how.start', price: null, swatch: '#FFFDF7', ownedStart: true },
  { id: 'top-berry', tab: 'upper', label: 'item.vest', rarity: 'uncommon', how: 'how.shop', price: 200, swatch: '#C81E50', ownedStart: false },
  { id: 'legs-start', tab: 'lower', label: 'item.legs', rarity: 'common', how: 'how.start', price: null, swatch: '#F2E6C9', ownedStart: true },
  { id: 'legs-oat', tab: 'lower', label: 'item.shorts', rarity: 'uncommon', how: 'how.shop', price: 200, swatch: '#E8D7A8', ownedStart: false },
  { id: 'emote-1', tab: 'emote', label: 'item.wave', rarity: 'common', how: 'how.start', price: 100, ownedStart: true },
  { id: 'emote-2', tab: 'emote', label: 'item.cheer', rarity: 'common', how: 'how.start', price: null, ownedStart: true },
  { id: 'emote-3', tab: 'emote', label: 'item.dance', rarity: 'common', how: 'how.start', price: null, ownedStart: true },
  { id: 'emote-4', tab: 'emote', label: 'item.more', rarity: 'rare', how: 'how.shows', price: null, ownedStart: false },
  { id: 'celeb-cheer', tab: 'celebration', label: 'item.celebCheer', rarity: 'common', how: 'how.start', price: null, ownedStart: true },
  { id: 'celeb-dance', tab: 'celebration', label: 'item.celebDance', rarity: 'uncommon', how: 'how.season12', price: null, ownedStart: false },
  { id: 'banner-simple', tab: 'banner', label: 'item.banner', rarity: 'common', how: 'how.start', price: null, ownedStart: true },
  { id: 'banner-star', tab: 'banner', label: 'item.starBanner', rarity: 'rare', how: 'how.shows', price: null, ownedStart: false },
  { id: 'title-bean', tab: 'title', label: 'item.titleBean', rarity: 'common', how: 'how.start', price: null, ownedStart: true },
  { id: 'title-swift', tab: 'title', label: 'item.titleSwift', rarity: 'uncommon', how: 'how.season12', price: null, ownedStart: false },
]

export function itemById(id: string): ItemDef | undefined {
  return ITEMS.find((item) => item.id === id)
}

export function itemsFor(tab: DressTab): ItemDef[] {
  return ITEMS.filter((item) => item.tab === tab)
}

export function shopItems(): ItemDef[] {
  return ITEMS.filter((item) => item.price != null)
}

export interface Look {
  colour: string
  pattern: string
  face: string
  upper: string
  lower: string
  emote: string
  celebration: string
  banner: string
  title: string
}

export function starterLook(): Look {
  return {
    colour: 'col-berry',
    pattern: 'pat-plain',
    face: 'face-smile',
    upper: 'top-cloud',
    lower: 'legs-start',
    emote: 'emote-1',
    celebration: 'celeb-cheer',
    banner: 'banner-simple',
    title: 'title-bean',
  }
}

export function starterOwned(): string[] {
  return ITEMS.filter((item) => item.ownedStart).map((item) => item.id)
}

/** Picks an owned item in the tab. Never an unowned or random-weight drop. */
export function surpriseOwned(tab: DressTab, owned: readonly string[], except: string, salt: number): string | null {
  const pool = itemsFor(tab).filter((item) => owned.includes(item.id) && item.id !== except)
  const usable = pool.length ? pool : itemsFor(tab).filter((item) => owned.includes(item.id))
  if (!usable.length) return null
  const index = Math.abs(salt) % usable.length
  return usable[index]?.id ?? null
}

export interface RewardsPort {
  settle(showId: string, won: boolean): { xp: number; coins: number; trophy: number }
}

/** Stand-in for a signed MatchResult. The view never invents a balance. */
export function settlementFor(_showId: string, won: boolean): { xp: number; coins: number; trophy: number } {
  if (won) return { xp: 200, coins: 65, trophy: 1 }
  return { xp: 120, coins: 40, trophy: 0 }
}
