import { describe, expect, it } from 'vitest'
import { POLICY } from './durations'
import { ParentGate, answerFromPrompt, words } from './parent-gate'

describe('parent gate', () => {
  it('asks for a sum in words between 21 and 99 and has no skip', () => {
    const now = 0
    const gate = new ParentGate(() => now, () => 0)
    const issued = gate.issue('device-1')
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    expect(issued.promptWords).not.toMatch(/\d/)
    expect(issued.promptWords).toBe('ten plus eleven')
    const digits = answerFromPrompt(issued.promptWords)
    expect(Number(digits)).toBeGreaterThanOrEqual(POLICY.parentGateAnswerMin)
    expect(Number(digits)).toBeLessThanOrEqual(POLICY.parentGateAnswerMax)
    expect(words(41)).toBe('forty-one')
    expect(answerFromPrompt('fourteen plus twenty-seven')).toBe('41')
    expect('skip' in gate).toBe(false)
    const passed = gate.submit('device-1', issued.challengeId, digits)
    expect(passed.ok).toBe(true)
  })

  it('locks for 5 minutes after 3 failures and a new sum does not reset the count', () => {
    let now = 1_000
    const gate = new ParentGate(() => now, () => 0.5)
    const first = gate.issue('pad')
    if (!first.ok) throw new Error('issue')
    const wrong = gate.submit('pad', first.challengeId, '10')
    expect(wrong.ok).toBe(false)
    if (wrong.ok) return
    expect(wrong.attemptsLeft).toBe(2)

    const second = gate.issue('pad')
    if (!second.ok) throw new Error('reissue')
    expect(second.challengeId).not.toBe(first.challengeId)
    const wrongAgain = gate.submit('pad', second.challengeId, 'nope')
    expect(wrongAgain.ok).toBe(false)
    if (wrongAgain.ok) return
    expect(wrongAgain.attemptsLeft).toBe(1)

    const third = gate.issue('pad')
    if (!third.ok) throw new Error('third')
    const locked = gate.submit('pad', third.challengeId, '10')
    expect(locked.ok).toBe(false)
    if (locked.ok) return
    expect(locked.attemptsLeft).toBe(0)
    expect(locked.lockedUntil).toBeTruthy()

    const during = gate.issue('pad')
    expect(during.ok).toBe(false)
    const correctDuringLock = gate.submit('pad', third.challengeId, answerFromPrompt(third.promptWords))
    expect(correctDuringLock.ok).toBe(false)

    now += POLICY.parentGateLockMs
    const after = gate.issue('pad')
    expect(after.ok).toBe(true)
    if (!after.ok) return
    expect(gate.submit('pad', after.challengeId, answerFromPrompt(after.promptWords)).ok).toBe(true)
  })
})