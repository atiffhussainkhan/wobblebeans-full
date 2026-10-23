/**
 * Show, queue, and bot limits from doc 01 §4 and doc 08 §4.
 * One copy, shared by the director and the matchmaker.
 * Tick rate and the 32-player cap stay on `PHYSICS` and `NET`.
 */
export const SHOW_RULES = {
  minHumans: 8,
  finalMax: 10,
  maxRounds: 5,
  maxBots: 12,
  /** At 60 s, start when humans + bots reach this and humans ≥ minHumans (ISS-06). */
  minWithBots: 20,
  maxParty: 4,
  practiceMaxBots: 7,
  newPlayerShows: 5,
  reconnectMs: 60_000,
  maxReconnects: 2,
  lowPopMs: 120_000,
  fillAt20Ms: 20_000,
  fillAt40Ms: 40_000,
  botBackfillMs: 60_000,
  newPlayerFallbackMs: 20_000,
  regionWidenMs: 90_000,
  blockGraceMs: 10_000,
  connectTokenMs: 30_000,
  /** A level disabled at least this long before allocation is not chosen (FR-01-03 AC5). */
  disableLeadMs: 60_000,
  humansAt20s: 28,
  humansAt40s: 24,
} as const
