import * as THREE from 'three'
import {
  FOUNDATION_COURSE,
  readKit,
  sampleMoverPose,
  type CourseBox,
  type CourseDef,
  type KitPieceId,
} from '@wobblebeans/shared'
import { loadGltf, loadTexture } from '../assets/load'

/**
 * Visible course pieces are CC0 glTF models from assets/ (Kenney, KayKit, Quaternius).
 * Collision stays on the Rapier boxes. A missing model stays invisible rather than
 * becoming a drawn primitive.
 */

const PACK = '/assets/obstacles'

const KIT_MESH: Partial<Record<KitPieceId, string>> = {
  swing_ball: `${PACK}/present-a-round.glb`,
  spin_bar: `${PACK}/poles.glb`,
  spin_mallet: `${PACK}/lollypop.glb`,
  tilt_plank: `${PACK}/platform.glb`,
  conveyor: `${PACK}/conveyor-belt.glb`,
  bumper: `${PACK}/bump.glb`,
  pusher: `${PACK}/crate.glb`,
  launch_arm: `${PACK}/windmill.glb`,
  trick_door: `${PACK}/door-rotate.glb`,
  drop_tile: `${PACK}/block-grass-hexagon.glb`,
}

const FLOOR = `${PACK}/block-grass-large.glb`
const RAMP = `${PACK}/platform-ramp.glb`
const SNOW = `${PACK}/block-snow-large.glb`
const RAIL = `${PACK}/pipe.glb`
const FLAG = `${PACK}/flag.glb`

interface MoverView {
  object: THREE.Object3D
  def: CourseBox
}

interface TileBatch {
  mesh: THREE.InstancedMesh
  defs: CourseBox[]
}

export class CourseView {
  readonly group = new THREE.Group()
  readonly course: CourseDef
  private readonly movers: MoverView[] = []
  private readonly tiles: TileBatch[] = []
  private readonly dummy = new THREE.Object3D()

  constructor(course: CourseDef = FOUNDATION_COURSE) {
    this.course = course
  }

  update(tick: number): void {
    for (const mover of this.movers) {
      const pose = sampleMoverPose(mover.def, tick)
      mover.object.position.set(pose.x, pose.y, pose.z)
      if (pose.rot) mover.object.quaternion.set(pose.rot.x, pose.rot.y, pose.rot.z, pose.rot.w)
      else mover.object.rotation.set(pose.rx, pose.ry, pose.rz)
      mover.object.visible = pose.y > -20
    }
    for (const batch of this.tiles) {
      batch.defs.forEach((def, index) => {
        const pose = sampleMoverPose(def, tick)
        this.dummy.position.set(pose.x, pose.y, pose.z)
        this.dummy.scale.set(1, 1, 1)
        if (pose.y < -20) this.dummy.scale.set(0, 0, 0)
        if (pose.rot) this.dummy.quaternion.set(pose.rot.x, pose.rot.y, pose.rot.z, pose.rot.w)
        else this.dummy.rotation.set(pose.rx, pose.ry, pose.rz)
        this.dummy.updateMatrix()
        batch.mesh.setMatrixAt(index, this.dummy.matrix)
      })
      batch.mesh.instanceMatrix.needsUpdate = true
    }
  }

  async addDressing(): Promise<void> {
    await this.loadStructure()
    if (this.course.id === 'foundation-gauntlet') {
      await dressSpots(this.group, [
        { url: `${PACK}/tree.glb`, x: -6.2, y: 0, z: 1.2, height: 2.4 },
        { url: `${PACK}/tree.glb`, x: 6.4, y: 0, z: 4.5, height: 2.8, yaw: 0.6 },
        { url: `${PACK}/flowers.glb`, x: -4.5, y: 0, z: 8, height: 0.6 },
        { url: `${PACK}/flowers.glb`, x: 4.8, y: 0, z: 7.2, height: 0.55 },
        { url: `${PACK}/flag.glb`, x: 2.2, y: 1.5, z: 52, height: 2.2 },
        { url: `${PACK}/star.glb`, x: 0, y: 3.2, z: 51.5, height: 0.8 },
        { url: `${PACK}/hedge.glb`, x: -6.5, y: 0.35, z: 20, height: 1.1 },
      ])
      return
    }
    const spawn = this.course.spawns[0]
    if (spawn) {
      await dressSpots(this.group, [
        { url: `${PACK}/tree.glb`, x: spawn.x - 4, y: spawn.feetY, z: spawn.z - 2, height: 2.2 },
        { url: `${PACK}/flowers.glb`, x: spawn.x + 3.5, y: spawn.feetY, z: spawn.z - 1, height: 0.55 },
      ])
    }
    await this.loadFinishFlag()
  }

  private async loadStructure(): Promise<void> {
    const singles: CourseBox[] = []
    const tiles: CourseBox[] = []
    for (const def of this.course.boxes) {
      if (def.id === 'out-hold' || def.y < -20) continue
      const kit = readKit(def)
      if (kit?.piece === 'drop_tile') tiles.push(def)
      else singles.push(def)
    }
    const urls = new Set<string>()
    for (const def of singles) {
      const url = visualUrl(def)
      if (url) urls.add(url)
    }
    if (tiles.length > 0) urls.add(KIT_MESH.drop_tile!)
    const templates = new Map<string, THREE.Object3D>()
    await Promise.all(
      [...urls].map(async (url) => {
        try {
          const gltf = await loadGltf(url)
          templates.set(url, gltf.scene)
        } catch (err) {
          console.warn('course model skipped', url, err)
        }
      }),
    )
    for (const def of singles) {
      const url = visualUrl(def)
      const template = url ? templates.get(url) : undefined
      if (!template) continue
      const holder = new THREE.Group()
      holder.position.set(def.x, def.y, def.z)
      holder.rotation.x = def.rx
      const model = template.clone(true)
      fitToCollider(model, def.hx, def.hy, def.hz)
      markShadows(model, singles.length < 80)
      holder.add(model)
      if (def.mover) this.movers.push({ object: holder, def })
      this.group.add(holder)
    }
    const tileTemplate = templates.get(KIT_MESH.drop_tile!)
    const sample = tiles[0]
    if (tileTemplate && sample) {
      const fitted = tileTemplate.clone(true)
      fitToCollider(fitted, sample.hx, sample.hy, sample.hz)
      fitted.updateMatrixWorld(true)
      const sources: THREE.Mesh[] = []
      fitted.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) sources.push(mesh)
      })
      for (const source of sources) {
        const geo = source.geometry.clone()
        source.updateWorldMatrix(true, false)
        geo.applyMatrix4(source.matrixWorld)
        const mesh = new THREE.InstancedMesh(geo, source.material, tiles.length)
        mesh.castShadow = false
        mesh.receiveShadow = true
        tiles.forEach((def, index) => {
          this.dummy.position.set(def.x, def.y, def.z)
          this.dummy.rotation.set(def.rx, 0, 0)
          this.dummy.scale.set(1, 1, 1)
          this.dummy.updateMatrix()
          mesh.setMatrixAt(index, this.dummy.matrix)
        })
        mesh.instanceMatrix.needsUpdate = true
        this.tiles.push({ mesh, defs: tiles })
        this.group.add(mesh)
      }
    }
  }

  private async loadFinishFlag(): Promise<void> {
    const finish = this.course.finish
    const cx = (finish.minX + finish.maxX) / 2
    const cz = (finish.minZ + finish.maxZ) / 2
    if (Math.abs(cx) > 80 || Math.abs(cz) > 80) return
    await dressSpots(this.group, [{ url: FLAG, x: cx, y: finish.minFeetY, z: cz, height: 2.4 }])
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
  }
}

function visualUrl(def: CourseBox): string | null {
  const kit = readKit(def)
  if (kit) {
    const mapped = KIT_MESH[kit.piece]
    if (mapped) return mapped
  }
  if (Math.abs(def.rx) > 0.05) return RAMP
  if ((def.hx <= 0.45 || def.hz <= 0.45) && def.hy >= 0.35) return RAIL
  if (def.role === 'cyan') return SNOW
  return FLOOR
}

async function dressSpots(
  group: THREE.Group,
  spots: { url: string; x: number; y: number; z: number; height: number; yaw?: number }[],
): Promise<void> {
  const cache = new Map<string, THREE.Object3D>()
  for (const spot of spots) {
    try {
      let template = cache.get(spot.url)
      if (!template) {
        const gltf = await loadGltf(spot.url)
        template = gltf.scene
        cache.set(spot.url, template)
      }
      const root = template.clone(true)
      fitHeight(root, spot.height)
      const box = new THREE.Box3().setFromObject(root)
      root.position.set(spot.x, spot.y - box.min.y, spot.z)
      if (spot.yaw) root.rotation.y = spot.yaw
      markShadows(root, true)
      group.add(root)
    } catch (err) {
      console.warn('prop skipped', spot.url, err)
    }
  }
}

function fitToCollider(root: THREE.Object3D, hx: number, hy: number, hz: number): void {
  root.scale.set(1, 1, 1)
  root.position.set(0, 0, 0)
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const sx = box.max.x - box.min.x
  const sy = box.max.y - box.min.y
  const sz = box.max.z - box.min.z
  root.scale.set(sx > 1e-4 ? (hx * 2) / sx : 1, sy > 1e-4 ? (hy * 2) / sy : 1, sz > 1e-4 ? (hz * 2) / sz : 1)
  root.updateMatrixWorld(true)
  const fitted = new THREE.Box3().setFromObject(root)
  root.position.set(
    -((fitted.min.x + fitted.max.x) / 2),
    -((fitted.min.y + fitted.max.y) / 2),
    -((fitted.min.z + fitted.max.z) / 2),
  )
}

function fitHeight(root: THREE.Object3D, height: number): void {
  const box = new THREE.Box3().setFromObject(root)
  const h = box.max.y - box.min.y
  if (h > 1e-4) root.scale.multiplyScalar(height / h)
}

function markShadows(root: THREE.Object3D, cast: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = cast
      mesh.receiveShadow = true
    }
  })
}
