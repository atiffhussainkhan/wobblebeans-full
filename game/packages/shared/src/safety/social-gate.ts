/**
 * One social rate for preset quick-chat and emotes.
 * Base interval is SAFETY.quickChatMinIntervalS (doc 09 §6).
 * Five identical phrases to the same audience inside 30 s soft-throttle
 * that sender to one quick-chat per 10 s for 60 s (doc 09 §6, design).
 */
import { PHYSICS } from '../physics/constants'
import { EventKind, SAFETY } from './rules'

export const SOCIAL_ABUSE = {
  repeatCount: 5,
  repeatWindowS: 30,
  throttleIntervalS: 10,
  throttleDurationS: 60,
} as const

export interface SocialGateState {
  lastSocialTick: number
  lastQuickChatTick: number
  recent: { code: number; targetId: number; tick: number }[]
  throttleUntilTick: number
}

export interface SocialGateInput {
  kind: number
  code: number
  /** 0 when the phrase is broadcast. There is no whisper target. */
  targetId: number
  tick: number
}

export function createSocialGate(): SocialGateState {
  return {
    lastSocialTick: -1_000_000,
    lastQuickChatTick: -1_000_000,
    recent: [],
    throttleUntilTick: -1,
  }
}

function ticks(seconds: number): number {
  return Math.round(seconds * PHYSICS.tickHz)
}

export function stepSocialGate(
  state: SocialGateState,
  input: SocialGateInput,
): { allow: boolean; state: SocialGateState } {
  const base = ticks(SAFETY.quickChatMinIntervalS)
  if (input.tick - state.lastSocialTick < base) return { allow: false, state }
  const throttled = input.kind === EventKind.QuickChat && input.tick < state.throttleUntilTick
  if (throttled && input.tick - state.lastQuickChatTick < ticks(SOCIAL_ABUSE.throttleIntervalS)) {
    return { allow: false, state }
  }

  const windowTicks = ticks(SOCIAL_ABUSE.repeatWindowS)
  const recent =
    input.kind === EventKind.QuickChat
      ? [
          ...state.recent.filter((row) => input.tick - row.tick <= windowTicks),
          { code: input.code, targetId: input.targetId, tick: input.tick },
        ]
      : state.recent.filter((row) => input.tick - row.tick <= windowTicks)

  let throttleUntilTick = state.throttleUntilTick
  if (input.kind === EventKind.QuickChat) {
    const same = recent.filter((row) => row.code === input.code && row.targetId === input.targetId).length
    if (same >= SOCIAL_ABUSE.repeatCount) {
      throttleUntilTick = input.tick + ticks(SOCIAL_ABUSE.throttleDurationS)
    }
  }

  return {
    allow: true,
    state: {
      lastSocialTick: input.tick,
      lastQuickChatTick: input.kind === EventKind.QuickChat ? input.tick : state.lastQuickChatTick,
      recent,
      throttleUntilTick,
    },
  }
}
