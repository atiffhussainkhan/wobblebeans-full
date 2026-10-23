import type { CourseBox } from '../foundation-gauntlet'
import type { KitPieceId } from '../../obstacles/types'
import { makeKit } from '../../obstacles/kit'
import { assemble, box, gridSpawns, movingBox, padsAt, ramp, slab } from '../build'
import type { Checkpoint, LevelDef, LevelRecord, RoutePoint, Volume } from '../schema'

const RECORD: LevelRecord = {
  id: 'tail_chase',
  nameKey: 'level.tail_chase',
  type: 'POINTS',
  minPlayers: 6,
  maxPlayers: 32,
  rule: 'points',
  pctBySlot: { R2: 0.6, R3: 0.6 },
  slots: ['R2', 'R3'],
  fallbackAnySlot: false,
  divisor: 1,
  weight: 1,
  limitS: 120,
  variants: [
    { id: 'r2', enabled: true, speedMult: 1, weight: 1, note: 'At GO the tail count equals the quota. Intro art can show half the field beforehand.' },
    { id: 'r3', enabled: true, speedMult: 1, weight: 1, note: 'Two extra bumpers.' },
  ],
  enabled: true,
  goalKey: 'goal.tail_chase',
  goalCard: "Hold a tail when time's up!",
  fall: 'respawn',
  killPlaneY: -10,
  respawnDelayS: 1,
  protectionS: 1,
}

/**
 * Picnic hill. Fully railed, so the round is points rather than a fall.
 * Two tunnels sit under a split mound. Bumpers are the only kit piece (I-6).
 * Grab itself is a player verb owned by the character stream. `stealTail` confirms it.
 */
export function buildTailChase(opts: { variant?: 'r2' | 'r3' } = {}): LevelDef {
  const r3 = opts.variant === 'r3'
  const boxes: CourseBox[] = []
  const pieces: Array<{ boxId: string; piece: KitPieceId }> = []
  const bumpAmp = makeKit('bumper', 'sine').amplitude

  boxes.push(box('floor', 20, 0.5, 20, 0, -0.5, 0, 'oat'))
  boxes.push(box('rail-n', 20, 0.7, 0.3, 0, 0.7, 20.3, 'cocoa'))
  boxes.push(box('rail-s', 20, 0.7, 0.3, 0, 0.7, -20.3, 'cocoa'))
  boxes.push(box('rail-w', 0.3, 0.7, 20, -20.3, 0.7, 0, 'cocoa'))
  boxes.push(box('rail-e', 0.3, 0.7, 20, 20.3, 0.7, 0, 'cocoa'))

  // Split mound. The gap between the decks is a north-south tunnel.
  // The deck bottom sits at 1.9 m, so a 1.6 m bean can walk east-west underneath.
  // yTop 3.0 puts the underside at 2.0 m, clear of a 1.6 m bean.
  boxes.push(slab('deck-w', -4.2, -6, 6, 3, 3, 'mint'))
  boxes.push(slab('deck-e', 4.2, -6, 6, 3, 3, 'mint'))
  boxes.push(slab('bridge', 0, -1.2, 1.2, 3, 2.2, 'lime'))
  boxes.push(ramp('ramp-sw', -4.2, -16, -6.2, 0, 3, 2.2))
  boxes.push(ramp('ramp-se', 4.2, -16, -6.2, 0, 3, 2.2))
  boxes.push(ramp('ramp-nw', -4.2, 6.2, 16, 3, 0, 2.2))
  boxes.push(ramp('ramp-ne', 4.2, 6.2, 16, 3, 0, 2.2))

  const bumpers: Array<[number, number, number]> = [
    [-14, -8, 0],
    [14, -8, 1],
    [-14, 8, 2],
    [14, 8, 3],
    [0, 12, 4],
    [0, -12, 5],
  ]
  if (r3) {
    bumpers.push([-16, 0, 6], [16, 0, 7])
  }
  for (const [x, z, index] of bumpers) {
    const id = `bumper-${index}`
    boxes.push(
      movingBox(id, 0.75, 0.7, 0.75, x, 0.7, z, 'orange', 'bumper', 'sine', {
        axis: index % 2 === 0 ? 'x' : 'z',
        amplitude: bumpAmp,
        period: 4,
        phase: index * 0.8,
        dir: 1,
      }),
    )
    pieces.push({ boxId: id, piece: 'bumper' })
  }

  const checkpoints: Checkpoint[] = [
    { index: 0, along: 0, pads: padsAt(0, -16, 0) },
    { index: 1, along: 18, pads: padsAt(-4.2, 0, 3) },
  ]
  const volumes: Volume[] = checkpoints.map((cp) => ({
    id: `cp-${cp.index}`,
    kind: 'checkpoint' as const,
    minX: -6,
    maxX: 6,
    minY: cp.pads[0]!.feetY - 0.4,
    maxY: cp.pads[0]!.feetY + 2.4,
    minZ: cp.pads[0]!.z - 2,
    maxZ: cp.pads[0]!.z + 2,
    index: cp.index,
    innerRadius: 0,
  }))

  const route: RoutePoint[] = [
    { x: 0, y: 0, z: -16 },
    { x: -4.2, y: 1, z: -12 },
    { x: -4.2, y: 2.5, z: -4 },
    { x: -4.2, y: 2.5, z: 2 },
    { x: 4.2, y: 2.5, z: 2 },
    { x: 4.2, y: 1, z: 12 },
    { x: 0, y: 0, z: 16 },
    { x: 10, y: 0, z: 0 },
  ]

  return assemble({
    record: RECORD,
    courseId: r3 ? `${RECORD.id}__r3` : RECORD.id,
    boxes,
    spawns: gridSpawns(32, 1.2, 0, -18.2, 0, 0, 16),
    finish: { minX: 400, maxX: 401, minZ: 400, maxZ: 401, minFeetY: 0 },
    volumes,
    checkpoints,
    route,
    jumpGaps: [],
    pieces,
  })
}

export const TAIL_CHASE = buildTailChase()
