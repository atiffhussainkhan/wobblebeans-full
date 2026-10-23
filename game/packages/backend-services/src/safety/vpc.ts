/**
 * Verifiable parental consent vendor. Production adapters (the chosen
 * certified vendor) must set requiresSignature and check the callback.
 * This service never sends a parent contact or a card number to the vendor.
 */

export interface VpcStart {
  parentId: string
  method: 'card_check' | 'id_check'
  noticeVersion: string
  country: string
}

export interface VpcChallenge {
  challengeId: string
  method: 'card_check' | 'id_check'
  expiresAt: string
}

export interface VpcCompletion {
  challengeId: string
  vendorToken: string
  signature?: string
}

export interface VpcDecision {
  ok: boolean
  vendorRef: string
  method: 'card_check' | 'id_check'
  reason?: string
}

export interface VpcVendor {
  readonly requiresSignature: boolean
  readonly methods: readonly ('card_check' | 'id_check')[]
  start(input: VpcStart): VpcChallenge
  complete(input: VpcCompletion): VpcDecision
}

function unsafeToken(token: string): boolean {
  return /^\d{13,19}$/.test(token) || token.includes('@')
}

export class MockVpcVendor implements VpcVendor {
  readonly requiresSignature: boolean = false
  readonly methods = ['card_check', 'id_check'] as const
  readonly started: VpcStart[] = []
  private readonly pending = new Map<string, 'card_check' | 'id_check'>()

  start(input: VpcStart): VpcChallenge {
    this.started.push({ ...input })
    const challengeId = `vpc_${this.started.length}`
    this.pending.set(challengeId, input.method)
    return {
      challengeId,
      method: input.method,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }
  }

  passingToken(challengeId: string): string {
    return `mock-ok.${challengeId}`
  }

  complete(input: VpcCompletion): VpcDecision {
    const method = this.pending.get(input.challengeId) ?? 'card_check'
    if (!this.pending.has(input.challengeId)) {
      return { ok: false, vendorRef: '', method, reason: 'unknown_challenge' }
    }
    if (unsafeToken(input.vendorToken)) {
      return { ok: false, vendorRef: '', method, reason: 'unsafe_token' }
    }
    if (input.vendorToken !== this.passingToken(input.challengeId)) {
      return { ok: false, vendorRef: '', method, reason: 'not_verified' }
    }
    this.pending.delete(input.challengeId)
    return { ok: true, vendorRef: `mock_${input.challengeId}`, method }
  }
}

/** Same mock, but the store must present a vendor signature. */
export class SignedMockVpcVendor extends MockVpcVendor {
  override readonly requiresSignature = true

  override complete(input: VpcCompletion): VpcDecision {
    if (input.signature !== `sig.${input.challengeId}`) {
      return { ok: false, vendorRef: '', method: 'card_check', reason: 'bad_signature' }
    }
    return super.complete(input)
  }
}
