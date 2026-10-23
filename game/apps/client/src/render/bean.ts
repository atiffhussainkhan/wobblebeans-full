import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Locomotion, type BeanState } from '@wobblebeans/shared'
import { assetUrl } from '../assets/load'
import { outlineMaterial, toonMaterial } from './toon'

export interface BeanPalette {
  upper: string
  lower: string
  ink: string
}

type Pose = Pick<BeanState, 'yaw' | 'vx' | 'vy' | 'vz' | 'locomotion' | 'grounded'> & {
  stateTime?: number
  emoteId?: number
}

const RIG_URL = 'animations/KayKit_AnimatedCharacter_v1.2.glb'
const FIT = 1.6 / 1.65
const PLAY_CLIPS = new Set([
  'Idle',
  'Run',
  'Walk',
  'Jump',
  'Roll',
  'LayingDownIdle',
  'Defeat',
  'Hop',
  'Wave',
  'Cheer',
  'Dance',
])

let rigPromise: Promise<{ scene: THREE.Group; clips: THREE.AnimationClip[] }> | null = null

function loadRig(): Promise<{ scene: THREE.Group; clips: THREE.AnimationClip[] }> {
  if (!rigPromise) {
    const loader = new GLTFLoader()
    rigPromise = loader.loadAsync(assetUrl(RIG_URL)).then((gltf) => ({
      scene: gltf.scene,
      clips: gltf.animations,
    }))
  }
  return rigPromise
}

/**
 * Cute bean on the KayKit split rig (Body / Head / arms).
 * Clips from KayKit Character Animations 1.2 are played on that rig.
 * A procedural capsule shows until the rig arrives, and stays if the file fails.
 * Upper costume follows the head and arms. Lower costume follows the body.
 * Neither changes the physics capsule.
 */
export class BeanView {
  readonly group = new THREE.Group()
  private readonly fit = new THREE.Group()
  private readonly fallback: THREE.Group
  private mixer: THREE.AnimationMixer | null = null
  private readonly actions = new Map<string, THREE.AnimationAction>()
  private current = ''
  private clipPlaying = ''
  private emote = 0
  private emoteTime = 0
  private getup = 0
  private prevGrounded = true
  private prevLoco = Locomotion.Idle
  private squash = 1
  private bob = 0
  private readonly pupils: THREE.Object3D[] = []
  private readonly label: THREE.Sprite

  constructor(palette: BeanPalette, name: string) {
    this.group.name = 'bean-root'
    this.fit.name = 'bean-fit'
    this.group.add(this.fit)
    this.fallback = buildFallback(palette)
    this.fit.add(this.fallback)
    this.label = makeLabel(name, palette.ink)
    this.label.position.y = 2.05
    this.group.add(this.label)
    void this.attachRig(palette)
  }

  setName(name: string, ink: string): void {
    const tex = drawLabel(name, ink)
    const mat = this.label.material as THREE.SpriteMaterial
    mat.map?.dispose()
    mat.map = tex
    mat.needsUpdate = true
  }

  triggerEmote(id: number): void {
    this.emote = id
    this.emoteTime = 0
    const clip = id === 1 ? 'Wave' : id === 2 ? 'Cheer' : id === 3 ? 'Dance' : ''
    if (clip) this.play(clip, 0.12)
  }

  update(feet: THREE.Vector3, state: Pose, dt: number): void {
    this.group.position.copy(feet)
    this.group.rotation.y = state.yaw
    this.mixer?.update(dt)
    this.emoteTime += dt
    if (this.emote && this.emoteTime > 1.6) this.emote = 0
    if (this.getup > 0) this.getup = Math.max(0, this.getup - dt)

    const landed = state.grounded && !this.prevGrounded
    const tookOff = !state.grounded && this.prevGrounded
    this.prevGrounded = state.grounded
    if (landed) {
      this.squash = 0.82
      if (this.prevLoco === Locomotion.Dive || this.prevLoco === Locomotion.DiveSlide) this.getup = 0.42
    }
    if (tookOff) this.squash = 1.16
    this.prevLoco = state.locomotion
    const target = 1
    this.squash += (target - this.squash) * Math.min(1, dt * 8)
    const stretch = THREE.MathUtils.clamp(state.vy * 0.04, -0.16, 0.2)
    this.fit.scale.set(FIT * (1 - stretch * 0.35) * (2 - this.squash), FIT * this.squash * (1 + stretch), FIT * (1 - stretch * 0.35))

    if (!this.mixer) {
      this.bob += dt * 6
      const swing = Math.sin(this.bob) * 0.4
      const armL = this.fallback.getObjectByName('arm_L')
      const armR = this.fallback.getObjectByName('arm_R')
      if (armL) armL.rotation.x = swing
      if (armR) armR.rotation.x = -swing
      void state
      return
    }
    const busy = Math.hypot(state.vx, state.vz) > 0.5 || !state.grounded || state.locomotion === Locomotion.Dive || state.locomotion === Locomotion.DiveSlide
    if (busy) this.emote = 0
    if (this.getup > 0) this.playGetup()
    else if (this.emote === 1) this.play('Wave', 0.1)
    else if (this.emote === 2) this.play('Cheer', 0.1)
    else if (this.emote === 3) this.play('Dance', 0.1)
    else this.play(clipFor(state.locomotion), 0.18)

    const look = Math.atan2(state.vx, state.vz)
    for (const pupil of this.pupils) {
      pupil.position.x = Math.sin(look) * 0.02
      pupil.position.z = 0.06 + Math.cos(look) * 0.01
    }
  }

  private play(name: string, fade: number): void {
    if (this.current === name) return
    const next = this.actions.get(name)
    if (!next) return
    const prev = this.actions.get(this.clipPlaying)
    next.reset().setEffectiveWeight(1).fadeIn(fade).play()
    prev?.fadeOut(fade)
    this.current = name
    this.clipPlaying = name
  }

  /** Defeat rises off the floor in its last third. That slice is the get-up. */
  private playGetup(): void {
    if (this.current === 'Getup') return
    const next = this.actions.get('Defeat')
    if (!next) return
    const prev = this.actions.get(this.clipPlaying)
    next.reset()
    next.time = 0.58
    next.setEffectiveWeight(1).fadeIn(0.08).play()
    prev?.fadeOut(0.08)
    this.current = 'Getup'
    this.clipPlaying = 'Defeat'
  }

  private async attachRig(palette: BeanPalette): Promise<void> {
    try {
      const source = await loadRig()
      const rig = cloneSkinned(source.scene) as THREE.Object3D
      const host = rig.getObjectByProperty('type', 'SkinnedMesh') as THREE.SkinnedMesh | undefined
      if (!host?.parent) throw new Error('rig has no skinned mesh')
      host.visible = false
      const parts = beanGeometry()
      const pelvis = new THREE.Group()
      pelvis.name = 'pelvis'
      const spine = new THREE.Group()
      spine.name = 'spine_02'
      host.parent.add(pelvis)
      pelvis.add(spine)
      const wear = (geo: THREE.BufferGeometry, color: string, parent: THREE.Object3D) => {
        const mesh = new THREE.SkinnedMesh(geo, toonMaterial(color))
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.frustumCulled = false
        mesh.bind(host.skeleton, host.bindMatrix)
        parent.add(mesh)
        return mesh
      }
      wear(parts.lower, palette.lower, pelvis)
      wear(parts.upper, palette.upper, spine)
      const shell = new THREE.SkinnedMesh(parts.shell, outlineMaterial(palette.ink))
      shell.name = 'outline'
      shell.scale.setScalar(1.045)
      shell.castShadow = false
      shell.frustumCulled = false
      shell.bind(host.skeleton, host.bindMatrix)
      host.parent.add(shell)
      const head = rig.getObjectByName('Head')
      if (head) {
        addFace(head, palette, this.pupils, { y: 0.56, z: 0.34, spread: 0.14, eye: 0.1 })
        addSprout(head, palette)
      }
      this.mixer = new THREE.AnimationMixer(rig)
      for (const clip of source.clips) {
        if (!PLAY_CLIPS.has(clip.name)) continue
        const action = this.mixer.clipAction(clip)
        const loop = clip.name === 'Idle' || clip.name === 'Run' || clip.name === 'Walk' || clip.name === 'Dance' || clip.name === 'Wave' || clip.name === 'Cheer'
        if (loop) action.setLoop(THREE.LoopRepeat, Infinity)
        else {
          action.setLoop(THREE.LoopOnce, 1)
          action.clampWhenFinished = true
        }
        this.actions.set(clip.name, action)
      }
      this.play('Idle', 0)
      this.fit.add(rig)
      this.fallback.visible = false
    } catch (err) {
      console.warn('bean rig skipped', err)
    }
  }
}

/**
 * Rounded bean in the KayKit bind pose. Body bone drives the belly and feet.
 * Head bone drives the top. Arm bones drive the sleeves. The stock Pete mesh
 * is not drawn.
 */
function beanGeometry(): { upper: THREE.BufferGeometry; lower: THREE.BufferGeometry; shell: THREE.BufferGeometry } {
  const lowerParts = [
    stamp(shapedSphere(0.5, 0.78, 0.9, 0, 0.5, 0), 0),
    stamp(shapedSphere(0.17, 0.5, 1.25, -0.2, 0.1, 0.08), 0),
    stamp(shapedSphere(0.17, 0.5, 1.25, 0.2, 0.1, 0.08), 0),
  ]
  const upperParts = [
    stamp(shapedSphere(0.44, 0.92, 0.86, 0, 0.96, 0.02), 1),
    stamp(shapedSphere(0.4, 0.92, 0.9, 0, 1.28, 0.04), 1),
    stamp(capsuleBetween(new THREE.Vector3(0.34, 1.02, 0.02), new THREE.Vector3(0.58, 0.36, 0.06), 0.11), 2),
    stamp(capsuleBetween(new THREE.Vector3(-0.34, 1.02, 0.02), new THREE.Vector3(-0.58, 0.36, 0.06), 0.11), 4),
    stamp(new THREE.SphereGeometry(0.14, 12, 10).translate(0.6, 0.28, 0.08), 2),
    stamp(new THREE.SphereGeometry(0.14, 12, 10).translate(-0.6, 0.28, 0.08), 4),
  ]
  const lower = mergeGeometries(lowerParts, false)
  const upper = mergeGeometries(upperParts, false)
  const shell = mergeGeometries([...lowerParts, ...upperParts].map((geo) => geo.clone()), false)
  if (!lower || !upper || !shell) throw new Error('bean geometry failed')
  lower.computeVertexNormals()
  upper.computeVertexNormals()
  shell.computeVertexNormals()
  return { upper, lower, shell }
}

function shapedSphere(radius: number, sy: number, sz: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, 22, 16)
  geo.scale(1, sy, sz)
  geo.translate(x, y, z)
  return geo
}

function capsuleBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.BufferGeometry {
  const length = Math.max(0.05, a.distanceTo(b) - radius * 2)
  const geo = new THREE.CapsuleGeometry(radius, length, 5, 10)
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const dir = b.clone().sub(a).normalize()
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))
  geo.translate(mid.x, mid.y, mid.z)
  return geo
}

function stamp(geo: THREE.BufferGeometry, bone: number): THREE.BufferGeometry {
  const count = geo.getAttribute('position').count
  const skinIndex = new Uint16Array(count * 4)
  const skinWeight = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    skinIndex[i * 4] = bone
    skinWeight[i * 4] = 1
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4))
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4))
  return geo
}

function clipFor(locomotion: Locomotion): string {
  if (locomotion === Locomotion.Run) return 'Run'
  if (locomotion === Locomotion.Jump) return 'Jump'
  if (locomotion === Locomotion.Fall) return 'Jump'
  if (locomotion === Locomotion.Dive) return 'Roll'
  if (locomotion === Locomotion.DiveSlide) return 'LayingDownIdle'
  return 'Idle'
}

function buildFallback(palette: BeanPalette): THREE.Group {
  const root = new THREE.Group()
  root.name = 'fallback-bean'
  const upper = toonMaterial(palette.upper)
  const lower = toonMaterial(palette.lower)
  const ink = toonMaterial(palette.ink)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.55, 8, 16), upper)
  body.position.y = 0.85
  body.castShadow = true
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), lower)
  belly.position.y = 0.55
  belly.scale.y = 0.72
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.55, 6, 12), outlineMaterial())
  hull.position.y = 0.85
  hull.scale.setScalar(1.04)
  root.add(hull, belly, body)
  const armGeo = new THREE.CapsuleGeometry(0.09, 0.28, 4, 8)
  const armL = new THREE.Mesh(armGeo, upper)
  armL.name = 'arm_L'
  armL.position.set(-0.52, 1.05, 0)
  const armR = armL.clone()
  armR.name = 'arm_R'
  armR.position.x = 0.52
  root.add(armL, armR)
  addFace(root, palette, [], { y: 1.32, z: 0.42, spread: 0.16, eye: 0.1 })
  void ink
  return root
}

function addSprout(head: THREE.Object3D, palette: BeanPalette): void {
  const leaf = toonMaterial('#3dbb6b')
  const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 3, 6), leaf)
  stem.position.set(0, 1.02, -0.1)
  const left = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), leaf)
  left.position.set(-0.08, 1.12, -0.08)
  left.scale.set(1.15, 0.55, 0.75)
  left.rotation.z = 0.7
  const right = left.clone()
  right.position.x = 0.08
  right.rotation.z = -0.7
  const badge = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), toonMaterial('#fffdf7'))
  badge.scale.set(1.2, 1.2, 0.45)
  badge.position.set(0, 0.48, -0.34)
  const pip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), toonMaterial(palette.upper))
  pip.position.set(0, 0.48, -0.4)
  head.add(stem, left, right, badge, pip)
}

function addFace(
  parent: THREE.Object3D,
  palette: BeanPalette,
  pupils: THREE.Object3D[],
  place: { y: number; z: number; spread: number; eye: number },
): void {
  const white = toonMaterial('#fffdf7')
  const ink = toonMaterial(palette.ink)
  const blushMat = toonMaterial('#e8336b')
  blushMat.transparent = true
  blushMat.opacity = 0.55
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(place.eye, 16, 12), white)
    eye.position.set(place.spread * side, place.y, place.z)
    eye.scale.set(1.15, 1.28, 0.55)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(place.eye * 0.48, 12, 8), ink)
    pupil.position.set(0, -0.01, place.eye * 0.7)
    const catchlight = new THREE.Mesh(new THREE.SphereGeometry(place.eye * 0.18, 8, 6), white)
    catchlight.position.set(place.eye * 0.2, place.eye * 0.22, place.eye * 0.85)
    eye.add(pupil, catchlight)
    parent.add(eye)
    pupils.push(pupil)
    const blush = new THREE.Mesh(new THREE.SphereGeometry(place.eye * 0.55, 10, 8), blushMat)
    blush.position.set(place.spread * 1.7 * side, place.y - place.eye * 1.3, place.z - 0.02)
    blush.scale.set(1.3, 0.7, 0.4)
    parent.add(blush)
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(place.eye, place.eye * 0.2, 8, 14, Math.PI), ink)
  smile.position.set(0, place.y - place.eye * 1.7, place.z + 0.02)
  smile.rotation.x = Math.PI
  smile.rotation.z = Math.PI
  parent.add(smile)
}

function makeLabel(name: string, ink: string): THREE.Sprite {
  const map = drawLabel(name, ink)
  const mat = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(1.8, 0.45, 1)
  return sprite
}

function drawLabel(name: string, ink: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  ctx.clearRect(0, 0, 256, 64)
  ctx.fillStyle = '#fffdf7'
  roundRect(ctx, 4, 8, 248, 48, 16)
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#1f2140'
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.font = '700 28px Trebuchet MS, Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 128, 34)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
