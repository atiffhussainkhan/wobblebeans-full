import { describe, expect, it } from 'vitest'
import { starterLoadout } from '@wobblebeans/shared'
import { freshRecord, grantXp, resolveLevels } from './progression/engine'
import {
  AdminService,
  CoinLedger,
  MemoryMatchAttestation,
  ProgressionService,
  ShopCatalogue,
  createProgressionService,
  type MatchParticipant,
  type MatchResult,
} from './services'

const NOW = new Date('2026-10-26T12:00:00.000Z')
const GATE = { coinShopEnabled: true as const }

function clocked(): ProgressionService {
  return new ProgressionService({ now: () => NOW })
}

function match(showId: string, player: Partial<MatchParticipant> = {}, playerId = 'ply_1'): MatchResult {
  return {
    showId,
    configVersion: 'foundation-1',
    region: 'eu',
    endedAtUtc: NOW.toISOString(),
    participants: [
      {
        playerId,
        qualifiedRounds: 0,
        wonFinal: false,
        xpEarned: 0,
        coinsEarned: 0,
        ...player,
      },
    ],
  }
}

function keyed(ledger: CoinLedger, playerId: string, prefix: string, currency: 'coins' | 'xp'): number {
  return ledger
    .history(playerId)
    .filter((entry) => (entry.currency ?? 'coins') === currency && entry.idempotencyKey.startsWith(prefix))
    .reduce((sum, entry) => sum + entry.delta, 0)
}

describe('progression service', () => {
  it('settles a show once and ignores the client XP and coin totals', () => {
    const service = clocked()
    const result = match('show_1', { qualifiedRounds: 1, xpEarned: 99999, coinsEarned: 99999 })
    expect(service.applyMatchResult(result, 'res-1').duplicate).toBe(false)
    expect(service.applyMatchResult(result, 'res-1').duplicate).toBe(true)
    expect(service.applyMatchResult(result, 'res-2').duplicate).toBe(true)
    expect(keyed(service.ledger, 'ply_1', 'xp:show:', 'xp')).toBe(250)
    expect(keyed(service.ledger, 'ply_1', 'coin:show:', 'coins')).toBe(15)
    expect(service.snapshot('ply_1').lifetimeXp).not.toBe(99999)
  })

  it('keeps quit rewards, pays practice nothing, and floors the daily show-coin cap per show', () => {
    const service = clocked()
    service.applyMatchResult(match('quit_1', { qualifiedRounds: 2, roundsPlayed: 2, quit: true }), 'quit')
    expect(keyed(service.ledger, 'ply_1', 'xp:show:', 'xp')).toBe(300)
    expect(keyed(service.ledger, 'ply_1', 'coin:show:', 'coins')).toBe(10)

    service.applyMatchResult(
      match('practice_1', { showKind: 'practice', qualifiedRounds: 5, wonFinal: true, xpEarned: 999 }),
      'practice',
    )
    expect(keyed(service.ledger, 'ply_1', 'xp:show:practice_1', 'xp')).toBe(0)
    expect(keyed(service.ledger, 'ply_1', 'coin:show:practice_1', 'coins')).toBe(0)

    const capped = clocked()
    for (let index = 0; index < 15; index++) {
      capped.applyMatchResult(match(`cap_${index}`, { roundsPlayed: 4 }), `cap-${index}`)
    }
    expect(keyed(capped.ledger, 'ply_1', 'coin:show:cap_', 'coins')).toBe(335)
  })

  it('banks rested XP across UTC days and spends it on the next real show', () => {
    const service = new ProgressionService()
    const played = (showId: string, endedAtUtc: string, showKind?: 'practice' | 'main') =>
      service.applyMatchResult(
        {
          ...match(showId, { qualifiedRounds: showKind === 'practice' ? 5 : 1, showKind: showKind ?? 'main' }),
          endedAtUtc,
        },
        showId,
      )
    played('rest_practice_a', '2026-10-20T12:00:00.000Z', 'practice')
    played('rest_practice_b', '2026-10-23T12:00:00.000Z', 'practice')
    expect(service.snapshot('ply_1').restedBank).toBe(3000)
    played('rest_real', '2026-10-23T18:00:00.000Z', 'main')
    expect(keyed(service.ledger, 'ply_1', 'xp:show:rest_real', 'xp')).toBe(500)
    expect(service.snapshot('ply_1').restedBank).toBe(2750)
  })

  it('requires a show attestation and still ignores a client total inside a valid token', () => {
    const attestation = new MemoryMatchAttestation()
    const service = createProgressionService({ now: () => NOW })
    const result = match('signed_1', { qualifiedRounds: 1, xpEarned: 50, coinsEarned: 10 })
    expect(service.applyMatchResult(result, 'signed').reason).toBe('unsigned')
    expect(service.ledger.balance('ply_1')).toBe(0)
    const token = attestation.issue(result)
    expect(service.applyMatchResult({ ...result, participants: [{ ...result.participants[0]!, qualifiedRounds: 5 }] }, 'tamper', token).reason).toBe(
      'unsigned',
    )
    const inflated = {
      ...result,
      participants: [{ ...result.participants[0]!, xpEarned: 99999, coinsEarned: 99999 }],
    }
    expect(attestation.verify(inflated, token)).toBe(true)
    expect(service.applyMatchResult(inflated, 'ok', token).duplicate).toBe(false)
    expect(keyed(service.ledger, 'ply_1', 'xp:show:signed_1', 'xp')).toBe(250)
  })

  it('completes a challenge once, allows one daily swap, and migrates a guest look once', () => {
    const service = clocked()
    service.recordActivity('ply_1', { emotesLobby: 3, teamRounds: 1 })
    expect(service.snapshot('ply_1').lifetimeXp).toBe(1500)
    expect(service.snapshot('ply_1').tier).toBe(1)
    expect(service.ledger.balance('ply_1')).toBe(25)
    service.recordActivity('ply_1', { emotesLobby: 3, teamRounds: 1 })
    const dailyKey = (entry: { idempotencyKey: string }) => entry.idempotencyKey.endsWith(':ply_1:2026-10-26')
    const history = service.ledger.history('ply_1')
    const dailyXp = history
      .filter((entry) => entry.currency === 'xp' && dailyKey(entry))
      .reduce((sum, entry) => sum + entry.delta, 0)
    const dailyCoins = history
      .filter((entry) => (entry.currency ?? 'coins') === 'coins' && entry.idempotencyKey.startsWith('coin:challenge:') && dailyKey(entry))
      .reduce((sum, entry) => sum + entry.delta, 0)
    expect(dailyXp).toBe(1500)
    expect(dailyCoins).toBe(25)

    const open = service.challenges('ply_1').find((row) => !row.done)
    expect(open).toBeTruthy()
    expect(service.swapDaily('ply_1', open!.id).ok).toBe(true)
    expect(service.swapDaily('ply_1', open!.id).ok).toBe(false)

    const moved = service.migrateGuest('ply_2', { ...starterLoadout(), colour: 'colour_coral' })
    expect(moved.reason).toBe('migrated')
    expect(service.snapshot('ply_2').loadout.colour).toBe('colour_berry')
    expect(service.migrateGuest('ply_2', starterLoadout()).reason).toBe('already-migrated')
    expect(service.closeSeason('ply_2').message).toBe('Your Season Path rewards are in your wardrobe!')
  })

  it('sells a fixed set only while the shop is on, and undoes an unused purchase for a day', () => {
    const service = clocked()
    expect(service.beginShopPurchase('ply_1', 'face_star_02', { coinShopEnabled: false }).reason).toBe('shop-off')
    service.ledger.apply({
      playerId: 'ply_1',
      delta: 2000,
      reason: 'show',
      sourceRef: 'seed',
      idempotencyKey: 'seed-coins',
    })
    const began = service.beginShopPurchase('ply_1', 'set_oat_common', GATE)
    expect(began.priceCoins).toBe(2000)
    expect(service.confirmShopPurchase('ply_1', 'set_oat_common', began.token ?? '', 'buy-set', GATE).ok).toBe(true)
    expect(service.ledger.balance('ply_1')).toBe(0)
    expect(service.snapshot('ply_1').ownedIds).toEqual(expect.arrayContaining(['top_set_oat', 'bottom_set_oat']))
    expect(service.beginShopPurchase('ply_1', 'set_oat_common', GATE).reason).toBe('owned')
    expect(service.undoShopPurchase('ply_1', 'top_set_oat', new Date(NOW.getTime() + 24 * 3_600_000)).ok).toBe(true)
    expect(service.ledger.balance('ply_1')).toBe(2000)
    expect(service.snapshot('ply_1').ownedIds).not.toContain('top_set_oat')
    expect(service.snapshot('ply_1').ownedIds).not.toContain('bottom_set_oat')
    expect(service.undoShopPurchase('ply_1', 'top_set_oat').reason).toBe('not-shop')

    const late = clocked()
    late.ledger.apply({ playerId: 'ply_1', delta: 1000, reason: 'show', sourceRef: 'seed', idempotencyKey: 'seed-face' })
    const face = late.beginShopPurchase('ply_1', 'face_star_02', GATE)
    late.confirmShopPurchase('ply_1', 'face_star_02', face.token ?? '', 'buy-face', GATE)
    expect(late.undoShopPurchase('ply_1', 'face_star_02', new Date(NOW.getTime() + 24 * 3_600_000 + 1)).reason).toBe('window')
    late.saveLoadout('ply_1', { ...starterLoadout(), faceplate: 'face_star_02' })
    late.applyMatchResult(match('worn', { qualifiedRounds: 1 }), 'worn')
    expect(late.undoShopPurchase('ply_1', 'face_star_02', NOW).reason).toBe('used')
  })

  it('grants each level reward once and keeps the ledger append-only', () => {
    const record = freshRecord('ply_1', NOW)
    const writes: Parameters<typeof grantXp>[4] = []
    grantXp(
      record,
      100_000,
      { playerId: 'ply_1', reason: 'show', sourceRef: 'levels', idempotencyKey: 'xp-levels', source: 'show' },
      NOW,
      writes,
    )
    expect(record.inventory.filter((row) => row.itemId === 'banner_level_5')).toHaveLength(1)
    resolveLevels(record, NOW)
    expect(record.inventory.filter((row) => row.itemId === 'banner_level_5')).toHaveLength(1)

    const ledger = new CoinLedger()
    const first = ledger.apply({ playerId: 'ply_1', delta: 10, reason: 'show', sourceRef: 'a', idempotencyKey: 'a' })
    expect(Object.isFrozen(first.entry)).toBe(true)
    ledger.apply({ playerId: 'ply_1', delta: 0, reason: 'show', sourceRef: 'zero', idempotencyKey: 'zero' })
    ledger.apply({ playerId: 'ply_1', delta: 5, reason: 'show', sourceRef: 'b', idempotencyKey: 'b' })
    expect(ledger.history('ply_1')[0]).toBe(first.entry)
    expect(ledger.balance('ply_1')).toBe(15)
    expect(ledger.apply({ playerId: 'ply_1', delta: 10, reason: 'show', sourceRef: 'a', idempotencyKey: 'a' }).duplicate).toBe(true)
    expect(() => ledger.apply({ playerId: 'ply_1', delta: -100, reason: 'shop', sourceRef: 'x', idempotencyKey: 'short' })).toThrow(/short/)
    expect(new ShopCatalogue().payload().rows.every((row) => row.buyable === false && row.priceLabel == null)).toBe(true)
    expect('grantCoins' in new AdminService()).toBe(false)
  })

  it('copies an equipped look onto an existing profile', () => {
    const profiles = new Map<string, {
      playerId: string
      generatedNameId: number
      locale: string
      upperId: string
      lowerId: string
      colourId: string
      patternId: string
      faceId: string
    }>()
    const store = {
      get: (playerId: string) => profiles.get(playerId),
      put: (profile: {
        playerId: string
        generatedNameId: number
        locale: string
        upperId: string
        lowerId: string
        colourId: string
        patternId: string
        faceId: string
      }) => {
        profiles.set(profile.playerId, profile)
      },
    }
    const service = new ProgressionService({ now: () => NOW, profiles: store })
    profiles.set('ply_1', {
      playerId: 'ply_1',
      generatedNameId: 1,
      locale: 'en',
      upperId: 'old',
      lowerId: 'old',
      colourId: 'old',
      patternId: 'old',
      faceId: 'old',
    })
    service.saveLoadout('ply_1', starterLoadout())
    expect(profiles.get('ply_1')?.colourId).toBe('colour_berry')
    expect(profiles.get('ply_1')?.faceId).toBe('face_smile')
  })
})
