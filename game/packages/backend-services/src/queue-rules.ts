/**
 * Queue and connect limits from doc 01 §4, doc 08 §3–4, and doc 09 §4–5.
 * Stream 4's show director should read the same numbers. Until `SHOW_RULES`
 * lands in `@wobblebeans/shared`, this is the copy the services use.
 * The 32-player cap stays on `NET.maxPlayers`.
 */
export const QUEUE_RULES = {
  minHumans: 8,
  maxBots: 12,
  /** At 60 s, start when humans + bots reach this and humans ≥ minHumans. */
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
  /** A level disabled at least this long before start is not chosen (FR-01-03 AC5). */
  disableLeadMs: 60_000,
  humansAt20s: 28,
  humansAt40s: 24,
  accessTtlMs: 15 * 60 * 1000,
  refreshTtlMs: 7 * 24 * 60 * 60 * 1000,
  friendCodeTtlMs: 10 * 60 * 1000,
  friendCodeAttempts: 5,
  friendCodeWindowMs: 10 * 60 * 1000,
  friendPendingMs: 14 * 24 * 60 * 60 * 1000,
  nameRerollsPerDay: 3,
  loginQueueRatio: 0.8,
  eventMinMs: 7 * 24 * 60 * 60 * 1000,
  seasonMs: 56 * 24 * 60 * 60 * 1000,
  xpLevelStep: 25_000,
  xpBoostCap: 2,
  conveyorMaxMps: 3.6,
  undoMs: 24 * 60 * 60 * 1000,
} as const
