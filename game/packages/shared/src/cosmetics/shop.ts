/**
 * Fixed-price coin shop. The weekly list is a rotation, not a draw.
 * Payloads are a whitelist: no weight, no timer, no second currency.
 */

import {
  CATALOGUE,
  RARITY_FRAME,
  SHOP_SETS,
  shopPricedItems,
  shopSetById,
  type CosmeticItem,
  type RarityLabel,
  type ShopSet,
} from './catalogue'
import { ECONOMY } from './economy'
import { shopWeekIndex, shopWeekStart } from './season'

export interface ShopClientItem {
  id: string
  name: string
  slot: string
  priceCoins: number
  rarityLabel: RarityLabel
  frame: string
  howToGet: string
}

export interface ShopClientSet {
  id: string
  name: string
  priceCoins: number
  rarityLabel: RarityLabel
  frame: string
  itemIds: string[]
  howToGet: string
}

export interface ShopPayload {
  weekStartUtc: string
  items: ShopClientItem[]
  sets: ShopClientSet[]
}

export interface ShopRouteRow {
  id: string
  name: string
  rarityLabel: RarityLabel
  frame: string
  /** Null when the shop is off, so the route has no price to press. */
  priceLabel: string | null
  priceCoins: number | null
  buyable: boolean
}

export interface ShopRoute {
  enabled: boolean
  message: string
  rows: ShopRouteRow[]
}

function mod(n: number, m: number): number {
  if (m <= 0) return 0
  return ((n % m) + m) % m
}

export function rotationItems(weekIndex: number): CosmeticItem[] {
  const pool = shopPricedItems()
  const count = Math.min(ECONOMY.shop.rotationItems, pool.length)
  const start = mod(weekIndex, pool.length)
  const picked: CosmeticItem[] = []
  for (let i = 0; i < count; i++) {
    const row = pool[(start + i) % pool.length]
    if (row) picked.push(row)
  }
  return picked
}

export function rotationSets(weekIndex: number): ShopSet[] {
  const count = Math.min(ECONOMY.shop.rotationSets, SHOP_SETS.length)
  const start = mod(weekIndex, SHOP_SETS.length)
  const picked: ShopSet[] = []
  for (let i = 0; i < count; i++) {
    const row = SHOP_SETS[(start + i) % SHOP_SETS.length]
    if (row) picked.push(row)
  }
  return picked
}

function toClientItem(row: CosmeticItem): ShopClientItem {
  return {
    id: row.itemId,
    name: row.displayName,
    slot: row.slot,
    priceCoins: row.coinPrice ?? 0,
    rarityLabel: row.rarityLabel,
    frame: RARITY_FRAME[row.rarityLabel],
    howToGet: row.howToGet,
  }
}

function toClientSet(row: ShopSet): ShopClientSet {
  return {
    id: row.id,
    name: row.name,
    priceCoins: row.priceCoins,
    rarityLabel: row.rarityLabel,
    frame: RARITY_FRAME[row.rarityLabel],
    itemIds: [...row.itemIds],
    howToGet: row.howToGet,
  }
}

export function shopPayload(now: Date): ShopPayload {
  const week = shopWeekIndex(now)
  return {
    weekStartUtc: shopWeekStart(now).toISOString(),
    items: rotationItems(week).map(toClientItem),
    sets: rotationSets(week).map(toClientSet),
  }
}

export function shopRoute(now: Date, coinShopEnabled: boolean): ShopRoute {
  const payload = shopPayload(now)
  if (!coinShopEnabled) {
    return {
      enabled: false,
      message: 'The coin shop is off. A grown-up can turn it on.',
      rows: [...payload.items, ...payload.sets].map((row) => ({
        id: row.id,
        name: row.name,
        rarityLabel: row.rarityLabel,
        frame: row.frame,
        priceLabel: null,
        priceCoins: null,
        buyable: false,
      })),
    }
  }
  return {
    enabled: true,
    message: 'Prices are in coins. Unused items can be returned for a day.',
    rows: [...payload.items, ...payload.sets].map((row) => ({
      id: row.id,
      name: row.name,
      rarityLabel: row.rarityLabel,
      frame: row.frame,
      priceLabel: `${row.priceCoins} coins`,
      priceCoins: row.priceCoins,
      buyable: true,
    })),
  }
}

export function priceForShopId(itemId: string): number | undefined {
  const direct = CATALOGUE.find((row) => row.itemId === itemId && row.coinPrice != null)
  if (direct?.coinPrice != null) return direct.coinPrice
  return shopSetById(itemId)?.priceCoins
}

export function shopGrants(itemId: string): string[] {
  const set = shopSetById(itemId)
  if (set) return [...set.itemIds]
  const direct = CATALOGUE.find((row) => row.itemId === itemId && row.coinPrice != null)
  return direct ? [direct.itemId] : []
}
