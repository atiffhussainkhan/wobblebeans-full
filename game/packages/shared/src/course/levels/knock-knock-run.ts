import { makeKit } from '../../obstacles/kit'
import type { CourseBox } from '../foundation-gauntlet'
import {
  addDoorRow,
  assemble,
  box,
  gridSpawns,
  movingBox,
  padsAt,
  railZ,
  ramp,
  slab,
} from '../build'
import type { Checkpoint, LevelDef, LevelRecord, RoutePoint, Volume } from '../schema'
import type { KitPieceId } from '../../obstacles/types'

const RECORD: LevelRecord = {
  id: 'knock_knock_run',
  nameKey: 'level.knock_knock_run',
  type: 'COURSE',
  minPlayers: 8,
  maxPlayers: 40,
  rule: 'race',
  pctBySlot: { R1: 0.7, R2: 0.6 },
  slots: ['R1', 'R2'],
  fallbackAnySlot: false,
  divisor: 1,
  weight: 1,
  limitS: 180,
  variants: [
    { id: 'easy', enabled: true, speedMult: 0.8, weight: 1, note: 'Two extra real doors per row and slower pushers.' },
    { id: 'base', enabled: true, speedMult: 1, weight: 1, note: 'R1 and R2 base layout.' },
    { id: 'faster', enabled: true, speedMult: 1.25, weight: 0.2, note: 'R2 only. Pushers cycle faster.' },
  ],
  enabled: true,
  goalKey: 'goal.knock_knock_run',
  goalCard: 'Bump doors. Find the open ones!',
  fall: 'respawn',
  killPlaneY: -10,
  respawnDelayS: 1.5,
  protectionS: 1,
}

export interface KnockOptions {
  variant?: 'base' | 'easy' | 'faster'
  seed?: number
}

/** Original five-row door course. The center door of each row is real. */
export function buildKnockKnock(opts: KnockOptions = {}): LevelDef {
  const variant = opts.variant ?? 'base'
  const seed = opts.seed ?? 1
  const extra = variant === 'easy' ? 2 : 0
  const pusherScale = variant === 'faster' ? 1.25 : variant === 'easy' ? 0.8 : 1
  const boxes: CourseBox[] = []
  const pieces: Array<{ boxId: string; piece: KitPieceId }> = []
  const route: RoutePoint[] = []
  const checkpoints: Checkpoint[] = []
  const volumes: Volume[] = []
  const jumpZs: number[] = []
  let along = 0

  const track = (z0: number, z1: number, y: number) => {
    const steps = Math.max(1, Math.round(Math.abs(z1 - z0) / 4))
    for (let i = 1; i <= steps; i++) route.push({ x: 0, y, z: z0 + ((z1 - z0) * i) / steps })
    along += Math.abs(z1 - z0)
  }

  boxes.push(slab('start', 0, 0, 18, 0, 12))
  boxes.push(railZ('start-l', -12.3, 0, 18, 0))
  boxes.push(railZ('start-r', 12.3, 0, 18, 0))
  track(0, 18, 0)

  boxes.push(ramp('ramp-a', 0, 17.2, 40, 0, 1.2, 8))
  boxes.push(slab('after-ramp', 0, 38, 48, 1.2, 14, 'mint'))
  track(18, 46, 1.2)

  const placeRow = (id: string, count: number, reals: number, zRow: number, floorY: number, cp: number) => {
    addDoorRow(boxes, pieces, id, zRow, floorY, count, reals + extra, seed + cp * 13)
    const cpz = zRow + 3.2
    checkpoints.push({ index: cp, along, pads: padsAt(0, cpz, floorY) })
    volumes.push({
      id: `cp-${cp}`,
      kind: 'checkpoint',
      minX: -6,
      maxX: 6,
      minY: floorY - 0.5,
      maxY: floorY + 2.5,
      minZ: zRow + 1.2,
      maxZ: zRow + 4.6,
      index: cp,
      innerRadius: 0,
    })
  }

  placeRow('row-a', 8, 5, 44, 1.2, 1)
  boxes.push(slab('meadow', 0, 46, 78, 1.2, 12, 'mint'))
  boxes.push(railZ('meadow-l', -12.2, 48, 76, 1.2, 0.8))
  boxes.push(railZ('meadow-r', 12.2, 48, 76, 1.2, 0.8))
  const bumperX = [-8.2, -5.4, 5.4, 8.2, -6.6, 6.6]
  bumperX.forEach((x, index) => {
    const id = `bumper-${index}`
    boxes.push(
      movingBox(id, 0.75, 0.7, 0.75, x, 1.9, 52 + index * 3.6, 'orange', 'bumper', 'sine', {
        axis: 'x',
        amplitude: makeKit('bumper', 'sine').amplitude,
        period: 4,
        phase: index * 0.6,
        dir: 1,
      }),
    )
    pieces.push({ boxId: id, piece: 'bumper' })
  })
  track(46, 80, 1.2)

  boxes.push(slab('row-b-floor', 0, 76, 90, 1.2, 14, 'oat'))
  placeRow('row-b', 7, 3, 84, 1.2, 2)
  boxes.push(slab('pushers', 0, 88, 124, 1.2, 12, 'oat'))
  boxes.push(railZ('push-l', -12.2, 90, 122, 1.2, 0.9))
  boxes.push(railZ('push-r', 12.2, 90, 122, 1.2, 0.9))
  const lanes = [-8, 2.7, 8]
  lanes.forEach((x, lane) => {
    for (let n = 0; n < 4; n++) {
      const id = `pusher-${lane}-${n}`
      boxes.push(
        movingBox(id, 1, 0.85, 0.9, x, 2.05, 94 + n * 7, 'plum', 'pusher', 'pusher', {
          axis: 'x',
          dir: x >= 0 ? 1 : -1,
          phase: lane * 0.75,
          period: 3 / pusherScale,
          amplitude: 3,
          speed: 4 * pusherScale,
        }),
      )
      pieces.push({ boxId: id, piece: 'pusher' })
    }
  })
  track(80, 126, 1.2)

  boxes.push(slab('row-c-floor', 0, 122, 136, 1.2, 12, 'mint'))
  placeRow('row-c', 6, 3, 130, 1.2, 3)
  boxes.push(slab('bridge', 0, 134, 160, 1.2, 4.2, 'oat'))
  boxes.push(railZ('bridge-l', -4.6, 134, 160, 1.2))
  boxes.push(railZ('bridge-r', 4.6, 134, 160, 1.2))
  for (const [index, x] of [3.3, -3.3].entries()) {
    const id = `bridge-bumper-${index}`
    boxes.push(movingBox(id, 0.7, 0.65, 0.7, x, 1.85, 146, 'orange', 'bumper', 'static'))
    pieces.push({ boxId: id, piece: 'bumper' })
  }
  track(126, 162, 1.2)

  boxes.push(slab('row-d-floor', 0, 158, 172, 1.2, 12, 'mint'))
  placeRow('row-d', 5, 2, 166, 1.2, 4)
  boxes.push(ramp('uphill', 0, 170, 202, 1.2, 3.4, 6))
  boxes.push(slab('uphill-crown', 0, 199, 210, 3.4, 8, 'lime'))
  track(162, 206, 3.4)

  boxes.push(slab('row-e-floor', 0, 206, 218, 3.4, 10, 'oat'))
  placeRow('row-e', 4, 1, 214, 3.4, 5)
  const sprintY = 3.4
  boxes.push(railZ('sprint-l', -6.4, 216, 250, sprintY, 0.8))
  boxes.push(railZ('sprint-r', 6.4, 216, 250, sprintY, 0.8))
  boxes.push(slab('sprint-a', 0, 216, 226, sprintY, 6, 'cyan'))
  const lip1 = 226
  jumpZs.push(lip1 - 0.7)
  boxes.push(slab('sprint-b', 0, lip1 + 2.4, lip1 + 10, sprintY, 6, 'cyan'))
  const lip2 = lip1 + 10
  jumpZs.push(lip2 - 0.7)
  boxes.push(slab('sprint-c', 0, lip2 + 2.4, lip2 + 12, sprintY, 8, 'cyan'))
  route.push({ x: 0, y: sprintY, z: lip1 - 1, jump: true })
  route.push({ x: 0, y: sprintY, z: lip2 - 1, jump: true })
  track(218, lip2 + 12, sprintY)

  const finishZ = lip2 + 10
  boxes.push(slab('finish-floor', 0, finishZ, finishZ + 14, sprintY, 9, 'cyan'))
  boxes.push(box('arch-l', 0.4, 2.2, 0.4, -8, sprintY + 2.2, finishZ + 8, 'cocoa'))
  boxes.push(box('arch-r', 0.4, 2.2, 0.4, 8, sprintY + 2.2, finishZ + 8, 'cocoa'))
  track(finishZ, finishZ + 8, sprintY)

  return assemble({
    record: RECORD,
    courseId: variant === 'base' ? RECORD.id : `${RECORD.id}__${variant}`,
    boxes,
    spawns: gridSpawns(40, 1.2, 0, 3, 0, 0, 8),
    finish: { minX: -8, maxX: 8, minZ: finishZ + 2, maxZ: finishZ + 12, minFeetY: sprintY - 0.2 },
    jumpZs,
    volumes,
    checkpoints,
    route,
    jumpGaps: [2.4, 2.4],
    pieces,
    stoneX: 0,
  })
}

export const KNOCK_KNOCK_RUN = buildKnockKnock()
