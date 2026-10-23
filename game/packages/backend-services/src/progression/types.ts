/**
 * Match and wallet shapes shared with the rest of the backend.
 * Optional fields were added for workstream 7. Existing fields stay required
 * and in the same order so older callers still type-check.
 * `xpEarned` and `coinsEarned` are ignored. The server computes both.
 */

export interface MatchParticipant {
  playerId: string
  qualifiedRounds: number
  wonFinal: boolean
  xpEarned: number
  coinsEarned: number
  roundsPlayed?: number
  reachedFinal?: boolean
  quit?: boolean
  teamRoundWins?: number
  teamRoundsPlayed?: number
  racesFinished?: number
  showKind?: 'main' | 'practice' | 'private'
  finalPlacement?: number | null
}

export interface MatchResult {
  showId: string
  configVersion: string
  region: string
  endedAtUtc?: string
  participants: MatchParticipant[]
}

export type LedgerKind = 'grant' | 'spend' | 'undo'
export type LedgerCurrency = 'coins' | 'xp'
export type LedgerSource = 'show' | 'challenge' | 'tier' | 'trophy' | 'overflow' | 'shop' | 'admin'

export interface LedgerEntry {
  id: string
  playerId: string
  delta: number
  reason: string
  sourceRef: string
  idempotencyKey: string
  balanceAfter: number
  kind?: LedgerKind
  currency?: LedgerCurrency
  tsUtc?: string
  source?: LedgerSource
}

export interface LedgerWrite {
  playerId: string
  delta: number
  reason: string
  sourceRef: string
  idempotencyKey: string
  currency: LedgerCurrency
  kind: LedgerKind
  source: LedgerSource
}

export interface ShopItem {
  id: string
  name: string
  priceCoins: number
  slot: 'upper' | 'lower' | 'pattern' | 'colour' | 'face' | 'emote'
}
