import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createSecretBox } from './codec'
import { MemoryParentBlobs, ParentDirectory, rememberParentWrites } from './parent-directory'
import { ParentAccountStore } from './parent-account'
import { CoinLedger, ModerationService, ProgressionService, ShopCatalogue, TelemetryService } from './services'

describe('backend stubs', () => {
  it('keeps contact data inside the parent store and hands out only a player id', async () => {
    const parents = new ParentAccountStore()
    const parent = parents.register({ email: 'parent@example.com', country: 'GB' })
    const child = parents.addChild(parent.id, 2018, 'en-GB')
    expect(parents.pseudonym(child.id)).toEqual({ playerId: child.playerId })
    const controls = parents.getControls(child.id)!
    expect(controls.friendsEnabled).toBe(false)
    expect(controls.coinShopEnabled).toBe(false)
    expect(JSON.stringify(controls)).not.toContain('example.com')
    const blobs = new MemoryParentBlobs()
    const directory = new ParentDirectory(createSecretBox(randomBytes(32)), blobs)
    const mirrored = new ParentAccountStore()
    rememberParentWrites(mirrored, directory)
    const sealed = mirrored.register({ email: 'parent@example.com', country: 'GB' })
    await new Promise((resolve) => setImmediate(resolve))
    const held = blobs.held('guardian', sealed.id)
    expect(held).toBeTruthy()
    expect(held?.toString('utf8')).not.toContain('parent@example.com')
    const sealedChild = mirrored.addChild(sealed.id, 2018, 'en-GB')
    await new Promise((resolve) => setImmediate(resolve))
    const loaded = (await directory.load('child', sealedChild.id)) as { playerId: string }
    expect(loaded.playerId).toBe(sealedChild.playerId)
  })

  it('applies a coin grant once per idempotency key and sells only fixed coin prices', () => {
    const ledger = new CoinLedger()
    ledger.apply({ playerId: 'ply_1', delta: 500, reason: 'show', sourceRef: 'show_1', idempotencyKey: 'grant-1' })
    const again = ledger.apply({ playerId: 'ply_1', delta: 500, reason: 'show', sourceRef: 'show_1', idempotencyKey: 'grant-1' })
    expect(again.duplicate).toBe(true)
    expect(ledger.balance('ply_1')).toBe(500)
    const shop = new ShopCatalogue()
    expect(shop.items.every((item) => item.priceCoins > 0)).toBe(true)
    expect(JSON.stringify(shop.items)).not.toMatch(/random|loot|premium/i)
    const bought = shop.purchase(ledger, 'ply_1', 'top-berry', 'buy-1')
    expect(bought.ok).toBe(true)
    expect(ledger.balance('ply_1')).toBe(300)
    expect(shop.purchase(ledger, 'ply_1', 'top-berry', 'buy-1').ok).toBe(true)
    expect(ledger.balance('ply_1')).toBe(300)
  })

  it('accepts a match result once and rejects unsafe telemetry', () => {
    const progression = new ProgressionService()
    const result = {
      showId: 'show_1',
      configVersion: 'foundation-1',
      region: 'eu',
      participants: [{ playerId: 'ply_1', qualifiedRounds: 1, wonFinal: false, xpEarned: 50, coinsEarned: 10 }],
    }
    expect(progression.applyMatchResult(result, 'res-1').duplicate).toBe(false)
    expect(progression.applyMatchResult(result, 'res-1').duplicate).toBe(true)
    const telemetry = new TelemetryService()
    telemetry.ingest({ name: 'round_end', playerPid: 'hash', sessionId: 's', ts: 1, payload: { qualified: true } })
    expect(() =>
      telemetry.ingest({ name: 'bad', playerPid: 'hash', sessionId: 's', ts: 1, payload: { email: 'a@b.c' } }),
    ).toThrow(/not allowed/)
    const mod = new ModerationService()
    const report = mod.file({ reporterPlayerId: 'ply_1', subjectPlayerId: 'ply_2', category: 'mean', showId: 'show_1' })
    expect(report.category).toBe('mean')
  })
})
