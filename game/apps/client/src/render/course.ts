import * as THREE from 'three'
import { FOUNDATION_COURSE, moverOffset, type CourseBox, type CourseDef } from '@wobblebeans/shared'
import { loadGltf, loadTexture } from '../assets/load'

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
    const gradient = toonGradient()
    for (const def of course.boxes) {
      const mat = new THREE.MeshToonMaterial({ color: ROLE[def.role], gradientMap: gradient })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(def.hx * 2, def.hy * 2, def.hz * 2), mat)
      mesh.position.set(def.x, def.y, def.z)
      mesh.rotation.x = def.rx
      mesh.castShadow = true
      mesh.receiveShadow = true
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(def.hx * 2 * 1.04, 0.08, def.hz * 2 * 1.04),
        new THREE.MeshToonMaterial({ color: EDGE[def.role], gradientMap: gradient }),
      )
      edge.position.y = def.hy - 0.02
      mesh.add(edge)
      if (def.mover) {
        this.shuttle = mesh
        this.shuttleDef = def
      }
      this.group.add(mesh)
    }
    this.group.add(finishFlag(course))
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
      { url: '/assets/obstacles/flowers.glb', x: -4.5, y: 0, z: 8, height: 0.6 },
      { url: '/assets/obstacles/flowers.glb', x: 4.8, y: 0, z: 7.2, height: 0.55 },
      { url: '/assets/obstacles/flag.glb', x: 2.2, y: 1.5, z: 52, height: 2.2 },
      { url: '/assets/obstacles/star.glb', x: 0, y: 3.2, z: 51.5, height: 0.8 },
      { url: '/assets/obstacles/hedge.glb', x: -6.5, y: 0.35, z: 20, height: 1.1 },
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
            if (mesh.isMesh) {
              mesh.castShadow = true
              mesh.receiveShadow = true
            }
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
    new THREE.MeshToonMaterial({ color: '#6B4A3A' }),
  )
  pole.position.y = 1.1
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.55),
    new THREE.MeshToonMaterial({ color: '#22C3E6', side: THREE.DoubleSide }),
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

function toonGradient(): THREE.DataTexture {
  const data = new Uint8Array([80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255])
  const tex = new THREE.DataTexture(data, 3, 1)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}
