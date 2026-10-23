import { clamp } from '../physics/math'

/**
 * Nearest integer. An exact half rounds down (AD-28, doc 01 §4.5).
 * 22.4 → 22, 7.8 → 8, 10.5 → 10.
 */
export function roundHalfDown(value: number): number {
  const sign = value < 0 ? -1 : 1
  const magnitude = Math.abs(value)
  const base = Math.floor(magnitude)
  const fraction = magnitude - base
  const rounded = fraction > 0.5 ? base + 1 : base
  return sign * rounded
}

/**
 * Qualifier spots from the field that *started* the round.
 * Disconnects do not shrink this number (FR-01-04).
 */
export function qualifyQuota(playerCount: number, percent: number): number {
  if (playerCount <= 1) return 0
  return clamp(roundHalfDown(playerCount * percent), 1, playerCount - 1)
}

/** Worked Main Show path: 32 → 22 → 13 → 8, then a Final (doc 01 §4.4). */
export function mainShowQuotaPath(startPlayers: number, finalMax = 10): number[] {
  const percents = [0.7, 0.6, 0.6, 0.6]
  const path: number[] = []
  let field = startPlayers
  for (const percent of percents) {
    if (field <= finalMax) break
    const next = qualifyQuota(field, percent)
    path.push(next)
    field = next
  }
  return path
}
