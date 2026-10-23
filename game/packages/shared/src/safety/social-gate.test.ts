import { describe, expect, it } from 'vitest'
import { PHYSICS } from '../physics/constants'
import { FRIEND_CODE_ICONS, FRIEND_CODE_LENGTH, isPictureFriendCode } from './friend-code'
import { REPORT_PICTURES } from './reports'
import { EMOTES, EventKind, QUICK_CHAT, SAFETY, isAllowedClientEvent } from './rules'
import { SOCIAL_ABUSE, createSocialGate, stepSocialGate } from './social-gate'

const tick = (seconds: number) => Math.round(seconds * PHYSICS.tickHz)

describe('quick-chat catalogue', () => {
  it('ships the launch set at one message per 2 seconds', () => {
    expect(SAFETY.quickChatMinIntervalS).toBe(2)
    expect(SAFETY.openChat).toBe(false)
    expect(SAFETY.voiceChat).toBe(false)
    expect(QUICK_CHAT.length).toBe(8)
    expect(QUICK_CHAT.length).toBeLessThanOrEqual(16)
    const insults = /stupid|idiot|dumb|hate|loser|shut up|kill|ugly/i
    for (const phrase of QUICK_CHAT) expect(phrase.text).not.toMatch(insults)
    expect(isAllowedClientEvent(EventKind.QuickChat, 8)).toBe(true)
    expect(isAllowedClientEvent(EventKind.QuickChat, 9)).toBe(false)
    expect(isAllowedClientEvent(EventKind.Emote, EMOTES[0]!.id)).toBe(true)
  })

  it('keeps report pictures and friend-code icons as preset ids', () => {
    expect(REPORT_PICTURES.map((row) => row.id)).toEqual(['unfair', 'mean', 'scary', 'bug'])
    expect(FRIEND_CODE_ICONS).toHaveLength(16)
    expect(isPictureFriendCode([0, 1, 2, 3, 4, 5])).toBe(true)
    expect(isPictureFriendCode([0, 1, 2, 3, 4])).toBe(false)
    expect(isPictureFriendCode([0, 1, 2, 3, 4, 16])).toBe(false)
    expect(FRIEND_CODE_LENGTH).toBe(6)
  })
})

describe('social abuse gate', () => {
  it('drops a second preset inside 2 seconds and allows the next one on the boundary', () => {
    let state = createSocialGate()
    const first = stepSocialGate(state, { kind: EventKind.QuickChat, code: 1, targetId: 0, tick: 0 })
    expect(first.allow).toBe(true)
    state = first.state
    const early = stepSocialGate(state, { kind: EventKind.Emote, code: 1, targetId: 0, tick: tick(2) - 1 })
    expect(early.allow).toBe(false)
    expect(early.state).toBe(state)
    const onTime = stepSocialGate(state, { kind: EventKind.QuickChat, code: 7, targetId: 0, tick: tick(2) })
    expect(onTime.allow).toBe(true)
  })

  it('soft-throttles the same phrase after five sends inside 30 seconds', () => {
    let state = createSocialGate()
    for (let n = 0; n < SOCIAL_ABUSE.repeatCount; n++) {
      const step = stepSocialGate(state, {
        kind: EventKind.QuickChat,
        code: 2,
        targetId: 0,
        tick: n * tick(2),
      })
      expect(step.allow).toBe(true)
      state = step.state
    }
    const tooSoon = stepSocialGate(state, {
      kind: EventKind.QuickChat,
      code: 2,
      targetId: 0,
      tick: 4 * tick(2) + tick(2),
    })
    expect(tooSoon.allow).toBe(false)
    const afterThrottleGap = stepSocialGate(state, {
      kind: EventKind.QuickChat,
      code: 2,
      targetId: 0,
      tick: 4 * tick(2) + tick(SOCIAL_ABUSE.throttleIntervalS),
    })
    expect(afterThrottleGap.allow).toBe(true)
    const differentPhrase = stepSocialGate(afterThrottleGap.state, {
      kind: EventKind.QuickChat,
      code: 5,
      targetId: 0,
      tick: 4 * tick(2) + tick(SOCIAL_ABUSE.throttleIntervalS) + tick(2),
    })
    expect(differentPhrase.allow).toBe(false)
    expect(differentPhrase.state.throttleUntilTick).toBeGreaterThan(0)
  })
})
