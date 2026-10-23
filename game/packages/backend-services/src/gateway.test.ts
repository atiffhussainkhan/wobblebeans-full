import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { startGateway } from './gateway'
import { createBackend } from './runtime'
import { signMatchResult } from './settle'

describe('gateway', () => {
  it('reports health, refuses a bad physics hash, and settles a signed result once', async () => {
    const backend = await createBackend({
      physicsHash: 1234,
      capacity: 10,
      mfaSecret: 'mfa-dev-secret',
      configKey: 'config-key',
      matchKey: 'match-key',
      sessionSecret: 'session-secret',
      platformPepper: 'pepper',
    })
    const gateway = await startGateway(backend)
    try {
      const health = await fetch(`${gateway.url}/health`)
      const healthBody = (await health.json()) as { services: { name: string; ready: boolean }[] }
      expect(health.status).toBe(200)
      expect(healthBody.services.map((service) => service.name)).toEqual(
        expect.arrayContaining(['identity', 'profile', 'social', 'matchmaker', 'fleet', 'progression', 'ledger', 'config', 'telemetry', 'moderation', 'admin']),
      )
      expect(healthBody.services.find((service) => service.name === 'admin')?.ready).toBe(false)
      const stale = await fetch(`${gateway.url}/v1/auth/platform-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform: 'device', subject: 'device-1', clientPhysicsHash: 1 }),
      })
      expect(stale.status).toBe(409)
      const logged = await fetch(`${gateway.url}/v1/auth/platform-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform: 'device', subject: 'device-1', clientPhysicsHash: 1234, locale: 'en-GB' }),
      })
      const sessionBody = (await logged.json()) as { playerId: string; session: { accessToken: string } }
      expect(logged.status).toBe(200)
      expect(JSON.stringify(sessionBody)).not.toContain('@')
      const auth = { authorization: `Bearer ${sessionBody.session.accessToken}`, 'content-type': 'application/json' }
      const shop = await fetch(`${gateway.url}/v1/shop/purchase`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ itemId: 'top-berry', idempotencyKey: 'buy-1' }),
      })
      expect(shop.status).toBe(403)
      const result = {
        showId: 'show_1',
        configVersion: 'foundation-1',
        region: 'eu-w',
        participants: [{ playerId: sessionBody.playerId, qualifiedRounds: 1, wonFinal: false, xpEarned: 50, coinsEarned: 500 }],
      }
      const signed = signMatchResult(result, 'match-key')
      const postResult = () =>
        fetch(`${gateway.url}/internal/match-results`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-server-key': 'match-key' },
          body: JSON.stringify({ ...signed, idempotencyKey: 'res-1' }),
        })
      expect((await postResult()).status).toBe(200)
      const duplicate = (await (await postResult()).json()) as { duplicate: boolean }
      expect(duplicate.duplicate).toBe(true)
      const wallet = (await (await fetch(`${gateway.url}/v1/wallet`, { headers: auth })).json()) as { balance: number }
      expect(wallet.balance).toBe(500)
      const unsafe = await fetch(`${gateway.url}/v1/telemetry/batch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events: [{ name: 'playtest_gate', playerPid: 'h', sessionId: 's', ts: 1, payload: { code: 'funny' } }] }),
      })
      expect(unsafe.status).toBe(400)
    } finally {
      await gateway.close()
      await backend.close()
    }
  })
})

describe('show process isolation', () => {
  it('does not hand the parent data key to the show server', async () => {
    const server = await readFile(new URL('../../../apps/server/src/index.ts', import.meta.url), 'utf8')
    expect(server).not.toContain('PARENT_DATA_KEY')
    const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8')
    expect(compose).toContain('PARENT_DATA_KEY')
    expect(compose).not.toContain('47221')
  })
})
