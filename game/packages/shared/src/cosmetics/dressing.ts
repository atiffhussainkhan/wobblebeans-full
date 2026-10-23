/**
 * Dressing-room state. Unowned items can be previewed and are not saved.
 * The coin shop contributes no button unless a parent has turned it on.
 * Confirming a purchase does not grant the item; the server does that.
 */

import { CATALOGUE, itemById, levelRewardItem, type CosmeticItem } from './catalogue'
import { levelForXp } from './economy'
import {
  cloneLoadout,
  OUTFIT_PRESET_COUNT,
  previewItem,
  starterLoadout,
  surpriseMe,
  tryEquip,
  type Loadout,
} from './loadout'
import { seasonStatus } from './season'
import type { CosmeticSlotName } from './season'
import { shopRoute, type ShopRouteRow } from './shop'

export type DressingTabId = CosmeticSlotName | 'outfits'

export interface DressingTab {
  id: DressingTabId
  label: string
  unseen: boolean
}

export const DRESSING_TABS: readonly { id: DressingTabId; label: string }[] = [
  { id: 'upper', label: 'Top' },
  { id: 'lower', label: 'Bottom' },
  { id: 'colour', label: 'Colour' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'faceplate', label: 'Face' },
  { id: 'emote', label: 'Emotes' },
  { id: 'celebration', label: 'Celebration' },
  { id: 'banner', label: 'Banner' },
  { id: 'title', label: 'Title' },
  { id: 'outfits', label: 'Outfits' },
]

export interface DressingState {
  tab: DressingTabId
  loadout: Loadout
  preview: Loadout
  ownedIds: string[]
  seenIds: string[]
  presets: [Loadout, Loadout, Loadout]
  yaw: number
  coinShopEnabled: boolean
  pendingBuyId: string | null
  shopNowIso: string
  styleNonce: number
  seasonXp: number
  lifetimeXp: number
  saveTarget: 'server' | 'device'
  helpOpen: boolean
  emoteIndex: number
  /** Set when the child confirms a buy. Ownership does not change here. */
  confirmItemId: string | null
}

export type DressingAction =
  | { type: 'tab'; id: DressingTabId }
  | { type: 'preview'; itemId: string }
  | { type: 'equip'; itemId: string }
  | { type: 'surprise' }
  | { type: 'rotate'; dir: -1 | 1 }
  | { type: 'save-preset'; index: number }
  | { type: 'wear-preset'; index: number }
  | { type: 'ask-buy'; itemId: string }
  | { type: 'confirm-buy' }
  | { type: 'cancel-buy' }
  | { type: 'emote-slot'; index: number }
  | { type: 'toggle-help' }
  | { type: 'replace'; state: DressingState }

export interface DressingRow {
  itemId: string
  name: string
  owned: boolean
  seen: boolean
  equipped: boolean
  howToGet: string | null
  rarityLabel: string
  hex: string | null
  action: 'equip' | 'preview'
}

export interface DressingView {
  tab: DressingTabId
  tabs: DressingTab[]
  rows: DressingRow[]
  headline: string
  playtime: string
  levelLabel: string
  saveNote: string
  menuDot: boolean
  surpriseLabel: 'Surprise me'
  shop: {
    enabled: boolean
    message: string
    rows: ShopRouteRow[]
    confirm: { itemId: string; label: string; cancelLabel: 'Not now' } | null
  }
  help: string | null
  helpLabel: 'Help'
  yaw: number
  previewEmoteName: string | null
  outfits: Array<{ index: number; label: string }>
  beanHex: string
  patternUrl: string | null
}

export function starterDressingState(partial?: Partial<DressingState>): DressingState {
  const loadout = starterLoadout()
  const owned = starterOwnedIds()
  return {
    tab: 'colour',
    loadout: cloneLoadout(loadout),
    preview: cloneLoadout(loadout),
    ownedIds: owned,
    seenIds: [...owned],
    presets: [cloneLoadout(loadout), cloneLoadout(loadout), cloneLoadout(loadout)],
    yaw: 0,
    coinShopEnabled: false,
    pendingBuyId: null,
    shopNowIso: '2026-10-26T10:00:00.000Z',
    styleNonce: 0,
    seasonXp: 0,
    lifetimeXp: 0,
    saveTarget: 'server',
    helpOpen: false,
    emoteIndex: 0,
    confirmItemId: null,
    ...partial,
  }
}

export function starterOwnedIds(): string[] {
  return CATALOGUE.filter((row) => row.acquisitionSource.includes('starter')).map((row) => row.itemId)
}

function ownedSet(state: DressingState): Set<string> {
  return new Set(state.ownedIds)
}

function markTabSeen(state: DressingState, tab: DressingTabId): string[] {
  if (tab === 'outfits') return state.seenIds
  const seen = new Set(state.seenIds)
  for (const row of rowsFor(state, tab)) seen.add(row.itemId)
  return [...seen]
}

export function dressingReduce(state: DressingState, action: DressingAction): DressingState {
  switch (action.type) {
    case 'replace':
      return action.state
    case 'tab':
      return { ...state, tab: action.id, seenIds: markTabSeen(state, action.id), confirmItemId: null }
    case 'preview': {
      const row = itemById(action.itemId)
      if (!row) return state
      return {
        ...state,
        tab: row.slot,
        preview: previewItem(state.preview, action.itemId, state.emoteIndex),
        seenIds: state.ownedIds.includes(action.itemId) ? [...new Set([...state.seenIds, action.itemId])] : state.seenIds,
      }
    }
    case 'equip': {
      const equipped = tryEquip(state.loadout, action.itemId, ownedSet(state), state.emoteIndex)
      if (!equipped.saved) {
        const row = itemById(action.itemId)
        if (!row) return state
        return { ...state, preview: previewItem(state.preview, action.itemId, state.emoteIndex) }
      }
      return {
        ...state,
        loadout: equipped.loadout,
        preview: cloneLoadout(equipped.loadout),
        seenIds: [...new Set([...state.seenIds, action.itemId])],
      }
    }
    case 'surprise': {
      const look = surpriseMe(ownedSet(state), state.styleNonce + 1)
      return { ...state, loadout: look, preview: cloneLoadout(look), styleNonce: state.styleNonce + 1 }
    }
    case 'rotate':
      return { ...state, yaw: (state.yaw + action.dir * 45 + 360) % 360 }
    case 'save-preset': {
      if (action.index < 0 || action.index >= OUTFIT_PRESET_COUNT) return state
      const presets = state.presets.map((preset) => cloneLoadout(preset)) as [Loadout, Loadout, Loadout]
      presets[action.index] = cloneLoadout(state.loadout)
      return { ...state, presets }
    }
    case 'wear-preset': {
      if (action.index < 0 || action.index >= OUTFIT_PRESET_COUNT) return state
      const worn = cloneLoadout(state.presets[action.index] ?? state.loadout)
      return { ...state, loadout: worn, preview: cloneLoadout(worn) }
    }
    case 'ask-buy': {
      if (!state.coinShopEnabled) return state
      const route = shopRoute(new Date(state.shopNowIso), true)
      const row = route.rows.find((candidate) => candidate.id === action.itemId && candidate.buyable)
      if (!row) return state
      return { ...state, pendingBuyId: action.itemId, confirmItemId: null }
    }
    case 'confirm-buy': {
      if (!state.coinShopEnabled || !state.pendingBuyId) return state
      return { ...state, confirmItemId: state.pendingBuyId, pendingBuyId: null }
    }
    case 'cancel-buy':
      return { ...state, pendingBuyId: null, confirmItemId: null }
    case 'emote-slot':
      if (action.index < 0 || action.index > 3) return state
      return { ...state, emoteIndex: action.index }
    case 'toggle-help':
      return { ...state, helpOpen: !state.helpOpen }
    default:
      return state
  }
}

function rowsFor(state: DressingState, tab: DressingTabId): DressingRow[] {
  if (tab === 'outfits') return []
  const owned = ownedSet(state)
  const pool = visibleItems(state, tab)
  const rows = pool.map((row) => {
    const isOwned = owned.has(row.itemId)
    return {
      itemId: row.itemId,
      name: row.displayName,
      owned: isOwned,
      seen: !isOwned || state.seenIds.includes(row.itemId),
      equipped: isEquipped(state.loadout, row),
      howToGet: isOwned ? null : row.howToGet,
      rarityLabel: row.rarityLabel,
      hex: row.hex ?? null,
      action: isOwned ? ('equip' as const) : ('preview' as const),
    }
  })
  rows.sort((a, b) => Number(b.owned) - Number(a.owned) || Number(a.seen) - Number(b.seen))
  return rows
}

function visibleItems(state: DressingState, slot: CosmeticSlotName): CosmeticItem[] {
  const owned = ownedSet(state)
  const visible = CATALOGUE.filter((row) => row.slot === slot).filter((row) => {
    if (owned.has(row.itemId)) return true
    return !row.acquisitionSource.includes('level')
  })
  const next = nextLevelItem(state.lifetimeXp, slot)
  if (next && !visible.some((row) => row.itemId === next.itemId)) visible.push(next)
  return visible
}

function nextLevelItem(lifetimeXp: number, slot: CosmeticSlotName): CosmeticItem | undefined {
  const level = levelForXp(lifetimeXp)
  const next = Math.ceil((level + 1) / 5) * 5
  const reward = levelRewardItem(next)
  if (!reward || reward.slot !== slot) return undefined
  return reward
}

function isEquipped(loadout: Loadout, row: CosmeticItem): boolean {
  switch (row.slot) {
    case 'upper':
      return loadout.upper === row.itemId
    case 'lower':
      return loadout.lower === row.itemId
    case 'colour':
      return loadout.colour === row.itemId
    case 'pattern':
      return loadout.pattern === row.itemId
    case 'faceplate':
      return loadout.faceplate === row.itemId
    case 'celebration':
      return loadout.celebration === row.itemId
    case 'banner':
      return loadout.banner === row.itemId
    case 'title':
      return loadout.title === row.itemId
    case 'emote':
      return loadout.emotes.includes(row.itemId)
    default:
      return false
  }
}

export function dressingView(state: DressingState): DressingView {
  const owned = ownedSet(state)
  const status = seasonStatus(state.seasonXp)
  const rows = state.tab === 'outfits' ? [] : rowsFor(state, state.tab)
  const unseenOwned = [...owned].some((id) => !state.seenIds.includes(id))
  const route = shopRoute(new Date(state.shopNowIso), state.coinShopEnabled)
  const pending = state.pendingBuyId ? route.rows.find((row) => row.id === state.pendingBuyId) : undefined
  const colour = itemById(state.preview.colour)
  const pattern = itemById(state.preview.pattern)
  const patternUrl = pattern?.assetRef.startsWith('patterns/') ? `/assets/${pattern.assetRef}` : null
  const emoteId = state.preview.emotes[state.emoteIndex] ?? state.preview.emotes[0]
  return {
    tab: state.tab,
    tabs: DRESSING_TABS.map((tab) => ({
      ...tab,
      unseen: tab.id !== 'outfits' && rowsFor({ ...state, tab: tab.id }, tab.id).some((row) => row.owned && !row.seen),
    })),
    rows,
    headline: status.headline,
    playtime: status.playtime,
    levelLabel: `Level ${levelForXp(state.lifetimeXp)}`,
    saveNote:
      state.saveTarget === 'server'
        ? 'This look is saved for this player.'
        : 'This look stays on this device.',
    menuDot: unseenOwned,
    surpriseLabel: 'Surprise me',
    shop: {
      enabled: route.enabled,
      message: route.message,
      rows: route.rows,
      confirm:
        route.enabled && pending?.priceCoins != null
          ? { itemId: pending.id, label: `Yes, spend ${pending.priceCoins} coins`, cancelLabel: 'Not now' }
          : null,
    },
    help: state.helpOpen ? `This free Season Path runs until 21 December 2026.` : null,
    helpLabel: 'Help',
    yaw: state.yaw,
    previewEmoteName: state.tab === 'emote' ? (itemById(emoteId)?.displayName ?? null) : null,
    outfits: Array.from({ length: OUTFIT_PRESET_COUNT }, (_, index) => ({
      index,
      label: `Outfit ${index + 1}`,
    })),
    beanHex: colour?.hex ?? '#E8336B',
    patternUrl,
  }
}
