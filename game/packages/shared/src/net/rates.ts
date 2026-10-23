/**
 * Netcode rates from docs/design/08-technical-architecture.md §3.
 * Packet rate is 25 Hz. Each packet carries the last 6 simulation steps
 * (50 Hz), so redundancy covers ~120 ms. Snapshots are 20 Hz for beans
 * within interestNearM and 10 Hz beyond it.
 */
export const NET = {
  protocolVersion: 1,
  tickHz: 50,
  inputPacketHz: 25,
  inputRedundancy: 6,
  snapshotNearHz: 20,
  snapshotFarHz: 10,
  interpDelayMs: 100,
  interpDelayMinMs: 80,
  interpDelayMaxMs: 200,
  extrapolateMaxMs: 150,
  correctionSnapM: 0.3,
  correctionSmoothM: 0.05,
  correctionSmoothMs: 150,
  interestNearM: 40,
  maxPlayers: 32,
  devClientPort: 47220,
  devServerPort: 47221,
  /** 16-bit position quantum: 1/256 m over ±128 m. */
  posScale: 256,
  velScale: 64,
} as const

export function isNearSnapshotTick(tick: number): boolean {
  const m = tick % 5
  return m === 0 || m === 2
}

export function isFarSnapshotTick(tick: number): boolean {
  return tick % 5 === 0
}
