import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { FOUNDATION_COURSE, moverOffset, type CourseBox, type CourseDef } from '@wobblebeans/shared'
import { loadGltf, loadTexture } from '../assets/load'
import { outlineMaterial, toonMaterial } from './toon'

const ROLE: Record<CourseBox['role'], string> = {
  oat: '#F2E6C9',
  mint: '#BFE8D2',
  cyan: '#22C3E6',
  cocoa: '#6B4A3A',
  orange: '#FF7A1A',
  lime: '#9BE15D',
  plum: '#7A2E8E',
}

const EDGE: Record<CourseBox['role'], string> = {
  oat: '#6B4A3A',
  mint: '#2F8F8A',
  cyan: '#1F2140',
  cocoa: '#1F2140',
  orange: '#1F2140',
  lime: '#3DBB6B',
  plum: '#1F2140',
}

export class CourseView {
  readonly group = new THREE.Group()
  private shuttle: THREE.Object3D | null = null
  private shuttleDef: CourseBox | null = null

  constructor(course: CourseDef = FOUNDATION_COURSE) {
    this.group.add(meadow())
    for (const def of course.boxes) {
      const mesh = toyBlock(def)
      if (def.mover) {
        this.shuttle = mesh
        this.shuttleDef = def
      }
      this.group.add(mesh)
    }
    this.group.add(finishFlag(course))
    void stripeTexture().then((tex) => {
      this.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.userData.hazard && mesh.material instanceof THREE.MeshToonMaterial) {
          mesh.material.map = tex
          mesh.material.needsUpdate = true
        }
      })
    })
  }

  update(tick: number): void {
    if (!this.shuttle || !this.shuttleDef?.mover) return
    const motion = this.shuttleDef.mover
    this.shuttle.position.x = this.shuttleDef.x + moverOffset(tick, motion.amplitude, motion.period)
  }

  async addDressing(): Promise<void> {
    const spots: { url: string; x: number; y: number; z: number; height: number; yaw?: number }[] = [
      { url: '/assets/obstacles/tree.glb', x: -6.2, y: 0, z: 1.2, height: 2.4 },
      { url: '/assets/obstacles/tree.glb', x: 6.4, y: 0, z: 4.5, height: 2.8, yaw: 0.6 },
      { url: '/assets/obstacles/tree.glb', x: -8.4, y: 0, z: 28, height: 3.1, yaw: 1.2 },
      { url: '/assets/obstacles/tree.glb', x: 8.6, y: 0, z: 34, height: 2.6 },
      { url: '/assets/obstacles/flowers.glb', x: -4.5, y: 0, z: 8, height: 0.6 },
      { url: '/assets/obstacles/flowers.glb', x: 4.8, y: 0, z: 7.2, height: 0.55 },
      { url: '/assets/obstacles/flowers.glb', x: 7.2, y: 0, z: 16, height: 0.5 },
      { url: '/assets/obstacles/hedge.glb', x: -6.5, y: 0.35, z: 20, height: 1.1 },
      { url: '/assets/obstacles/hedge.glb', x: 7.4, y: 0.35, z: 24, height: 1.15, yaw: 0.4 },
      { url: '/assets/obstacles/mushrooms.glb', x: -7.6, y: 0, z: 11, height: 0.7 },
      { url: '/assets/obstacles/cupcake.glb', x: 7.8, y: 0, z: 12.5, height: 1.15 },
      { url: '/assets/obstacles/donut-sprinkles.glb', x: -8.2, y: 0, z: 18, height: 0.7, yaw: 0.8 },
      { url: '/assets/obstacles/ice-cream.glb', x: 8.4, y: 0, z: 19.5, height: 1.3 },
      { url: '/assets/obstacles/lollypop.glb', x: -7.2, y: 0, z: 26, height: 1.5 },
      { url: '/assets/obstacles/heart.glb', x: 6.8, y: 1.6, z: 30, height: 0.55 },
      { url: '/assets/obstacles/windmill.glb', x: -9.2, y: 0, z: 36, height: 3.4 },
      { url: '/assets/obstacles/castle.glb', x: 9.4, y: 0, z: 46, height: 2.8 },
      { url: '/assets/obstacles/present-a-round.glb', x: -6.4, y: 1.5, z: 48, height: 0.7 },
      { url: '/assets/obstacles/flag.glb', x: 2.2, y: 1.5, z: 52, height: 2.2 },
      { url: '/assets/obstacles/star.glb', x: 0, y: 3.2, z: 51.5, height: 0.8 },
    ]
    await Promise.all(
      spots.map(async (spot) => {
        try {
          const gltf = await loadGltf(spot.url)
          const root = gltf.scene
          fitHeight(root, spot.height)
          const box = new THREE.Box3().setFromObject(root)
          root.position.set(spot.x, spot.y - box.min.y, spot.z)
          if (spot.yaw) root.rotation.y = spot.yaw
          root.traverse((obj) => {
            const mesh = obj as THREE.Mesh
            if (!mesh.isMesh) return
            mesh.castShadow = false
            mesh.receiveShadow = true
            const source = mesh.material
            const first = Array.isArray(source) ? source[0] : source
            const map = first && 'map' in first ? (first.map as THREE.Texture | null) : null
            mesh.material = toonMaterial('#ffffff', map)
          })
          this.group.add(root)
        } catch (err) {
          console.warn('prop skipped', spot.url, err)
        }
      }),
    )
  }
}

export async function loadSky(scene: THREE.Scene): Promise<void> {
  try {
    const tex = await loadTexture('/assets/backgrounds/skybox-day.png')
    tex.colorSpace = THREE.SRGBColorSpace
    tex.mapping = THREE.EquirectangularReflectionMapping
    scene.background = tex
  } catch (err) {
    console.warn('skybox skipped', err)
    scene.background = new THREE.Color('#BFE6FF')
  }
}

function finishFlag(course: CourseDef): THREE.Group {
  const g = new THREE.Group()
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8),
    toonMaterial('#6B4A3A'),
  )
  pole.position.y = 1.1
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.55),
    toonMaterial('#22C3E6'),
  )
  cloth.position.set(0.5, 1.9, 0)
  g.add(pole, cloth)
  g.position.set(-2.4, course.finish.minFeetY, 52.4)
  return g
}

function fitHeight(root: THREE.Object3D, height: number): void {
  const box = new THREE.Box3().setFromObject(root)
  const h = box.max.y - box.min.y
  if (h > 1e-4) root.scale.multiplyScalar(height / h)
}

function toyBlock(def: CourseBox): THREE.Mesh {
  const sx = Math.max(0.2, def.hx * 2)
  const sy = Math.max(0.12, def.hy * 2)
  const sz = Math.max(0.2, def.hz * 2)
  const radius = Math.min(0.16, sx * 0.18, sy * 0.45, sz * 0.18)
  const geo = new RoundedBoxGeometry(sx, sy, sz, 3, radius)
  const mat = toonMaterial(ROLE[def.role])
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(def.x, def.y, def.z)
  mesh.rotation.x = def.rx
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (def.role === 'orange' || def.role === 'plum') mesh.userData.hazard = true
  const trim = new THREE.Mesh(
    new RoundedBoxGeometry(sx * 1.02, 0.08, sz * 1.02, 2, 0.03),
    toonMaterial(EDGE[def.role]),
  )
  trim.position.y = sy * 0.5 - 0.02
  mesh.add(trim)
  const hull = new THREE.Mesh(geo, outlineMaterial())
  hull.scale.setScalar(1.035)
  hull.castShadow = false
  mesh.add(hull)
  return mesh
}

function meadow(): THREE.Group {
  const g = new THREE.Group()
  const ground = new THREE.Mesh(new THREE.CircleGeometry(28, 40), toonMaterial('#d7efe0'))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -0.05, 26)
  ground.receiveShadow = true
  const goo = new THREE.Mesh(new THREE.CircleGeometry(34, 32), toonMaterial('#2f8f8a'))
  goo.rotation.x = -Math.PI / 2
  goo.position.set(0, -1.4, 26)
  g.add(goo, ground)
  return g
}

let stripes: Promise<THREE.Texture> | null = null

function stripeTexture(): Promise<THREE.Texture> {
  if (!stripes) {
    stripes = loadTexture('patterns/pattern_03.png').then((tex) => {
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(2, 2)
      tex.colorSpace = THREE.SRGBColorSpace
      return tex
    })
  }
  return stripes
}
