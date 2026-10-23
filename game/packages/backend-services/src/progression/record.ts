import { CATALOGUE, SEASON, cloneLoadout, starterLoadout, type Loadout } from '@wobblebeans/shared'
import type { RewardLine, ShowMedal } from '@wobblebeans/shared'
import type { ChallengeKind } from '@wobblebeans/shared'

export interface InventoryRow {
  itemId: string
  acquiredTs: string
  source: string
  seen: boolean
  usedInMatch: boolean
  revokedTs: string | null
  purchaseKey: string | null
}

export interface ChallengeRow {
  challengeId: string
  kind: ChallengeKind
  periodKey: string
  progress: number
  completedAt: string | null
  swapped: boolean
}

export interface LastShow {
  showId: string
  xp: number
  coins: number
  lines: RewardLine[]
  medals: ShowMedal[]
  placement: number | null
}

export interface PlayerProgressRecord {
  playerId: string
  lifetimeXp: number
  seasonId: string
  seasonXp: number
  tier: number
  overflowGrants: number
  trophies: number
  restedBank: number
  lastPlayUtc: string | null
  showCoinRawByDay: Record<string, number>
  inventory: InventoryRow[]
  loadout: Loadout
  presets: [Loadout, Loadout, Loadout]
  challenges: ChallengeRow[]
  dailySwaps: Record<string, number>
  levelRewards: number[]
  guestMigrated: boolean
  settledShowIds: string[]
  lastShow: LastShow | null
}

export function emptyRecord(playerId: string, now: Date): PlayerProgressRecord {
  const loadout = starterLoadout()
  return {
    playerId,
    lifetimeXp: 0,
    seasonId: SEASON.id,
    seasonXp: 0,
    tier: 0,
    overflowGrants: 0,
    trophies: 0,
    restedBank: 0,
    lastPlayUtc: null,
    showCoinRawByDay: {},
    inventory: CATALOGUE.filter((row) => row.acquisitionSource.includes('starter')).map((row) => ({
      itemId: row.itemId,
      acquiredTs: now.toISOString(),
      source: 'starter',
      seen: true,
      usedInMatch: false,
      revokedTs: null,
      purchaseKey: null,
    })),
    loadout: cloneLoadout(loadout),
    presets: [cloneLoadout(loadout), cloneLoadout(loadout), cloneLoadout(loadout)],
    challenges: [],
    dailySwaps: {},
    levelRewards: [],
    guestMigrated: false,
    settledShowIds: [],
    lastShow: null,
  }
}

export function ownedIds(record: PlayerProgressRecord): string[] {
  return record.inventory.filter((row) => row.revokedTs == null).map((row) => row.itemId)
}

export function isOwned(record: PlayerProgressRecord, itemId: string): boolean {
  return record.inventory.some((row) => row.itemId === itemId && row.revokedTs == null)
}
