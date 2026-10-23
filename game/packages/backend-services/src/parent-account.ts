/**
 * The only module allowed to hold a parent contact or a child birth year.
 * Other services keep a pseudonymous player id. Contact data is sealed with a
 * key this process holds; show servers do not import this package.
 * Guests are not stored here (doc 09 I-01, counsel).
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { EventKind } from '@wobblebeans/shared'
import { POLICY } from './safety/durations'
import { SafetyError } from './safety/errors'
import { FriendGraph, type FriendNotice } from './safety/friends'
import { ModerationService } from './safety/moderation'
import { NOTICE } from './safety/notices'
import { ParentGate } from './safety/parent-gate'
import { PRIVACY_DEFAULTS } from './safety/privacy'
import { partitionRetention, type RetentionKind } from './safety/retention'
import { MockVpcVendor, type VpcVendor } from './safety/vpc'

export interface ParentAccount {
  id: string
  email: string
  country: string
  createdAt: string
  vpcMethod: 'pending' | 'card_check' | 'id_check'
  status: 'pending' | 'verified' | 'revoked'
}

export interface OpenedParentAccount extends ParentAccount {
  sessionToken: string
}

export interface ChildProfile {
  id: string
  parentId: string
  /** Year only. A full birth date is more than we need. */
  birthYear: number
  generatedNameId: number
  locale: string
  playerId: string
}

export interface ConsentPurposes {
  onlinePlay: boolean
  friends: boolean
  builderSharing: boolean
  weeklySummary: boolean
}

export interface ParentControls {
  parentId: string
  childId: string
  /** Break-reminder minutes from the foundation stub. Default 60. Not the daily cap. */
  dailyMinutes: number
  friendsEnabled: boolean
  quickChatEnabled: boolean
  coinShopEnabled: boolean
  onlinePlayEnabled: boolean
  breakReminderEnabled: boolean
  breakReminderMinutes: number
  dailyLimitEnabled: boolean
  dailyLimitMinutes: number
  builderEnabled: boolean
  builderSharingEnabled: boolean
  weeklySummaryEnabled: boolean
  realMoneyEnabled: false
  preciseLocationEnabled: false
  profilingEnabled: false
  appliesFrom: 'next_show'
}

export interface ControlPatch {
  onlinePlayEnabled?: boolean
  friendsEnabled?: boolean
  quickChatEnabled?: boolean
  coinShopEnabled?: boolean
  breakReminderEnabled?: boolean
  breakReminderMinutes?: number
  dailyLimitEnabled?: boolean
  dailyLimitMinutes?: number
  builderEnabled?: boolean
  builderSharingEnabled?: boolean
  weeklySummaryEnabled?: boolean
}

export type OnlineReason = 'ok' | 'pending_vpc' | 'purpose_off' | 'suspended' | 'banned' | 'daily_limit' | 'deleted'

export interface OnlineDecision {
  ok: boolean
  reason: OnlineReason
  practiceAllowed: boolean
}

export interface PlaytimeOutcome {
  deferred: boolean
  breakDue: boolean
  limitReached: boolean
  todayMinutes: number
  messageId: 'none' | 'break' | 'daily_limit'
}

export interface JobReport {
  droppedLogs: number
  exportsReady: number
  deletions: number
  purposeWithdrawals: number
  contactsForgotten: number
  reportsPruned: number
}

type PurposeName = keyof ConsentPurposes

interface ConsentRecord {
  id: string
  parentId: string
  childId: string | null
  purpose: PurposeName | 'vpc'
  method: 'card_check' | 'id_check'
  vendorRef: string
  noticeVersion: string
  grantedAt: string
  revokedAt: string | null
}

interface StoredParent {
  id: string
  sealedContact: string
  contactLookup: string
  country: string
  createdAt: string
  vpcMethod: ParentAccount['vpcMethod']
  status: ParentAccount['status']
  passwordHash: Buffer | null
  passwordSalt: Buffer | null
  noticeVersion: string | null
  retainContactUntil: number | null
  closedAt: number | null
}

interface PendingVpc {
  parentId: string
  method: 'card_check' | 'id_check'
  purposes: ConsentPurposes
  noticeVersion: string
  challengeId: string
  expiresAt: number
}

interface Session {
  parentId: string
  expiresAt: number
}

interface NoticeRow {
  id: string
  parentId: string
  childId: string | null
  playerId: string | null
  templateId: number
  params: Record<string, number | boolean>
  at: number
}

interface LogRow {
  id: string
  kind: RetentionKind
  playerId: string
  at: number
  numbers: Record<string, number>
  showId?: string
  holdUntil?: number
}

interface ExportTicket {
  id: string
  parentId: string
  childId: string
  requestedAt: number
  readyBy: number
  readyAt: number | null
  status: 'processing' | 'ready'
  payload: Record<string, unknown> | null
}

interface DeletionTicket {
  id: string
  parentId: string
  childId: string
  playerId: string
  requestedAt: number
  completeBy: number
  completedAt: number | null
  status: 'scheduled' | 'complete'
}

interface PurposeJob {
  id: string
  playerId: string
  purpose: PurposeName
  requestedAt: number
  completeBy: number
  completedAt: number | null
}

interface SignInBucket {
  fails: number
  lockedUntil: number
}

const CONTACT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NOTICE_VERSION = /^[A-Za-z0-9._-]{1,40}$/
const LOCALE = /^[a-z]{2}(-[A-Z]{2})?$/
const CONTROL_KEYS = new Set([
  'onlinePlayEnabled',
  'friendsEnabled',
  'quickChatEnabled',
  'coinShopEnabled',
  'breakReminderEnabled',
  'breakReminderMinutes',
  'dailyLimitEnabled',
  'dailyLimitMinutes',
  'builderEnabled',
  'builderSharingEnabled',
  'weeklySummaryEnabled',
])
const REGION_CODE: Record<'eu-w' | 'eu-c' | 'na-e' | 'na-w', number> = {
  'eu-w': 1,
  'eu-c': 2,
  'na-e': 3,
  'na-w': 4,
}

const EMPTY_PURPOSES: ConsentPurposes = {
  onlinePlay: false,
  friends: false,
  builderSharing: false,
  weeklySummary: false,
}

export class ParentAccountStore {
  readonly moderation: ModerationService
  private readonly parents = new Map<string, StoredParent>()
  private readonly children = new Map<string, ChildProfile>()
  private readonly controls = new Map<string, ParentControls>()
  private readonly consent: ConsentRecord[] = []
  private readonly sessions = new Map<string, Session>()
  private readonly notices: NoticeRow[] = []
  private readonly logs: LogRow[] = []
  private readonly exports: ExportTicket[] = []
  private readonly deletions: DeletionTicket[] = []
  private readonly purposeJobs: PurposeJob[] = []
  private readonly playDays = new Map<string, Map<string, number>>()
  private readonly breakAckDay = new Map<string, string>()
  private readonly progress = new Map<string, { trophies: number; seasonTier: number }>()
  private readonly liveShows = new Set<string>()
  private readonly onlineUntilShowEnd = new Set<string>()
  private readonly quickChatHold = new Map<string, number>()
  private readonly signInFails = new Map<string, SignInBucket>()
  private readonly pendingVpc = new Map<string, PendingVpc>()
  private readonly gate: ParentGate
  private readonly friends: FriendGraph
  private readonly clock: () => number
  private readonly random: () => number
  private readonly vendor: VpcVendor
  private readonly contactKey: Buffer
  private parentSeq = 0
  private childSeq = 0
  private seq = 0

  constructor(opts?: { vendor?: VpcVendor; now?: () => number; random?: () => number; contactKey?: Uint8Array }) {
    this.clock = opts?.now ?? (() => Date.now())
    this.random = opts?.random ?? Math.random
    this.vendor = opts?.vendor ?? new MockVpcVendor()
    this.contactKey = normalizeKey(opts?.contactKey)
    this.gate = new ParentGate(this.clock, this.random)
    this.moderation = new ModerationService({
      now: this.clock,
      sink: {
        notify: (playerId, templateId, params) => this.noticeForPlayer(playerId, templateId, params),
        onLegalHold: (showId, until) => this.holdShow(showId, until),
      },
    })
    this.friends = new FriendGraph(
      this.clock,
      this.random,
      (playerId) => this.friendAuthz(playerId),
      (a, b) => this.moderation.isBlocked(a, b),
    )
  }

  issueParentGate(deviceKey: string) {
    return this.gate.issue(deviceKey)
  }

  submitParentGate(deviceKey: string, challengeId: string, digits: string) {
    return this.gate.submit(deviceKey, challengeId, digits)
  }

  register(input: { email: string; country: string; password: string; gatePass: string }): OpenedParentAccount {
    if (!this.gate.consume(input.gatePass)) throw new SafetyError('gate_required')
    const email = normalizeContact(input.email)
    if (!/^[A-Z]{2}$/.test(input.country)) throw new SafetyError('invalid_country')
    assertPassword(input.password)
    const contactLookup = lookupContact(email, this.contactKey)
    if (this.parentsByLookup(contactLookup)) throw new SafetyError('already_registered')
    const salt = randomBytes(16)
    const parent: StoredParent = {
      id: `par_${++this.parentSeq}`,
      sealedContact: seal(email, this.contactKey),
      contactLookup,
      country: input.country,
      createdAt: new Date(this.clock()).toISOString(),
      vpcMethod: 'pending',
      status: 'pending',
      passwordHash: hashPassword(input.password, salt),
      passwordSalt: salt,
      noticeVersion: null,
      retainContactUntil: null,
      closedAt: null,
    }
    this.parents.set(parent.id, parent)
    return this.openSession(parent)
  }

  signIn(input: { email: string; password: string; gatePass: string }): OpenedParentAccount {
    if (!this.gate.consume(input.gatePass)) throw new SafetyError('gate_required')
    const email = normalizeContact(input.email)
    const contactLookup = lookupContact(email, this.contactKey)
    const bucket = this.signInBucket(contactLookup)
    if (bucket.lockedUntil > this.clock()) throw new SafetyError('sign_in_locked')
    const parent = this.parentsByLookup(contactLookup)
    const passwordOk =
      parent?.passwordHash &&
      parent.passwordSalt &&
      timingSafeEqual(hashPassword(input.password, parent.passwordSalt), parent.passwordHash)
    if (!parent || !passwordOk || parent.status === 'revoked') {
      bucket.fails += 1
      if (bucket.fails >= 5) bucket.lockedUntil = this.clock() + POLICY.parentGateLockMs
      throw new SafetyError('sign_in_rejected')
    }
    bucket.fails = 0
    return this.openSession(parent)
  }

  startConsent(
    parentId: string,
    input: { method: 'card_check' | 'id_check'; noticeVersion: string; purposes: ConsentPurposes; sessionToken: string },
  ) {
    const parent = this.requireSession(input.sessionToken)
    if (parent.id !== parentId) throw new SafetyError('not_owner')
    if (parent.status === 'verified') throw new SafetyError('already_verified')
    if (parent.status === 'revoked') throw new SafetyError('session_revoked')
    if (input.method !== 'card_check' && input.method !== 'id_check') throw new SafetyError('vpc_method')
    if (!NOTICE_VERSION.test(input.noticeVersion)) throw new SafetyError('bad_notice')
    const purposes = parsePurposes(input.purposes)
    const challenge = this.vendor.start({
      parentId: parent.id,
      method: input.method,
      noticeVersion: input.noticeVersion,
      country: parent.country,
    })
    const expiresAt = this.clock() + POLICY.vpcChallengeMs
    this.pendingVpc.set(challenge.challengeId, {
      parentId: parent.id,
      method: input.method,
      purposes,
      noticeVersion: input.noticeVersion,
      challengeId: challenge.challengeId,
      expiresAt,
    })
    return { challengeId: challenge.challengeId, method: input.method, expiresAt: new Date(expiresAt).toISOString() }
  }

  completeConsent(
    parentId: string,
    input: { challengeId: string; vendorToken: string; sessionToken: string; signature?: string },
  ): { verified: boolean; status: ParentAccount['status'] } {
    const parent = this.requireSession(input.sessionToken)
    if (parent.id !== parentId) throw new SafetyError('not_owner')
    const pending = this.pendingVpc.get(input.challengeId)
    if (!pending || pending.parentId !== parent.id) throw new SafetyError('unknown_challenge')
    if (pending.expiresAt < this.clock()) throw new SafetyError('challenge_expired')
    if (this.vendor.requiresSignature && !input.signature) throw new SafetyError('vendor_signature_required')
    const decision = this.vendor.complete({
      challengeId: input.challengeId,
      vendorToken: input.vendorToken,
      ...(input.signature ? { signature: input.signature } : {}),
    })
    this.pendingVpc.delete(input.challengeId)
    if (!decision.ok) return { verified: false, status: parent.status }
    parent.status = 'verified'
    parent.vpcMethod = decision.method
    parent.noticeVersion = pending.noticeVersion
    this.appendConsent(parent, null, 'vpc', decision.method, decision.vendorRef, pending.noticeVersion, false)
    for (const purpose of Object.keys(pending.purposes) as PurposeName[]) {
      if (pending.purposes[purpose]) {
        this.appendConsent(parent, null, purpose, decision.method, decision.vendorRef, pending.noticeVersion, false)
      }
    }
    return { verified: true, status: 'verified' }
  }

  addChild(parentId: string, birthYear: number, locale: string): ChildProfile {
    const parent = this.parents.get(parentId)
    if (!parent) throw new SafetyError('unknown_parent')
    if (parent.status !== 'verified') throw new SafetyError('parent_unverified')
    const owned = [...this.children.values()].filter((child) => child.parentId === parentId)
    if (owned.length >= POLICY.maxChildren) throw new SafetyError('too_many_children')
    this.assertBirthYear(birthYear)
    if (!LOCALE.test(locale)) throw new SafetyError('bad_locale')
    const child: ChildProfile = {
      id: `chi_${++this.childSeq}`,
      parentId,
      birthYear,
      generatedNameId: this.childSeq,
      locale,
      playerId: `ply_${this.childSeq}`,
    }
    this.children.set(child.id, child)
    this.controls.set(
      child.id,
      defaultControls(parentId, child.id, {
        onlinePlay: this.accountPurpose(parentId, 'onlinePlay'),
        friends: this.accountPurpose(parentId, 'friends'),
        builderSharing: this.accountPurpose(parentId, 'builderSharing'),
        weeklySummary: this.accountPurpose(parentId, 'weeklySummary'),
      }),
    )
    return { ...child }
  }

  getControls(childId: string): ParentControls | undefined {
    const row = this.controls.get(childId)
    return row ? this.controlView(row) : undefined
  }

  updateControls(parentId: string, childId: string, patch: ControlPatch, sessionToken: string): ParentControls {
    const parent = this.requireSession(sessionToken)
    if (parent.id !== parentId) throw new SafetyError('not_owner')
    const child = this.children.get(childId)
    if (!child || child.parentId !== parentId) throw new SafetyError('not_owner')
    for (const key of Object.keys(patch)) {
      if (!CONTROL_KEYS.has(key)) throw new SafetyError('control_rejected')
    }
    const row = this.controls.get(childId)
    if (!row) throw new SafetyError('unknown_child')
    if (patch.breakReminderMinutes != null) {
      assertRange(patch.breakReminderMinutes, POLICY.breakReminderMin, POLICY.breakReminderMax)
      row.breakReminderMinutes = patch.breakReminderMinutes
      row.dailyMinutes = patch.breakReminderMinutes
    }
    if (patch.dailyLimitMinutes != null) {
      assertRange(patch.dailyLimitMinutes, POLICY.dailyLimitMin, POLICY.dailyLimitMax)
      row.dailyLimitMinutes = patch.dailyLimitMinutes
    }
    this.assignBool(row, 'breakReminderEnabled', patch.breakReminderEnabled)
    this.assignBool(row, 'dailyLimitEnabled', patch.dailyLimitEnabled)
    this.assignBool(row, 'coinShopEnabled', patch.coinShopEnabled)
    this.assignBool(row, 'builderEnabled', patch.builderEnabled)
    if (patch.quickChatEnabled != null) {
      assertBool(patch.quickChatEnabled)
      row.quickChatEnabled = patch.quickChatEnabled
      if (patch.quickChatEnabled) this.quickChatHold.delete(child.playerId)
      else if (this.liveShows.has(child.playerId)) this.quickChatHold.set(child.playerId, this.clock() + POLICY.quickChatHoldMs)
      else this.quickChatHold.delete(child.playerId)
    }
    this.assignPurpose(parent, child, row, 'onlinePlayEnabled', 'onlinePlay', patch.onlinePlayEnabled)
    this.assignPurpose(parent, child, row, 'friendsEnabled', 'friends', patch.friendsEnabled)
    this.assignPurpose(parent, child, row, 'builderSharingEnabled', 'builderSharing', patch.builderSharingEnabled)
    this.assignPurpose(parent, child, row, 'weeklySummaryEnabled', 'weeklySummary', patch.weeklySummaryEnabled)
    return this.controlView(row)
  }

  canPlayOnline(childId: string, opts?: { showInProgress?: boolean }): OnlineDecision {
    const child = this.children.get(childId)
    if (!child) return { ok: false, reason: 'deleted', practiceAllowed: true }
    return this.decideOnline(child, opts?.showInProgress ?? this.liveShows.has(child.playerId))
  }

  onlineDecisionForPlayer(playerId: string, opts?: { showInProgress?: boolean }): OnlineDecision {
    const child = this.childByPlayer(playerId)
    if (!child) return { ok: false, reason: 'deleted', practiceAllowed: true }
    return this.decideOnline(child, opts?.showInProgress ?? this.liveShows.has(playerId))
  }

  /** Unknown player ids are guests: no parent switch, preset quick-chat stays available. */
  quickChatAllowedNow(playerId: string): boolean {
    const child = this.childByPlayer(playerId)
    if (!child) return true
    const row = this.controls.get(child.id)
    if (!row) return false
    if (row.quickChatEnabled) return true
    const hold = this.quickChatHold.get(playerId)
    return hold != null && this.clock() < hold
  }

  noteShowBoundary(playerId: string, phase: 'start' | 'end'): void {
    if (phase === 'start') {
      this.liveShows.add(playerId)
      return
    }
    this.liveShows.delete(playerId)
    this.onlineUntilShowEnd.delete(playerId)
    if (!this.quickChatAllowedNow(playerId) || this.quickChatHold.has(playerId)) {
      const child = this.childByPlayer(playerId)
      const row = child ? this.controls.get(child.id) : undefined
      if (row && !row.quickChatEnabled) this.quickChatHold.set(playerId, this.clock())
    }
  }

  recordShow(
    playerId: string,
    input: { minutes: number; showEnded: boolean; trophies?: number; seasonTier?: number },
  ): PlaytimeOutcome {
    const child = this.childByPlayer(playerId)
    if (!child) throw new SafetyError('unknown_player')
    if (!Number.isFinite(input.minutes) || input.minutes < 0 || input.minutes > POLICY.showMinutesMax) {
      throw new SafetyError('bad_minutes')
    }
    if (input.trophies != null) this.setProgress(playerId, 'trophies', input.trophies)
    if (input.seasonTier != null) this.setProgress(playerId, 'seasonTier', input.seasonTier)
    const today = this.dayKey()
    const soFar = this.playDays.get(playerId)?.get(today) ?? 0
    if (!input.showEnded) {
      return { deferred: true, breakDue: false, limitReached: false, todayMinutes: soFar, messageId: 'none' }
    }
    const days = this.playDays.get(playerId) ?? new Map<string, number>()
    days.set(today, soFar + input.minutes)
    this.playDays.set(playerId, days)
    const todayMinutes = days.get(today) ?? 0
    const row = this.controls.get(child.id)
    const acked = this.breakAckDay.get(playerId) === today
    const breakDue = !!row?.breakReminderEnabled && todayMinutes >= (row?.breakReminderMinutes ?? 60) && !acked
    const limitReached = !!row?.dailyLimitEnabled && todayMinutes >= (row?.dailyLimitMinutes ?? 60)
    const messageId = limitReached ? 'daily_limit' : breakDue ? 'break' : 'none'
    return { deferred: false, breakDue, limitReached, todayMinutes, messageId }
  }

  acknowledgeBreak(playerId: string): void {
    if (!this.childByPlayer(playerId)) throw new SafetyError('unknown_player')
    this.breakAckDay.set(playerId, this.dayKey())
  }

  issueFriendCode(playerId: string): { symbols: number[]; expiresAt: string } {
    return this.friends.issue(playerId)
  }

  redeemFriendCode(playerId: string, symbols: readonly number[]) {
    const result = this.friends.redeem(playerId, symbols)
    this.recordFriendNotices(result.notices)
    return { requestId: result.requestId, status: result.status }
  }

  approveFriend(parentId: string, requestId: string, knowThisChild: boolean, sessionToken: string) {
    this.requireOwnedSession(parentId, sessionToken)
    const result = this.friends.approve(parentId, requestId, knowThisChild)
    this.recordFriendNotices(result.notices)
    return { status: result.status }
  }

  declineFriend(parentId: string, requestId: string, sessionToken: string) {
    this.requireOwnedSession(parentId, sessionToken)
    return this.friends.decline(parentId, requestId)
  }

  removeFriend(parentId: string, playerId: string, otherPlayerId: string, sessionToken: string) {
    const parent = this.requireOwnedSession(parentId, sessionToken)
    const child = this.childByPlayer(playerId)
    if (!child || child.parentId !== parent.id) throw new SafetyError('not_owner')
    return this.friends.remove(playerId, otherPlayerId)
  }

  listFriends(playerId: string) {
    return this.friends.list(playerId)
  }

  canInvite(playerId: string, otherPlayerId: string): boolean {
    return this.friends.canInvite(playerId, otherPlayerId)
  }

  fileReport(input: {
    reporterPlayerId: string
    subjectPlayerId: string
    category: 'unfair' | 'mean' | 'scary' | 'bug'
    showId: string
    subjectKind?: 'player' | 'level' | 'bot'
    levelId?: string
    round?: number
  }) {
    const since = this.clock() - 60_000
    const involved = new Set([input.reporterPlayerId, input.subjectPlayerId])
    const phraseIds: number[] = []
    const emoteIds: number[] = []
    for (const log of this.logs) {
      if (log.at < since || !involved.has(log.playerId)) continue
      const code = log.numbers.code
      if (code == null) continue
      if (log.kind === 'quick_chat') phraseIds.push(code)
      if (log.kind === 'emote') emoteIds.push(code)
    }
    return this.moderation.file({ ...input, phraseIds, emoteIds })
  }

  notePresetEvent(playerId: string, kind: 'quick_chat' | 'emote', code: number): void {
    if (!Number.isInteger(code) || code < 0 || code > 255) throw new SafetyError('preset_ids_only')
    this.logs.push({
      id: `log_${++this.seq}`,
      kind,
      playerId,
      at: this.clock(),
      numbers: { code },
    })
  }

  noteTruncatedAddress(playerId: string, prefix: number): void {
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > POLICY.addressPrefixMax) throw new SafetyError('address_prefix_only')
    this.logs.push({
      id: `log_${++this.seq}`,
      kind: 'address_prefix',
      playerId,
      at: this.clock(),
      numbers: { prefix },
    })
  }

  noteRegionRtt(playerId: string, region: keyof typeof REGION_CODE, rttMs: number): void {
    if (!Number.isFinite(rttMs) || rttMs < 0 || rttMs > 10_000) throw new SafetyError('bad_rtt')
    this.logs.push({
      id: `log_${++this.seq}`,
      kind: 'qos',
      playerId,
      at: this.clock(),
      numbers: { region: REGION_CODE[region], rttMs: Math.round(rttMs) },
    })
  }

  noteReplay(showId: string, ref: number): void {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(showId) || !Number.isInteger(ref)) throw new SafetyError('bad_id')
    this.logs.push({
      id: `log_${++this.seq}`,
      kind: 'replay',
      playerId: '',
      at: this.clock(),
      numbers: { ref },
      showId,
    })
  }

  requestExport(parentId: string, childId: string, sessionToken: string) {
    const parent = this.requireOwnedSession(parentId, sessionToken)
    const child = this.children.get(childId)
    if (!child || child.parentId !== parent.id) throw new SafetyError('not_owner')
    const requestedAt = this.clock()
    const ticket: ExportTicket = {
      id: `exp_${++this.seq}`,
      parentId,
      childId,
      requestedAt,
      readyBy: requestedAt + POLICY.exportMs,
      readyAt: null,
      status: 'processing',
      payload: null,
    }
    this.exports.push(ticket)
    return { id: ticket.id, status: ticket.status, readyBy: new Date(ticket.readyBy).toISOString() }
  }

  requestDeletion(parentId: string, childId: string, sessionToken: string) {
    const parent = this.requireOwnedSession(parentId, sessionToken)
    const child = this.children.get(childId)
    if (!child || child.parentId !== parent.id) throw new SafetyError('not_owner')
    const requestedAt = this.clock()
    const ticket: DeletionTicket = {
      id: `del_${++this.seq}`,
      parentId,
      childId,
      playerId: child.playerId,
      requestedAt,
      completeBy: requestedAt + POLICY.deletionMs,
      completedAt: null,
      status: 'scheduled',
      }
    this.deletions.push(ticket)
    this.recordNotice(parent.id, child.id, child.playerId, NOTICE.deletionScheduled, { scheduled: 1 })
    return {
      id: ticket.id,
      status: ticket.status,
      completeBy: new Date(ticket.completeBy).toISOString(),
    }
  }

  requestAccountClosure(parentId: string, sessionToken: string) {
    const parent = this.requireOwnedSession(parentId, sessionToken)
    parent.status = 'revoked'
    parent.closedAt = this.clock()
    parent.retainContactUntil = this.clock() + POLICY.consentAfterClosureMs
    for (const session of this.sessions.values()) {
      if (session.parentId === parent.id) session.expiresAt = 0
    }
    for (const child of this.children.values()) {
      if (child.parentId !== parent.id) continue
      this.deletions.push({
        id: `del_${++this.seq}`,
        parentId: parent.id,
        childId: child.id,
        playerId: child.playerId,
        requestedAt: this.clock(),
        completeBy: this.clock() + POLICY.deletionMs,
        completedAt: null,
        status: 'scheduled',
      })
    }
    return { status: 'revoked' as const, retainContactUntil: new Date(parent.retainContactUntil).toISOString() }
  }

  dashboard(parentId: string, childId: string, sessionToken: string) {
    const parent = this.requireOwnedSession(parentId, sessionToken)
    const child = this.children.get(childId)
    if (!child || child.parentId !== parent.id) throw new SafetyError('not_owner')
    const now = this.clock()
    const controls = this.getControls(child.id)
    const days = [...(this.playDays.get(child.playerId)?.entries() ?? [])]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-POLICY.activityDays)
      .map(([day, minutes]) => ({ day, minutes }))
    const friends = this.friends.list(child.playerId)
    const progress = this.progress.get(child.playerId) ?? { trophies: 0, seasonTier: 0 }
    return {
      asOf: new Date(now).toISOString(),
      dataAgeMs: 0,
      appliesFrom: 'next_show' as const,
      child: {
        id: child.id,
        playerId: child.playerId,
        birthYear: child.birthYear,
        generatedNameId: child.generatedNameId,
        locale: child.locale,
      },
      controls,
      consent: this.consent
        .filter((row) => row.parentId === parent.id && (row.childId == null || row.childId === child.id))
        .map((row) => ({
          purpose: row.purpose,
          method: row.method,
          noticeVersion: row.noticeVersion,
          grantedAt: row.grantedAt,
          revokedAt: row.revokedAt,
        })),
      activity: { days, trophies: progress.trophies, seasonTier: progress.seasonTier },
      friends: {
        pending: friends.filter((row) => row.status === 'pending'),
        active: friends.filter((row) => row.status === 'active'),
      },
      safety: {
        reportsMade: this.moderation.reportsBy(child.playerId).map((row) => ({
          id: row.id,
          category: row.category,
          showId: row.showId,
          createdAt: row.createdAt ?? null,
        })),
        blocks: this.moderation.blocksBy(child.playerId),
        mutes: this.moderation.mutesBy(child.playerId),
        notices: this.notices
          .filter((row) => row.playerId === child.playerId)
          .map((row) => ({ templateId: row.templateId, at: new Date(row.at).toISOString(), params: row.params })),
        sanctions: this.moderation.sanctionsFor(child.playerId),
      },
      purchases: { realMoneyEnabled: false as const, history: [] as [] },
      data: {
        exports: this.exports
          .filter((row) => row.childId === child.id)
          .map((row) => ({ id: row.id, status: row.status, readyBy: new Date(row.readyBy).toISOString() })),
        deletions: this.deletions
          .filter((row) => row.childId === child.id)
          .map((row) => ({ id: row.id, status: row.status, completeBy: new Date(row.completeBy).toISOString() })),
      },
    }
  }

  readExport(parentId: string, exportId: string, sessionToken: string) {
    this.requireOwnedSession(parentId, sessionToken)
    const ticket = this.exports.find((row) => row.id === exportId && row.parentId === parentId)
    if (!ticket || ticket.status !== 'ready' || !ticket.payload) throw new SafetyError('export_not_ready')
    return ticket.payload
  }

  /** Ciphertext of the stored contact. Callers cannot treat a pending parent as verified. */
  contactCiphertext(parentId: string): string {
    const parent = this.parents.get(parentId)
    if (!parent || parent.sealedContact.length === 0) throw new SafetyError('unknown_parent')
    return parent.sealedContact
  }

  account(sessionToken: string): ParentAccount {
    return this.view(this.requireSession(sessionToken))
  }

  retainedCount(kind: RetentionKind): number {
    return this.logs.filter((row) => row.kind === kind).length
  }

  /** Consent rows stay after profile deletion. Show servers never see them. */
  consentRecordCount(parentId: string): number {
    return this.consent.filter((row) => row.parentId === parentId).length
  }

  pseudonym(childId: string): { playerId: string } | undefined {
    const child = this.children.get(childId)
    return child ? { playerId: child.playerId } : undefined
  }

  runRetention(): JobReport {
    const now = this.clock()
    let exportsReady = 0
    for (const ticket of this.exports) {
      if (ticket.status !== 'processing') continue
      ticket.payload = this.exportPayload(ticket.childId)
      ticket.status = 'ready'
      ticket.readyAt = now
      exportsReady += 1
      this.recordNotice(ticket.parentId, ticket.childId, null, NOTICE.exportReady, { ready: 1 })
    }
    let purposeWithdrawals = 0
    for (const job of this.purposeJobs) {
      if (job.completedAt != null) continue
      if (job.purpose === 'friends') this.friends.forgetPlayer(job.playerId)
      job.completedAt = now
      purposeWithdrawals += 1
    }
    let deletions = 0
    for (const ticket of this.deletions) {
      if (ticket.status !== 'scheduled') continue
      this.deleteChild(ticket.childId, ticket.playerId)
      ticket.status = 'complete'
      ticket.completedAt = now
      deletions += 1
    }
    const partitioned = partitionRetention(
      this.logs.map((row) => ({
        id: row.id,
        kind: row.kind,
        at: row.at,
        ...(row.holdUntil != null ? { holdUntil: row.holdUntil } : {}),
      })),
      now,
    )
    const drop = new Set(partitioned.dropIds)
    const kept = this.logs.filter((row) => !drop.has(row.id))
    const droppedLogs = this.logs.length - kept.length
    this.logs.length = 0
    this.logs.push(...kept)
    let contactsForgotten = 0
    for (const parent of this.parents.values()) {
      if (parent.retainContactUntil != null && parent.retainContactUntil <= now && parent.sealedContact.length > 0) {
        parent.sealedContact = ''
        parent.contactLookup = ''
        parent.passwordHash = null
        parent.passwordSalt = null
        contactsForgotten += 1
      }
    }
    const reportsPruned = this.moderation.prune(now)
    return { droppedLogs, exportsReady, deletions, purposeWithdrawals, contactsForgotten, reportsPruned }
  }

  private decideOnline(child: ChildProfile, showInProgress: boolean): OnlineDecision {
    const parent = this.parents.get(child.parentId)
    if (!parent || parent.status === 'revoked') return { ok: false, reason: 'deleted', practiceAllowed: true }
    if (parent.status !== 'verified') return { ok: false, reason: 'pending_vpc', practiceAllowed: true }
    const block = this.moderation.onlineBlock(child.playerId, this.clock())
    if (block.blocked) {
      return { ok: false, reason: block.reason === 'banned' ? 'banned' : 'suspended', practiceAllowed: true }
    }
    const row = this.controls.get(child.id)
    const purpose = row?.onlinePlayEnabled && this.purposeOpen(child, 'onlinePlay')
    if (!purpose) {
      if (showInProgress && this.onlineUntilShowEnd.has(child.playerId)) {
        return { ok: true, reason: 'ok', practiceAllowed: true }
      }
      return { ok: false, reason: 'purpose_off', practiceAllowed: true }
    }
    if (!showInProgress && row?.dailyLimitEnabled) {
      const today = this.playDays.get(child.playerId)?.get(this.dayKey()) ?? 0
      if (today >= row.dailyLimitMinutes) return { ok: false, reason: 'daily_limit', practiceAllowed: true }
    }
    return { ok: true, reason: 'ok', practiceAllowed: true }
  }

  private assignPurpose(
    parent: StoredParent,
    child: ChildProfile,
    row: ParentControls,
    field: 'onlinePlayEnabled' | 'friendsEnabled' | 'builderSharingEnabled' | 'weeklySummaryEnabled',
    purpose: PurposeName,
    value: boolean | undefined,
  ): void {
    if (value == null) return
    assertBool(value)
    row[field] = value
    if (!parent.noticeVersion) throw new SafetyError('bad_notice')
    if (value) {
      this.appendConsent(parent, child.id, purpose, parent.vpcMethod === 'pending' ? 'card_check' : parent.vpcMethod, 'parent_toggle', parent.noticeVersion, false)
      if (purpose === 'onlinePlay') this.onlineUntilShowEnd.delete(child.playerId)
      return
    }
    this.appendConsent(parent, child.id, purpose, parent.vpcMethod === 'pending' ? 'card_check' : parent.vpcMethod, 'parent_toggle', parent.noticeVersion, true)
    this.purposeJobs.push({
      id: `job_${++this.seq}`,
      playerId: child.playerId,
      purpose,
      requestedAt: this.clock(),
      completeBy: this.clock() + POLICY.withdrawalMs,
      completedAt: null,
    })
    this.recordNotice(parent.id, child.id, child.playerId, NOTICE.consentWithdrawn, { [purpose]: false })
    if (purpose === 'onlinePlay' && this.liveShows.has(child.playerId)) this.onlineUntilShowEnd.add(child.playerId)
  }

  private appendConsent(
    parent: StoredParent,
    childId: string | null,
    purpose: ConsentRecord['purpose'],
    method: 'card_check' | 'id_check',
    vendorRef: string,
    noticeVersion: string,
    revoked: boolean,
  ): void {
    const at = new Date(this.clock()).toISOString()
    this.consent.push({
      id: `cns_${++this.seq}`,
      parentId: parent.id,
      childId,
      purpose,
      method,
      vendorRef,
      noticeVersion,
      grantedAt: at,
      revokedAt: revoked ? at : null,
    })
  }

  private accountPurpose(parentId: string, purpose: PurposeName): boolean {
    const rows = this.consent.filter((row) => row.parentId === parentId && row.childId == null && row.purpose === purpose)
    const latest = rows[rows.length - 1]
    return !!latest && latest.revokedAt == null
  }

  private purposeOpen(child: ChildProfile, purpose: PurposeName): boolean {
    const childRows = this.consent.filter((row) => row.childId === child.id && row.purpose === purpose)
    const latestChild = childRows[childRows.length - 1]
    if (latestChild) return latestChild.revokedAt == null
    return this.accountPurpose(child.parentId, purpose)
  }

  private friendAuthz(playerId: string) {
    const child = this.childByPlayer(playerId)
    if (!child) return { ok: false as const, reason: 'friends_off' }
    const row = this.controls.get(child.id)
    if (!row?.friendsEnabled || !this.purposeOpen(child, 'friends')) return { ok: false as const, reason: 'friends_off' }
    return { ok: true as const, parentId: child.parentId, generatedNameId: child.generatedNameId }
  }

  private exportPayload(childId: string): Record<string, unknown> {
    const child = this.children.get(childId)
    if (!child) return { deleted: true }
    const dashboard = {
      child: {
        id: child.id,
        playerId: child.playerId,
        birthYear: child.birthYear,
        generatedNameId: child.generatedNameId,
        locale: child.locale,
      },
      controls: this.getControls(child.id),
      consent: this.consent
        .filter((row) => row.parentId === child.parentId && (row.childId == null || row.childId === child.id))
        .map((row) => ({
          purpose: row.purpose,
          method: row.method,
          noticeVersion: row.noticeVersion,
          vendorRef: row.vendorRef,
          grantedAt: row.grantedAt,
          revokedAt: row.revokedAt,
        })),
      friends: this.friends.list(child.playerId),
      blocks: this.moderation.blocksBy(child.playerId),
      reports: this.moderation.reportsBy(child.playerId).map((row) => ({
        id: row.id,
        category: row.category,
        showId: row.showId,
      })),
      play: [...(this.playDays.get(child.playerId)?.entries() ?? [])].map(([day, minutes]) => ({ day, minutes })),
      purchases: [] as [],
    }
    return JSON.parse(JSON.stringify(dashboard)) as Record<string, unknown>
  }

  private deleteChild(childId: string, playerId: string): void {
    const held = this.moderation.openIncidents().some((row) => row.playerId === playerId && row.legalHoldUntil > this.clock())
    this.moderation.forgetPlayer(playerId, held)
    this.friends.forgetPlayer(playerId)
    this.children.delete(childId)
    this.controls.delete(childId)
    this.playDays.delete(playerId)
    this.progress.delete(playerId)
    this.liveShows.delete(playerId)
    this.quickChatHold.delete(playerId)
    this.onlineUntilShowEnd.delete(playerId)
    const kept = this.logs.filter((row) => {
      if (row.playerId !== playerId) return true
      return row.holdUntil != null && row.holdUntil > this.clock()
    })
    this.logs.length = 0
    this.logs.push(...kept)
  }

  private holdShow(showId: string, until: number): void {
    for (const log of this.logs) {
      if (log.showId === showId) log.holdUntil = until
    }
  }

  private noticeForPlayer(playerId: string, templateId: number, params: Record<string, number | boolean>): void {
    const child = this.childByPlayer(playerId)
    if (!child) return
    this.recordNotice(child.parentId, child.id, playerId, templateId, params)
  }

  private recordFriendNotices(notices: FriendNotice[]): void {
    for (const notice of notices) {
      this.recordNotice(notice.parentId, null, null, notice.templateId, notice.params)
    }
  }

  private recordNotice(
    parentId: string,
    childId: string | null,
    playerId: string | null,
    templateId: number,
    params: Record<string, number | boolean>,
  ): void {
    this.notices.push({
      id: `ntc_${++this.seq}`,
      parentId,
      childId,
      playerId,
      templateId,
      params,
      at: this.clock(),
    })
  }

  private setProgress(playerId: string, field: 'trophies' | 'seasonTier', value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 10_000) throw new SafetyError('bad_progress')
    const row = this.progress.get(playerId) ?? { trophies: 0, seasonTier: 0 }
    row[field] = value
    this.progress.set(playerId, row)
  }

  private assertBirthYear(year: number): void {
    if (!Number.isInteger(year)) throw new SafetyError('year_only')
    const age = new Date(this.clock()).getUTCFullYear() - year
    if (age < POLICY.minChildAge || age > POLICY.maxChildAge) throw new SafetyError('year_only')
  }

  private controlView(row: ParentControls): ParentControls {
    return {
      ...row,
      realMoneyEnabled: false,
      preciseLocationEnabled: false,
      profilingEnabled: false,
      appliesFrom: 'next_show',
    }
  }

  private assignBool(row: ParentControls, field: 'breakReminderEnabled' | 'dailyLimitEnabled' | 'coinShopEnabled' | 'builderEnabled', value: boolean | undefined): void {
    if (value == null) return
    assertBool(value)
    row[field] = value
  }

  private dayKey(): string {
    return new Date(this.clock()).toISOString().slice(0, 10)
  }

  private childByPlayer(playerId: string): ChildProfile | undefined {
    return [...this.children.values()].find((child) => child.playerId === playerId)
  }

  private parentsByLookup(contactLookup: string): StoredParent | undefined {
    return [...this.parents.values()].find((parent) => parent.contactLookup === contactLookup)
  }

  private signInBucket(contactLookup: string): SignInBucket {
    let bucket = this.signInFails.get(contactLookup)
    if (!bucket) {
      bucket = { fails: 0, lockedUntil: 0 }
      this.signInFails.set(contactLookup, bucket)
    }
    return bucket
  }

  private openSession(parent: StoredParent): OpenedParentAccount {
    const sessionToken = randomBytes(32).toString('base64url')
    this.sessions.set(sessionToken, { parentId: parent.id, expiresAt: this.clock() + POLICY.sessionMs })
    return { ...this.view(parent), sessionToken }
  }

  private requireSession(sessionToken: string): StoredParent {
    const session = this.sessions.get(sessionToken)
    if (!session) throw new SafetyError('session_required')
    if (session.expiresAt < this.clock()) throw new SafetyError('session_expired')
    const parent = this.parents.get(session.parentId)
    if (!parent || parent.status === 'revoked') throw new SafetyError('session_revoked')
    return parent
  }

  private requireOwnedSession(parentId: string, sessionToken: string): StoredParent {
    const parent = this.requireSession(sessionToken)
    if (parent.id !== parentId) throw new SafetyError('not_owner')
    return parent
  }

  private view(parent: StoredParent): ParentAccount {
    return {
      id: parent.id,
      email: parent.sealedContact.length === 0 ? '' : openSeal(parent.sealedContact, this.contactKey),
      country: parent.country,
      createdAt: parent.createdAt,
      vpcMethod: parent.vpcMethod,
      status: parent.status,
    }
  }
}

export function quickChatDropped(allowed: boolean, kind: number): boolean {
  return kind === EventKind.QuickChat && !allowed
}

function defaultControls(parentId: string, childId: string, purposes: ConsentPurposes): ParentControls {
  return {
    parentId,
    childId,
    dailyMinutes: PRIVACY_DEFAULTS.dailyMinutes,
    friendsEnabled: purposes.friends,
    quickChatEnabled: PRIVACY_DEFAULTS.quickChatEnabled,
    coinShopEnabled: PRIVACY_DEFAULTS.coinShopEnabled,
    onlinePlayEnabled: purposes.onlinePlay,
    breakReminderEnabled: PRIVACY_DEFAULTS.breakReminderEnabled,
    breakReminderMinutes: PRIVACY_DEFAULTS.breakReminderMinutes,
    dailyLimitEnabled: PRIVACY_DEFAULTS.dailyLimitEnabled,
    dailyLimitMinutes: PRIVACY_DEFAULTS.dailyLimitMinutes,
    builderEnabled: PRIVACY_DEFAULTS.builderEnabled,
    builderSharingEnabled: purposes.builderSharing,
    weeklySummaryEnabled: purposes.weeklySummary,
    realMoneyEnabled: false,
    preciseLocationEnabled: false,
    profilingEnabled: false,
    appliesFrom: 'next_show',
  }
}

function parsePurposes(input: ConsentPurposes): ConsentPurposes {
  const keys = Object.keys(input).sort()
  const expected = Object.keys(EMPTY_PURPOSES).sort()
  if (keys.join() !== expected.join()) throw new SafetyError('bad_purposes')
  for (const key of expected) assertBool(input[key as PurposeName])
  return { ...input }
}

function assertBool(value: boolean): void {
  if (typeof value !== 'boolean') throw new SafetyError('bad_control')
}

function assertRange(value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) throw new SafetyError('bad_control')
}

function assertPassword(password: string): void {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128 || /[\r\n]/.test(password)) {
    throw new SafetyError('bad_secret')
  }
}

function normalizeContact(value: string): string {
  const trimmed = value.trim().toLowerCase()
  if (!CONTACT.test(trimmed) || trimmed.length > 254) throw new SafetyError('invalid_contact')
  return trimmed
}

function lookupContact(value: string, key: Buffer): string {
  return createHash('sha256').update(key).update(value).digest('base64url')
}

function hashPassword(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 })
}

function normalizeKey(key: Uint8Array | undefined): Buffer {
  if (!key) return randomBytes(32)
  if (key.byteLength !== 32) throw new SafetyError('bad_contact_key')
  return Buffer.from(key)
}

function seal(plain: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, data]).toString('base64')
}

function openSeal(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export { PRIVACY_DEFAULTS }
