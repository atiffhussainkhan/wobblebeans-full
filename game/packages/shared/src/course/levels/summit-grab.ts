import type { CourseBox } from '../foundation-gauntlet'
import type { KitPieceId } from '../../obstacles/types'
import { assemble, gridSpawns, movingBox, padsAt, railZ, ramp, slab } from '../build'
import type { Checkpoint, LevelDef, LevelRecord, RoutePoint, Volume } from '../schema'

const RECORD: LevelRecord = {
  id: 'summit_grab',
  nameKey: 'level.summit_grab',
  type: 'FINAL',
  minPlayers: 2,
  maxPlayers: 10,
  rule: 'trophy',
  pctBySlot: {},
  slots: ['F'],
  fallbackAnySlot: false,
  divisor: 1,
  weight: 1,
  limitS: 300,
  variants: [
    { id: 'base', enabled: true, speedMult: 1, weight: 1, note: 'Swing balls on the lower stair.' },
    { id: 'windy', enabled: false, speedMult: 1, weight: 0, note: 'Spin mallets replace the swing balls. Disabled until R2.' },
  ],
  enabled: true,
  goalKey: 'goal.summit_grab',
  goalCard: 'Climb up! Grab the trophy!',
  fall: 'respawn',
  killPlaneY: -10,
  respawnDelayS: 1.5,
  protectionS: 1,
}

const TAU = Math.PI * 2

/**
 * Spiral-free switchback hill, about 140 m and 33 m of rise.
 * The safe line stays off the swing reach and off the launch arm.
 * A ramp climbs the 3 m plinth, so the grab does not need a dive.
 */
export function buildSummitGrab(opts: { variant?: 'base' | 'windy' } = {}): LevelDef {
  const windy = opts.variant === 'windy'
  const boxes: CourseBox[] = []
  const pieces: Array<{ boxId: string; piece: KitPieceId }> = []
  const checkpoints: Checkpoint[] = []
  const volumes: Volume[] = []

  const mark = (index: number, x: number, z: number, y: number, along: number) => {
    checkpoints.push({ index, along, pads: padsAt(x, z, y, 0, 1.2).slice(0, 4) })
    volumes.push({
      id: `cp-${index}`,
      kind: 'checkpoint',
      minX: x - 3,
      maxX: x + 3,
      minY: y - 0.4,
      maxY: y + 2.6,
      minZ: z - 2,
      maxZ: z + 2,
      index,
      innerRadius: 0,
    })
  }

  boxes.push(slab('start', 0, 0, 16, 0, 7))
  boxes.push(railZ('start-l', -7.3, 0, 16, 0, 0.9))
  boxes.push(railZ('start-r', 7.3, 0, 16, 0, 0.9))
  boxes.push(ramp('stairs', 0, 14, 52, 0, 12, 5))
  boxes.push(railZ('stair-l', -5.3, 16, 50, 0, 1))
  boxes.push(railZ('stair-r', 5.3, 16, 50, 0, 1))

  for (let i = 0; i < 3; i++) {
    const z = 24 + i * 10
    const id = windy ? `mallet-${i}` : `swing-${i}`
    if (windy) {
      boxes.push(
        movingBox(id, 2, 0.35, 0.4, -1.2, 2.2, z, 'plum', 'spin_mallet', 'spin', {
          speed: 90,
          length: 2,
          phase: i * 0.8,
        }),
      )
      pieces.push({ boxId: id, piece: 'spin_mallet' })
    } else {
      boxes.push(
        movingBox(id, 0.7, 0.7, 0.7, -1.2, 1.4, z, 'plum', 'swing_ball', 'swing', {
          axis: 'x',
          length: 4,
          amplitude: 0.65,
          period: 3.5,
          phase: i * ((1.2 * TAU) / 3.5),
        }),
      )
      pieces.push({ boxId: id, piece: 'swing_ball' })
    }
  }

  boxes.push(slab('deck', 0, 51.3, 80, 12, 7, 'mint'))
  mark(1, 3.6, 50, 12, 50)
  boxes.push(
    movingBox('launch', 3, 0.35, 0.45, -3, 12.8, 64, 'plum', 'launch_arm', 'launch', {
      length: 6,
      speed: 120,
      dir: -1,
      dv: 20,
    }),
  )
  pieces.push({ boxId: 'launch', piece: 'launch_arm' })
  mark(2, 4.5, 76, 12, 86)

  boxes.push(ramp('climb', 2, 74, 118, 12, 30, 4, 'lime'))
  boxes.push(slab('plateau', 0, 117.5, 142, 30, 8, 'oat'))
  for (const [index, phase] of [0.4, Math.PI + 0.4].entries()) {
    const id = `bar-${index}`
    boxes.push(
      movingBox(id, 2.2, 0.18, 0.28, 0, 31.1, 122, 'orange', 'spin_bar', 'spin', {
        speed: 45,
        length: 3.4,
        phase,
        axis: 'y',
      }),
    )
    pieces.push({ boxId: id, piece: 'spin_bar' })
  }
  boxes.push(ramp('plinth', 0, 130, 138, 30, 33, 1.8, 'cyan'))
  boxes.push(slab('crown', 0, 137.6, 142, 33, 2.2, 'cyan'))
  mark(3, 0, 138, 33, 140)

  volumes.push({
    id: 'trophy',
    kind: 'trophy',
    minX: -1.4,
    maxX: 1.4,
    minY: 33.2,
    maxY: 36.5,
    minZ: 136.2,
    maxZ: 140.5,
    index: 0,
    innerRadius: 0,
  })

  const route: RoutePoint[] = [
    { x: 3.6, y: 0, z: 8 },
    { x: 3.6, y: 4, z: 24 },
    { x: 3.6, y: 8, z: 40 },
    { x: 3.6, y: 12, z: 50 },
    { x: 4.8, y: 12, z: 64 },
    { x: 4.8, y: 12, z: 76 },
    { x: 2, y: 18, z: 90 },
    { x: 2, y: 26, z: 108 },
    { x: 6.8, y: 30, z: 122 },
    { x: 0, y: 30, z: 132 },
    { x: 0, y: 33, z: 138 },
  ]

  return assemble({
    record: RECORD,
    courseId: windy ? `${RECORD.id}__windy` : RECORD.id,
    boxes,
    spawns: gridSpawns(10, 1.2, 0, 2.2, 0, 0, 5),
    finish: { minX: -1.6, maxX: 1.6, minZ: 136.4, maxZ: 141, minFeetY: 32.8 },
    volumes,
    checkpoints,
    route,
    jumpGaps: [],
    launches: [{ along: 70, x: -3, y: 13.2, z: 64, floorY: 12 }],
    trophy: { x: 0, y: 35, z: 138 },
    pieces,
  })
}

export const SUMMIT_GRAB = buildSummitGrab()
