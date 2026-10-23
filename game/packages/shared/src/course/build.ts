import type { CourseBox, CourseDef, SpawnPoint, SurfaceRole } from './foundation-gauntlet'
import { makeKit } from '../obstacles/kit'
import { registerSurfaceZones } from '../obstacles/pose'
import { attachKit, readKit, type BoxKit, type KitPieceId, type MotionKind } from '../obstacles/types'
import {
  assertLevelRecord,
  type Checkpoint,
  type LaunchSite,
  type LevelDef,
  type LevelRecord,
  type RoutePoint,
  type TrophySite,
  type Volume,
} from './schema'
import type { SlimeParams } from '../obstacles/motion'
import type { SurfaceZone } from '../obstacles/pose'

export function box(
  id: string,
  hx: number,
  hy: number,
  hz: number,
  x: number,
  y: number,
  z: number,
  role: SurfaceRole,
  rx = 0,
  mover: CourseBox['mover'] = null,
): CourseBox {
  return { id, hx, hy, hz, x, y, z, rx, role, mover }
}

/** Walkable slab. `yTop` is the floor the feet stand on. */
export function slab(
  id: string,
  x: number,
  z0: number,
  z1: number,
  yTop: number,
  halfWidth: number,
  role: SurfaceRole = 'oat',
): CourseBox {
  const zMin = Math.min(z0, z1)
  const zMax = Math.max(z0, z1)
  const hz = Math.max(0.2, (zMax - zMin) / 2)
  return box(id, halfWidth, 0.5, hz, x, yTop - 0.5, (zMin + zMax) / 2, role)
}

/** Slab along X instead of Z. */
export function slabX(
  id: string,
  z: number,
  x0: number,
  x1: number,
  yTop: number,
  halfDepth: number,
  role: SurfaceRole = 'oat',
): CourseBox {
  const xMin = Math.min(x0, x1)
  const xMax = Math.max(x0, x1)
  const hx = Math.max(0.2, (xMax - xMin) / 2)
  return box(id, hx, 0.5, halfDepth, (xMin + xMax) / 2, yTop - 0.5, z, role)
}

/**
 * Ramp whose walkable surface runs from (z0, y0) to (z1, y1).
 * Same construction as the gauntlet ramp, so the lip does not catch the capsule.
 */
export function ramp(
  id: string,
  x: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
  halfWidth: number,
  role: SurfaceRole = 'lime',
): CourseBox {
  const run = z1 - z0
  const rise = y1 - y0
  const len = Math.hypot(run, rise)
  const theta = Math.atan2(rise, run)
  const hy = 0.22
  const midZ = (z0 + z1) / 2
  const midY = (y0 + y1) / 2
  const cy = midY - Math.cos(theta) * hy
  const cz = midZ + Math.sin(theta) * hy
  return box(id, halfWidth, hy, len / 2, x, cy, cz, role, -theta)
}

export function railZ(
  id: string,
  x: number,
  z0: number,
  z1: number,
  yTop: number,
  height = 1.1,
): CourseBox {
  const zMin = Math.min(z0, z1)
  const zMax = Math.max(z0, z1)
  return box(id, 0.25, height / 2, (zMax - zMin) / 2, x, yTop + height / 2, (zMin + zMax) / 2, 'cocoa')
}

export function railX(
  id: string,
  z: number,
  x0: number,
  x1: number,
  yTop: number,
  height = 1.1,
): CourseBox {
  const xMin = Math.min(x0, x1)
  const xMax = Math.max(x0, x1)
  return box(id, (xMax - xMin) / 2, height / 2, 0.25, (xMin + xMax) / 2, yTop + height / 2, z, 'cocoa')
}

export function gridSpawns(
  count: number,
  spacing: number,
  originX: number,
  originZ: number,
  feetY: number,
  yaw = 0,
  cols = 8,
): SpawnPoint[] {
  const spawns: SpawnPoint[] = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    spawns.push({
      x: originX + (col - (cols - 1) / 2) * spacing,
      feetY,
      z: originZ + row * spacing,
      yaw,
    })
  }
  return spawns
}

/** Even ring. `angleBias` rotates the first pad off a hazard that sits on an axis. */
export function ringSpawns(count: number, radius: number, feetY: number, angleBias = 0): SpawnPoint[] {
  const spawns: SpawnPoint[] = []
  for (let i = 0; i < count; i++) {
    const ang = angleBias + (i / count) * Math.PI * 2
    const x = Math.sin(ang) * radius
    const z = Math.cos(ang) * radius
    spawns.push({
      x,
      feetY,
      z,
      yaw: Math.atan2(-x, -z),
    })
  }
  return spawns
}

export function arcSpawns(count: number, radius: number, spacing: number, feetY: number): SpawnPoint[] {
  const step = spacing / radius
  const start = -((count - 1) * step) / 2
  const spawns: SpawnPoint[] = []
  for (let i = 0; i < count; i++) {
    const ang = start + i * step
    spawns.push({
      x: Math.sin(ang) * radius,
      feetY,
      z: Math.cos(ang) * radius,
      yaw: Math.atan2(-Math.sin(ang), -Math.cos(ang)),
    })
  }
  return spawns
}

export function padsAt(x: number, z: number, feetY: number, yaw = 0, spacing = 1.5): SpawnPoint[] {
  return [-1.5, -0.5, 0.5, 1.5].map((col) => ({
    x: x + col * spacing,
    feetY,
    z,
    yaw,
  }))
}

const KINEMATIC: CourseBox['mover'] = { amplitude: 0, period: 1, axis: 'x' }

export function movingBox(
  id: string,
  hx: number,
  hy: number,
  hz: number,
  x: number,
  y: number,
  z: number,
  role: SurfaceRole,
  piece: KitPieceId,
  motion: MotionKind,
  extra: Partial<BoxKit> = {},
  rx = 0,
): CourseBox {
  const body = box(id, hx, hy, hz, x, y, z, role, rx, motion === 'static' ? null : KINEMATIC)
  attachKit(body, makeKit(piece, motion, extra))
  return body
}

/** One door on x = 0, the rest paired down the row. The center door is real. */
export function doorCenters(count: number, pitch: number): number[] {
  const xs = [0]
  let i = 1
  while (xs.length < count) {
    xs.push(-i * pitch)
    if (xs.length < count) xs.push(i * pitch)
    i += 1
  }
  xs.sort((a, b) => a - b)
  return xs
}

export function mulberry(seed: number): () => number {
  let a = seed >>> 0 || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Trick-door row. Real doors break at ≥ 3 m/s. The door on x = 0 is always real
 * so a forward run can finish. `realCount` includes that center door.
 */
export function addDoorRow(
  boxes: CourseBox[],
  pieces: Array<{ boxId: string; piece: KitPieceId }>,
  row: string,
  z: number,
  floorY: number,
  count: number,
  realCount: number,
  seed: number,
): void {
  const pitch = 3.6
  const xs = doorCenters(count, pitch)
  const real = new Set<number>([xs.indexOf(0)])
  const side = xs.map((_, index) => index).filter((index) => xs[index] !== 0)
  const rand = mulberry(seed + count * 17 + realCount)
  for (let i = side.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const swap = side[i]!
    side[i] = side[j]!
    side[j] = swap
  }
  while (real.size < Math.min(count, Math.max(1, realCount)) && side.length) {
    real.add(side.pop()!)
  }
  xs.forEach((x, index) => {
    const id = `${row}-door-${index}`
    const center = Math.abs(x) < 0.01
    boxes.push(
      movingBox(id, center ? 1.15 : 0.9, 1.25, 0.28, x, floorY + 1.2, z, 'orange', 'trick_door', 'door', {
        real: real.has(index),
        phase: index * 0.1,
      }),
    )
    pieces.push({ boxId: id, piece: 'trick_door' })
  })
}

export function cloneCourse(course: CourseDef): CourseDef {
  return {
    ...course,
    boxes: course.boxes.map((entry) => {
      const copy: CourseBox = {
        ...entry,
        mover: entry.mover ? { ...entry.mover } : null,
      }
      const kit = readKit(entry)
      if (kit) attachKit(copy, { ...kit, triggeredTick: null, tilt: 0 })
      return copy
    }),
    spawns: course.spawns.map((spawn) => ({ ...spawn })),
    finish: { ...course.finish },
    landmarks: {
      ...course.landmarks,
      stoneJumpZs: [...course.landmarks.stoneJumpZs],
    },
  }
}

export function holdPad(): CourseBox {
  return slab('out-hold', 0, -86, -74, 80, 6, 'plum')
}

export interface AssembleInput {
  record: LevelRecord
  /** Defaults to the record id. Variants use a suffix so zones stay per course. */
  courseId?: string
  boxes: CourseBox[]
  spawns: SpawnPoint[]
  finish: CourseDef['finish']
  jumpZs?: number[]
  volumes?: Volume[]
  zones?: SurfaceZone[]
  checkpoints?: Checkpoint[]
  route?: RoutePoint[]
  jumpGaps?: number[]
  launches?: LaunchSite[]
  trophy?: TrophySite | null
  slime?: SlimeParams | null
  pieces?: Array<{ boxId: string; piece: KitPieceId }>
  stoneX?: number
}

export function assemble(input: AssembleInput): LevelDef {
  assertLevelRecord(input.record)
  const boxes = [...input.boxes, holdPad()]
  const jumpZs = input.jumpZs ?? []
  const course: CourseDef = {
    id: input.courseId ?? input.record.id,
    boxes,
    spawns: input.spawns,
    finish: input.finish,
    landmarks: {
      firstGapJumpZ: jumpZs[0] ?? input.route?.[0]?.z ?? 0,
      stoneX: input.stoneX ?? 0,
      stoneJumpZs: jumpZs,
    },
  }
  const zones = input.zones ?? []
  registerSurfaceZones(course.id, zones)
  return {
    record: input.record,
    course,
    volumes: input.volumes ?? [],
    zones,
    checkpoints: input.checkpoints ?? [],
    route: input.route ?? [],
    jumpGaps: input.jumpGaps ?? [],
    launches: input.launches ?? [],
    trophy: input.trophy ?? null,
    slime: input.slime ?? null,
    pieces: input.pieces ?? [],
  }
}

export function minSpawnSpacing(spawns: readonly SpawnPoint[]): number {
  let best = Infinity
  for (let i = 0; i < spawns.length; i++) {
    for (let j = i + 1; j < spawns.length; j++) {
      const a = spawns[i]!
      const b = spawns[j]!
      const d = Math.hypot(a.x - b.x, a.z - b.z)
      if (d < best) best = d
    }
  }
  return best
}

export function finishFinite(course: CourseDef): boolean {
  const finish = course.finish
  return [finish.minX, finish.maxX, finish.minZ, finish.maxZ, finish.minFeetY].every((value) => Number.isFinite(value))
}
