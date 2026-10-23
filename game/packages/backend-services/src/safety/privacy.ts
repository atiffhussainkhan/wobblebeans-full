import { SAFETY } from '@wobblebeans/shared'
import { POLICY } from './durations'

/**
 * Children's Code high-privacy defaults (FR-11-11).
 * Quick-chat is the one social control that starts on, and it is preset ids only.
 * A child profile has no method that flips these toward less protective.
 */
export const PRIVACY_DEFAULTS = {
  friendsEnabled: false,
  coinShopEnabled: false,
  quickChatEnabled: true,
  onlinePlayEnabled: false,
  builderEnabled: false,
  builderSharingEnabled: false,
  weeklySummaryEnabled: false,
  breakReminderEnabled: true,
  breakReminderMinutes: POLICY.breakReminderDefault,
  dailyLimitEnabled: false,
  dailyLimitMinutes: POLICY.dailyLimitDefault,
  dailyMinutes: POLICY.breakReminderDefault,
  preciseLocationEnabled: false as const,
  profilingEnabled: false as const,
  realMoneyEnabled: false as const,
  openChat: SAFETY.openChat,
  voiceChat: SAFETY.voiceChat,
  lootBoxes: SAFETY.lootBoxes,
  premiumCurrency: SAFETY.premiumCurrency,
  realMoneyInMvp: SAFETY.realMoneyInMvp,
  darkPatterns: SAFETY.darkPatterns,
} as const
