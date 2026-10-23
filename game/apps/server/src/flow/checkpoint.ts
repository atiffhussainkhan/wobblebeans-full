/**
 * In-process stand-in for the per-round Redis checkpoint (doc 08 §4).
 * The show process keeps pseudonymous ids and round counters only.
 * A crash report uses the last completed round, then the child returns to the menu.
 */

export interface CheckpointParticipant {
  playerId: string
  isBot: boolean
  qualifiedRounds: number
  reachedFinal: boolean
  wonFinal: boolean
  quit: boolean
  sawResolvedRound: boolean
}

export interface ShowCheckpoint {
  showId: string
  configVersion: string
  region: string
  completedRounds: number
  participants: CheckpointParticipant[]
}

export class ShowCheckpointStore {
  private readonly rows = new Map<string, ShowCheckpoint>()

  save(row: ShowCheckpoint): void {
    this.rows.set(row.showId, clone(row))
  }

  latest(showId: string): ShowCheckpoint | undefined {
    const row = this.rows.get(showId)
    return row ? clone(row) : undefined
  }
}

function clone(row: ShowCheckpoint): ShowCheckpoint {
  return {
    showId: row.showId,
    configVersion: row.configVersion,
    region: row.region,
    completedRounds: row.completedRounds,
    participants: row.participants.map((participant) => ({ ...participant })),
  }
}
