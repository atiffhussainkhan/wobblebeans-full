import * as THREE from 'three'
import {
  BeanWorld,
  CAPSULE_CENTER,
  NET,
  PredictedBean,
  colourForSlot,
  decodeServer,
  encodeHello,
  encodeInput,
  encodePing,
  formatDisplayName,
  physicsHash,
  quickChatText,
  type InputFrame,
  type SnapBean,
} from '@wobblebeans/shared'
import './style.css'
import { loadManifest } from './assets/load'
import { mountGauntletAudio } from './audio/session'
import { InputDevice } from './input'
import { BeanView } from './render/bean'
import { CourseView, loadSky } from './render/course'

const statusEl = document.querySelector<HTMLElement>('#status')!
const netEl = document.querySelector<HTMLElement>('#net')!
const rosterEl = document.querySelector<HTMLElement>('#roster')!
const bannerEl = document.querySelector<HTMLElement>('#banner')!
const bubbleEl = document.querySelector<HTMLElement>('#bubble')!
const meEl = document.querySelector<HTMLElement>('#me')!
const errorEl = document.querySelector<HTMLElement>('#error')!
const canvas = document.querySelector<HTMLCanvasElement>('#view')!

const serverUrl =
  import.meta.env.VITE_SERVER_URL ??
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:${NET.devServerPort}`

interface Ghost {
  view: BeanView
  samples: { t: number; snap: SnapBean }[]
  seen: number
}

const ghosts = new Map<number, Ghost>()
const keys = new InputDevice()
/** Workstream 6: locomotion and net events go through this bus. main.ts does not own playback. */
const ears = mountGauntletAudio()
const camForward = new THREE.Vector3()
let world: BeanWorld | null = null
let predicted: PredictedBean | null = null
let socket: WebSocket | null = null
let myId = 0
let myName = ''
let stepsSinceSend = 0
let pingSentAt = 0
let pingRtt = 0
let bubbleUntil = 0
let simAcc = 0
let lastFrame = performance.now()
let serverTickEstimate = 0
let sawSnapshot = false

const offset = new THREE.Vector3()
const feet = new THREE.Vector3()
const look = new THREE.Vector3()

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
scene.background = new THREE.Color('#BFE6FF')
scene.fog = new THREE.Fog('#BFE6FF', 28, 78)

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200)
scene.add(new THREE.HemisphereLight('#fff4dd', '#6B4A3A', 1.1))
const sun = new THREE.DirectionalLight('#fff7e8', 2.1)
sun.position.set(12, 22, 8)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 60
sun.shadow.camera.left = -20
sun.shadow.camera.right = 20
sun.shadow.camera.top = 20
sun.shadow.camera.bottom = -20
scene.add(sun)

const course = new CourseView()
scene.add(course.group)
void loadSky(scene)
void course.addDressing()
void loadManifest().catch((err) => console.warn('asset manifest', err))

let localView: BeanView | null = null

keys.attach(canvas)
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

connect()
requestAnimationFrame(frame)

function connect(): void {
  setStatus('Warming up the show…')
  errorEl.hidden = true
  const ws = new WebSocket(serverUrl)
  ws.binaryType = 'arraybuffer'
  socket = ws
  ws.onopen = () => {
    netEl.textContent = 'In the show'
    ws.send(encodeHello(physicsHash()))
  }
  ws.onmessage = (ev) => {
    const buf = new Uint8Array(ev.data as ArrayBuffer)
    let msg
    try {
      msg = decodeServer(buf)
    } catch {
      return
    }
    if (msg.type === 'welcome') void onWelcome(msg.playerId, msg.serverTick, msg.spawnIndex, msg.adj, msg.noun, msg.num, msg.colourIndex)
    else if (msg.type === 'reject') showError(rejectCopy(msg.reason))
    else if (msg.type === 'snapshot') onSnapshot(msg.serverTick, msg.ackSeq, msg.beans)
    else if (msg.type === 'pong') {
      pingRtt = performance.now() - msg.clientTimeMs
      serverTickEstimate = msg.serverTick
      netEl.textContent = `${Math.round(pingRtt)} ms`
    } else if (msg.type === 'event') onEvent(msg.kind, msg.subjectId, msg.code)
  }
  ws.onclose = () => {
    if (socket !== ws) return
    predicted = null
    world?.destroy()
    world = null
    if (localView) {
      scene.remove(localView.group)
      localView = null
    }
    ears.onDrop()
    setStatus('The show dropped. Reconnecting…')
    window.setTimeout(connect, 1000)
  }
  ws.onerror = () => {
    showError('Could not reach the show server. Is `pnpm dev` running?')
  }
}

async function onWelcome(
  playerId: number,
  serverTick: number,
  spawnIndex: number,
  adj: number,
  noun: number,
  num: number,
  colourIndex: number,
): Promise<void> {
  world?.destroy()
  world = await BeanWorld.create()
  world.spawn(playerId, spawnIndex)
  world.tick = serverTick
  predicted = new PredictedBean(world, playerId)
  myId = playerId
  myName = formatDisplayName(adj, noun, num)
  const palette = colourForSlot(colourIndex)
  if (localView) scene.remove(localView.group)
  localView = new BeanView(palette, myName)
  scene.add(localView.group)
  meEl.textContent = myName
  setStatus('Gauntlet is live. Open another tab to bring a friend.')
  ears.onWelcome()
  serverTickEstimate = serverTick
}

function onSnapshot(serverTick: number, ackSeq: number, beans: SnapBean[]): void {
  if (!predicted || !world) return
  sawSnapshot = true
  serverTickEstimate = serverTick
  const now = performance.now()
  const seen = new Set<number>()
  for (const bean of beans) {
    seen.add(bean.id)
    if (bean.id === myId) {
      const before = predicted.state
      const err = predicted.reconcile(serverTick, ackSeq, bean)
      const after = predicted.state
      if (err > NET.correctionSnapM) offset.set(0, 0, 0)
      else if (err > NET.correctionSmoothM) {
        offset.x += before.px - after.px
        offset.y += before.py - after.py
        offset.z += before.pz - after.pz
      }
      if (after.finished) {
        bannerEl.hidden = false
        bannerEl.textContent = 'You made it!'
      }
      continue
    }
    let ghost = ghosts.get(bean.id)
    if (!ghost) {
      const palette = colourForSlot(bean.colourIndex)
      const view = new BeanView(palette, formatDisplayName(bean.adj, bean.noun, bean.num))
      scene.add(view.group)
      ghost = { view, samples: [], seen: now }
      ghosts.set(bean.id, ghost)
    }
    ghost.seen = now
    ghost.samples.push({ t: now, snap: bean })
    if (ghost.samples.length > 30) ghost.samples.shift()
  }
  renderRoster(beans)
  for (const [id, ghost] of ghosts) {
    if (!seen.has(id) && now - ghost.seen > 1500) {
      scene.remove(ghost.view.group)
      ghosts.delete(id)
    }
  }
}

function onEvent(kind: number, subjectId: number, code: number): void {
  const self = subjectId === myId
  const samples = self ? undefined : ghosts.get(subjectId)?.samples
  const snap = samples && samples.length ? samples[samples.length - 1]?.snap : undefined
  ears.onSocial(kind, subjectId, code, self, snap ? { x: snap.px, y: snap.py, z: snap.pz } : undefined)
  if (kind === 1) {
    const text = quickChatText(code)
    if (!text) return
    const name = subjectId === myId ? myName : ghostName(subjectId)
    bubbleEl.hidden = false
    bubbleEl.textContent = `${name}: ${text}`
    bubbleUntil = performance.now() + 2000
  }
  if (kind === 2) {
    if (subjectId === myId) localView?.triggerEmote(code)
    else ghosts.get(subjectId)?.view.triggerEmote(code)
  }
}

function frame(now: number): void {
  requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - lastFrame) / 1000)
  lastFrame = now
  simAcc += dt
  let simTick = world?.tick ?? serverTickEstimate
  while (simAcc >= NET.tickHz ** -1 && predicted && world) {
    simAcc -= 1 / NET.tickHz
    const sample = keys.sample(1 / NET.tickHz)
    const frameInput: InputFrame = {
      seq: predicted.nextSeq(),
      tick: world.tick,
      moveX: sample.moveX,
      moveZ: sample.moveZ,
      jump: sample.jump,
      dive: sample.dive,
      camYaw: sample.camYaw,
      quickChat: sample.quickChat,
      emote: sample.emote,
    }
    ears.beforeStep(predicted.state)
    predicted.push(frameInput)
    ears.afterStep(predicted.state)
    simTick = world.tick
    stepsSinceSend += 1
    if (stepsSinceSend >= NET.tickHz / NET.inputPacketHz) {
      stepsSinceSend = 0
      const frames = predicted.recentFrames()
      if (socket?.readyState === WebSocket.OPEN && frames.length) socket.send(encodeInput(frames))
    }
  }
  if (!predicted) keys.sample(dt)

  const decay = Math.exp(-dt / (NET.correctionSmoothMs / 1000))
  offset.multiplyScalar(decay)
  if (offset.lengthSq() < 1e-6) offset.set(0, 0, 0)

  course.update(simTick)

  if (predicted && localView) {
    const state = predicted.state
    feet.set(state.px + offset.x, state.py - CAPSULE_CENTER + offset.y, state.pz + offset.z)
    localView.update(feet, state, dt)
    aimCamera(feet, dt)
  } else {
    camera.position.set(0, 6, -8)
    camera.lookAt(0, 1, 6)
  }

  const renderNow = performance.now()
  for (const ghost of ghosts.values()) {
    const pose = sampleGhost(ghost, renderNow)
    const gfeet = new THREE.Vector3(pose.px, pose.py - CAPSULE_CENTER, pose.pz)
    ghost.view.update(gfeet, pose, dt)
  }

  if (bubbleUntil && renderNow > bubbleUntil) {
    bubbleEl.hidden = true
    bubbleUntil = 0
  }
  camera.getWorldDirection(camForward)
  ears.setListener({
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    fx: camForward.x,
    fy: camForward.y,
    fz: camForward.z,
  })
  ears.frame(dt)

  if (socket?.readyState === WebSocket.OPEN && renderNow - pingSentAt > 1000) {
    pingSentAt = renderNow
    socket.send(encodePing(renderNow))
  }

  renderer.render(scene, camera)
}

function aimCamera(targetFeet: THREE.Vector3, _dt: number): void {
  const yaw = keys.camYaw
  const pitch = keys.camPitch
  const dist = 8.4
  look.set(targetFeet.x, targetFeet.y + 1.15, targetFeet.z)
  const horiz = dist * Math.cos(pitch)
  camera.position.set(
    look.x - Math.sin(yaw) * horiz,
    look.y + dist * Math.sin(pitch),
    look.z - Math.cos(yaw) * horiz,
  )
  camera.lookAt(look)
}

function sampleGhost(ghost: Ghost, now: number): SnapBean {
  const when = now - NET.interpDelayMs
  const buf = ghost.samples
  if (when <= buf[0]!.t) return buf[0]!.snap
  let i = 0
  while (i < buf.length - 1 && buf[i + 1]!.t < when) i += 1
  const a = buf[i]!
  const b = buf[i + 1]
  if (!b) {
    const extra = when - a.t
    if (extra > NET.extrapolateMaxMs) return a.snap
    const k = extra / 1000
    return { ...a.snap, px: a.snap.px + a.snap.vx * k, py: a.snap.py + a.snap.vy * k, pz: a.snap.pz + a.snap.vz * k }
  }
  const u = (when - a.t) / Math.max(1, b.t - a.t)
  return {
    ...b.snap,
    px: a.snap.px + (b.snap.px - a.snap.px) * u,
    py: a.snap.py + (b.snap.py - a.snap.py) * u,
    pz: a.snap.pz + (b.snap.pz - a.snap.pz) * u,
    yaw: lerpAngle(a.snap.yaw, b.snap.yaw, u),
  }
}

function renderRoster(beans: SnapBean[]): void {
  const rows = beans
    .map((b) => {
      const colour = colourForSlot(b.colourIndex).upper
      const name = b.id === myId ? `${formatDisplayName(b.adj, b.noun, b.num)} (you)` : formatDisplayName(b.adj, b.noun, b.num)
      return `<div class="row"><span class="swatch" style="background:${colour}"></span>${name}</div>`
    })
    .join('')
  const count = beans.length
  rosterEl.innerHTML = `<h2>${count === 1 ? '1 bean' : `${count} beans`}</h2>${rows}`
  if (sawSnapshot && count < 2) setStatus('Gauntlet is live. Open another tab to bring a friend.')
  else if (count >= 2) setStatus('Everyone here is on the same server.')
}

function ghostName(id: number): string {
  const ghost = ghosts.get(id)
  const snap = ghost?.samples[ghost.samples.length - 1]?.snap
  if (!snap) return 'Bean'
  return formatDisplayName(snap.adj, snap.noun, snap.num)
}

function setStatus(text: string): void {
  statusEl.textContent = text
}

function showError(text: string): void {
  errorEl.hidden = false
  errorEl.textContent = text
  ears.onError()
}

function rejectCopy(reason: number): string {
  if (reason === 2) return 'Physics config does not match the server. Refresh the page.'
  if (reason === 3) return 'This show is full. Try again in a moment.'
  return 'This client is out of date. Refresh the page.'
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}
