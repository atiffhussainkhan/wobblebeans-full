import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { ModerationService, assertNoPersonalFields, PLAYTEST_GATE, type PlaytestGateId } from './services'
import type { Backend } from './runtime'
import { settleMatch } from './settle'
import { QUEUE_RULES } from './queue-rules'
import type { SignedMatchResult } from './settle'

export interface GatewayHandle {
  port: number
  url: string
  close: () => Promise<void>
}

export async function startGateway(backend: Backend, opts: { port?: number; moderation?: ModerationService } = {}): Promise<GatewayHandle> {
  const moderation = opts.moderation ?? new ModerationService()
  const server = createServer((req, res) => {
    void handle(req, res, backend, moderation).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'error'
      const status = statusFor(message)
      send(res, status, { error: codeFor(message) })
    })
  })
  await new Promise<void>((resolve) => {
    server.listen(opts.port ?? 0, '0.0.0.0', () => resolve())
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : (opts.port ?? 0)
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

async function handle(req: IncomingMessage, res: ServerResponse, backend: Backend, moderation: ModerationService): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const method = req.method ?? 'GET'
  const path = url.pathname
  if (method === 'GET' && path === '/health') {
    const services = backend.health()
    send(res, 200, { ok: true, services })
    return
  }
  if (method === 'GET' && path === '/ready') {
    const services = backend.health()
    const ready = services.every((service) => service.name === 'admin' || service.name === 'moderation' || service.ready)
    send(res, ready ? 200 : 503, { ready, services })
    return
  }
  if (method === 'GET' && path === '/v1/auth/queue-status') {
    send(res, 200, await backend.identity.queueStatus())
    return
  }
  if (method === 'GET' && path === '/v1/config/client') {
    const view = backend.config.clientView(url.searchParams.get('version') ?? undefined)
    send(res, 200, view ?? { config: null })
    return
  }
  if (method === 'GET' && path === '/v1/news') {
    send(res, 200, { posts: backend.config.current.news ?? [] })
    return
  }
  if (method === 'GET' && path === '/v1/shows') {
    send(res, 200, { shows: (backend.config.current.shows ?? []).filter((show) => show.enabled) })
    return
  }
  if (method === 'GET' && path === '/v1/shop/catalogue') {
    send(res, 200, { items: backend.shop.items, coinShopEnabled: backend.config.current.coinShopEnabled })
    return
  }
  if (method === 'GET' && path === '/v1/names/options') {
    const seed = Number(url.searchParams.get('seed') ?? '1')
    send(res, 200, { options: backend.profile.nameOptions(Number.isFinite(seed) ? seed : 1) })
    return
  }
  if (method === 'GET' && path === '/v1/season/current') {
    send(res, 200, { season: seasonView(backend, Date.now()) })
    return
  }

  if (path.startsWith('/internal/') || path.startsWith('/admin/')) {
    await privileged(method, path, req, res, backend, moderation)
    return
  }

  const body = method === 'GET' || method === 'DELETE' ? {} : await readJson(req)
  assertNoPersonalFields(body)

  if (method === 'POST' && path === '/v1/auth/platform-login') {
    const record = asRecord(body)
    const clientPhysicsHash = Number(record.clientPhysicsHash)
    const pinned = backend.config.current.physicsHash
    if (!Number.isInteger(clientPhysicsHash) || clientPhysicsHash !== pinned) {
      send(res, 409, { error: 'physics', refreshConfig: true, physicsHash: pinned, configVersion: backend.config.current.version })
      return
    }
    const result = await backend.identity.login({
      platform: record.platform as 'steam' | 'epic' | 'device',
      subject: String(record.subject ?? ''),
    })
    if (result.queued) {
      send(res, 202, { queued: true, position: result.position })
      return
    }
    if (result.created && result.playerId) backend.profile.ensure(result.playerId, typeof record.locale === 'string' ? record.locale : 'en-GB')
    if (result.playerId) backend.social.setPresence(result.playerId, 'menu')
    send(res, 200, { playerId: result.playerId, session: result.session, created: result.created === true })
    return
  }

  if (method === 'POST' && path === '/v1/auth/refresh') {
    const session = await backend.identity.refreshSession(String(asRecord(body).refreshToken ?? ''))
    if (!session) return send(res, 401, { error: 'unauthorized' })
    send(res, 200, { session })
    return
  }
  if (method === 'POST' && path === '/v1/auth/logout') {
    const record = asRecord(body)
    await backend.identity.logout(String(record.accessToken ?? ''), typeof record.refreshToken === 'string' ? record.refreshToken : undefined)
    send(res, 200, { ok: true })
    return
  }
  if (method === 'POST' && path === '/v1/telemetry/batch') {
    const events = asRecord(body).events
    if (!Array.isArray(events)) throw new Error('invalid')
    for (const event of events) {
      assertNoPersonalFields(event)
      backend.telemetry.ingest(event as Parameters<Backend['telemetry']['ingest']>[0])
    }
    send(res, 202, { accepted: events.length })
    return
  }

  const playerId = backend.identity.verifyAccess(bearer(req) ?? '')
  if (!playerId) return send(res, 401, { error: 'unauthorized' })

  if (method === 'GET' && path === '/v1/me') {
    send(res, 200, { profile: backend.profile.ensure(playerId) })
    return
  }
  if (method === 'PUT' && path === '/v1/me/loadout') {
    const patch = asRecord(body)
    const profile = backend.profile.updateLoadout(playerId, {
      upperId: typeof patch.upperId === 'string' ? patch.upperId : undefined,
      lowerId: typeof patch.lowerId === 'string' ? patch.lowerId : undefined,
      colourId: typeof patch.colourId === 'string' ? patch.colourId : undefined,
      patternId: typeof patch.patternId === 'string' ? patch.patternId : undefined,
      faceId: typeof patch.faceId === 'string' ? patch.faceId : undefined,
    })
    await backend.db?.saveProfile(profile)
    send(res, 200, { profile })
    return
  }
  if (method === 'POST' && path === '/v1/me/name/reroll') {
    send(res, 200, backend.profile.rerollName(playerId))
    return
  }
  if (method === 'GET' && path === '/v1/friends') {
    send(res, 200, { friends: backend.social.listFriends(playerId), pending: backend.social.pendingFor(playerId) })
    return
  }
  if (method === 'POST' && path === '/v1/friends/code') {
    if (!backend.config.current.friendRequestsEnabled) return send(res, 403, { error: 'forbidden' })
    const code = backend.social.issueFriendCode(playerId)
    await persistSocial(backend)
    send(res, 200, code)
    return
  }
  if (method === 'POST' && path === '/v1/friends/requests') {
    if (!backend.config.current.friendRequestsEnabled) return send(res, 403, { error: 'forbidden' })
    const symbols = asRecord(body).symbols
    if (!Array.isArray(symbols)) throw new Error('picture code')
    const redeemed = backend.social.redeemFriendCode(playerId, symbols.map(Number))
    await persistSocial(backend)
    send(res, 200, redeemed)
    return
  }
  if (method === 'POST' && path === '/v1/blocks') {
    const subjectId = String(asRecord(body).subjectPlayerId ?? '')
    backend.social.block(playerId, subjectId)
    backend.matchmaker.block(playerId, subjectId)
    await persistSocial(backend)
    send(res, 200, { ok: true })
    return
  }
  if (method === 'DELETE' && path.startsWith('/v1/blocks/')) {
    backend.social.unblock(playerId, decodeURIComponent(path.slice('/v1/blocks/'.length)))
    await persistSocial(backend)
    send(res, 200, { ok: true })
    return
  }
  if (method === 'POST' && path === '/v1/mutes') {
    backend.social.mute(playerId, String(asRecord(body).subjectPlayerId ?? ''))
    await persistSocial(backend)
    send(res, 200, { ok: true })
    return
  }
  if (method === 'POST' && path === '/v1/party') {
    send(res, 200, backend.matchmaker.createParty(playerId))
    return
  }
  const partyInvite = path.match(/^\/v1\/party\/([^/]+)\/invite$/)
  if (method === 'POST' && partyInvite?.[1]) {
    const friendId = String(asRecord(body).playerId ?? '')
    if (!backend.social.areFriends(playerId, friendId)) throw new Error('friends only')
    send(res, 200, backend.matchmaker.invite(decodeURIComponent(partyInvite[1]), friendId))
    return
  }
  const partyLeave = path.match(/^\/v1\/party\/([^/]+)\/leave$/)
  if (method === 'POST' && partyLeave?.[1]) {
    send(res, 200, { party: backend.matchmaker.leaveParty(decodeURIComponent(partyLeave[1]), playerId) })
    return
  }
  if (method === 'POST' && path === '/v1/mm/tickets') {
    const record = asRecord(body)
    const queued = {
      region: typeof record.region === 'string' ? record.region : null,
      widenRegions: Array.isArray(record.widenRegions) ? record.widenRegions.map(String) : [],
      showsCompleted: Number(record.showsCompleted ?? 0),
      nowMs: Date.now(),
      clientPhysicsHash: record.clientPhysicsHash === undefined ? undefined : Number(record.clientPhysicsHash),
    }
    const ticket = typeof record.partyId === 'string'
      ? backend.matchmaker.queueParty(record.partyId, playerId, queued)
      : backend.matchmaker.queue({ ...queued, playerIds: [playerId] })
    if (ticket.refreshConfig) return send(res, 409, { error: 'physics', refreshConfig: true, physicsHash: ticket.physicsHash, configVersion: ticket.configVersion })
    send(res, 200, ticket)
    return
  }
  const ticketGet = path.match(/^\/v1\/mm\/tickets\/([^/]+)$/)
  if (ticketGet?.[1] && method === 'GET') {
    const ticket = backend.matchmaker.get(decodeURIComponent(ticketGet[1]))
    if (!ticket) return send(res, 404, { error: 'not_found' })
    send(res, 200, ticket)
    return
  }
  if (ticketGet?.[1] && method === 'DELETE') {
    send(res, 200, { ok: backend.matchmaker.cancel(decodeURIComponent(ticketGet[1])) })
    return
  }
  if (method === 'POST' && path === '/v1/mm/reconnect') {
    const record = asRecord(body)
    const showId = String(record.showId ?? '')
    if (typeof record.token === 'string') {
      send(res, 200, { ok: backend.identity.redeemReconnect(record.token, playerId, showId) })
      return
    }
    const issued = backend.identity.issueReconnect(playerId, showId)
    send(res, 'error' in issued ? 429 : 200, issued)
    return
  }
  if (method === 'GET' && path === '/v1/progression') {
    send(res, 200, backend.progression.get(playerId))
    return
  }
  const claim = path.match(/^\/v1\/challenges\/([^/]+)\/claim$/)
  if (method === 'POST' && claim?.[1]) {
    const challengeId = decodeURIComponent(claim[1])
    const result = backend.progression.claimChallenge(playerId, challengeId)
    if (!result.duplicate) {
      await backend.applyCoins({
        playerId,
        delta: 25,
        reason: 'challenge',
        sourceRef: challengeId,
        idempotencyKey: `challenge:${playerId}:${challengeId}`,
      })
    }
    send(res, 200, result)
    return
  }
  if (method === 'GET' && path === '/v1/wallet') {
    send(res, 200, { balance: backend.ledger.balance(playerId), entries: backend.ledger.list(playerId) })
    return
  }
  if (method === 'GET' && path === '/v1/inventory') {
    send(res, 200, { items: backend.inventory.list(playerId) })
    return
  }
  if (method === 'POST' && path === '/v1/shop/purchase') {
    if (!backend.config.current.coinShopEnabled) return send(res, 403, { error: 'forbidden' })
    const record = asRecord(body)
    const item = backend.shop.items.find((row) => row.id === record.itemId)
    if (!item) return send(res, 404, { error: 'not_found' })
    const key = String(record.idempotencyKey ?? '')
    if (!key) throw new Error('invalid')
    if (backend.ledger.balance(playerId) < item.priceCoins && !backend.ledger.list(playerId).some((entry) => entry.idempotencyKey === key)) {
      return send(res, 200, { ok: false, reason: 'short' })
    }
    const applied = await backend.applyCoins({
      playerId,
      delta: -item.priceCoins,
      reason: 'shop',
      sourceRef: item.id,
      idempotencyKey: key,
    })
    if (!applied.duplicate) backend.inventory.grant(playerId, item.id, 'shop', Date.now())
    send(res, 200, { ok: true, reason: 'bought', duplicate: applied.duplicate })
    return
  }
  if (method === 'POST' && path === '/v1/reports') {
    const record = asRecord(body)
    const report = moderation.file({
      reporterPlayerId: playerId,
      subjectPlayerId: String(record.subjectPlayerId ?? ''),
      category: record.category as 'unfair' | 'mean' | 'scary' | 'bug',
      showId: String(record.showId ?? ''),
    })
    backend.social.block(playerId, report.subjectPlayerId)
    backend.matchmaker.block(playerId, report.subjectPlayerId)
    send(res, 200, report)
    return
  }
  if (method === 'GET' && path === '/v1/reports/mine') {
    send(res, 200, { reports: moderation.mine(playerId) })
    return
  }
  send(res, 404, { error: 'not_found' })
}

async function privileged(
  method: string,
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
  backend: Backend,
  moderation: ModerationService,
): Promise<void> {
  if (method === 'POST' && path === '/admin/session') {
    const body = asRecord(await readJson(req))
    const session = backend.admin.openSession(String(body.actorId ?? ''), String(body.mfaCode ?? ''))
    send(res, 200, session)
    return
  }
  if (path.startsWith('/admin/')) {
    const token = bearer(req)
    if (!token) return send(res, 401, { error: 'unauthorized' })
    const body = method === 'GET' ? {} : asRecord(await readJson(req))
    assertNoPersonalFields(body)
    if (method === 'POST' && path === '/admin/wallet/grant') {
      const entry = await backend.admin.grantCoins({
        token,
        playerId: String(body.playerId ?? ''),
        delta: Number(body.delta),
        idempotencyKey: String(body.idempotencyKey ?? ''),
      })
      if (backend.db) {
        await backend.applyCoins({
          playerId: entry.playerId,
          delta: entry.delta,
          reason: entry.reason,
          sourceRef: entry.sourceRef,
          idempotencyKey: entry.idempotencyKey,
        })
      }
      send(res, 200, entry)
      return
    }
    if (method === 'POST' && path === '/admin/wallet/rollback') {
      const entry = await backend.admin.rollbackGrant({
        token,
        playerId: String(body.playerId ?? ''),
        delta: Number(body.delta),
        idempotencyKey: String(body.idempotencyKey ?? ''),
      })
      if (backend.db) {
        await backend.applyCoins({
          playerId: entry.playerId,
          delta: entry.delta,
          reason: entry.reason,
          sourceRef: entry.sourceRef,
          idempotencyKey: entry.idempotencyKey,
        })
      }
      send(res, 200, entry)
      return
    }
    if (method === 'POST' && path === '/admin/config/rollback') {
      const config = backend.config.rollback(backend.admin.actor(token) ?? '')
      send(res, 200, { version: config.version })
      return
    }
    if (method === 'POST' && path === '/admin/killswitch') {
      const actor = backend.admin.actor(token)
      if (!actor) return send(res, 401, { error: 'unauthorized' })
      const config = backend.config.killSwitch(
        actor,
        {
          accountCreationEnabled: typeof body.accountCreationEnabled === 'boolean' ? body.accountCreationEnabled : undefined,
          friendRequestsEnabled: typeof body.friendRequestsEnabled === 'boolean' ? body.friendRequestsEnabled : undefined,
          coinShopEnabled: typeof body.coinShopEnabled === 'boolean' ? body.coinShopEnabled : undefined,
          showId: typeof body.showId === 'string' ? body.showId : undefined,
          showEnabled: typeof body.showEnabled === 'boolean' ? body.showEnabled : undefined,
        },
        backend.configKey,
      )
      send(res, 200, { version: config.version, accountCreationEnabled: config.accountCreationEnabled })
      return
    }
    if (method === 'GET' && path === '/admin/moderation/queue') {
      if (!backend.admin.actor(token)) return send(res, 401, { error: 'unauthorized' })
      send(res, 200, { reports: moderation.queue() })
      return
    }
    if (method === 'POST' && path === '/admin/sanctions') {
      const actor = backend.admin.actor(token)
      if (!actor) return send(res, 401, { error: 'unauthorized' })
      const code = Number(body.code)
      if (!Number.isInteger(code)) throw new Error('invalid')
      send(res, 200, { ok: true, actorId: actor, code })
      return
    }
    if (method === 'POST' && path === '/admin/config/activate') {
      const actor = backend.admin.actor(token)
      if (!actor) return send(res, 401, { error: 'unauthorized' })
      const config = backend.config.activate(String(body.version ?? ''), actor, body.mode === 'canary' ? 'canary' : body.mode === 'staging' ? 'staging' : 'global', Number(body.canaryPercent ?? 5))
      send(res, 200, { version: config.version })
      return
    }
  }

  if (!serverKeyOk(req, backend.matchKey)) return send(res, 401, { error: 'unauthorized' })
  const body = method === 'GET' ? {} : asRecord(await readJson(req))
  assertNoPersonalFields(body)
  if (method === 'POST' && path === '/internal/match-results') {
    const signed = body as unknown as SignedMatchResult
    const key = String(body.idempotencyKey ?? signed.result?.showId ?? '')
    const settled = settleMatch(signed, backend.matchKey, key, backend.progression, backend.ledger)
    if (!settled.duplicate && backend.db) {
      for (const participant of signed.result.participants) {
        await backend.db.applyLedger({
          playerId: participant.playerId,
          delta: participant.coinsEarned,
          reason: 'show',
          sourceRef: signed.result.showId,
          idempotencyKey: `${key}:${participant.playerId}`,
        })
        await backend.db.saveProgress(backend.progression.get(participant.playerId))
      }
      backend.ledger.hydrate(await backend.db.loadLedger())
    }
    send(res, 200, settled)
    return
  }
  if (method === 'POST' && path === '/internal/anticheat/flags') {
    const code = Number(body.code)
    if (!Number.isInteger(code)) throw new Error('invalid')
    backend.flags.push({ playerId: String(body.playerId ?? ''), showId: String(body.showId ?? ''), code })
    send(res, 202, { ok: true })
    return
  }
  if (method === 'POST' && path === '/internal/fleet/allocate') {
    const roster = Array.isArray(body.roster) ? body.roster : []
    const showId = String(body.showId ?? `show_${Date.now()}`)
    const pinned = backend.config.pinForShow(showId)
    const allocation = backend.fleet.allocate({
      showId,
      region: typeof body.region === 'string' ? body.region : null,
      configVersion: pinned.version,
      physicsHash: pinned.physicsHash,
      pinnedAt: pinned.pinnedAt,
      levels: pinned.levels,
      nowMs: Date.now(),
      roster: roster.map((member) => {
        const row = asRecord(member)
        return { playerId: String(row.playerId ?? ''), isBot: row.isBot === true }
      }),
    })
    if (allocation) {
      await backend.db?.saveShowPin({
        showId: allocation.showId,
        configVersion: allocation.configVersion,
        region: allocation.region,
        physicsHash: allocation.physicsHash,
        serverBuild: allocation.serverBuild,
        pinnedAt: allocation.pinnedAt,
        levels: allocation.levels,
      })
    }
    send(res, allocation ? 200 : 503, allocation ?? { error: 'unavailable' })
    return
  }
  if (method === 'POST' && path === '/internal/connect/admit') {
    const admission = backend.fleet.admit(
      String(body.token ?? ''),
      String(body.playerId ?? ''),
      String(body.showId ?? ''),
      Number(body.nowMs ?? Date.now()),
      Number(body.clientPhysicsHash),
    )
    send(res, admission.ok ? 200 : 409, admission)
    return
  }
  if (method === 'POST' && path === '/internal/mm/tick') {
    const started = backend.matchmaker.tick(Number(body.nowMs ?? Date.now()))
    send(res, 200, { started })
    return
  }
  const configGet = path.match(/^\/internal\/config\/server\/([^/]+)$/)
  if (method === 'GET' && configGet?.[1]) {
    const view = backend.config.clientView(decodeURIComponent(configGet[1]))
    if (!view) return send(res, 404, { error: 'not_found' })
    send(res, 200, view)
    return
  }
  send(res, 404, { error: 'not_found' })
}

function seasonView(backend: Backend, now: number): { id: string; startsAt: string; endsAt: string } {
  if (backend.config.current.season) return backend.config.current.season
  const epoch = Date.parse('2026-01-05T00:00:00.000Z')
  const index = Math.floor((now - epoch) / QUEUE_RULES.seasonMs)
  const starts = epoch + index * QUEUE_RULES.seasonMs
  return {
    id: `season-${index + 1}`,
    startsAt: new Date(starts).toISOString(),
    endsAt: new Date(starts + QUEUE_RULES.seasonMs).toISOString(),
  }
}

async function persistSocial(backend: Backend): Promise<void> {
  await backend.db?.saveSocial(backend.social.snapshot())
}

function bearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

function serverKeyOk(req: IncomingMessage, key: string): boolean {
  const header = req.headers['x-server-key']
  const given = Array.isArray(header) ? header[0] : header
  if (!given) return false
  const left = Buffer.from(given)
  const right = Buffer.from(key)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    size += buffer.length
    if (size > 65_536) throw new Error('invalid')
    chunks.push(buffer)
  }
  if (size === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid')
  return value as Record<string, unknown>
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(json) })
  res.end(json)
}

function statusFor(message: string): number {
  if (/signature|mfa|unauthorized|admin session/.test(message)) return 401
  if (/not allowed|forbidden|friends are off|friends only/.test(message)) return 403
  if (/not_found|unknown player|missing/.test(message)) return 404
  if (/physics/.test(message)) return 409
  if (/limit|slow down|full/.test(message)) return 429
  return 400
}

function codeFor(message: string): string {
  if (/not allowed/.test(message)) return 'rejected'
  if (/signature/.test(message)) return 'unauthorized'
  if (/mfa|admin session/.test(message)) return 'unauthorized'
  return 'invalid'
}

export const PLAYTEST_GATES = PLAYTEST_GATE
export type { PlaytestGateId }
