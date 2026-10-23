/** Preset notice ids. A mailer may map these later. No free-text body is stored. */
export const NOTICE = {
  friendApproval: 1,
  sanctionWarning: 2,
  sanctionSuspend24h: 3,
  sanctionSuspend7d: 4,
  sanctionBan: 5,
  appealReceived: 6,
  incidentEscalated: 7,
  exportReady: 8,
  deletionScheduled: 9,
  consentWithdrawn: 10,
  friendActive: 11,
} as const

export type NoticeId = (typeof NOTICE)[keyof typeof NOTICE]
