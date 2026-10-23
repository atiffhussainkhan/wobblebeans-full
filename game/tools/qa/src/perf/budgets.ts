/**
 * Performance budgets from docs/design/08-technical-architecture.md §12 and §13 (R-01),
 * scaled where ADR-001 says this runtime cannot reproduce a GPU number headlessly.
 *
 * These are timing gates, not gameplay tuning. Locomotion numbers stay in
 * `@wobblebeans/shared` `PHYSICS`.
 */

/** Full server tick, including physics and personalised snapshots. */
export const SERVER_TICK_P99_MS = {
  /** Supported lobby. AD-32, two shows per vCPU. */
  32: 9,
  /** 40-player config. Accept a heavier vCPU share. */
  40: 12,
  /**
   * Stress only. Not a supported lobby (`NET.maxPlayers` is 32).
   * R-01: stable, no NaN, step inside 20 ms.
   */
  60: 20,
} as const

/** Doc 08 reference the 60-bean stress run is also compared against. Not a fail line. */
export const SERVER_TICK_REFERENCE_MS = {
  32: 9,
  40: 12,
  60: 12,
} as const

/** Client prediction of the local bean. Doc 08 sim line. */
export const CLIENT_SIM_STEP_P99_MS = 2.5

/**
 * Doc 08 rollback line (+2.0 ms for ≤10 steps). Headless WASM often misses this,
 * so CI gates the per-step cost instead and records the batch time.
 */
export const CLIENT_ROLLBACK_BATCH_MS = 2

/** Min-spec frame budget. Recorded from a browser; not a headless fail line. */
export const CLIENT_FRAME_P95_MS = 16.7

/** Headless stall gate. A stuck renderer, not the GTX 960 budget. */
export const CLIENT_FRAME_STALL_P95_MS = 100

/**
 * Gzipped client JavaScript. Three.js plus the sim should stay under this.
 * Raised only when a real build measurement says the previous cap was wrong.
 */
export const CLIENT_JS_GZIP_BUDGET_BYTES = 1_200_000

/** Doc 06 §5–6. Locked here so a later audio bus can be checked against one table. */
export const LOUDNESS = {
  musicLufs: -16,
  musicToleranceLu: 1,
  truePeakDbtp: -1,
  mixLufs: -16,
  mixToleranceLu: 2,
  shortTermMaxLufs: -10,
  uiLufsMin: -20,
  uiLufsMax: -18,
  lraMaxLu: 10,
  masterDefault: 70,
  musicDefault: 60,
  sfxDefault: 80,
  uiDefault: 70,
  /** No sudden jump above this, except the GO beat. */
  jumpMaxLu: 6,
} as const
