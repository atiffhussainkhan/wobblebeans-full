import { createServer, type Server as HttpServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  BeanWorld,
  NET,
  RejectReason,
  decodeClient,
  encodePong,
  encodeReject,
  encodeWelcome,
  physicsHash,
} from '@wobblebeans/shared'
import { createLiveGauntlet } from './flow/live-gauntlet'
import { Show } from './show'

export interface RunningServer {
  port: number
  show: Show
  close: () => Promise<void>
}

export async function startShowServer(port: number = NET.devServerPort): Promise<RunningServer> {
  const world = await BeanWorld.create()
  const show = new Show(world)
  // Vitest drives inputs on the first ticks. The countdown stays on `pnpm dev`.
  if (!process.env.VITEST) show.flow = createLiveGauntlet()
  const hash = physicsHash()
  const sockets = new Map<WebSocket, number>()

  const http: HttpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
      return
    }
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('wobblebeans show server')
  })

  const wss = new WebSocketServer({ server: http })

  const sendSnap = (sock: WebSocket, bytes: Uint8Array) => {
    if (sock.readyState === sock.OPEN) sock.send(bytes)
  }

  wss.on('connection', (sock) => {
    sock.binaryType = 'arraybuffer'
    sock.on('message', (data) => {
      const bytes = toBytes(data)
      let msg
      try {
        msg = decodeClient(bytes)
      } catch {
        return
      }
      const joined = sockets.get(sock)
      if (msg.type === 'hello') {
        if (joined !== undefined) return
        if (msg.version !== NET.protocolVersion) {
          sock.send(encodeReject(RejectReason.Version))
          sock.close()
          return
        }
        if (msg.physicsHash !== hash) {
          sock.send(encodeReject(RejectReason.Physics))
          sock.close()
          return
        }
        if (show.full) {
          sock.send(encodeReject(RejectReason.Full))
          sock.close()
          return
        }
        const player = show.addPlayer()
        sockets.set(sock, player.id)
        sock.send(
          encodeWelcome({
            playerId: player.id,
            serverTick: show.tick,
            physicsHash: hash,
            colourIndex: player.colourIndex,
            adj: player.adj,
            noun: player.noun,
            num: player.num,
            spawnIndex: player.spawnIndex,
          }),
        )
        console.log(`[show] bean ${player.id} joined (${show.players.size} in the gauntlet)`)
        return
      }
      if (joined === undefined) return
      if (msg.type === 'input') show.pushInputs(joined, msg.frames)
      else if (msg.type === 'ping') sock.send(encodePong(msg.clientTimeMs, show.tick))
      else if (msg.type === 'event') show.pushClientEvent(joined, msg.kind, msg.code)
    })
    sock.on('close', () => {
      const id = sockets.get(sock)
      sockets.delete(sock)
      if (id !== undefined) {
        show.removePlayer(id)
        console.log(`[show] bean ${id} left (${show.players.size} remaining)`)
      }
    })
  })

  await new Promise<void>((resolve) => {
    http.listen(port, '0.0.0.0', () => resolve())
  })

  const address = http.address()
  const bound = typeof address === 'object' && address ? address.port : port

  let running = true
  let acc = 0
  let last = performance.now()
  const timer = setInterval(() => {
    if (!running) return
    const now = performance.now()
    acc += now - last
    last = now
    if (acc > 100) acc = 100
    while (acc >= 20) {
      const step = show.step()
      acc -= 20
      if (step.snapshots) {
        for (const [sock, id] of sockets) {
          const bytes = step.snapshots.get(id)
          if (bytes) sendSnap(sock, bytes)
        }
      }
      for (const ev of step.events) {
        for (const sock of sockets.keys()) sendSnap(sock, ev)
      }
    }
  }, 5)

  console.log(`[show] listening on ${bound} (50 Hz, physics ${hash.toString(16)})`)

  return {
    port: bound,
    show,
    close: async () => {
      running = false
      clearInterval(timer)
      for (const sock of sockets.keys()) sock.close()
      await new Promise<void>((resolve) => wss.close(() => resolve()))
      await new Promise<void>((resolve) => http.close(() => resolve()))
      world.destroy()
    },
  }
}

function toBytes(data: unknown): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
  if (typeof data === 'string') return new TextEncoder().encode(data)
  return new Uint8Array()
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  startShowServer(Number(process.env.PORT ?? NET.devServerPort)).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
