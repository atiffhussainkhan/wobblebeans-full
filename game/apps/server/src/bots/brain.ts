import { emptyInput, type InputFrame } from '@wobblebeans/shared'

/**
 * Casual in-process bot (D-11). One `InputFrame`, the same path humans use.
 * No second physics step, no quick-chat, no emote (doc 09 §3.3).
 * Practice bots ease off the stick so a child can finish the mini-race.
 */
export interface BotMind {
  slotId: number
  seq: number
  phase: number
  jumpEvery: number
}

export function createBotMind(slotId: number, salt = slotId): BotMind {
  return {
    slotId,
    seq: 1,
    phase: Math.abs(salt) % 17,
    jumpEvery: 36 + (Math.abs(salt) % 24),
  }
}

export function botInput(mind: BotMind, tick: number, practice = false): InputFrame {
  const frame = emptyInput(mind.seq, tick)
  frame.moveZ = practice ? 0.45 : 1
  frame.jump = (tick + mind.phase) % mind.jumpEvery === 0
  frame.dive = false
  frame.quickChat = 0
  frame.emote = 0
  mind.seq = (mind.seq + 1) & 0xffff
  if (mind.seq === 0) mind.seq = 1
  return frame
}
