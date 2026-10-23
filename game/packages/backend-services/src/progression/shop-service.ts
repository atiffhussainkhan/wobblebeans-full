import { priceForShopId, shopRoute, type ShopRoute } from '@wobblebeans/shared'
import type { CoinLedger } from './ledger'
import type { ShopItem } from './types'

/**
 * The four shelf rows are the foundation catalogue the existing purchase
 * test prices against. The weekly rotation uses the design catalogue.
 */
const FOUNDATION_SHELF: ShopItem[] = [
  { id: 'top-berry', name: 'Berry vest', priceCoins: 200, slot: 'upper' },
  { id: 'legs-oat', name: 'Oat shorts', priceCoins: 200, slot: 'lower' },
  { id: 'pat-hearts', name: 'Heart pattern', priceCoins: 150, slot: 'pattern' },
  { id: 'emote-wave', name: 'Wave', priceCoins: 100, slot: 'emote' },
]

export class ShopCatalogue {
  readonly items: ShopItem[] = FOUNDATION_SHELF

  priceOf(itemId: string): number | undefined {
    return this.items.find((row) => row.id === itemId)?.priceCoins ?? priceForShopId(itemId)
  }

  purchase(
    ledger: CoinLedger,
    playerId: string,
    itemId: string,
    idempotencyKey: string,
    gate?: { coinShopEnabled?: boolean },
  ): { ok: boolean; reason: string; duplicate?: boolean } {
    if (gate?.coinShopEnabled === false) return { ok: false, reason: 'shop-off' }
    const price = this.priceOf(itemId)
    if (price == null) return { ok: false, reason: 'missing' }
    if (ledger.findByKey(idempotencyKey)) return { ok: true, reason: 'bought', duplicate: true }
    if (ledger.balance(playerId) < price) return { ok: false, reason: 'short' }
    const applied = ledger.apply({
      playerId,
      delta: -price,
      reason: 'shop',
      sourceRef: itemId,
      idempotencyKey,
      kind: 'spend',
      currency: 'coins',
      source: 'shop',
    })
    return { ok: true, reason: 'bought', duplicate: applied.duplicate }
  }

  /** Child route. Prices are omitted when the parent has not turned the shop on. */
  payload(now: Date = new Date(), gate: { coinShopEnabled: boolean } = { coinShopEnabled: false }): ShopRoute {
    return shopRoute(now, gate.coinShopEnabled)
  }
}
