import { describe, expect, it } from 'vitest'
import { CATALOGUE, shopPricedItems } from './catalogue'
import { ECONOMY } from './economy'
import { priceForShopId, rotationItems, shopPayload, shopRoute } from './shop'

const BANNED = ['weight', 'odds', 'dropRate', 'chance', 'countdown', 'secondsLeft', 'premium']

function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) keysOf(entry, found)
    return found
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      found.add(key)
      keysOf(entry, found)
    }
  }
  return found
}

describe('coin shop', () => {
  it('ships a whitelist with fixed prices and no draw fields', () => {
    const payload = shopPayload(new Date('2026-10-26T10:00:00.000Z'))
    const keys = keysOf(payload)
    for (const banned of BANNED) expect(keys.has(banned)).toBe(false)
    expect(JSON.stringify(payload)).not.toMatch(/random|loot|premium/i)
    expect(payload.items.length).toBe(ECONOMY.shop.rotationItems)
    expect(payload.sets.length).toBe(ECONOMY.shop.rotationSets)
    for (const row of payload.items) {
      expect(priceForShopId(row.id)).toBe(row.priceCoins)
      expect(row.priceCoins).toBeGreaterThan(0)
    }
  })

  it('brings every priced item back within 12 weeks at the same price', () => {
    const pool = shopPricedItems()
    expect(pool).toHaveLength(19)
    for (const item of pool) {
      const weeks: number[] = []
      for (let week = 0; week < 40; week++) {
        if (rotationItems(week).some((row) => row.itemId === item.itemId)) weeks.push(week)
      }
      expect(weeks.length).toBeGreaterThan(0)
      for (let week = 0; week < 28; week++) {
        expect(weeks.some((shown) => shown >= week && shown < week + ECONOMY.shop.returnWithinWeeks)).toBe(true)
      }
      const prices = new Set(weeks.map((week) => rotationItems(week).find((row) => row.itemId === item.itemId)?.coinPrice))
      expect(prices).toEqual(new Set([item.coinPrice]))
    }
    expect(priceForShopId('set_oat_common')).toBe(2_000)
    expect(priceForShopId('set_parade_special')).toBe(5_000)
    expect(priceForShopId('face_star_02')).toBe(1_000)
  })

  it('hides prices until a parent turns the shop on', () => {
    const now = new Date('2026-10-26T12:00:00.000Z')
    const off = shopRoute(now, false)
    expect(off.enabled).toBe(false)
    expect(off.rows.every((row) => row.priceLabel == null && row.priceCoins == null && row.buyable === false)).toBe(true)
    expect(off.message).toBe('The coin shop is off. A grown-up can turn it on.')
    const on = shopRoute(now, true)
    expect(on.rows.every((row) => row.buyable && row.priceCoins != null && row.priceLabel === `${row.priceCoins} coins`)).toBe(true)
    expect(CATALOGUE.every((row) => !/buy/i.test(row.howToGet))).toBe(true)
  })
})
