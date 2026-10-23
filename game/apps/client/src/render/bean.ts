import * as THREE from 'three'
import { Locomotion, type BeanState } from '@wobblebeans/shared'

export interface BeanPalette {
  upper: string
  lower: string
  ink: string
}

/**
 * Placeholder bean: a 1.6 m capsule split at the waist.
 * Upper costume hangs off spine_02, lower off the pelvis, matching the
 * rig split in docs/design/03-character-controls.md §3.1. Procedural wobble
 * only — clip retarget is a later workstream.
 */
export class BeanView {
  readonly group = new THREE.Group()
  private readonly pelvis = new THREE.Group()
  private readonly spine = new THREE.Group()
  private readonly armL = new THREE.Group()
  private readonly armR = new THREE.Group()
  private readonly legL = new THREE.Group()
  private readonly legR = new THREE.Group()
  private readonly label: THREE.Sprite
  private bob = 0
  private lean = 0
  private emote = 0
  private emoteTime = 0

  constructor(palette: BeanPalette, name: string) {
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
    const spine2 = new THREE.Group()
    spine2.name = 'spine_02'
    this.spine.add(spine2)
    const upper = new THREE.Group()
    upper.name = 'upperCostume'
    spine2.add(upper)
    upper.add(mesh(new THREE.CylinderGeometry(0.48, 0.5, 0.32, 18), upperMat, 0, 0.22, 0))
    upper.add(mesh(new THREE.SphereGeometry(0.48, 18, 14), upperMat, 0, 0.36, 0))

    const head = new THREE.Group()
    head.name = 'head'
    head.position.y = 0.42
    spine2.add(head)
    const eyeGeo = new THREE.SphereGeometry(0.09, 12, 10)
    const pupilGeo = new THREE.SphereGeometry(0.045, 10, 8)
    for (const side of [-1, 1]) {
      head.add(mesh(eyeGeo, white, 0.16 * side, 0.08, 0.36))
      head.add(mesh(pupilGeo, inkMat, 0.16 * side, 0.07, 0.44))
    }
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.025, 8, 14, Math.PI),
      inkMat,
    )
    smile.position.set(0, -0.06, 0.4)
    smile.rotation.x = Math.PI
    smile.rotation.z = Math.PI
    head.add(smile)

    this.armL.name = 'arm_L'
    this.armR.name = 'arm_R'
    this.armL.position.set(-0.52, 0.28, 0)
    this.armR.position.set(0.52, 0.28, 0)
    spine2.add(this.armL, this.armR)
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

  triggerEmote(id: number): void {
    this.emote = id
    this.emoteTime = 0
  }

  /**
   * `feet` is the visual position (capsule centre minus 0.8 m), already smoothed.
   */
  update(feet: THREE.Vector3, state: Pick<BeanState, 'yaw' | 'vx' | 'vy' | 'vz' | 'locomotion' | 'grounded'>, dt: number): void {
    this.group.position.copy(feet)
    this.group.rotation.y = state.yaw
    const speed = Math.hypot(state.vx, state.vz)
    this.bob += dt * (4 + speed * 0.8)
    const swing = Math.sin(this.bob) * Math.min(1, speed / 9) * 0.7
    const diving = state.locomotion === Locomotion.Dive || state.locomotion === Locomotion.DiveSlide
    const airborne = state.locomotion === Locomotion.Jump || state.locomotion === Locomotion.Fall || state.locomotion === Locomotion.Dive

    this.emoteTime += dt
    if (this.emoteTime > 1.6) this.emote = 0
    let armWave = 0
    if (this.emote === 1) armWave = Math.sin(this.emoteTime * 10) * 0.8
    if (this.emote === 2) armWave = 1.2 + Math.sin(this.emoteTime * 14) * 0.4
    if (this.emote === 3) {
      this.group.rotation.y += Math.sin(this.emoteTime * 8) * 0.25
      armWave = Math.sin(this.emoteTime * 12) * 1.1
    }

    this.armL.rotation.x = diving ? 0.4 : airborne ? -0.8 : swing + armWave
    this.armR.rotation.x = diving ? 0.4 : airborne ? -0.8 : -swing + (this.emote === 1 ? 0 : armWave)
    if (this.emote === 1) this.armR.rotation.x = -2.2 + armWave
    this.legL.rotation.x = diving ? 0.5 : airborne ? 0.3 : -swing
    this.legR.rotation.x = diving ? 0.5 : airborne ? -0.2 : swing

    const targetLean = diving ? 1.15 : THREE.MathUtils.clamp(-state.vz * 0.03, -0.25, 0.25)
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 8)
    this.spine.rotation.x = this.lean
    this.pelvis.rotation.z = Math.sin(this.bob * 0.5) * Math.min(0.08, speed * 0.01)

    const stretch = THREE.MathUtils.clamp(state.vy * 0.035, -0.18, 0.22)
    this.group.scale.set(1 - stretch * 0.45, 1 + stretch, 1 - stretch * 0.45)
    if (!state.grounded && !airborne) this.group.scale.y = 1
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
