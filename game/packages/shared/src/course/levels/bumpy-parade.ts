import type { CourseBox } from '../foundation-gauntlet'
import type { KitPieceId } from '../../obstacles/types'
import { makeKit } from '../../obstacles/kit'
import { attachKit } from '../../obstacles/types'
import {
  assemble,
  gridSpawns,
  movingBox,
  padsAt,
  railZ,
  ramp,
  slab,
} from '../build'
import type { Checkpoint, LevelDef, LevelRecord, RoutePoint, Volume } from '../schema'

const RECORD: LevelRecord = {
  id: 'bumpy_parade',
  nameKey: 'level.bumpy_parade',
  type: 'COURSE',
  minPlayers: 8,
  maxPlayers: 40,
  rule: 'race',
  pctBySlot: { R1: 0.7 },
  slots: ['R1'],
  fallbackAnySlot: false,
  divisor: 1,
  weight: 1,
  limitS: 180,
  variants: [
    { id: 'easy', enabled: true, speedMult: 0.8, weight: 1, note: 'Swing balls use a 5 s period.' },
    { id: 'base', enabled: true, speedMult: 1, weight: 1, note: 'Base parade.' },
    { id: 'swap', enabled: false, speedMult: 1, weight: 0, note: 'R2 swap: spin mallets instead of swing alley. Disabled until R2.' },
  ],
  enabled: true,
  goalKey: 'goal.bumpy_parade',
  goalCard: 'Run, hop, reach the finish!',
  fall: 'respawn',
  killPlaneY: -10,
  respawnDelayS: 1.5,
  protectionS: 1,
}

/** Shoulder X the swing balls never reach. The alley itself is the hazard. */
const SHOULDER = 7.4

export function buildBumpyParade(opts: { variant?: 'base' | 'easy' | 'swap' } = {}): LevelDef {
  const variant = opts.variant ?? 'base'
  const easy = variant === 'easy'
  const swap = variant === 'swap'
  const period = easy ? 5 : 4
  const boxes: CourseBox[] = []
  const pieces: Array<{ boxId: string; piece: KitPieceId }> = []
  const route: RoutePoint[] = []
  const checkpoints: Checkpoint[] = []
  const volumes: Volume[] = []
  const bumpAmp = makeKit('bumper', 'sine').amplitude

  const cp = (index: number, z: number, along: number, y = 0) => {
    checkpoints.push({ index, along, pads: padsAt(0, z, y) })
    volumes.push({
      id: `cp-${index}`,
      kind: 'checkpoint',
      minX: -5,
      maxX: 5,
      minY: y - 0.4,
      maxY: y + 2.4,
      minZ: z - 1.5,
      maxZ: z + 1.5,
      index,
      innerRadius: 0,
    })
  }

  boxes.push(slab('start', 0, 0, 25, 0, 10))
  boxes.push(railZ('start-l', -10.2, 0, 25, 0, 0.9))
  boxes.push(railZ('start-r', 10.2, 0, 25, 0, 0.9))
  for (const [index, x] of [6.2, -6.2].entries()) {
    const id = `warm-bumper-${index}`
    boxes.push(movingBox(id, 0.7, 0.65, 0.7, x, 0.65, 12, 'orange', 'bumper', 'static'))
    pieces.push({ boxId: id, piece: 'bumper' })
  }
  cp(1, 22, 22)
  route.push({ x: 0, y: 0, z: 8 }, { x: 0, y: 0, z: 20 }, { x: SHOULDER, y: 0, z: 30 })

  boxes.push(slab('alley', 0, 25, 65, 0, 3, 'mint'))
  boxes.push(slab('shoulder', SHOULDER, 25, 65, 0, 1.6, 'oat'))
  boxes.push(slab('join-a', 3, 25, 33, 0, 5, 'oat'))
  boxes.push(slab('join-b', 3, 57, 67, 0, 5, 'oat'))
  boxes.push(railZ('alley-l', -3.4, 25, 65, 0))
  boxes.push(railZ('shoulder-r', SHOULDER + 1.9, 25, 65, 0))
  for (let i = 0; i < 4; i++) {
    const id = swap ? `mallet-${i}` : `swing-${i}`
    if (swap) {
      boxes.push(
        movingBox(id, 2, 0.35, 0.4, 0, 1.3, 34 + i * 8, 'plum', 'spin_mallet', 'spin', {
          speed: 90,
          length: 2,
          phase: i * 0.7,
        }),
      )
      pieces.push({ boxId: id, piece: 'spin_mallet' })
    } else {
      boxes.push(
        movingBox(id, 0.7, 0.7, 0.7, 0, 1.15, 34 + i * 8, 'plum', 'swing_ball', 'swing', {
          axis: 'x',
          length: 5,
          amplitude: 0.72,
          period,
          phase: i * 1.2,
        }),
      )
      pieces.push({ boxId: id, piece: 'swing_ball' })
    }
  }
  for (let z = 34; z <= 62; z += 4) route.push({ x: SHOULDER, y: 0, z })
  cp(2, 63, 63)
  route.push({ x: 0, y: 0, z: 72 })

  boxes.push(slab('garden-in', 0, 65, 74, 0, 8, 'mint'))
  const plankZ = [78, 88, 98]
  for (const [row, z] of plankZ.entries()) {
    for (const [col, x] of [-4.2, 0, 4.2].entries()) {
      const id = `plank-${row}-${col}`
      boxes.push(
        movingBox(id, 1.45, 0.2, 5.15, x, -0.2, z, 'lime', 'tilt_plank', 'tilt', {
          amplitude: (25 * Math.PI) / 180,
        }),
      )
      pieces.push({ boxId: id, piece: 'tilt_plank' })
    }
    route.push({ x: 0, y: 0, z })
  }
  boxes.push(slab('garden-out', 0, 102, 112, 0, 8, 'mint'))
  volumes.push({
    id: 'garden-pit',
    kind: 'pit',
    minX: -12,
    maxX: 12,
    minY: -6,
    maxY: -0.3,
    minZ: 74,
    maxZ: 102,
    index: 0,
    innerRadius: 0,
  })
  cp(3, 108, 108)
  route.push({ x: 0, y: 0, z: 112 })

  const belt = ramp('belt', 0, 110, 155, 0, 4.5, 5, 'orange')
  attachKit(belt, makeKit('conveyor', 'static', { axis: 'z', dir: -1, speed: 3.5 }))
  boxes.push(belt)
  pieces.push({ boxId: 'belt', piece: 'conveyor' })
  boxes.push(slab('belt-crown', 0, 152, 162, 4.5, 6, 'oat'))
  boxes.push(railZ('belt-l', -5.4, 112, 160, 0, 1))
  boxes.push(railZ('belt-r', 5.4, 112, 160, 0, 1))
  cp(4, 158, 158, 4.5)
  for (let z = 116; z <= 156; z += 5) route.push({ x: 0, y: 4.5 * ((z - 110) / 45), z })

  boxes.push(slab('pit', 0, 160, 200, 4.5, 10, 'mint'))
  boxes.push(railZ('pit-l', -10.2, 162, 198, 4.5, 0.8))
  boxes.push(railZ('pit-r', 10.2, 162, 198, 4.5, 0.8))
  for (let i = 0; i < 8; i++) {
    const id = `parade-bumper-${i}`
    const x = i % 2 === 0 ? 5.6 : -5.6
    boxes.push(
      movingBox(id, 0.75, 0.7, 0.75, x + (i % 3) * 0.2, 5.2, 166 + i * 3.8, 'orange', 'bumper', 'sine', {
        axis: 'x',
        amplitude: bumpAmp,
        period: 4,
        phase: i * 0.4,
        dir: x > 0 ? 1 : -1,
      }),
    )
    pieces.push({ boxId: id, piece: 'bumper' })
  }
  for (let z = 164; z <= 198; z += 4) route.push({ x: 0, y: 4.5, z })
  cp(5, 196, 196, 4.5)

  boxes.push(slab('dash-a', 0, 198, 220, 4.5, 8, 'cyan'))
  boxes.push(slab('dash-shoulder', SHOULDER, 198, 236, 4.5, 1.6, 'oat'))
  const lip = 220
  boxes.push(slab('dash-b', 0, lip + 2.4, 242, 4.5, 8, 'cyan'))
  for (let i = 0; i < 2; i++) {
    const id = `dash-swing-${i}`
    boxes.push(
      movingBox(id, 0.7, 0.7, 0.7, 0, 5.65, 204 + i * 6, 'plum', 'swing_ball', 'swing', {
        axis: 'x',
        length: 5,
        amplitude: 0.72,
        period,
        phase: 1.4 + i * 2,
      }),
    )
    pieces.push({ boxId: id, piece: 'swing_ball' })
  }
  route.push({ x: SHOULDER, y: 4.5, z: 204 }, { x: SHOULDER, y: 4.5, z: 216 })
  route.push({ x: 0, y: 4.5, z: lip - 0.45, jump: true })
  route.push({ x: 0, y: 4.5, z: lip + 6 }, { x: 0, y: 4.5, z: 238 })

  const finishZ = 238
  boxes.push(slab('finish', 0, finishZ, finishZ + 14, 4.5, 9, 'cyan'))
  route.push({ x: 0, y: 4.5, z: finishZ + 6 })

  return assemble({
    record: RECORD,
    courseId: variant === 'base' ? RECORD.id : `${RECORD.id}__${variant}`,
    boxes,
    spawns: gridSpawns(40, 1.2, 0, 3, 0, 0, 8),
    finish: { minX: -8, maxX: 8, minZ: finishZ + 2, maxZ: finishZ + 12, minFeetY: 4.3 },
    jumpZs: [lip - 0.7],
    volumes,
    zones: [
      {
        minX: -5.2,
        maxX: 5.2,
        minY: -1,
        maxY: 8,
        minZ: 112,
        maxZ: 154,
        vx: 0,
        vy: 0,
        vz: -3.5,
        speedMult: 1,
      },
    ],
    checkpoints,
    route,
    jumpGaps: [2.4],
    pieces,
  })
}

export const BUMPY_PARADE = buildBumpyParade()
