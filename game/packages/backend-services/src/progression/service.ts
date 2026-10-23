import {
  ECONOMY,
  SEASON,
  fnv1a,
  levelForXp,
  normalizeShowFacts,
  sanitizeLoadout,
  shopGrants,
  templateById,
  type Loadout,
} from '@wobblebeans/shared'
import { MemoryMatchAttestation, type MatchAttestation } from './attest'
import {
  applyActivity,
  applyShowToRecord,
  freshRecord,
  giveItem,
  refreshChallenges,
  resolveSeason,
  swapDailyChallenge,
} from './engine'
import { CoinLedger } from './ledger'
import { MemoryProgressionRepository, type ProgressionRepository } from './repository'
import { isOwned, ownedIds, type PlayerProgressRecord } from './record'
import { ShopCatalogue } from './shop-service'
import type { LedgerWrite, MatchParticipant, MatchResult } from './types'

export interface CosmeticProfile {
  playerId: string
  generatedNameId: number
  locale: string
  upperId: string
  lowerId: string
  colourId: string
  patternId: string
  faceId: string
}

export interface ProfileCosmeticStore {
  get(playerId: string): CosmeticProfile | undefined
  put(profile: CosmeticProfile): void
}

export interface ProgressionOptions {
  ledger?: CoinLedger
  repo?: ProgressionRepository
  shop?: ShopCatalogue
  profiles?: ProfileCosmeticStore
  now?: () => Date
  requireAttestation?: boolean
  attestation?: MatchAttestation
  telemetry?: (event: {
    name: string
    playerPid: string
    payload: Record<string, number | boolean>
  }) => void
}

export interface ProgressSnapshot {
  lifetimeXp: number
  level: number
  seasonXp: number
  tier: number
  coins: number
  trophies: number
  loadout: Loadout
  ownedIds: string[]
  restedBank: number
  unseen: boolean
  lastShow: PlayerProgressRecord['lastShow']
}

/**
 * Applies signed show results, season rewards, and coin-shop purchases.
 * The client never writes the ledger.
 */
export class ProgressionService {
  readonly name = 'progression'
  readonly ledger: CoinLedger
  readonly shop: ShopCatalogue
  private readonly repo: ProgressionRepository
  private readonly profiles: ProfileCosmeticStore | undefined
  private readonly now: () => Date
  private readonly requireAttestation: boolean
  private readonly attestation: MatchAttestation
  private readonly telemetry: ProgressionOptions['telemetry']
  private readonly applied = new Set<string>()
  private readonly pending = new Map<string, { playerId: string; itemId: string }>()
  private confirmSeq = 0

  constructor(options: ProgressionOptions = {}) {
    this.ledger = options.ledger ?? new CoinLedger()
    this.shop = options.shop ?? new ShopCatalogue()
    this.repo = options.repo ?? new MemoryProgressionRepository()
    this.profiles = options.profiles
    this.now = options.now ?? (() => new Date())
    this.requireAttestation = options.requireAttestation ?? false
    this.attestation = options.attestation ?? new MemoryMatchAttestation()
    this.telemetry = options.telemetry
  }

  applyMatchResult(
    result: MatchResult,
    idempotencyKey: string,
    token?: string,
  ): { accepted: boolean; duplicate: boolean; reason?: string } {
    if (this.applied.has(idempotencyKey)) return { accepted: true, duplicate: true, reason: 'key' }
    if (this.requireAttestation) {
      if (!token || !this.attestation.verify(result, token)) {
        return { accepted: false, duplicate: false, reason: 'unsigned' }
      }
    }
    const now = result.endedAtUtc ? new Date(result.endedAtUtc) : this.now()
    let fresh = false
    for (const participant of result.participants) {
      if (this.settleParticipant(result.showId, participant, now)) fresh = true
    }
    this.applied.add(idempotencyKey)
    return { accepted: true, duplicate: !fresh, reason: fresh ? 'applied' : 'show' }
  }

  private settleParticipant(showId: string, participant: MatchParticipant, now: Date): boolean {
    const xpKey = `xp:show:${showId}:${participant.playerId}`
    const record = this.repo.load(participant.playerId) ?? freshRecord(participant.playerId, now)
    if (record.settledShowIds.includes(showId) || this.ledger.findByKey(xpKey)) return false
    const facts = normalizeShowFacts(participant)
    const applied = applyShowToRecord(record, { showId, facts, now })
    if (applied.duplicate) return false
    this.commit(record, applied.writes, now)
    this.telemetry?.({
      name: 'show_settled',
      playerPid: fnv1a(participant.playerId).toString(16),
      payload: {
        xp: applied.xp,
        coins: applied.coins,
        quit: facts.quit,
        tier: record.tier,
        practice: facts.practice,
      },
    })
    return true
  }

  snapshot(playerId: string): ProgressSnapshot {
    const now = this.now()
    const record = this.repo.load(playerId) ?? freshRecord(playerId, now)
    refreshChallenges(record, now)
    this.repo.save(record)
    return {
      lifetimeXp: record.lifetimeXp,
      level: levelForXp(record.lifetimeXp),
      seasonXp: record.seasonXp,
      tier: record.tier,
      coins: this.ledger.balance(playerId),
      trophies: record.trophies,
      loadout: record.loadout,
      ownedIds: ownedIds(record),
      restedBank: record.restedBank,
      unseen: record.inventory.some((row) => row.revokedTs == null && !row.seen),
      lastShow: record.lastShow,
    }
  }

  challenges(playerId: string): Array<{ id: string; text: string; progress: number; target: number; done: boolean }> {
    const now = this.now()
    const record = this.repo.load(playerId) ?? freshRecord(playerId, now)
    refreshChallenges(record, now)
    this.repo.save(record)
    return record.challenges.map((row) => {
      const template = templateText(row.challengeId)
      return {
        id: row.challengeId,
        text: template.text,
        progress: row.progress,
        target: template.target,
        done: row.completedAt != null,
      }
    })
  }

  recordActivity(
    playerId: string,
    activity: { showsPlayed?: number; roundsQualified?: number; racesFinished?: number; finalsReached?: number; emotesLobby?: number; teamRounds?: number },
  ): void {
    const now = this.now()
    const record = this.repo.load(playerId) ?? freshRecord(playerId, now)
    const writes: LedgerWrite[] = []
    applyActivity(
      record,
      {
        showsPlayed: activity.showsPlayed ?? 0,
        roundsQualified: activity.roundsQualified ?? 0,
        racesFinished: activity.racesFinished ?? 0,
        finalsReached: activity.finalsReached ?? 0,
        emotesLobby: activity.emotesLobby ?? 0,
        teamRounds: activity.teamRounds ?? 0,
      },
      now,
      writes,
    )
    this.commit(record, writes, now)
  }

  swapDaily(playerId: string, challengeId: string): { ok: boolean; reason: string } {
    const now = this.now()
    const record = this.repo.load(playerId) ?? freshRecord(playerId, now)
    const result = swapDailyChallenge(record, challengeId, now)
    if (result.ok) this.repo.save(record)
    return result
  }

  saveLoadout(playerId: string, loadout: Loadout): { ok: boolean; reason: string } {
    const now = this.now()
    const record = this.repo.load(playerId) ?? freshRecord(playerId, now)
    record.loadout = sanitizeLoadout(loadout, new Set(ownedIds(record)))
    this.repo.save(record)
    this.syncProfile(record)
    return { ok: true, reason: 'saved' }
  }

  migrateGuest(playerId: string, loadout: Loadout): { ok: boolean; reason: string } {
    const now = this.now()
    const record = this.repo.load(playerId) ?? freshRecord(playerId, now)
    if (record.guestMigrated) return { ok: false, reason: 'already-migrated' }
    record.loadout = sanitizeLoadout(loadout, new Set(ownedIds(record)))
    record.guestMigrated = true
    this.repo.save(record)
    this.syncProfile(record)
    return { ok: true, reason: 'migrated' }
  }

  markSeen(playerId: string, itemId: string): void {
    const record = this.repo.load(playerId)
    if (!record) return
    const row = record.inventory.find((candidate) => candidate.itemId === itemId && candidate.revokedTs == null)
    if (!row) return
    row.seen = true
    this.repo.save(record)
  }

  beginShopPurchase(
    playerId: string,
    itemId: string,
    gate: { coinShopEnabled: boolean },
  ): { ok: boolean; reason: string; token?: string; priceCoins?: number } {
    if (!gate.coinShopEnabled) return { ok: false, reason: 'shop-off' }
    const price = this.shop.priceOf(itemId)
    if (price == null) return { ok: false, reason: 'missing' }
    const grants = grantsFor(itemId)
    const record = this.repo.load(playerId) ?? freshRecord(playerId, this.now())
    if (grants.some((id) => isOwned(record, id))) return { ok: false, reason: 'owned' }
    const token = `cfm_${++this.confirmSeq}`
    this.pending.set(token, { playerId, itemId })
    return { ok: true, reason: 'confirm', token, priceCoins: price }
  }

  confirmShopPurchase(
    playerId: string,
    itemId: string,
    token: string,
    idempotencyKey: string,
    gate: { coinShopEnabled: boolean },
  ): { ok: boolean; reason: string } {
    if (!gate.coinShopEnabled) return { ok: false, reason: 'shop-off' }
    const pending = this.pending.get(token)
    if (!pending || pending.playerId !== playerId || pending.itemId !== itemId) {
      return { ok: false, reason: 'confirm' }
    }
    this.pending.delete(token)
    const bought = this.shop.purchase(this.ledger, playerId, itemId, idempotencyKey, gate)
    if (!bought.ok) return bought
    const now = this.now()
    const record = this.repo.load(playerId) ?? freshRecord(playerId, now)
    for (const id of grantsFor(itemId)) giveItem(record, id, 'coins', now, idempotencyKey)
    this.repo.save(record)
    return { ok: true, reason: 'bought' }
  }

  undoShopPurchase(playerId: string, itemId: string, now = this.now()): { ok: boolean; reason: string } {
    const record = this.repo.load(playerId)
    if (!record) return { ok: false, reason: 'missing' }
    const seed = record.inventory.find((row) => row.itemId === itemId && row.revokedTs == null && row.purchaseKey)
    if (!seed?.purchaseKey) return { ok: false, reason: 'not-shop' }
    const rows = record.inventory.filter((row) => row.purchaseKey === seed.purchaseKey && row.revokedTs == null)
    if (rows.length === 0) return { ok: false, reason: 'missing' }
    if (rows.some((row) => row.usedInMatch)) return { ok: false, reason: 'used' }
    const acquired = Date.parse(rows[0]?.acquiredTs ?? '')
    if (!Number.isFinite(acquired) || now.getTime() - acquired > ECONOMY.shop.undoHours * 3_600_000) {
      return { ok: false, reason: 'window' }
    }
    const charge = this.ledger.findByKey(seed.purchaseKey)
    if (!charge || charge.delta >= 0) return { ok: false, reason: 'missing' }
    const price = -charge.delta
    const key = `undo:${seed.purchaseKey}`
    if (!this.ledger.findByKey(key)) {
      this.ledger.apply({
        playerId,
        delta: price,
        reason: 'undo',
        sourceRef: itemId,
        idempotencyKey: key,
        kind: 'undo',
        currency: 'coins',
        source: 'shop',
        tsUtc: now.toISOString(),
      })
    }
    for (const row of rows) row.revokedTs = now.toISOString()
    this.repo.save(record)
    return { ok: true, reason: 'undone' }
  }

  closeSeason(playerId: string): { message: string } {
    const now = this.now()
    const record = this.repo.load(playerId) ?? freshRecord(playerId, now)
    const writes: LedgerWrite[] = []
    resolveSeason(record, now, writes)
    this.commit(record, writes, now)
    return { message: SEASON.wardrobeCopy }
  }

  private commit(record: PlayerProgressRecord, writes: LedgerWrite[], now: Date): void {
    for (const write of writes) {
      this.ledger.apply({
        playerId: write.playerId,
        delta: write.delta,
        reason: write.reason,
        sourceRef: write.sourceRef,
        idempotencyKey: write.idempotencyKey,
        currency: write.currency,
        kind: write.kind,
        source: write.source,
        tsUtc: now.toISOString(),
      })
    }
    this.repo.save(record)
    this.syncProfile(record)
  }

  private syncProfile(record: PlayerProgressRecord): void {
    const existing = this.profiles?.get(record.playerId)
    if (!existing || !this.profiles) return
    this.profiles.put({
      ...existing,
      upperId: record.loadout.upper,
      lowerId: record.loadout.lower,
      colourId: record.loadout.colour,
      patternId: record.loadout.pattern,
      faceId: record.loadout.faceplate,
    })
  }
}

function grantsFor(itemId: string): string[] {
  const grants = shopGrants(itemId)
  return grants.length > 0 ? grants : [itemId]
}

function templateText(id: string): { text: string; target: number } {
  const row = templateById(id)
  return { text: row?.text ?? '', target: row?.target ?? 0 }
}
