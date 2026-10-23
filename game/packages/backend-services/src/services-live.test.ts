import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AdminService, MemoryAuditLog, type AuditLog } from './admin'
import { createSecretBox } from './codec'
import { IdentityService } from './identity'
import { CoinLedger, InventoryService } from './ledger'
import { MemoryParentBlobs, ParentDirectory } from './parent-directory'
import { ProfileService } from './profile'
import { ProgressionService } from './progression'
import { settleMatch, signMatchResult } from './settle'
import { SocialService } from './social'
import { PLAYTEST_GATE, TelemetryService } from './services'

describe('identity, profile, and sessions', () => {
  it('links a platform to a pseudonymous id and queues past 80 percent capacity', async () => {
    const identity = new IdentityService({ capacity: 3, pepper: 'pepper', sessionSecret: 'secret' })
    const first = await identity.login({ platform: 'steam', subject: 'steam-subject-1', nowMs: 1_000 })
    const again = await identity.login({ platform: 'steam', subject: 'steam-subject-1', nowMs: 2_000 })
    expect(first.playerId).toBe(again.playerId)
    expect(first.playerId).toMatch(/^[0-9a-f-]{36}$/)
    const device = await identity.login({ platform: 'device', subject: 'device-2', nowMs: 3_000 })
    expect(device.queued).toBe(false)
    const queued = await identity.login({ platform: 'epic', subject: 'epic-3', nowMs: 4_000 })
    expect(queued.queued).toBe(true)
    expect(queued.position).toBe(1)
    const access = first.session?.accessToken ?? ''
    expect(identity.verifyAccess(access, 2_000)).toBe(first.playerId)
    const refreshed = await identity.refreshSession(first.session?.refreshToken ?? '', 5_000)
    expect(refreshed?.playerId).toBe(first.playerId)
    await identity.logout(access, refreshed?.refreshToken)
    expect(identity.verifyAccess(access, 5_000)).toBeNull()
    await identity.linkPlatform(first.playerId ?? '', 'epic', 'epic-subject-9')
    const linked = await identity.login({ platform: 'epic', subject: 'epic-subject-9', nowMs: 6_000 })
    expect(linked.playerId).toBe(first.playerId)
    const reconnect = identity.issueReconnect(first.playerId ?? '', 'show_1', 7_000)
    expect('token' in reconnect).toBe(true)
    if (!('token' in reconnect)) return
    expect(identity.redeemReconnect(reconnect.token, 'other', 'show_1', 7_000)).toBe(false)
    expect(identity.redeemReconnect(reconnect.token, first.playerId ?? '', 'show_1', 7_000)).toBe(true)
    identity.issueReconnect(first.playerId ?? '', 'show_1', 8_000)
    expect(identity.issueReconnect(first.playerId ?? '', 'show_1', 9_000)).toEqual({ error: 'limit' })
    const off = new IdentityService({ accountCreationEnabled: () => false })
    await expect(off.login({ platform: 'device', subject: 'new' })).rejects.toThrow(/account creation/)
  })

  it('rerolls a catalogue name and keeps the loadout on preset ids', () => {
    const profiles = new ProfileService()
    const profile = profiles.ensure('ply_1', 'en-GB')
    expect(profile.settingsPrivate).toBe(true)
    expect(JSON.stringify(profile)).not.toMatch(/@/)
    const rolled = profiles.rerollName('ply_1', Date.parse('2026-06-01T00:00:00Z'))
    expect(rolled.text.length).toBeLessThanOrEqual(16)
    expect(rolled.generatedNameId).not.toBe(profile.generatedNameId)
    const updated = profiles.updateLoadout('ply_1', { upperId: 'top-berry' })
    expect(updated.upperId).toBe('top-berry')
    expect(updated.lowerId).toBe('legs-basic')
  })
})

describe('social graph', () => {
  it('needs both sides to approve a picture code and hides presence from strangers', () => {
    const social = new SocialService()
    social.setConsent({ friendsEnabled: () => true })
    const now = Date.parse('2026-06-01T12:00:00Z')
    const code = social.issueFriendCode('ply_a', now)
    expect(code.symbols).toHaveLength(6)
    const request = social.redeemFriendCode('ply_b', code.symbols, now + 1_000)
    expect(social.approveFriend(request.requestId, 'ply_a', true, now + 2_000).active).toBe(false)
    expect(social.approveFriend(request.requestId, 'ply_b', true, now + 3_000).active).toBe(true)
    expect(social.areFriends('ply_a', 'ply_b')).toBe(true)
    social.setPresence('ply_a', 'menu')
    expect(social.presenceFor('ply_b', 'ply_a')).toBe('menu')
    expect(social.presenceFor('ply_c', 'ply_a')).toBeNull()
    social.block('ply_a', 'ply_b')
    expect(social.areFriends('ply_a', 'ply_b')).toBe(false)
    expect(social.blockedEither('ply_b', 'ply_a')).toBe(true)
    social.setConsent({ friendsEnabled: (playerId) => playerId !== 'ply_c' })
    expect(() => social.issueFriendCode('ply_c', now)).toThrow(/friends are off/)
    const again = social.issueFriendCode('ply_a', now + 4_000)
    expect(() => social.redeemFriendCode('ply_b', again.symbols, now + 5_000)).toThrow(/blocked/)
  })
})

describe('progression and ledger', () => {
  it('applies a signed match result once and does not let progression write coins by itself', () => {
    const progression = new ProgressionService()
    const ledger = new CoinLedger()
    const result = {
      showId: 'show_1',
      configVersion: 'foundation-1',
      region: 'eu-w',
      participants: [{ playerId: 'ply_1', qualifiedRounds: 2, wonFinal: true, xpEarned: 100, coinsEarned: 40 }],
    }
    progression.applyMatchResult(result, 'res-1')
    expect(ledger.balance('ply_1')).toBe(0)
    expect(progression.get('ply_1').trophies).toBe(1)
    const signed = signMatchResult(result, 'match-key')
    expect(settleMatch(signed, 'match-key', 'res-2', progression, ledger).duplicate).toBe(false)
    expect(settleMatch(signed, 'match-key', 'res-2', progression, ledger).duplicate).toBe(true)
    expect(ledger.balance('ply_1')).toBe(40)
    expect(ledger.list('ply_1')).toHaveLength(1)
    expect(() => settleMatch({ ...signed, signature: 'nope' }, 'match-key', 'res-3', progression, ledger)).toThrow(/signature/)
    expect(ledger.balance('ply_1')).toBe(40)
    const shop = new InventoryService()
    shop.grant('ply_1', 'top-berry', 'shop', 0)
    const undone = shop.undoUnused(ledger, 'ply_1', 'top-berry', 1_000, 200, 'undo-1')
    expect(undone.ok).toBe(true)
    expect(ledger.list('ply_1').some((entry) => entry.reason === 'undo')).toBe(true)
    expect(ledger.list('ply_1').some((entry) => entry.reason === 'show')).toBe(true)
  })
})

describe('telemetry salts', () => {
  it('uses numeric playtest codes and unlinks events when the salt is deleted', async () => {
    const telemetry = new TelemetryService()
    const salts = new Map<string, Buffer>()
    telemetry.attachSalts({
      async put(playerId, salt) {
        salts.set(playerId, Buffer.from(salt))
      },
      async get(playerId) {
        const salt = salts.get(playerId)
        return salt ? Buffer.from(salt) : null
      },
      async delete(playerId) {
        salts.delete(playerId)
      },
    })
    const first = await telemetry.ingestPlaytest({
      playerId: 'ply_1',
      gate: PLAYTEST_GATE.fallFeel,
      code: 1,
      value: 1,
      sessionId: 'sess',
      ts: 10,
    })
    expect(first.payload).toEqual({ gate: PLAYTEST_GATE.fallFeel, code: 1, value: 1 })
    expect(first.playerPid).not.toBe('ply_1')
    expect(() =>
      telemetry.ingest({
        name: 'playtest_gate',
        playerPid: 'h',
        sessionId: 's',
        ts: 1,
        payload: { gate: 3, code: 'funny' },
      }),
    ).toThrow(/numeric/)
    await telemetry.deleteSalt('ply_1')
    expect(salts.has('ply_1')).toBe(false)
    const second = await telemetry.playerPid('ply_1')
    expect(second).not.toBe(first.playerPid)
  })
})

describe('admin audit', () => {
  it('stays unready without a durable audit log and grants only through the ledger', async () => {
    const ledger = new CoinLedger()
    const unready = new AdminService({ ledger, mfa: { verify: () => true } })
    expect(unready.ready().ready).toBe(false)
    const session = unready.openSession('ops', 'code', 1_000)
    await expect(
      unready.grantCoins({ token: session.token, playerId: 'ply_1', delta: 25, idempotencyKey: 'g1', nowMs: 1_000 }),
    ).rejects.toThrow(/audit/)
    expect(ledger.balance('ply_1')).toBe(0)
    const memory = new MemoryAuditLog()
    const withMemory = new AdminService({ ledger, audit: memory, mfa: { verify: () => true } })
    expect(withMemory.ready().ready).toBe(false)
    const rows: unknown[] = []
    const durable: AuditLog = {
      durable: true,
      async append(event) {
        rows.push(event)
      },
      async recent() {
        return []
      },
    }
    const ready = new AdminService({ ledger, audit: durable, mfa: { verify: () => true } })
    expect(ready.ready().ready).toBe(true)
    const open = ready.openSession('ops', 'code', 2_000)
    const granted = await ready.grantCoins({ token: open.token, playerId: 'ply_1', delta: 25, idempotencyKey: 'g1', nowMs: 2_000 })
    expect(granted.balanceAfter).toBe(25)
    expect(ledger.list('ply_1')).toHaveLength(1)
    await ready.rollbackGrant({ token: open.token, playerId: 'ply_1', delta: 25, idempotencyKey: 'g1', nowMs: 3_000 })
    expect(ledger.list('ply_1')).toHaveLength(2)
    expect(ledger.balance('ply_1')).toBe(0)
    expect(rows).toHaveLength(2)
  })
})

describe('parent record sealing', () => {
  it('stores ciphertext that does not contain the plaintext', async () => {
    const blobs = new MemoryParentBlobs()
    const directory = new ParentDirectory(createSecretBox(randomBytes(32)), blobs)
    const secret = 'grown-up@example.com'
    await directory.save('guardian', 'par_1', { id: 'par_1', contact: secret, country: 'GB' })
    const held = blobs.held('guardian', 'par_1')
    expect(held?.includes(Buffer.from(secret))).toBe(false)
    const loaded = (await directory.load('guardian', 'par_1')) as { contact: string }
    expect(loaded.contact).toBe(secret)
  })
})
