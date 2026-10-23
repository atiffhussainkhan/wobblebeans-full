import { randomInt } from 'node:crypto'
import type { ServiceHealth } from './health'
import { QUEUE_RULES } from './queue-rules'

export interface ParentConsentPort {
  /** Friends stay off until a parent grants the purpose. Default is off. */
  friendsEnabled(playerId: string): boolean
}

const friendsOff: ParentConsentPort = { friendsEnabled: () => false }

export interface FriendRequest {
  id: string
  fromPlayerId: string
  toPlayerId: string
  createdAt: number
  expiresAt: number
  fromApproved: boolean
  toApproved: boolean
  declined: boolean
}

export interface SocialSnapshot {
  friends: { a: string; b: string; since: number }[]
  blocks: { playerId: string; subjectId: string }[]
  mutes: { playerId: string; subjectId: string }[]
  requests: FriendRequest[]
}

/**
 * Friend graph, blocks, mutes, and parties' social checks.
 * Picture codes are six icon ids. There is no name search and no typed code.
 */
export class SocialService {
  readonly name = 'social'
  private live = false
  private consent: ParentConsentPort = friendsOff
  private readonly codes = new Map<string, { playerId: string; symbols: number[]; expiresAt: number; used: boolean }>()
  private readonly attempts = new Map<string, number[]>()
  private readonly requests: FriendRequest[] = []
  private readonly friends: { a: string; b: string; since: number }[] = []
  private readonly blocks: { playerId: string; subjectId: string }[] = []
  private readonly mutes: { playerId: string; subjectId: string }[] = []
  private readonly presence = new Map<string, 'offline' | 'menu' | 'queued' | 'show'>()
  private seq = 0

  ready(): ServiceHealth {
    return { name: this.name, ready: this.live }
  }

  markLive(live = true): void {
    this.live = live
  }

  setConsent(port: ParentConsentPort): void {
    this.consent = port
  }

  issueFriendCode(playerId: string, nowMs = Date.now()): { symbols: number[]; expiresAt: string } {
    if (!this.consent.friendsEnabled(playerId)) throw new Error('friends are off')
    for (const [key, code] of this.codes) {
      if (code.playerId === playerId && !code.used) this.codes.delete(key)
    }
    const symbols = Array.from({ length: 6 }, () => randomInt(0, 16))
    const expiresAt = nowMs + QUEUE_RULES.friendCodeTtlMs
    this.codes.set(symbols.join('.'), { playerId, symbols, expiresAt, used: false })
    return { symbols, expiresAt: new Date(expiresAt).toISOString() }
  }

  redeemFriendCode(playerId: string, symbols: readonly number[], nowMs = Date.now()): { requestId: string; fromPlayerId: string } {
    if (!this.consent.friendsEnabled(playerId)) throw new Error('friends are off')
    if (symbols.length !== 6 || symbols.some((symbol) => !Number.isInteger(symbol) || symbol < 0 || symbol > 15)) {
      throw new Error('picture code')
    }
    const stamps = (this.attempts.get(playerId) ?? []).filter((stamp) => nowMs - stamp < QUEUE_RULES.friendCodeWindowMs)
    if (stamps.length >= QUEUE_RULES.friendCodeAttempts) throw new Error('slow down')
    stamps.push(nowMs)
    this.attempts.set(playerId, stamps)
    const code = this.codes.get(symbols.join('.'))
    if (!code || code.used || code.expiresAt <= nowMs) throw new Error('code is not valid')
    if (code.playerId === playerId) throw new Error('code is not valid')
    if (!this.consent.friendsEnabled(code.playerId)) throw new Error('friends are off')
    if (this.blockedEither(playerId, code.playerId)) throw new Error('blocked')
    code.used = true
    const request: FriendRequest = {
      id: `fr_${++this.seq}`,
      fromPlayerId: code.playerId,
      toPlayerId: playerId,
      createdAt: nowMs,
      expiresAt: nowMs + QUEUE_RULES.friendPendingMs,
      fromApproved: false,
      toApproved: false,
      declined: false,
    }
    this.requests.push(request)
    return { requestId: request.id, fromPlayerId: code.playerId }
  }

  /**
   * Parent approval for one child. Friendship starts only after both sides
   * say they know this child. The other child is not told about a decline.
   */
  approveFriend(requestId: string, playerId: string, knowThisChild: boolean, nowMs = Date.now()): { active: boolean } {
    const request = this.requests.find((row) => row.id === requestId)
    if (!request || request.declined || request.expiresAt <= nowMs) throw new Error('request is closed')
    if (playerId !== request.fromPlayerId && playerId !== request.toPlayerId) throw new Error('not your request')
    if (!knowThisChild) {
      request.declined = true
      return { active: false }
    }
    if (playerId === request.fromPlayerId) request.fromApproved = true
    if (playerId === request.toPlayerId) request.toApproved = true
    if (request.fromApproved && request.toApproved) {
      this.addFriend(request.fromPlayerId, request.toPlayerId, nowMs)
      return { active: true }
    }
    return { active: false }
  }

  removeFriend(playerId: string, otherPlayerId: string): void {
    const index = this.friends.findIndex((row) => pair(row.a, row.b) === pair(playerId, otherPlayerId))
    if (index >= 0) this.friends.splice(index, 1)
  }

  listFriends(playerId: string): string[] {
    return this.friends
      .filter((row) => row.a === playerId || row.b === playerId)
      .map((row) => (row.a === playerId ? row.b : row.a))
  }

  areFriends(a: string, b: string): boolean {
    return this.friends.some((row) => pair(row.a, row.b) === pair(a, b))
  }

  block(playerId: string, subjectId: string): void {
    if (playerId === subjectId) return
    if (!this.blocks.some((row) => row.playerId === playerId && row.subjectId === subjectId)) {
      this.blocks.push({ playerId, subjectId })
    }
    this.removeFriend(playerId, subjectId)
  }

  unblock(playerId: string, subjectId: string): void {
    const index = this.blocks.findIndex((row) => row.playerId === playerId && row.subjectId === subjectId)
    if (index >= 0) this.blocks.splice(index, 1)
  }

  blocked(playerId: string, subjectId: string): boolean {
    return this.blocks.some((row) => row.playerId === playerId && row.subjectId === subjectId)
  }

  blockedEither(a: string, b: string): boolean {
    return this.blocked(a, b) || this.blocked(b, a)
  }

  mute(playerId: string, subjectId: string): void {
    if (playerId === subjectId) return
    if (!this.mutes.some((row) => row.playerId === playerId && row.subjectId === subjectId)) {
      this.mutes.push({ playerId, subjectId })
    }
  }

  muted(playerId: string, subjectId: string): boolean {
    return this.mutes.some((row) => row.playerId === playerId && row.subjectId === subjectId)
  }

  setPresence(playerId: string, status: 'offline' | 'menu' | 'queued' | 'show'): void {
    this.presence.set(playerId, status)
  }

  /** Online status is visible to approved friends only. */
  presenceFor(viewerId: string, subjectId: string): 'offline' | 'menu' | 'queued' | 'show' | null {
    if (viewerId !== subjectId && !this.areFriends(viewerId, subjectId)) return null
    return this.presence.get(subjectId) ?? 'offline'
  }

  pendingFor(playerId: string, nowMs = Date.now()): FriendRequest[] {
    return this.requests
      .filter((row) => !row.declined && row.expiresAt > nowMs && (row.fromPlayerId === playerId || row.toPlayerId === playerId))
      .filter((row) => !(row.fromApproved && row.toApproved))
      .map((row) => ({ ...row }))
  }

  erase(playerId: string): void {
    for (const [key, code] of this.codes) {
      if (code.playerId === playerId) this.codes.delete(key)
    }
    this.attempts.delete(playerId)
    for (let i = this.friends.length - 1; i >= 0; i--) {
      const row = this.friends[i]
      if (row && (row.a === playerId || row.b === playerId)) this.friends.splice(i, 1)
    }
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const row = this.blocks[i]
      if (row && (row.playerId === playerId || row.subjectId === playerId)) this.blocks.splice(i, 1)
    }
    for (let i = this.mutes.length - 1; i >= 0; i--) {
      const row = this.mutes[i]
      if (row && (row.playerId === playerId || row.subjectId === playerId)) this.mutes.splice(i, 1)
    }
    this.presence.delete(playerId)
  }

  snapshot(): SocialSnapshot {
    return {
      friends: this.friends.map((row) => ({ ...row })),
      blocks: this.blocks.map((row) => ({ ...row })),
      mutes: this.mutes.map((row) => ({ ...row })),
      requests: this.requests.map((row) => ({ ...row })),
    }
  }

  restore(snapshot: SocialSnapshot): void {
    this.friends.length = 0
    this.blocks.length = 0
    this.mutes.length = 0
    this.requests.length = 0
    this.friends.push(...snapshot.friends)
    this.blocks.push(...snapshot.blocks)
    this.mutes.push(...snapshot.mutes)
    this.requests.push(...snapshot.requests)
  }

  private addFriend(a: string, b: string, nowMs: number): void {
    if (this.areFriends(a, b)) return
    this.friends.push({ a, b, since: nowMs })
  }
}

function pair(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
