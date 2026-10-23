import * as THREE from 'three'
import {
  AUDIO,
  BeanWorld,
  CAPSULE_CENTER,
  EventKind,
  Locomotion,
  NET,
  PredictedBean,
  RoundStateCode,
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
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import './style.css'
import { loadManifest } from './assets/load'
import { InputDevice } from './input'
import { BeanView } from './render/bean'
import { CourseView, loadSky } from './render/course'
import { PartyVfx } from './render/vfx'

const statusEl = document.querySelector<HTMLElement>('#status')!
const netEl = document.querySelector<HTMLElement>('#net')!
const rosterEl = document.querySelector<HTMLElement>('#roster')!
const bannerEl = document.querySelector<HTMLElement>('#banner')!
const bubbleEl = document.querySelector<HTMLElement>('#bubble')!
const meEl = document.querySelector<HTMLElement>('#me')!
const errorEl = document.querySelector<HTMLElement>('#error')!
const announceEl = document.querySelector<HTMLElement>('#announce')!
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08

const scene = new THREE.Scene()
scene.background = new THREE.Color('#c5e8fb')
scene.fog = new THREE.Fog('#c5e8fb', 36, 92)

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 220)
scene.add(new THREE.HemisphereLight('#fff6e4', '#6b4a3a', 0.95))
const sun = new THREE.DirectionalLight('#fff4e2', 2.45)
sun.position.set(16, 28, 10)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.camera.near = 2
sun.shadow.camera.far = 70
sun.shadow.camera.left = -24
sun.shadow.camera.right = 24
sun.shadow.camera.top = 24
sun.shadow.camera.bottom = -24
sun.shadow.bias = -0.0004
scene.add(sun)
const rim = new THREE.DirectionalLight('#9adfff', 0.7)
rim.position.set(-14, 10, -8)
scene.add(rim)

const gl = renderer.getContext()
const gpuInfo = gl.getExtension('WEBGL_debug_renderer_info')
const gpuName = gpuInfo ? gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL) : ''
const softwareGpu = /SwiftShader|llvmpipe|softpipe/i.test(String(gpuName))
if (softwareGpu) {
  renderer.shadowMap.enabled = false
  sun.castShadow = false
}

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
  0.18,
  0.55,
  0.86,
)
if (!softwareGpu) composer.addPass(bloom)
composer.addPass(new OutputPass())
const vfx = new PartyVfx()
scene.add(vfx.points)

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
  composer.setSize(window.innerWidth, window.innerHeight)
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

let countdownUntil = 0
let celebrated = false

function onEvent(kind: number, subjectId: number, code: number): void {
  if (kind === EventKind.RoundState) {
    showRound(code)
    return
  }
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
    if (sample.jump) blip(AUDIO.jump)
    if (sample.dive) blip(AUDIO.dive)
    predicted.push(frameInput)
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
    const speed = Math.hypot(state.vx, state.vz)
    if (state.locomotion === Locomotion.Run && state.grounded && speed > 2 && Math.random() < 0.18) {
      vfx.dust(feet.x, feet.y, feet.z)
      void AUDIO.land
    }
    if (state.locomotion === Locomotion.Dive && Math.random() < 0.25) vfx.splash(feet.x, feet.y, feet.z)
    if (state.finished && !celebrated) {
      celebrated = true
      vfx.confetti(feet.x, feet.y, feet.z)
    }
    aimCamera(feet, state, dt)
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
  if (socket?.readyState === WebSocket.OPEN && renderNow - pingSentAt > 1000) {
    pingSentAt = renderNow
    socket.send(encodePing(renderNow))
  }
  if (countdownUntil) tickCountdown(renderNow)
  vfx.update(dt)
  if (softwareGpu) renderer.render(scene, camera)
  else composer.render()
}

const camPos = new THREE.Vector3(0, 6, -8)
const camLook = new THREE.Vector3(0, 1, 6)
let camReady = false

function aimCamera(targetFeet: THREE.Vector3, state: { vx: number; vz: number }, dt: number): void {
  const yaw = keys.camYaw
  const pitch = keys.camPitch
  const dist = 9.1
  const ahead = 1.6
  look.set(
    targetFeet.x + Math.sin(yaw) * ahead + state.vx * 0.08,
    targetFeet.y + 1.25,
    targetFeet.z + Math.cos(yaw) * ahead + state.vz * 0.08,
  )
  const horiz = dist * Math.cos(pitch)
  const desired = new THREE.Vector3(
    look.x - Math.sin(yaw) * horiz,
    look.y + dist * Math.sin(pitch) + 0.4,
    look.z - Math.cos(yaw) * horiz,
  )
  if (!camReady) {
    camPos.copy(desired)
    camLook.copy(look)
    camReady = true
  }
  const k = 1 - Math.exp(-dt * 5.5)
  camPos.lerp(desired, k)
  camLook.lerp(look, k)
  camera.position.copy(camPos)
  camera.lookAt(camLook)
}

function showRound(code: number): void {
  announceEl.hidden = false
  if (code === RoundStateCode.RoundIntro) announceEl.textContent = 'Get ready'
  else if (code === RoundStateCode.Countdown) {
    countdownUntil = performance.now() + 3000
    announceEl.textContent = '3'
  } else if (code === RoundStateCode.Go || code === RoundStateCode.Play) {
    countdownUntil = 0
    announceEl.textContent = 'GO!'
    window.setTimeout(() => {
      if (announceEl.textContent === 'GO!') announceEl.hidden = true
    }, 700)
  } else if (code === RoundStateCode.Outcome) announceEl.textContent = 'Nice run!'
}

function tickCountdown(now: number): void {
  const left = countdownUntil - now
  if (left <= 0) {
    countdownUntil = 0
    return
  }
  const n = Math.ceil(left / 1000)
  announceEl.hidden = false
  announceEl.textContent = String(Math.min(3, Math.max(1, n)))
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

/** Placeholder until the audio workstream wires a bus. Keeps the event id referenced. */
function blip(id: string): void {
  void id
}
