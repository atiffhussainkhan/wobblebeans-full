import { describe, expect, it } from 'vitest'
import { EventKind, SAFETY } from '@wobblebeans/shared'
import { PRIVACY_DEFAULTS, ParentAccountStore, quickChatDropped, type ConsentPurposes } from './parent-account'
import { MS, POLICY } from './safety/durations'
import { answerFromPrompt } from './safety/parent-gate'
import { MockVpcVendor, SignedMockVpcVendor } from './safety/vpc'

const PASSWORD = 'long-password-1'

function harness(chosen?: Partial<ConsentPurposes>) {
  let now = Date.parse('2026-10-23T12:00:00.000Z')
  const vendor = new MockVpcVendor()
  const store = new ParentAccountStore({ vendor, now: () => now })
  const purposes: ConsentPurposes = {
    onlinePlay: false,
    friends: false,
    builderSharing: false,
    weeklySummary: false,
    ...chosen,
  }

  function adult(device: string, contact: string) {
    const gate = store.issueParentGate(device)
    if (!gate.ok) throw new Error('locked')
    const answered = store.submitParentGate(device, gate.challengeId, answerFromPrompt(gate.promptWords))
    if (!answered.ok) throw new Error('gate')
    const parent = store.register({
      email: contact,
      country: 'GB',
      password: PASSWORD,
      gatePass: answered.gatePass,
    })
    const started = store.startConsent(parent.id, {
      method: 'card_check',
      noticeVersion: 'notice-1',
      purposes,
      sessionToken: parent.sessionToken,
    })
    const done = store.completeConsent(parent.id, {
      challengeId: started.challengeId,
      vendorToken: vendor.passingToken(started.challengeId),
      sessionToken: parent.sessionToken,
    })
    if (!done.verified) throw new Error('vpc')
    return parent
  }

  function resign(device: string, contact: string) {
    const gate = store.issueParentGate(device)
    if (!gate.ok) throw new Error('locked')
    const answered = store.submitParentGate(device, gate.challengeId, answerFromPrompt(gate.promptWords))
    if (!answered.ok) throw new Error('gate')
    return store.signIn({ email: contact, password: PASSWORD, gatePass: answered.gatePass })
  }

  return { store, vendor, adult, resign, advance: (ms: number) => { now += ms } }
}

describe('parent account and consent', () => {
  it('keeps pending distinct from verified and seals the contact', () => {
    const now = Date.parse('2026-10-23T12:00:00.000Z')
    const vendor = new MockVpcVendor()
    const store = new ParentAccountStore({ vendor, now: () => now })
    const gate = store.issueParentGate('device')
    if (!gate.ok) throw new Error('locked')
    const answered = store.submitParentGate('device', gate.challengeId, answerFromPrompt(gate.promptWords))
    if (!answered.ok) throw new Error('gate')
    const parent = store.register({
      email: 'parent@example.com',
      country: 'GB',
      password: PASSWORD,
      gatePass: answered.gatePass,
    })
    expect(parent.status).toBe('pending')
    expect(() => store.addChild(parent.id, 2018, 'en-GB')).toThrow(/parent_unverified/)
    expect(store.contactCiphertext(parent.id)).not.toContain('@')
    const started = store.startConsent(parent.id, {
      method: 'id_check',
      noticeVersion: 'notice-1',
      purposes: { onlinePlay: false, friends: false, builderSharing: false, weeklySummary: false },
      sessionToken: parent.sessionToken,
    })
    expect(JSON.stringify(vendor.started)).not.toContain('@')
    const refused = store.completeConsent(parent.id, {
      challengeId: started.challengeId,
      vendorToken: '4242424242424242',
      sessionToken: parent.sessionToken,
    })
    expect(refused.verified).toBe(false)
    expect(store.account(parent.sessionToken).status).toBe('pending')
    const again = store.startConsent(parent.id, {
      method: 'id_check',
      noticeVersion: 'notice-1',
      purposes: { onlinePlay: true, friends: false, builderSharing: false, weeklySummary: false },
      sessionToken: parent.sessionToken,
    })
    const verified = store.completeConsent(parent.id, {
      challengeId: again.challengeId,
      vendorToken: vendor.passingToken(again.challengeId),
      sessionToken: parent.sessionToken,
    })
    expect(verified.status).toBe('verified')
    expect(store.account(parent.sessionToken).vpcMethod).toBe('id_check')
    const child = store.addChild(parent.id, 2018, 'en-GB')
    expect(store.canPlayOnline(child.id)).toEqual({ ok: true, reason: 'ok', practiceAllowed: true })
  })

  it('rejects an adult year, a fifth child, and a signature-less vendor when one is required', () => {
    const { store, adult } = harness()
    const parent = adult('device', 'parent@example.com')
    expect(() => store.addChild(parent.id, 1990, 'en-GB')).toThrow(/year_only/)
    expect(() => store.addChild(parent.id, 2018.5, 'en-GB')).toThrow(/year_only/)
    for (const year of [2014, 2015, 2016, 2017]) store.addChild(parent.id, year, 'en-GB')
    expect(() => store.addChild(parent.id, 2018, 'en-GB')).toThrow(/too_many_children/)

    const now = Date.parse('2026-10-23T12:00:00.000Z')
    const vendor = new SignedMockVpcVendor()
    const signed = new ParentAccountStore({ vendor, now: () => now })
    const gate = signed.issueParentGate('signed')
    if (!gate.ok) throw new Error('locked')
    const answered = signed.submitParentGate('signed', gate.challengeId, answerFromPrompt(gate.promptWords))
    if (!answered.ok) throw new Error('gate')
    const parent2 = signed.register({
      email: 'signed@example.com',
      country: 'GB',
      password: PASSWORD,
      gatePass: answered.gatePass,
    })
    const started = signed.startConsent(parent2.id, {
      method: 'card_check',
      noticeVersion: 'notice-1',
      purposes: { onlinePlay: false, friends: false, builderSharing: false, weeklySummary: false },
      sessionToken: parent2.sessionToken,
    })
    expect(() =>
      signed.completeConsent(parent2.id, {
        challengeId: started.challengeId,
        vendorToken: vendor.passingToken(started.challengeId),
        sessionToken: parent2.sessionToken,
      }),
    ).toThrow(/vendor_signature_required/)
    expect(
      signed.completeConsent(parent2.id, {
        challengeId: started.challengeId,
        vendorToken: vendor.passingToken(started.challengeId),
        signature: `sig.${started.challengeId}`,
        sessionToken: parent2.sessionToken,
      }).verified,
    ).toBe(true)
  })

  it('starts from privacy defaults and only a parent session can loosen them', () => {
    const { store, adult } = harness()
    const parent = adult('device', 'parent@example.com')
    const child = store.addChild(parent.id, 2018, 'en-GB')
    const controls = store.getControls(child.id)!
    expect(controls.friendsEnabled).toBe(false)
    expect(controls.coinShopEnabled).toBe(false)
    expect(controls.quickChatEnabled).toBe(true)
    expect(controls.onlinePlayEnabled).toBe(false)
    expect(controls.dailyMinutes).toBe(60)
    expect(controls.breakReminderMinutes).toBe(60)
    expect(controls.dailyLimitEnabled).toBe(false)
    expect(controls.realMoneyEnabled).toBe(false)
    expect(controls.preciseLocationEnabled).toBe(false)
    expect(controls.profilingEnabled).toBe(false)
    expect(JSON.stringify(controls)).not.toContain('example.com')
    expect(PRIVACY_DEFAULTS.openChat).toBe(SAFETY.openChat)
    expect(PRIVACY_DEFAULTS.voiceChat).toBe(false)
    expect(PRIVACY_DEFAULTS.lootBoxes).toBe(false)
    expect(store.canPlayOnline(child.id).reason).toBe('purpose_off')
    expect(() => store.updateControls(parent.id, child.id, { coinShopEnabled: true }, 'nope')).toThrow(/session_required/)
    expect(() =>
      store.updateControls(parent.id, child.id, { realMoneyEnabled: true } as never, parent.sessionToken),
    ).toThrow(/control_rejected/)
    const next = store.updateControls(parent.id, child.id, { coinShopEnabled: true, onlinePlayEnabled: true }, parent.sessionToken)
    expect(next.coinShopEnabled).toBe(true)
    expect(next.realMoneyEnabled).toBe(false)
    expect(next.appliesFrom).toBe('next_show')
    expect(store.canPlayOnline(child.id).ok).toBe(true)
    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(store))
    expect(names.some((name) => /search|findByName|lookupName/i.test(name))).toBe(false)
  })

  it('applies play limits only at show end and quick-chat off within five minutes', () => {
    const { store, adult, advance } = harness({ onlinePlay: true })
    const parent = adult('device', 'parent@example.com')
    const child = store.addChild(parent.id, 2018, 'en-GB')
    store.noteShowBoundary(child.playerId, 'start')
    expect(store.recordShow(child.playerId, { minutes: 90, showEnded: false })).toMatchObject({
      deferred: true,
      breakDue: false,
      limitReached: false,
      messageId: 'none',
    })
    expect(store.canPlayOnline(child.id).ok).toBe(true)
    store.noteShowBoundary(child.playerId, 'end')
    expect(store.recordShow(child.playerId, { minutes: 70, showEnded: true })).toMatchObject({
      breakDue: true,
      limitReached: false,
      messageId: 'break',
    })
    store.acknowledgeBreak(child.playerId)
    store.updateControls(parent.id, child.id, { dailyLimitEnabled: true, dailyLimitMinutes: 60 }, parent.sessionToken)
    expect(store.canPlayOnline(child.id).reason).toBe('daily_limit')
    store.noteShowBoundary(child.playerId, 'start')
    expect(store.canPlayOnline(child.id).reason).toBe('ok')
    store.updateControls(parent.id, child.id, { quickChatEnabled: false }, parent.sessionToken)
    expect(store.quickChatAllowedNow(child.playerId)).toBe(true)
    expect(quickChatDropped(store.quickChatAllowedNow(child.playerId), EventKind.QuickChat)).toBe(false)
    advance(POLICY.quickChatHoldMs)
    expect(store.quickChatAllowedNow(child.playerId)).toBe(false)
    expect(quickChatDropped(false, EventKind.QuickChat)).toBe(true)
    expect(quickChatDropped(false, EventKind.Emote)).toBe(false)
    store.noteShowBoundary(child.playerId, 'end')
    expect(store.recordShow(child.playerId, { minutes: 10, showEnded: false }).limitReached).toBe(false)
  })

  it('opens friendships only through parent-approved picture codes', () => {
    const { store, adult, advance, resign } = harness({ friends: true })
    const a = adult('device-a', 'ada@example.com')
    const b = adult('device-b', 'bee@example.com')
    const childA = store.addChild(a.id, 2017, 'en-GB')
    const childB = store.addChild(b.id, 2018, 'en-GB')
    expect(() => store.redeemFriendCode(childB.playerId, '123456' as unknown as number[])).toThrow(/picture_code_only/)
    const first = store.issueFriendCode(childA.playerId)
    const second = store.issueFriendCode(childA.playerId)
    expect(() => store.redeemFriendCode(childB.playerId, first.symbols)).toThrow(/code_rejected/)
    const pending = store.redeemFriendCode(childB.playerId, second.symbols)
    expect(store.listFriends(childA.playerId)[0]?.status).toBe('pending')
    expect(store.listFriends(childA.playerId)[0]?.promptId).toBe('know_this_child')
    expect(store.listFriends(childA.playerId)[0]?.addedBy).toBe('friend_code')
    expect(store.approveFriend(a.id, pending.requestId, true, a.sessionToken).status).toBe('pending')
    expect(store.approveFriend(b.id, pending.requestId, false, b.sessionToken).status).toBe('declined')

    const code = store.issueFriendCode(childA.playerId)
    const request = store.redeemFriendCode(childB.playerId, code.symbols)
    expect(store.approveFriend(a.id, request.requestId, true, a.sessionToken).status).toBe('pending')
    expect(store.approveFriend(b.id, request.requestId, true, b.sessionToken).status).toBe('active')
    expect(store.canInvite(childA.playerId, childB.playerId)).toBe(true)
    const before = store.dashboard(b.id, childB.id, b.sessionToken).safety.notices.length
    store.removeFriend(a.id, childA.playerId, childB.playerId, a.sessionToken)
    expect(store.listFriends(childB.playerId)).toHaveLength(0)
    expect(store.dashboard(b.id, childB.id, b.sessionToken).safety.notices.length).toBe(before)
    expect(store.canInvite(childA.playerId, childB.playerId)).toBe(false)

    const expiring = store.issueFriendCode(childA.playerId)
    advance(POLICY.friendCodeMs + 1)
    resign('device-a', 'ada@example.com')
    resign('device-b', 'bee@example.com')
    expect(() => store.redeemFriendCode(childB.playerId, expiring.symbols)).toThrow(/code_rejected/)
    const later = store.issueFriendCode(childA.playerId)
    const waiting = store.redeemFriendCode(childB.playerId, later.symbols)
    advance(POLICY.friendRequestMs + 1)
    const sessionA2 = resign('device-a', 'ada@example.com')
    expect(() => store.approveFriend(a.id, waiting.requestId, true, sessionA2.sessionToken)).toThrow(/friend_request_closed/)
  })

  it('stops picture-code guessing after five attempts', () => {
    const { store, adult } = harness({ friends: true })
    const a = adult('device-a', 'ada@example.com')
    const b = adult('device-b', 'bee@example.com')
    const childA = store.addChild(a.id, 2017, 'en-GB')
    const childB = store.addChild(b.id, 2018, 'en-GB')
    for (let n = 0; n < 5; n++) {
      expect(() => store.redeemFriendCode(childB.playerId, [0, 1, 2, 3, 4, n])).toThrow(/code_rejected/)
    }
    const code = store.issueFriendCode(childA.playerId)
    expect(() => store.redeemFriendCode(childB.playerId, code.symbols)).toThrow(/slow_down/)
    store.moderation.block(childA.playerId, childB.playerId)
    expect(store.canInvite(childA.playerId, childB.playerId)).toBe(false)
    expect(store.moderation.avoidIds(childA.playerId)).toContain(childB.playerId)
  })

  it('exports within 72 hours, deletes within 30 days, and keeps consent plus legal hold', () => {
    const { store, adult, advance } = harness({ onlinePlay: true, friends: true })
    const parent = adult('device', 'parent@example.com')
    const child = store.addChild(parent.id, 2018, 'en-GB')
    store.notePresetEvent(child.playerId, 'quick_chat', 2)
    store.notePresetEvent('ply_guest', 'quick_chat', 1)
    store.noteTruncatedAddress('ply_guest', 0xc0_a8_01)
    expect(() => store.noteTruncatedAddress(child.playerId, 0xc0_a8_01_01)).toThrow(/address_prefix_only/)
    store.noteRegionRtt(child.playerId, 'eu-w', 40)
    store.noteReplay('show_1', 3)
    const report = store.fileReport({
      reporterPlayerId: child.playerId,
      subjectPlayerId: 'ply_other',
      category: 'mean',
      showId: 'show_1',
    })
    expect(report.phraseIds).toEqual([2])
    expect(report.autoBlocked).toBe(true)
    store.moderation.review(report.id, 'escalate_p1', 'mod_trust')

    const exp = store.requestExport(parent.id, child.id, parent.sessionToken)
    expect(Date.parse(exp.readyBy) - Date.parse('2026-10-23T12:00:00.000Z')).toBe(POLICY.exportMs)
    const deletion = store.requestDeletion(parent.id, child.id, parent.sessionToken)
    expect(Date.parse(deletion.completeBy) - Date.parse('2026-10-23T12:00:00.000Z')).toBe(POLICY.deletionMs)
    const job = store.runRetention()
    expect(job.exportsReady).toBe(1)
    expect(job.deletions).toBe(1)
    const payload = JSON.stringify(store.readExport(parent.id, exp.id, parent.sessionToken))
    expect(payload).not.toContain('example.com')
    expect(payload).toContain('2018')
    expect(store.pseudonym(child.id)).toBeUndefined()
    expect(store.consentRecordCount(parent.id)).toBeGreaterThan(0)
    expect(store.retainedCount('replay')).toBe(1)

    advance(15 * MS.day)
    store.runRetention()
    expect(store.retainedCount('replay')).toBe(1)
    expect(store.retainedCount('address_prefix')).toBe(0)
    advance(90 * MS.day)
    store.runRetention()
    expect(store.retainedCount('quick_chat')).toBe(0)
    advance(365 * MS.day)
    store.runRetention()
    expect(store.retainedCount('replay')).toBe(0)

    const closed = harness()
    const keeper = closed.adult('keep', 'keep@example.com')
    const keptChild = closed.store.addChild(keeper.id, 2016, 'en-GB')
    closed.store.requestAccountClosure(keeper.id, keeper.sessionToken)
    closed.store.runRetention()
    expect(closed.store.pseudonym(keptChild.id)).toBeUndefined()
    expect(closed.store.contactCiphertext(keeper.id)).not.toContain('@')
    expect(closed.store.consentRecordCount(keeper.id)).toBeGreaterThan(0)
    closed.advance(POLICY.consentAfterClosureMs + 1)
    closed.store.runRetention()
    expect(() => closed.store.contactCiphertext(keeper.id)).toThrow(/unknown_parent/)
    expect(closed.store.consentRecordCount(keeper.id)).toBeGreaterThan(0)
  })

  it('withdraws friends within an hour and locks online play after the current show', () => {
    const { store, adult } = harness({ onlinePlay: true, friends: true })
    const a = adult('device-a', 'ada@example.com')
    const b = adult('device-b', 'bee@example.com')
    const childA = store.addChild(a.id, 2017, 'en-GB')
    const childB = store.addChild(b.id, 2018, 'en-GB')
    const code = store.issueFriendCode(childA.playerId)
    const request = store.redeemFriendCode(childB.playerId, code.symbols)
    store.approveFriend(a.id, request.requestId, true, a.sessionToken)
    store.approveFriend(b.id, request.requestId, true, b.sessionToken)
    store.noteShowBoundary(childA.playerId, 'start')
    store.updateControls(a.id, childA.id, { onlinePlayEnabled: false, friendsEnabled: false }, a.sessionToken)
    expect(store.canPlayOnline(childA.id).ok).toBe(true)
    expect(store.listFriends(childA.playerId).some((row) => row.status === 'active')).toBe(true)
    store.runRetention()
    expect(store.listFriends(childA.playerId).filter((row) => row.status === 'active')).toHaveLength(0)
    store.noteShowBoundary(childA.playerId, 'end')
    expect(store.canPlayOnline(childA.id).reason).toBe('purpose_off')
    const board = store.dashboard(a.id, childA.id, a.sessionToken)
    expect(board.dataAgeMs).toBeLessThanOrEqual(POLICY.dashboardFreshMs)
    expect(board.purchases.history).toEqual([])
    expect(board.purchases.realMoneyEnabled).toBe(false)
    expect(board.friends.pending).toEqual([])
  })
})
