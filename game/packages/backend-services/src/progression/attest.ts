import { fnv1a } from '@wobblebeans/shared'
import type { MatchResult } from './types'

export interface MatchAttestation {
  issue(result: MatchResult): string
  verify(result: MatchResult, token: string): boolean
}

/**
 * Stand-in until workstream 9 holds the show-server signing key.
 * The token covers authoritative show facts. Client-reported XP and coin
 * totals are not part of it, and the applier does not read them.
 */
export class MemoryMatchAttestation implements MatchAttestation {
  constructor(private readonly secret = 'wobblebeans-dev-match') {}

  issue(result: MatchResult): string {
    return fnv1a(`${this.secret}\n${canonicalMatch(result)}`).toString(16)
  }

  verify(result: MatchResult, token: string): boolean {
    return token === this.issue(result)
  }
}

export function canonicalMatch(result: MatchResult): string {
  return JSON.stringify({
    showId: result.showId,
    configVersion: result.configVersion,
    region: result.region,
    endedAtUtc: result.endedAtUtc ?? null,
    participants: result.participants.map((row) => ({
      playerId: row.playerId,
      qualifiedRounds: row.qualifiedRounds,
      wonFinal: row.wonFinal,
      roundsPlayed: row.roundsPlayed ?? null,
      reachedFinal: row.reachedFinal ?? null,
      quit: row.quit ?? false,
      teamRoundWins: row.teamRoundWins ?? 0,
      teamRoundsPlayed: row.teamRoundsPlayed ?? 0,
      racesFinished: row.racesFinished ?? 0,
      showKind: row.showKind ?? 'main',
      finalPlacement: row.finalPlacement ?? null,
    })),
  })
}
