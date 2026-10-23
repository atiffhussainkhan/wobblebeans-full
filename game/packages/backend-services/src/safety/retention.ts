import { POLICY } from './durations'

export type RetentionKind = 'quick_chat' | 'emote' | 'qos' | 'address_prefix' | 'replay' | 'report'

export interface ExpiringRow {
  id: string
  kind: RetentionKind
  at: number
  holdUntil?: number
}

export function maxAgeMs(kind: RetentionKind): number {
  switch (kind) {
    case 'address_prefix':
      return POLICY.addressPrefixMs
    case 'replay':
      return POLICY.replayMs
    case 'report':
      return POLICY.safetyReportMs
    case 'qos':
      return POLICY.qosMs
    default:
      return POLICY.quickChatLogMs
  }
}

/** Legal hold wins over the short replay window until the hold itself ends. */
export function partitionRetention(
  rows: readonly ExpiringRow[],
  now: number,
): { keep: ExpiringRow[]; dropIds: string[] } {
  const keep: ExpiringRow[] = []
  const dropIds: string[] = []
  for (const row of rows) {
    if (row.holdUntil != null && row.holdUntil > now) {
      keep.push(row)
      continue
    }
    if (now - row.at > maxAgeMs(row.kind)) dropIds.push(row.id)
    else keep.push(row)
  }
  return { keep, dropIds }
}
