import type { CourseBox } from '../foundation-gauntlet'
import type { KitPieceId } from '../../obstacles/types'
import { assemble, movingBox, ringSpawns } from '../build'
import type { LevelDef, LevelRecord } from '../schema'

const RECORD: LevelRecord = {
  id: 'beam_hop',
  nameKey: 'level.beam_hop',
  type: 'SURVIVAL',
  minPlayers: 6,
  maxPlayers: 32,
  rule: 'survival',
  pctBySlot: { R2: 0.6, R3: 0.6 },
  slots: ['R2', 'R3'],
  fallbackAnySlot: false,
  divisor: 1,
  weight: 1,
  limitS: 90,
  variants: [
    { id: 'r2', enabled: true, speedMult: 1, weight: 1, note: 'Single low bar.' },
    { id: 'r3', enabled: true, speedMult: 1, weight: 1, note: 'Low bar plus a counter-rotating high bar.' },
  ],
  enabled: true,
  goalKey: 'goal.beam_hop',
  goalCard: 'Jump the spinning bar!',
  fall: 'eliminate',
  killPlaneY: -10,
  respawnDelayS: 0,
  protectionS: 0,
}

const SPIN = {
  speed: 40,
  speedMult: 1,
  amplitude: 2.6,
  loop: 10,
  origin: 85,
  escalate: true,
  length: 4.8,
  axis: 'y' as const,
}

/** Square plaza the size of the r=9 disc. Spin bars orbit and leave the hub empty. */
export function buildBeamHop(opts: { variant?: 'r2' | 'r3' } = {}): LevelDef {
  const r3 = opts.variant === 'r3'
  const boxes: CourseBox[] = []
  const pieces: Array<{ boxId: string; piece: KitPieceId }> = []
  boxes.push({
    id: 'plaza',
    hx: 9,
    hy: 0.35,
    hz: 9,
    x: 0,
    y: -0.05,
    z: 0,
    rx: 0,
    role: 'oat',
    mover: null,
  })
  // Two radial halves so the pivot is not a solid hub.
  for (const [index, phase] of [0, Math.PI].entries()) {
    const id = `low-bar-${index}`
    boxes.push(
      movingBox(id, 3.2, 0.18, 0.28, 0, 1.0, 0, 'orange', 'spin_bar', 'spin', {
        ...SPIN,
        phase,
      }),
    )
    pieces.push({ boxId: id, piece: 'spin_bar' })
  }
  if (r3) {
    for (const [index, phase] of [0.4, Math.PI + 0.4].entries()) {
      const id = `high-bar-${index}`
      boxes.push(
        movingBox(id, 3.2, 0.18, 0.28, 0, 2.35, 0, 'plum', 'spin_bar', 'spin', {
          speed: 25,
          length: 4.8,
          phase,
          dir: -1,
          wobble: true,
          period: 4,
          amplitude: 1,
          escalate: false,
          axis: 'y',
        }),
      )
      pieces.push({ boxId: id, piece: 'spin_bar' })
    }
  }
  // Slippery dome. Soft out-of-bounds after 3 s, fall rule at 5 s.
  boxes.push({
    id: 'hub',
    hx: 0.8,
    hy: 0.35,
    hz: 0.8,
    x: 0,
    y: 0.55,
    z: 0,
    rx: 0,
    role: 'plum',
    mover: null,
  })

  const moat = (id: string, minX: number, maxX: number, minZ: number, maxZ: number) => ({
    id,
    kind: 'slime' as const,
    minX,
    maxX,
    minY: -8,
    maxY: 0.15,
    minZ,
    maxZ,
    index: 0,
    innerRadius: 0,
  })

  return assemble({
    record: RECORD,
    courseId: r3 ? `${RECORD.id}__r3` : RECORD.id,
    boxes,
    spawns: ringSpawns(32, 6.3, 0.3, Math.PI / 32),
    finish: { minX: 500, maxX: 501, minZ: 500, maxZ: 501, minFeetY: 0 },
    volumes: [
      moat('moat-w', -30, -9.1, -30, 30),
      moat('moat-e', 9.1, 30, -30, 30),
      moat('moat-s', -9.1, 9.1, -30, -9.1),
      moat('moat-n', -9.1, 9.1, 9.1, 30),
      {
        id: 'hub-oob',
        kind: 'soft-oob',
        minX: -3,
        maxX: 3,
        minY: 0.4,
        maxY: 3,
        minZ: -3,
        maxZ: 3,
        index: 0,
        innerRadius: 1.2,
      },
    ],
    pieces,
    slime: null,
  })
}

export const BEAM_HOP = buildBeamHop()
