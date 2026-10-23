import * as THREE from 'three'
import { assetUrl } from '../assets/load'

const MAX = 280

interface Spark {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  size: number
  r: number
  g: number
  b: number
}

/**
 * Confetti, dust and splash. One point cloud, no per-spark objects,
 * so a crowd of beans stays cheap.
 */
export class PartyVfx {
  readonly points: THREE.Points
  private readonly sparks: Spark[] = []
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private tex: THREE.Texture | null = null

  constructor() {
    this.positions = new Float32Array(MAX * 3)
    this.colors = new Float32Array(MAX * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    void new THREE.TextureLoader().loadAsync(assetUrl('vfx/star_06.png')).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      mat.map = tex
      mat.needsUpdate = true
      this.tex = tex
    })
  }

  dust(x: number, y: number, z: number): void {
    this.burst(x, y + 0.05, z, '#f2e6c9', 2, 1.2, 0.35)
  }

  splash(x: number, y: number, z: number): void {
    this.burst(x, y + 0.2, z, '#22c3e6', 10, 3.5, 0.55)
  }

  confetti(x: number, y: number, z: number): void {
    this.burst(x, y + 1.2, z, '#e8336b', 8, 4.2, 0.9)
    this.burst(x, y + 1.2, z, '#22c3e6', 8, 4.2, 0.9)
    this.burst(x, y + 1.2, z, '#9be15d', 6, 3.6, 0.9)
    this.burst(x, y + 1.2, z, '#ffb627', 6, 3.6, 0.9)
  }

  burst(x: number, y: number, z: number, hex: string, count: number, speed: number, life: number): void {
    const color = new THREE.Color(hex)
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= MAX) this.sparks.shift()
      const yaw = Math.random() * Math.PI * 2
      const lift = 0.4 + Math.random()
      this.sparks.push({
        x, y, z,
        vx: Math.cos(yaw) * speed * (0.3 + Math.random()),
        vy: lift * speed,
        vz: Math.sin(yaw) * speed * (0.3 + Math.random()),
        life,
        max: life,
        size: 1,
        r: color.r,
        g: color.g,
        b: color.b,
      })
    }
  }

  update(dt: number): void {
    const pos = this.positions
    const col = this.colors
    let n = 0
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!
      s.life -= dt
      if (s.life <= 0) {
        this.sparks.splice(i, 1)
        continue
      }
      s.vy -= 6 * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.z += s.vz * dt
      const fade = s.life / s.max
      pos[n * 3] = s.x
      pos[n * 3 + 1] = s.y
      pos[n * 3 + 2] = s.z
      col[n * 3] = s.r * fade
      col[n * 3 + 1] = s.g * fade
      col[n * 3 + 2] = s.b * fade
      n += 1
    }
    for (let i = n; i < MAX; i++) {
      pos[i * 3 + 1] = -100
    }
    const geo = this.points.geometry
    ;(geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
    void this.tex
  }
}
