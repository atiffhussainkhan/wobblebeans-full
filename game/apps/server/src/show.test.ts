import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { decodeServer, encodeHello, encodeInput, physicsHash } from '@wobblebeans/shared'
import { BeanWorld } from '@wobblebeans/shared'
import { Show } from './show'
import { startShowServer } from './index'

const stops: Array<() => Promise<void>> = []
afterEach(async () => {
  while (stops.length) await stops.pop()?.()
})

describe('show', () => {
  it('lets two beans see each other move', async () => {
    const world = await BeanWorld.create()
    stops.push(async () => world.destroy())
    const show = new Show(world)
    const a = show.addPlayer()
    const b = show.addPlayer()
    let snap: Map<number, Uint8Array> | null = null
    for (let i = 1; i <= 45; i++) {
      show.pushInputs(a.id, [
        { seq: i, tick: i, moveX: 0, moveZ: 1, jump: false, dive: false, camYaw: 0, quickChat: 0, emote: 0 },
      ])
      const step = show.step()
      if (step.snapshots) snap = step.snapshots
    }
    expect(snap).not.toBeNull()
    const view = decodeServer(snap!.get(b.id)!)
    expect(view.type).toBe('snapshot')
    if (view.type !== 'snapshot') return
    const ids = view.beans.map((bean) => bean.id).sort()
    expect(ids).toEqual([a.id, b.id])
    const mover = view.beans.find((bean) => bean.id === a.id)!
    const still = view.beans.find((bean) => bean.id === b.id)!
    expect(mover.pz).toBeGreaterThan(still.pz + 2)
  })

  it('rejects a quick-chat id that is not in the catalogue', async () => {
    const world = await BeanWorld.create()
    stops.push(async () => world.destroy())
    const show = new Show(world)
    const a = show.addPlayer()
    expect(show.pushClientEvent(a.id, 1, 99)).toBe(false)
    expect(show.pushClientEvent(a.id, 1, 1)).toBe(true)
  })
})

describe('websocket show', () => {
  it('connects two browsers worth of sockets', async () => {
    const server = await startShowServer(0)
    stops.push(() => server.close())
    const [one, two] = await Promise.all([openBean(server.port), openBean(server.port)])
    for (let i = 1; i <= 30; i++) {
      one.send(
        encodeInput([
          { seq: i, tick: i, moveX: 0, moveZ: 1, jump: false, dive: false, camYaw: 0, quickChat: 0, emote: 0 },
        ]),
      )
      await delay(20)
    }
    await delay(200)
    const seen = two.beans.map((b) => b.id)
    expect(seen).toContain(one.id)
    expect(seen).toContain(two.id)
    const moved = two.latest.get(one.id)
    const self = two.latest.get(two.id)
    expect(moved).toBeTruthy()
    expect(self).toBeTruthy()
    expect(moved!.pz).toBeGreaterThan(self!.pz + 2)
    one.ws.close()
    two.ws.close()
  })
})

interface BeanSocket {
  ws: WebSocket
  id: number
  beans: { id: number }[]
  latest: Map<number, { id: number; px: number; pz: number }>
  send: (bytes: Uint8Array) => void
}

function openBean(port: number): Promise<BeanSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const latest = new Map<number, { id: number; px: number; pz: number }>()
    const beans: { id: number }[] = []
    const sock: BeanSocket = {
      ws,
      id: 0,
      beans,
      latest,
      send: (bytes) => ws.send(bytes),
    }
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => ws.send(encodeHello(physicsHash()))
    ws.onmessage = (ev) => {
      const msg = decodeServer(new Uint8Array(ev.data as ArrayBuffer))
      if (msg.type === 'welcome') {
        sock.id = msg.playerId
        resolve(sock)
      } else if (msg.type === 'snapshot') {
        beans.splice(0, beans.length, ...msg.beans)
        for (const bean of msg.beans) latest.set(bean.id, bean)
      } else if (msg.type === 'reject') {
        reject(new Error(`rejected ${msg.reason}`))
      }
    }
    ws.onerror = () => reject(new Error('socket error'))
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
