import type { MatchResult } from '@wobblebeans/backend-services'

/**
 * Doc 07 §1 and §3. The show server fills these fields on the signed
 * `MatchResult`. It does not write the coin ledger (doc 08 §2 principle 4).
 * Practice never builds a result.
 */
export const REWARD = {
  xpParticipation: 100,
  xpQualifiedRound: 150,
  xpReachedFinal: 200,
  xpWin: 500,
  coinsShow: 10,
  coinsPerQualifiedRound: 5,
  coinsWin: 25,
} as const

export interface RewardInput {
  sawResolvedRound: boolean
  qualifiedRounds: number
  reachedFinal: boolean
  won: boolean
}

export function rewardFor(input: RewardInput): { xpEarned: number; coinsEarned: number } {
  if (!input.sawResolvedRound && input.qualifiedRounds === 0 && !input.won && !input.reachedFinal) {
    return { xpEarned: 0, coinsEarned: 0 }
  }
  let xpEarned = REWARD.xpParticipation + REWARD.xpQualifiedRound * input.qualifiedRounds
  let coinsEarned = REWARD.coinsShow + REWARD.coinsPerQualifiedRound * input.qualifiedRounds
  if (input.reachedFinal) xpEarned += REWARD.xpReachedFinal
  if (input.won) {
    xpEarned += REWARD.xpWin
    coinsEarned += REWARD.coinsWin
  }
  return { xpEarned, coinsEarned }
}

export interface RewardParticipant {
  playerId: string
  isBot: boolean
  qualifiedRounds: number
  reachedFinal: boolean
  won: boolean
  sawResolvedRound: boolean
}

export function matchResultFrom(input: {
  showId: string
  configVersion: string
  region: string
  participants: readonly RewardParticipant[]
}): MatchResult | null {
  const humans = input.participants.filter((row) => !row.isBot)
  if (humans.length === 0) return null
  return {
    showId: input.showId,
    configVersion: input.configVersion,
    region: input.region,
    participants: humans.map((row) => {
      const reward = rewardFor(row)
      return {
        playerId: row.playerId,
        qualifiedRounds: row.qualifiedRounds,
        wonFinal: row.won,
        xpEarned: reward.xpEarned,
        coinsEarned: reward.coinsEarned,
      }
    }),
  }
}
