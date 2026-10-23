import type { CourseBox } from '../foundation-gauntlet'
import type { KitPieceId } from '../../obstacles/types'
import { makeKit } from '../../obstacles/kit'
import { attachKit } from '../../obstacles/types'
import {
  SLIME_RISE_FLOOD_LEAD_S,
  SLIME_RISE_GRACE_S,
  SLIME_RISE_HEIGHT,
  SLIME_RISE_LIMIT_S,
  SLIME_RISE_RATE,
} from '../../obstacles/motion'
import { assemble, gridSpawns, movingBox, padsAt, railZ, ramp, slab, slabX } from '../build'
import type { Checkpoint, LevelDef, LevelRecord, RoutePoint, Volume } from '../schema'

const RECORD: LevelRecord = {
  id: 'slime_rise',
  nameKey: 'level.slime_rise',
  type: 'COURSE_SLIME',
  minPlayers: 6,
  maxPlayers: 32,
  rule: 'race',
  pctBySlot: { R2: 0.6, R3: 0.6 },
  slots: ['R2', 'R3'],
  fallbackAnySlot: false,
  divisor: 1,
  weight: 1,
  limitS: SLIME_RISE_LIMIT_S,
  variants: [
    { id: 'easy', enabled: true, speedMult: 1, weight: 1, note: 'Grace grows from 3 s to 6 s.' },
    { id: 'base', enabled: true, speedMult: 1, weight: 1, note: 'R2 base climb.' },
    { id: 'faster', enabled: true, speedMult: 1.4, weight: 0.2, note: 'R3 mallets at ×1.4.' },
  ],
  enabled: true,
  goalKey: 'goal.slime_rise',
  goalCard: 'Climb up! Stay above the slime!',
  fall: 'checkpoint-or-slime',
  killPlaneY: -12,
  respawnDelayS: 1.5,
  protectionS: 1,
}

export function buildSlimeRise(opts: { variant?: 'base' | 'easy' | 'faster' } = {}): LevelDef {
  const variant = opts.variant ?? 'base'
  const malletScale = variant === 'faster' ? 1.4 : 1
  const grace = variant === 'easy' ? 6 : SLIME_RISE_GRACE_S
  const boxes: CourseBox[] = []
  const pieces: Array<{ boxId: string; piece: KitPieceId }> = []
  const checkpoints: Checkpoint[] = []
  const volumes: Volume[] = []

  const mark = (index: number, x: number, z: number, y: number, along: number) => {
    checkpoints.push({ index, along, pads: padsAt(x, z, y) })
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

  boxes.push(slab('start', 0, 0, 18, 0, 8))
  boxes.push(railZ('start-l', -8.2, 0, 18, 0, 0.8))
  boxes.push(railZ('start-r', 8.2, 0, 18, 0, 0.8))
  boxes.push(ramp('mallet-ramp', 0, 16, 58, 0, 10, 5))
  boxes.push(railZ('mallet-l', -5.3, 18, 56, 0, 1))
  boxes.push(railZ('mallet-r', 5.3, 18, 56, 0, 1))
  for (let i = 0; i < 4; i++) {
    const id = `mallet-${i}`
    const z = 28 + i * 7
    const rampY = ((z - 16) / (58 - 16)) * 10
    boxes.push(
      movingBox(id, 2, 0.35, 0.4, -3.3, rampY + 1.15, z, 'plum', 'spin_mallet', 'spin', {
        speed: 90 * malletScale,
        length: 2,
        axis: 'y',
      }),
    )
    pieces.push({ boxId: id, piece: 'spin_mallet' })
  }
  boxes.push(slab('deck-10', 0, 57.4, 74, 10, 8, 'mint'))
  mark(1, 2.4, 64, 10, 60)
  // Flat link onto the first belt. Starts on the deck, clear of the ramp face.
  boxes.push(slabX('to-belt', 67, -2, 22, 10, 5, 'oat'))

  // ~6° belts. A steeper belt plus a 3.5 m/s opposing conveyor stalls the step.
  // Belt 1 climbs toward -Z. Belt 2 climbs toward +Z.
  const beltLow = ramp('belt-low', 16, 2, 68, 17, 10, 4, 'orange')
  const beltHigh = ramp('belt-high', -8, 8, 74, 17, 24, 4, 'orange')
  attachKit(beltLow, makeKit('conveyor', 'static', { axis: 'z', dir: 1, speed: 3.5 }))
  attachKit(beltHigh, makeKit('conveyor', 'static', { axis: 'z', dir: -1, speed: 3.5 }))
  boxes.push(beltLow, beltHigh)
  pieces.push({ boxId: beltLow.id, piece: 'conveyor' }, { boxId: beltHigh.id, piece: 'conveyor' })

  // Landing face sits where the belt surface is within the 0.35 step (z ≈ 3.5).
  boxes.push(slab('low-turn', 16, -2, 3.5, 17, 6, 'mint'))
  boxes.push(slabX('low-cross', 1, -14, 22, 17, 2.4, 'oat'))
  boxes.push(slab('belt-2-in', -8, 0, 12, 17, 5, 'mint'))
  mark(2, 0, 1, 17, 126)

  boxes.push(slab('launch-deck', -2, 72.2, 92, 24, 12, 'oat'))
  boxes.push(
    movingBox('launch', 3, 0.35, 0.45, 8, 25.2, 80, 'plum', 'launch_arm', 'launch', {
      length: 6,
      speed: 120,
      dir: -1,
      dv: 20,
    }),
  )
  pieces.push({ boxId: 'launch', piece: 'launch_arm' })
  mark(3, -6, 86, 24, 196)

  boxes.push(ramp('swing-ramp', -4, 84, 136, 24, 40, 5))
  for (let i = 0; i < 3; i++) {
    const id = `swing-${i}`
    const z = 96 + i * 12
    const rampY = 24 + ((z - 84) / (136 - 84)) * 16
    boxes.push(
      movingBox(id, 0.7, 0.7, 0.7, -8.4, rampY + 1.3, z, 'plum', 'swing_ball', 'swing', {
        axis: 'x',
        length: 4.2,
        amplitude: 0.6,
        period: 4,
        phase: i * 1.3,
      }),
    )
    pieces.push({ boxId: id, piece: 'swing_ball' })
  }
  boxes.push(slab('deck-40', -4, 135.4, 148, 40, 6, 'mint'))
  mark(4, -3, 140, 40, 248)

  boxes.push(ramp('crown-ramp', -4, 140, 206, 40, 60, 5, 'lime'))
  boxes.push(slab('finish-deck', -4, 205.3, 220, 60, 7, 'cyan'))

  const route: RoutePoint[] = [
    { x: 2.6, y: 0, z: 8 },
    { x: 2.6, y: 6, z: 40 },
    { x: 2.6, y: 10, z: 64 },
    { x: 16, y: 10, z: 66 },
    { x: 16, y: 11, z: 56 },
    { x: 16, y: 13, z: 40 },
    { x: 16, y: 15, z: 24 },
    { x: 16, y: 16.5, z: 10 },
    { x: 16, y: 17, z: 1 },
    { x: -8, y: 17, z: 1 },
    { x: -8, y: 17, z: 10 },
    { x: -8, y: 19, z: 28 },
    { x: -8, y: 21, z: 46 },
    { x: -8, y: 23, z: 64 },
    { x: -6, y: 24, z: 78 },
    { x: -6, y: 24, z: 86 },
    { x: -3, y: 28, z: 98 },
    { x: -3, y: 34, z: 116 },
    { x: -3, y: 40, z: 140 },
    { x: -4, y: 48, z: 166 },
    { x: -4, y: 56, z: 190 },
    { x: -4, y: 60, z: 210 },
  ]

  return assemble({
    record: RECORD,
    courseId: variant === 'base' ? RECORD.id : `${RECORD.id}__${variant}`,
    boxes,
    spawns: gridSpawns(32, 1.2, 0, 3, 0, 0, 8),
    finish: { minX: -10, maxX: 2, minZ: 208, maxZ: 216, minFeetY: 59.5 },
    volumes,
    zones: [
      {
        minX: 11,
        maxX: 21,
        minY: 8,
        maxY: 20,
        minZ: 6,
        maxZ: 66,
        vx: 0,
        vy: 0,
        vz: 3.5,
        speedMult: 1,
      },
      {
        minX: -13,
        maxX: -3,
        minY: 15,
        maxY: 27,
        minZ: 12,
        maxZ: 72,
        vx: 0,
        vy: 0,
        vz: -3.5,
        speedMult: 1,
      },
    ],
    checkpoints,
    route,
    jumpGaps: [],
    launches: [{ along: 180, x: 8, y: 25.2, z: 80, floorY: 24 }],
    trophy: { x: -4, y: 62, z: 212 },
    slime: {
      graceS: grace,
      rate: SLIME_RISE_RATE,
      maxY: SLIME_RISE_HEIGHT,
      startY: -2,
      limitS: SLIME_RISE_LIMIT_S,
      floodLeadS: SLIME_RISE_FLOOD_LEAD_S,
    },
    pieces,
  })
}

export const SLIME_RISE = buildSlimeRise()
