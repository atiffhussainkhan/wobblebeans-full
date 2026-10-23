import { fnv1a, quatFromXRotation } from '../physics/math'
import { PHYSICS } from '../physics/constants'

export type SurfaceRole = 'oat' | 'mint' | 'cyan' | 'cocoa' | 'orange' | 'lime' | 'plum'

export interface CourseBox {
  id: string
  hx: number
  hy: number
  hz: number
  x: number
  y: number
  z: number
  /** Rotation about X, radians. */
  rx: number
  role: SurfaceRole
  mover: { amplitude: number; period: number; axis: 'x' } | null
}

export interface SpawnPoint {
  x: number
  /** Feet height. */
  feetY: number
  z: number
  yaw: number
}

export interface CourseDef {
  id: string
  boxes: CourseBox[]
  spawns: SpawnPoint[]
  finish: { minX: number; maxX: number; minZ: number; maxZ: number; minFeetY: number }
  /** Straight-line landmarks so tests and bots share the layout. */
  landmarks: {
    firstGapJumpZ: number
    stoneX: number
    stoneJumpZs: number[]
  }
}

function box(
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

/**
 * Ramp whose walkable surface runs from (z0, y0) to (z1, y1).
 * Local +Z lies along the slope after an X rotation of -atan2(rise, run).
 */
function ramp(
  id: string,
  x: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
  halfWidth: number,
  thickness: number,
  role: SurfaceRole,
): CourseBox {
  const run = z1 - z0
  const rise = y1 - y0
  const len = Math.hypot(run, rise)
  const theta = Math.atan2(rise, run)
  const hy = thickness / 2
  const midZ = (z0 + z1) / 2
  const midY = (y0 + y1) / 2
  const cy = midY - Math.cos(theta) * hy
  const cz = midZ + Math.sin(theta) * hy
  return box(id, halfWidth, hy, len / 2, x, cy, cz, role, -theta)
}

/**
 * Foundation test course, Toybox Meadow palette.
 * Completable with move + jump. Dive is an advantage on the side gap, not a gate.
 * A server-timed platform shuttles across the middle of the long gap.
 */
export function foundationGauntlet(): CourseDef {
  const boxes: CourseBox[] = [
    box('start', 8, 0.5, 7, 0, -0.5, 5, 'oat'),
    box('curb-l', 0.35, 0.55, 7, -8.35, 0.55, 5, 'cocoa'),
    box('curb-r', 0.35, 0.55, 7, 8.35, 0.55, 5, 'cocoa'),
    // 0.3 m step. Autostep is 0.35 m, so this is walkable.
    box('step', 5, 0.4, 1.6, 0, -0.1, 13.4, 'mint'),
    // 2.4 m gap (z 15.0 → 17.4), then an island.
    box('island', 5, 0.45, 3.1, 0, -0.1, 20.5, 'mint'),
    box('island-block', 1.1, 0.7, 1.1, 0, 1.05, 20.2, 'orange'),
    ramp('ramp', 0, 23.4, 29.2, 0.35, 1.5, 4.2, 0.45, 'lime'),
    // High road overlaps the ramp crown so the lip does not catch the capsule.
    // Wide enough to walk out to the stone line before the gap.
    box('high', 7, 0.5, 3.6, 0, 1.0, 32.4, 'oat'),
    // A running jump from the high road lands about 6 m out. The pad is long
    // enough to catch that arc. Move + jump, dive not required.
    box('stone-1', 1.6, 0.4, 2.05, 5.5, 1.1, 42.05, 'mint'),
    // Side dive gap: a longer leap off the left shoulder of the high road.
    box('dive-pad', 1.6, 0.4, 1.5, -5.4, 1.1, 42.4, 'plum'),
    // Shuttle in the centre gap. Base pose; x is animated from server tick.
    // Kept clear of the stone colliders at the ends of its travel.
    box('shuttle', 1.7, 0.28, 1.7, 0, 1.22, 39.45, 'orange', 0, {
      amplitude: 1.8,
      period: 3.6,
      axis: 'x',
    }),
    box('finish', 8, 0.5, 4.3, 0, 1.0, 51.8, 'cyan'),
    box('finish-back', 8, 1.1, 0.35, 0, 2.1, 56.2, 'cocoa'),
  ]

  const spawns: SpawnPoint[] = []
  for (let i = 0; i < 8; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    spawns.push({
      x: (col - 1.5) * 1.7,
      feetY: 0,
      z: 2.2 + row * 1.8,
      yaw: 0,
    })
  }

  return {
    id: 'foundation-gauntlet',
    boxes,
    spawns,
    finish: { minX: -7.5, maxX: 7.5, minZ: 47.6, maxZ: 56, minFeetY: 1.0 },
    landmarks: {
      firstGapJumpZ: 14.35,
      stoneX: 5.5,
      stoneJumpZs: [35.4, 43.0],
    },
  }
}

export const FOUNDATION_COURSE = foundationGauntlet()

export function moverOffset(tick: number, amplitude: number, period: number): number {
  const t = tick / PHYSICS.tickHz
  return Math.sin((t * Math.PI * 2) / period) * amplitude
}

export function courseHash(course: CourseDef = FOUNDATION_COURSE): number {
  const payload = course.boxes
    .map((b) =>
      [
        b.id,
        b.hx,
        b.hy,
        b.hz,
        b.x,
        b.y,
        b.z,
        b.rx,
        b.mover?.amplitude ?? 0,
        b.mover?.period ?? 0,
      ].join(','),
    )
    .join('|')
  return fnv1a(`${course.id}|${payload}`)
}

export function boxRotation(boxDef: CourseBox): { x: number; y: number; z: number; w: number } {
  return quatFromXRotation(boxDef.rx)
}

export function inFinish(course: CourseDef, feetX: number, feetY: number, feetZ: number): boolean {
  const f = course.finish
  return feetX >= f.minX && feetX <= f.maxX && feetZ >= f.minZ && feetZ <= f.maxZ && feetY >= f.minFeetY
}
