import { FRIEND_CODE_LENGTH, isPictureFriendCode } from '@wobblebeans/shared'
import { POLICY } from './durations'
import { SafetyError } from './errors'
import { NOTICE } from './notices'

export interface FriendAuthz {
  ok: true
  parentId: string
  generatedNameId: number
}

export interface FriendNotice {
  parentId: string
  templateId: number
  params: Record<string, number | boolean>
}

interface CodeRow {
  ownerPlayerId: string
  symbols: number[]
  expiresAt: number
  used: boolean
}

interface RequestRow {
  id: string
  fromPlayerId: string
  toPlayerId: string
  fromParentId: string
  toParentId: string
  fromNameId: number
  toNameId: number
  fromApproved: boolean
  toApproved: boolean
  status: 'pending' | 'active' | 'declined' | 'expired' | 'removed'
  createdAt: number
  expiresAt: number
}

export interface FriendListItem {
  requestId: string
  otherPlayerId: string
  otherGeneratedNameId: number
  status: RequestRow['status']
  addedBy: 'friend_code'
  promptId: 'know_this_child'
  expiresAt: string
}

/**
 * Friendships exist only after a picture code is redeemed and every parent approves.
 * There is no name search.
 */
export class FriendGraph {
  private readonly codes: CodeRow[] = []
  private readonly requests: RequestRow[] = []
  private readonly attempts = new Map<string, number[]>()
  private seq = 0

  constructor(
    private readonly now: () => number,
    private readonly random: () => number,
    private readonly authz: (playerId: string) => FriendAuthz | { ok: false; reason: string },
    private readonly blocked: (a: string, b: string) => boolean,
  ) {}

  issue(playerId: string): { symbols: number[]; expiresAt: string } {
    const who = this.authz(playerId)
    if (!who.ok) throw new SafetyError(who.reason)
    for (const code of this.codes) {
      if (code.ownerPlayerId === playerId && !code.used) code.used = true
    }
    const symbols = this.freshSymbols()
    const expiresAt = this.now() + POLICY.friendCodeMs
    this.codes.push({ ownerPlayerId: playerId, symbols, expiresAt, used: false })
    return { symbols, expiresAt: new Date(expiresAt).toISOString() }
  }

  redeem(playerId: string, symbols: readonly number[]): { requestId: string; status: 'pending'; notices: FriendNotice[] } {
    if (!Array.isArray(symbols) || symbols.some((symbol) => typeof symbol !== 'number')) throw new SafetyError('picture_code_only')
    if (!isPictureFriendCode(symbols)) throw new SafetyError('picture_code_only')
    this.noteAttempt(playerId)
    const redeemer = this.authz(playerId)
    if (!redeemer.ok) throw new SafetyError('code_rejected')
    const code = this.codes.find((row) => sameSymbols(row.symbols, symbols))
    if (!code || code.used || code.expiresAt < this.now() || code.ownerPlayerId === playerId) {
      throw new SafetyError('code_rejected')
    }
    const owner = this.authz(code.ownerPlayerId)
    if (!owner.ok || this.blocked(playerId, code.ownerPlayerId)) throw new SafetyError('code_rejected')
    if (this.requests.some((row) => row.status === 'active' && pair(row, playerId, code.ownerPlayerId))) {
      throw new SafetyError('code_rejected')
    }
    code.used = true
    const now = this.now()
    const request: RequestRow = {
      id: `frq_${++this.seq}`,
      fromPlayerId: code.ownerPlayerId,
      toPlayerId: playerId,
      fromParentId: owner.parentId,
      toParentId: redeemer.parentId,
      fromNameId: owner.generatedNameId,
      toNameId: redeemer.generatedNameId,
      fromApproved: false,
      toApproved: false,
      status: 'pending',
      createdAt: now,
      expiresAt: now + POLICY.friendRequestMs,
    }
    this.requests.push(request)
    const notices: FriendNotice[] = [owner.parentId, redeemer.parentId]
      .filter((parentId, index, all) => all.indexOf(parentId) === index)
      .map((parentId) => ({
        parentId,
        templateId: NOTICE.friendApproval,
        params: {
          generatedNameId: parentId === owner.parentId ? redeemer.generatedNameId : owner.generatedNameId,
          addedByCode: true,
        },
      }))
    return { requestId: request.id, status: 'pending', notices }
  }

  approve(
    parentId: string,
    requestId: string,
    knowThisChild: boolean,
  ): { status: RequestRow['status']; notices: FriendNotice[] } {
    const request = this.live(requestId)
    if (request.fromParentId !== parentId && request.toParentId !== parentId) throw new SafetyError('not_owner')
    if (!knowThisChild) {
      request.status = 'declined'
      return { status: 'declined', notices: [] }
    }
    if (request.fromParentId === parentId) request.fromApproved = true
    if (request.toParentId === parentId) request.toApproved = true
    const notices: FriendNotice[] = []
    if (request.fromApproved && request.toApproved) {
      request.status = 'active'
      notices.push(
        { parentId: request.fromParentId, templateId: NOTICE.friendActive, params: { generatedNameId: request.toNameId } },
        { parentId: request.toParentId, templateId: NOTICE.friendActive, params: { generatedNameId: request.fromNameId } },
      )
    }
    return { status: request.status, notices }
  }

  decline(parentId: string, requestId: string): { status: 'declined' } {
    const request = this.live(requestId)
    if (request.fromParentId !== parentId && request.toParentId !== parentId) throw new SafetyError('not_owner')
    request.status = 'declined'
    return { status: 'declined' }
  }

  /** Silent to the other child: no notice is returned. */
  remove(playerId: string, otherPlayerId: string): { removed: boolean } {
    let removed = false
    for (const request of this.requests) {
      if (request.status === 'active' && pair(request, playerId, otherPlayerId)) {
        request.status = 'removed'
        removed = true
      }
    }
    return { removed }
  }

  list(playerId: string): FriendListItem[] {
    this.expire()
    return this.requests
      .filter((row) => row.fromPlayerId === playerId || row.toPlayerId === playerId)
      .filter((row) => row.status === 'pending' || row.status === 'active')
      .map((row) => this.item(row, playerId))
      .sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1))
  }

  canInvite(playerId: string, otherPlayerId: string): boolean {
    if (this.blocked(playerId, otherPlayerId)) return false
    return this.requests.some((row) => row.status === 'active' && pair(row, playerId, otherPlayerId))
  }

  forgetPlayer(playerId: string): void {
    for (const request of this.requests) {
      if (request.fromPlayerId === playerId || request.toPlayerId === playerId) request.status = 'removed'
    }
    for (const code of this.codes) {
      if (code.ownerPlayerId === playerId) code.used = true
    }
    this.attempts.delete(playerId)
  }

  private item(row: RequestRow, playerId: string): FriendListItem {
    const otherIsFrom = row.toPlayerId === playerId
    return {
      requestId: row.id,
      otherPlayerId: otherIsFrom ? row.fromPlayerId : row.toPlayerId,
      otherGeneratedNameId: otherIsFrom ? row.fromNameId : row.toNameId,
      status: row.status,
      addedBy: 'friend_code',
      promptId: 'know_this_child',
      expiresAt: new Date(row.expiresAt).toISOString(),
    }
  }

  private live(requestId: string): RequestRow {
    this.expire()
    const request = this.requests.find((row) => row.id === requestId)
    if (!request || request.status !== 'pending') throw new SafetyError('friend_request_closed')
    return request
  }

  private expire(): void {
    const now = this.now()
    for (const request of this.requests) {
      if (request.status === 'pending' && request.expiresAt < now) request.status = 'expired'
    }
  }

  private noteAttempt(playerId: string): void {
    const now = this.now()
    const recent = (this.attempts.get(playerId) ?? []).filter((at) => now - at < POLICY.friendCodeWindowMs)
    if (recent.length >= POLICY.friendCodeAttempts) {
      this.attempts.set(playerId, recent)
      throw new SafetyError('slow_down')
    }
    recent.push(now)
    this.attempts.set(playerId, recent)
  }

  private freshSymbols(): number[] {
    for (let attempt = 0; attempt < 5; attempt++) {
      const symbols = Array.from({ length: FRIEND_CODE_LENGTH }, () => Math.min(15, Math.floor(this.random() * 16)))
      if (!this.codes.some((row) => !row.used && sameSymbols(row.symbols, symbols))) return symbols
    }
    throw new SafetyError('code_unavailable')
  }
}

function sameSymbols(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((symbol, index) => symbol === right[index])
}

function pair(row: RequestRow, a: string, b: string): boolean {
  return (row.fromPlayerId === a && row.toPlayerId === b) || (row.fromPlayerId === b && row.toPlayerId === a)
}
