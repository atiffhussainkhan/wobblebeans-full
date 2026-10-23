import * as THREE from 'three'
import {
  Locomotion,
  clipSlotFor,
  faceFor,
  keyBonePose,
  type BeanState,
} from '@wobblebeans/shared'
import { addShake, cueHaptic, flashesOn } from './feel'
import { clipsReady, sampleSlot, warmupClips, type RigPose } from './retarget'

export interface BeanPalette {
  upper: string
  lower: string
  ink: string
}

type PoseState = Pick<BeanState, 'yaw' | 'vx' | 'vy' | 'vz' | 'locomotion' | 'grounded'> & {
  stateTime?: number
  getUpBack?: boolean
  emoteId?: number
}

/**
 * Placeholder bean: a 1.6 m capsule split at the waist.
 * Upper costume hangs off spine_02, lower off the pelvis (doc 03 §3.1).
 * KayKit and Quaternius clips are retargeted as deltas from their idle pose.
 * If a clip is missing, the procedural wobble remains.
 */
export class BeanView {
  readonly group = new THREE.Group()
  private readonly pelvis = new THREE.Group()
  private readonly spine = new THREE.Group()
  private readonly spine2 = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly armL = new THREE.Group()
  private readonly armR = new THREE.Group()
  private readonly legL = new THREE.Group()
  private readonly legR = new THREE.Group()
  private readonly smile: THREE.Mesh
  private readonly stars: THREE.Sprite
  private readonly label: THREE.Sprite
  private bob = 0
  private lean = 0
  private clipTime = 0
  private clipId = ''
  private overlay: { id: string; left: number } | null = null
  private prev: Locomotion = Locomotion.Idle
  private prevYaw = 0
  private scratch = new THREE.Quaternion()
  private euler = new THREE.Euler()

  constructor(palette: BeanPalette, name: string) {
    warmupClips()
    this.group.name = 'bean-root'
    this.pelvis.name = 'pelvis'
    this.pelvis.position.y = 0.8
    this.group.add(this.pelvis)

    const lowerMat = new THREE.MeshToonMaterial({ color: palette.lower })
    const upperMat = new THREE.MeshToonMaterial({ color: palette.upper })
    const inkMat = new THREE.MeshToonMaterial({ color: palette.ink })
    const white = new THREE.MeshToonMaterial({ color: '#fffdf7' })

    const lower = new THREE.Group()
    lower.name = 'lowerCostume'
    this.pelvis.add(lower)
    lower.add(mesh(new THREE.SphereGeometry(0.48, 18, 14), lowerMat, 0, -0.28, 0))
    lower.add(mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.34, 18), lowerMat, 0, -0.08, 0))

    this.spine.name = 'spine_01'
    this.pelvis.add(this.spine)
    this.spine2.name = 'spine_02'
    this.spine.add(this.spine2)
    const upper = new THREE.Group()
    upper.name = 'upperCostume'
    this.spine2.add(upper)
    upper.add(mesh(new THREE.CylinderGeometry(0.48, 0.5, 0.32, 18), upperMat, 0, 0.22, 0))
    upper.add(mesh(new THREE.SphereGeometry(0.48, 18, 14), upperMat, 0, 0.36, 0))

    this.head.name = 'head'
    this.head.position.y = 0.42
    this.spine2.add(this.head)
    const eyeGeo = new THREE.SphereGeometry(0.09, 12, 10)
    const pupilGeo = new THREE.SphereGeometry(0.045, 10, 8)
    for (const side of [-1, 1]) {
      this.head.add(mesh(eyeGeo, white, 0.16 * side, 0.08, 0.36))
      this.head.add(mesh(pupilGeo, inkMat, 0.16 * side, 0.07, 0.44))
    }
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 14, Math.PI), inkMat)
    this.smile.position.set(0, -0.06, 0.4)
    this.smile.rotation.x = Math.PI
    this.smile.rotation.z = Math.PI
    this.head.add(this.smile)

    this.armL.name = 'arm_L'
    this.armR.name = 'arm_R'
    this.armL.position.set(-0.52, 0.28, 0)
    this.armR.position.set(0.52, 0.28, 0)
    this.spine2.add(this.armL, this.armR)
    const socket = new THREE.Group()
    socket.name = 'hand_r_socket'
    socket.position.set(0, -0.42, 0.05)
    this.armR.add(socket)
    const armGeo = new THREE.CapsuleGeometry(0.09, 0.28, 4, 8)
    this.armL.add(mesh(armGeo, upperMat, 0, -0.22, 0))
    this.armR.add(mesh(armGeo, upperMat, 0, -0.22, 0))

    this.legL.name = 'leg_L'
    this.legR.name = 'leg_R'
    this.legL.position.set(-0.18, -0.34, 0)
    this.legR.position.set(0.18, -0.34, 0)
    this.pelvis.add(this.legL, this.legR)
    const legGeo = new THREE.CapsuleGeometry(0.1, 0.22, 4, 8)
    this.legL.add(mesh(legGeo, lowerMat, 0, -0.2, 0))
    this.legR.add(mesh(legGeo, lowerMat, 0, -0.2, 0))

    this.stars = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: '#ffe56b',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    )
    this.stars.position.set(0, 0.55, 0)
    this.stars.scale.set(0.7, 0.7, 0.7)
    this.head.add(this.stars)
    void loadStar(this.stars)

    this.label = makeLabel(name, palette.ink)
    this.label.position.y = 1.95
    this.group.add(this.label)
    this.group.traverse((obj) => {
      const meshObj = obj as THREE.Mesh
      if (meshObj.isMesh) {
        meshObj.castShadow = true
        meshObj.receiveShadow = true
      }
    })
  }

  setName(name: string, ink: string): void {
    const tex = drawLabel(name, ink)
    const mat = this.label.material as THREE.SpriteMaterial
    mat.map?.dispose()
    mat.map = tex
    mat.needsUpdate = true
  }

  /** Remote names stay hidden until Show names is held. The local bean ignores this. */
  setNameVisible(visible: boolean): void {
    this.label.visible = visible
  }

  triggerEmote(id: number): void {
    this.overlay = { id: id === 2 ? 'emote_cheer' : id === 3 ? 'emote_dance' : 'emote_wave', left: 1.6 }
  }

  /**
   * `feet` is the visual position (capsule centre minus 0.8 m), already smoothed.
   */
  update(feet: THREE.Vector3, state: PoseState, dt: number, showName = true): void {
    this.noteTransition(state.locomotion)
    this.group.position.copy(feet)
    this.group.rotation.y = state.yaw
    if (!showName) this.label.visible = false
    const speed = Math.hypot(state.vx, state.vz)
    this.bob += dt * (4 + speed * 0.8)
    const slot = this.overlay?.id ?? clipSlotFor(state)
    if (slot !== this.clipId) {
      this.clipId = slot
      this.clipTime = 0
    }
    this.clipTime += dt
    if (this.overlay) {
      this.overlay.left -= dt
      if (this.overlay.left <= 0) this.overlay = null
    }

    const pose = clipsReady() ? sampleSlot(this.clipId, this.clipTime) : null
    if (pose) this.applyClip(pose, state, dt, speed)
    else this.procedural(state, speed, dt)

    this.applyFace(state.locomotion)
    this.applyStars(state.locomotion)
    const turn = Math.atan2(Math.sin(state.yaw - this.prevYaw), Math.cos(state.yaw - this.prevYaw))
    this.prevYaw = state.yaw
    if (state.locomotion === Locomotion.Run) {
      this.spine.rotateZ(THREE.MathUtils.clamp(-turn * 2.2, -0.25, 0.25))
    }
    const stretch = THREE.MathUtils.clamp(state.vy * 0.035, -0.18, 0.22)
    this.group.scale.set(1 - stretch * 0.45, 1 + stretch, 1 - stretch * 0.45)
    this.prev = state.locomotion
  }

  private applyClip(pose: RigPose, state: PoseState, dt: number, speed: number): void {
    const k = 1 - Math.exp(-12 * dt)
    const tumble = state.locomotion === Locomotion.Ragdoll || state.locomotion === Locomotion.GetUp
    if (tumble) {
      const bones = keyBonePose({
        ...state,
        px: 0,
        py: 0,
        pz: 0,
        vy: state.vy,
        grounded: state.grounded,
        locomotion: state.locomotion,
        stateTime: state.stateTime ?? 0,
        getUpBack: state.getUpBack,
      } as BeanState)
      this.euler.set(bones.pelvis.pitch, bones.pelvis.yaw, bones.pelvis.roll)
      this.scratch.setFromEuler(this.euler)
      this.pelvis.quaternion.slerp(this.scratch, k)
      this.euler.set(bones.spine02.pitch, bones.spine02.yaw, bones.spine02.roll)
      this.scratch.setFromEuler(this.euler)
      this.spine.quaternion.slerp(this.scratch, k)
      this.euler.set(bones.head.pitch, bones.head.yaw, bones.head.roll)
      this.scratch.setFromEuler(this.euler)
      this.head.quaternion.slerp(this.scratch, k)
    } else {
      this.pelvis.quaternion.slerp(pose.pelvis, k)
      this.spine.quaternion.slerp(pose.spine, k)
      this.head.quaternion.slerp(pose.head, k)
    }
    this.armL.quaternion.slerp(pose.armL, k)
    this.armR.quaternion.slerp(pose.armR, k)
    if (pose.legs) {
      this.legL.quaternion.slerp(pose.legL, k)
      this.legR.quaternion.slerp(pose.legR, k)
    } else {
      this.swingLegs(state, speed)
    }
    const wobble = Math.sin(this.bob) * Math.min(0.08, speed * 0.012)
    this.spine.rotateZ(wobble)
    this.pelvis.position.y = 0.8 + pose.bob
  }

  private procedural(state: PoseState, speed: number, _dt: number): void {
    this.pelvis.quaternion.identity()
    this.spine.quaternion.identity()
    this.head.quaternion.identity()
    this.armL.quaternion.identity()
    this.armR.quaternion.identity()
    const swing = Math.sin(this.bob) * Math.min(1, speed / 9) * 0.7
    const diving = state.locomotion === Locomotion.Dive || state.locomotion === Locomotion.DiveSlide
    const airborne =
      state.locomotion === Locomotion.Jump || state.locomotion === Locomotion.Fall || state.locomotion === Locomotion.Dive
    const cheering = state.locomotion === Locomotion.Emote
    this.armL.rotation.x = diving ? 0.4 : airborne ? -0.8 : swing
    this.armR.rotation.x = diving ? 0.4 : airborne ? -0.8 : cheering ? -2.2 : -swing
    this.swingLegs(state, speed)
    const targetLean = diving ? 1.15 : THREE.MathUtils.clamp(-state.vz * 0.03, -0.25, 0.25)
    this.lean += (targetLean - this.lean) * 0.35
    this.spine.rotation.x = this.lean
    this.pelvis.rotation.z = Math.sin(this.bob * 0.5) * Math.min(0.08, speed * 0.01)
    if (state.locomotion === Locomotion.Ragdoll || state.locomotion === Locomotion.GetUp) {
      const bones = keyBonePose({
        yaw: state.yaw,
        vx: state.vx,
        vy: state.vy,
        vz: state.vz,
        locomotion: state.locomotion,
        grounded: state.grounded,
        stateTime: state.stateTime ?? 0,
        getUpBack: state.getUpBack,
      } as BeanState)
      this.pelvis.rotation.x = bones.pelvis.pitch
      this.spine.rotation.x = bones.spine02.pitch
      this.head.rotation.z = bones.head.roll
    }
    this.pelvis.position.y = 0.8
  }

  private swingLegs(state: PoseState, speed: number): void {
    const swing = Math.sin(this.bob) * Math.min(1, speed / 9) * 0.7
    const diving = state.locomotion === Locomotion.Dive || state.locomotion === Locomotion.DiveSlide
    const airborne = state.locomotion === Locomotion.Jump || state.locomotion === Locomotion.Fall
    this.legL.rotation.set(0, 0, 0)
    this.legR.rotation.set(0, 0, 0)
    this.legL.rotation.x = diving ? 0.5 : airborne ? 0.3 : -swing
    this.legR.rotation.x = diving ? 0.5 : airborne ? -0.2 : swing
  }

  private applyFace(loco: Locomotion): void {
    const face = faceFor(loco)
    const open = face === 'face_surprised' ? 1.25 : face === 'face_dizzy' ? 0.7 : face === 'face_effort' ? 0.85 : 1
    this.smile.scale.set(1, open, 1)
  }

  private applyStars(loco: Locomotion): void {
    const mat = this.stars.material as THREE.SpriteMaterial
    const on = (loco === Locomotion.Ragdoll || loco === Locomotion.GetUp) && flashesOn()
    const pulse = 0.55 + Math.sin(this.bob * 2) * 0.2
    mat.opacity = on ? pulse : 0
    this.stars.position.y = 0.55 + Math.sin(this.bob) * 0.05
  }

  private noteTransition(next: Locomotion): void {
    if (next === this.prev) return
    if (next === Locomotion.Jump) cueHaptic('light')
    if (next === Locomotion.Dive) cueHaptic('medium')
    if (next === Locomotion.Stumble) {
      cueHaptic('medium')
      addShake(0.05)
      this.overlay = { id: 'land_hard', left: 0.35 }
    }
    if (next === Locomotion.Ragdoll) {
      cueHaptic('strong')
      addShake(0.15)
    }
    if (next === Locomotion.GetUp) cueHaptic('light')
    if (next === Locomotion.Grab) {
      cueHaptic('medium')
      this.overlay = { id: 'grab_reach', left: 0.22 }
    }
    if (this.prev === Locomotion.Grab && next !== Locomotion.Grab && next !== Locomotion.Climb) {
      this.overlay = { id: 'grab_throw', left: 0.35 }
    }
    if (
      (this.prev === Locomotion.Fall || this.prev === Locomotion.Jump) &&
      (next === Locomotion.Idle || next === Locomotion.Run)
    ) {
      cueHaptic('light')
      this.overlay = { id: 'land_soft', left: 0.16 }
    }
    if (next === Locomotion.Idle && this.prev === Locomotion.Ragdoll) {
      this.overlay = { id: 'respawn_pop', left: 0.3 }
    }
  }
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  return m
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

async function loadStar(sprite: THREE.Sprite): Promise<void> {
  try {
    const tex = await new THREE.TextureLoader().loadAsync('/assets/vfx/star_06.png')
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = sprite.material as THREE.SpriteMaterial
    mat.map = tex
    mat.needsUpdate = true
  } catch {
    // Stars stay a tinted sprite if the texture is missing.
  }
}
