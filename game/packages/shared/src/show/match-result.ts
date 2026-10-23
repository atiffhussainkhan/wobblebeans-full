/**
 * Signed show outcome. The show server fills this; progression applies it.
 * No contact address, birth year, or free text.
 */
export interface MatchResult {
  showId: string
  configVersion: string
  region: string
  participants: {
    playerId: string
    qualifiedRounds: number
    wonFinal: boolean
    xpEarned: number
    coinsEarned: number
  }[]
}
