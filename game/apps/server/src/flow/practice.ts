import { botInput, createBotMind, type BotMind } from '../bots/brain'
import type { InputFrame } from '@wobblebeans/shared'
import { SHOW } from './constants'

/**
 * Offline Practice Playground (FR-01-12). No fleet allocation, no XP, no coins.
 * The low-population queue offers this; it never starts a Main Show by itself.
 */
export interface PracticeRewards {
  xpEarned: 0
  coinsEarned: 0
}

export class PracticePlayground {
  readonly offline = true as const
  readonly rewards: PracticeRewards = { xpEarned: 0, coinsEarned: 0 }
  readonly botCount: number
  private readonly minds: BotMind[]

  constructor(
    readonly humanId: string,
    botCount = 3,
  ) {
    if (botCount < 0 || botCount > SHOW.practiceMaxBots) throw new Error('practice bot count')
    this.botCount = botCount
    this.minds = Array.from({ length: botCount }, (_, index) => createBotMind(index + 1, index + 3))
  }

  step(tick: number): InputFrame[] {
    return this.minds.map((mind) => botInput(mind, tick, true))
  }

  /** Practice never posts a match result (anti-farm). */
  matchResult(): null {
    return null
  }
}
