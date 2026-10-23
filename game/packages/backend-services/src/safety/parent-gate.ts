import { randomBytes } from 'node:crypto'
import { POLICY } from './durations'
import { SafetyError } from './errors'

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

export function words(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new SafetyError('bad_words')
  if (n < 10) return ONES[n]!
  if (n < 20) return TEENS[n - 10]!
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return ones ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens]!
}

const WORD_VALUE = new Map<string, number>()
for (let n = 0; n <= 99; n++) WORD_VALUE.set(words(n), n)

export function answerFromPrompt(prompt: string): string {
  if (/\d/.test(prompt)) throw new SafetyError('prompt_has_digits')
  const parts = prompt.split(' plus ')
  if (parts.length !== 2) throw new SafetyError('prompt_shape')
  const left = WORD_VALUE.get(parts[0]!)
  const right = WORD_VALUE.get(parts[1]!)
  if (left == null || right == null) throw new SafetyError('bad_words')
  return String(left + right)
}

export type GateIssue =
  | { ok: true; challengeId: string; promptWords: string; expiresAt: string }
  | { ok: false; lockedUntil: string; attemptsLeft: 0 }

export type GateSubmit =
  | { ok: true; gatePass: string; expiresAt: string }
  | { ok: false; attemptsLeft: number; lockedUntil?: string }

interface Challenge {
  id: string
  sum: number
  expiresAt: number
}

interface DeviceState {
  fails: number
  lockedUntil: number
  challenge: Challenge | null
}

interface Pass {
  expiresAt: number
  used: boolean
}

/**
 * Sum-in-words gate. Three wrong answers lock the device for five minutes.
 * Issuing a new sum does not reset the failure count, and nothing skips the sum.
 */
export class ParentGate {
  private readonly devices = new Map<string, DeviceState>()
  private readonly passes = new Map<string, Pass>()
  private seq = 0

  constructor(
    private readonly now: () => number,
    private readonly random: () => number = Math.random,
  ) {}

  issue(deviceKey: string): GateIssue {
    const device = this.device(deviceKey)
    const now = this.now()
    if (device.lockedUntil > now) {
      return { ok: false, lockedUntil: new Date(device.lockedUntil).toISOString(), attemptsLeft: 0 }
    }
    const sum = this.pickSum()
    const parts = this.splitSum(sum)
    const promptWords = `${words(parts.a)} plus ${words(parts.b)}`
    if (/\d/.test(promptWords)) throw new SafetyError('prompt_has_digits')
    const challenge: Challenge = {
      id: `gate_${++this.seq}`,
      sum,
      expiresAt: now + POLICY.gateChallengeMs,
    }
    device.challenge = challenge
    return { ok: true, challengeId: challenge.id, promptWords, expiresAt: new Date(challenge.expiresAt).toISOString() }
  }

  submit(deviceKey: string, challengeId: string, digits: string): GateSubmit {
    const device = this.device(deviceKey)
    const now = this.now()
    if (device.lockedUntil > now) {
      return { ok: false, attemptsLeft: 0, lockedUntil: new Date(device.lockedUntil).toISOString() }
    }
    const challenge = device.challenge
    const fresh = challenge && challenge.id === challengeId && challenge.expiresAt >= now
    const expected = fresh ? String(challenge.sum) : ''
    const digitsOk = /^[1-9][0-9]$/.test(digits) && digits === expected
    if (!digitsOk) return this.fail(device, now)
    device.fails = 0
    device.challenge = null
    const gatePass = randomBytes(32).toString('base64url')
    const expiresAt = now + POLICY.gatePassMs
    this.passes.set(gatePass, { expiresAt, used: false })
    return { ok: true, gatePass, expiresAt: new Date(expiresAt).toISOString() }
  }

  consume(gatePass: string): boolean {
    const pass = this.passes.get(gatePass)
    if (!pass || pass.used || pass.expiresAt < this.now()) return false
    pass.used = true
    return true
  }

  private device(deviceKey: string): DeviceState {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(deviceKey)) throw new SafetyError('bad_device')
    let device = this.devices.get(deviceKey)
    if (!device) {
      device = { fails: 0, lockedUntil: 0, challenge: null }
      this.devices.set(deviceKey, device)
    }
    return device
  }

  private fail(device: DeviceState, now: number): GateSubmit {
    device.fails += 1
    device.challenge = null
    if (device.fails >= POLICY.parentGateFails) {
      device.lockedUntil = now + POLICY.parentGateLockMs
      return { ok: false, attemptsLeft: 0, lockedUntil: new Date(device.lockedUntil).toISOString() }
    }
    return { ok: false, attemptsLeft: POLICY.parentGateFails - device.fails }
  }

  private pickSum(): number {
    const span = POLICY.parentGateAnswerMax - POLICY.parentGateAnswerMin + 1
    return POLICY.parentGateAnswerMin + Math.floor(this.random() * span)
  }

  private splitSum(sum: number): { a: number; b: number } {
    const minA = Math.max(10, sum - 89)
    const maxA = Math.min(89, sum - 10)
    const a = minA + Math.floor(this.random() * (maxA - minA + 1))
    return { a, b: sum - a }
  }
}
