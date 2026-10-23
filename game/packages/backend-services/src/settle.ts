import { canonicalJson, signPayload, verifyPayload } from './codec'
import type { CoinLedger, LedgerInput } from './ledger'
import type { MatchResult, ProgressionService } from './progression'

export interface SignedMatchResult {
  result: MatchResult
  signature: string
}

export function signMatchResult(result: MatchResult, key: string): SignedMatchResult {
  return { result, signature: signPayload(canonicalJson(result), key) }
}

export function verifyMatchResult(signed: SignedMatchResult, key: string): boolean {
  return verifyPayload(canonicalJson(signed.result), signed.signature, key)
}

/**
 * Applies a server-signed result once. Progression stores XP. Coins go through
 * the ledger under a per-player idempotency key. There is no balance write
 * that skips the ledger.
 */
export function settleMatch(
  signed: SignedMatchResult,
  key: string,
  idempotencyKey: string,
  progression: ProgressionService,
  ledger: CoinLedger,
): { accepted: boolean; duplicate: boolean } {
  if (!verifyMatchResult(signed, key)) throw new Error('match result signature')
  const progress = progression.applyMatchResult(signed.result, idempotencyKey)
  if (!progress.duplicate) {
    for (const participant of signed.result.participants) {
      const input: LedgerInput = {
        playerId: participant.playerId,
        delta: participant.coinsEarned,
        reason: 'show',
        sourceRef: signed.result.showId,
        idempotencyKey: `${idempotencyKey}:${participant.playerId}`,
      }
      ledger.apply(input)
    }
  }
  return progress
}
