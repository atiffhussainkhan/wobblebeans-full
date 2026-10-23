/**
 * Child-safety invariants. These are product rules, not comments.
 * Pillar priority in the GDD: safety beats every other pillar.
 * - No open chat and no voice. Quick-chat and emotes are preset ids.
 * - No loot boxes, no premium currency, no real-money purchases in MVP.
 * - Child personal data lives only in ParentAccountStore.
 */
export const SAFETY = {
  openChat: false,
  voiceChat: false,
  lootBoxes: false,
  premiumCurrency: false,
  realMoneyInMvp: false,
  darkPatterns: false,
  childPiiStore: 'ParentAccountStore',
  quickChatIdsOnly: true,
  quickChatMinIntervalS: 1.5,
} as const

export const QUICK_CHAT = [
  { id: 1, text: 'Hello!' },
  { id: 2, text: 'Nice one!' },
  { id: 3, text: "Let's go!" },
  { id: 4, text: 'Oops!' },
  { id: 5, text: 'Good game!' },
  { id: 6, text: 'Thanks!' },
] as const

export const EMOTES = [
  { id: 1, name: 'Wave' },
  { id: 2, name: 'Cheer' },
  { id: 3, name: 'Dance' },
] as const

export type QuickChatId = (typeof QUICK_CHAT)[number]['id']
export type EmoteId = (typeof EMOTES)[number]['id']

export function quickChatText(id: number): string | null {
  const row = QUICK_CHAT.find((q) => q.id === id)
  return row ? row.text : null
}

export function isQuickChatId(id: number): boolean {
  return QUICK_CHAT.some((q) => q.id === id)
}

export function isEmoteId(id: number): boolean {
  return EMOTES.some((e) => e.id === id)
}

/** Client-originated reliable events. Anything else is server-only. */
export const EventKind = {
  QuickChat: 1,
  Emote: 2,
  Eliminated: 3,
  RoundState: 4,
  TileRemoved: 5,
  Score: 6,
} as const

export function isAllowedClientEvent(kind: number, code: number): boolean {
  if (kind === EventKind.QuickChat) return isQuickChatId(code)
  if (kind === EventKind.Emote) return isEmoteId(code)
  return false
}
