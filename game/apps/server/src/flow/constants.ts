import { NET, PHYSICS, SHOW_RULES } from '@wobblebeans/shared'

/**
 * Show-flow numbers from doc 01 §4 and doc 08 §4.
 * The counts live on `SHOW_RULES`. Tick rate and the lobby cap come from `PHYSICS` and `NET`.
 */
export const SHOW = SHOW_RULES

export function lobbyTarget(): number {
  return NET.maxPlayers
}

export interface PhaseTicks {
  intro: number
  spawnHold: number
  countdown: number
  outcome: number
  interstitial: number
  results: number
}

export function productionPhaseTicks(): PhaseTicks {
  const hz = PHYSICS.tickHz
  return {
    intro: 6 * hz,
    spawnHold: 2 * hz,
    countdown: 3 * hz,
    outcome: 3 * hz,
    interstitial: 8 * hz,
    results: 8 * hz,
  }
}

export function tickMs(): number {
  return 1000 / PHYSICS.tickHz
}
