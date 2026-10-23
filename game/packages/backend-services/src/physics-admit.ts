/**
 * A show admits a client only when the client's physics hash matches the
 * config version pinned at allocation (doc 08 §10, I-09). A mismatch asks
 * the client to refresh config before queueing again.
 * The gauntlet process still compares Hello locally and does not import this package.
 */
export function physicsHashAllowed(clientHash: number, pinnedHash: number): boolean {
  return Number.isInteger(clientHash) && clientHash >= 0 && clientHash === pinnedHash
}

export type AdmitReason = 'ok' | 'physics' | 'expired' | 'identity' | 'missing'

export interface ConnectAdmission {
  ok: boolean
  reason: AdmitReason
  refreshConfig: boolean
}

export function admitPhysics(clientHash: number, pinnedHash: number): ConnectAdmission {
  if (physicsHashAllowed(clientHash, pinnedHash)) return { ok: true, reason: 'ok', refreshConfig: false }
  return { ok: false, reason: 'physics', refreshConfig: true }
}
