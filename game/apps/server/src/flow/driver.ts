import type { RoundType } from '@wobblebeans/shared'

export interface DriverEntrant {
  slotId: number
  isBot: boolean
  finished: boolean
  alive: boolean
  eliminated: boolean
  score: number
}

/** Test and headless shows push finish / fall / score through this. Physics does it in a live show. */
export interface DriverCtx {
  roundType: RoundType
  quota: number
  elapsedTicks: number
  entrants: readonly DriverEntrant[]
  finish(slotId: number): void
  fall(slotId: number): void
  score(slotId: number, value: number): void
}

export interface RoundDriver {
  tick(ctx: DriverCtx): void
}

/**
 * Deterministic stand-in for a level. Lowest slot ids qualify.
 * Finals leave a single champion unless the round times out first.
 */
export function scriptedShowDriver(): RoundDriver {
  return {
    tick(ctx) {
      if (ctx.roundType === 'points') {
        for (const entrant of ctx.entrants) {
          if (!entrant.eliminated) ctx.score(entrant.slotId, 1000 - entrant.slotId)
        }
        return
      }
      if (ctx.roundType === 'survival') {
        const alive = ctx.entrants.filter((entrant) => entrant.alive && !entrant.eliminated)
        if (alive.length > ctx.quota) {
          const last = alive[alive.length - 1]
          if (last) ctx.fall(last.slotId)
        }
        return
      }
      if (ctx.roundType === 'final-survival') {
        const alive = ctx.entrants.filter((entrant) => entrant.alive && !entrant.eliminated && !entrant.isBot)
        if (alive.length > 1) {
          const last = alive[alive.length - 1]
          if (last) ctx.fall(last.slotId)
        }
        return
      }
      const next = ctx.entrants.find((entrant) => !entrant.finished && !entrant.eliminated && entrant.alive)
      if (next) ctx.finish(next.slotId)
    },
  }
}
