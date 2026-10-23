import type { CourseBox } from '../foundation-gauntlet'
import type { KitPieceId } from '../../obstacles/types'
import { WALL_SLOTS } from '../../obstacles/motion'
import { assemble, movingBox } from '../build'
import type { SpawnPoint } from '../foundation-gauntlet'
import type { LevelDef, LevelRecord } from '../schema'

const RECORD: LevelRecord = {
  id: 'wall_dodge',
  nameKey: 'level.wall_dodge',
  type: 'SURVIVAL',
  minPlayers: 6,
  maxPlayers: 32,
  rule: 'survival',
  pctBySlot: { R2: 0.6, R3: 0.6 },
  slots: ['R2', 'R3'],
  fallbackAnySlot: false,
  divisor: 1,
  weight: 1,
  limitS: 105,
  variants: [
    { id: 'r2', enabled: true, speedMult: 1, weight: 1, note: 'Phases 1 and 2. Phase 2 holds to the end.' },
    { id: 'r3', enabled: true, speedMult: 1, weight: 1, note: 'Full three phases, including the side squeeze.' },
  ],
  enabled: true,
  goalKey: 'goal.wall_dodge',
  goalCard: 'Find the gap in the wall!',
  fall: 'eliminate',
  killPlaneY: -10,
  respawnDelayS: 0,
  protectionS: 0,
}

/** Walls are pusher-block panels (K7), not a twelfth obstacle (I-4). */
export function buildWallDodge(opts: { variant?: 'r2' | 'r3' } = {}): LevelDef {
  const phase3 = opts.variant === 'r3'
  const boxes: CourseBox[] = []
  const pieces: Array<{ boxId: string; piece: KitPieceId }> = []
  boxes.push({
    id: 'platform',
    hx: 14,
    hy: 0.5,
    hz: 10,
    x: 14,
    y: -0.5,
    z: 0,
    rx: 0,
    role: 'oat',
    mover: null,
  })
  // Side rails only. The back edge (low X) stays open so a push off the back is out.
  boxes.push({
    id: 'rail-s',
    hx: 14,
    hy: 0.55,
    hz: 0.25,
    x: 14,
    y: 0.55,
    z: -10.4,
    rx: 0,
    role: 'cocoa',
    mover: null,
  })
  boxes.push({
    id: 'rail-n2',
    hx: 14,
    hy: 0.55,
    hz: 0.25,
    x: 14,
    y: 0.55,
    z: 10.4,
    rx: 0,
    role: 'cocoa',
    mover: null,
  })
  for (let slot = 0; slot < WALL_SLOTS; slot++) {
    for (let panel = 0; panel < 5; panel++) {
      const id = `wall-${slot}-${panel}`
      boxes.push(
        movingBox(id, 0.45, 1.4, 2, 0, 1.4, 0, 'plum', 'pusher', 'travel', {
          slot,
          panel,
          phase3,
          dv: 10,
          speed: 3,
          ragdoll: 'stumble',
        }),
      )
      pieces.push({ boxId: id, piece: 'pusher' })
    }
  }
  // 0.6 m jump beams. Buried until phase 2, with a 3 m gap so a jump is enough.
  for (const [index, x] of [12, 18].entries()) {
    const id = `beam-${index}`
    boxes.push(
      movingBox(id, 0.3, 0.3, 3.2, x, 0.3, -3.4, 'orange', 'pusher', 'rise', {
        loop: 45,
      }),
    )
    boxes.push(
      movingBox(`${id}b`, 0.3, 0.3, 3.2, x, 0.3, 3.4, 'orange', 'pusher', 'rise', {
        loop: 45,
      }),
    )
  }
  if (phase3) {
    boxes.push(
      movingBox('squeeze', 4, 1.1, 3, 20, 1.1, -7, 'cocoa', 'pusher', 'rise', {
        loop: 87,
        ragdoll: 'stumble',
        dv: 10,
      }),
    )
  }

  const slime = (id: string, minX: number, maxX: number) => ({
    id,
    kind: 'slime' as const,
    minX,
    maxX,
    minY: -8,
    maxY: 2,
    minZ: -20,
    maxZ: 20,
    index: 0,
    innerRadius: 0,
  })

  return assemble({
    record: RECORD,
    courseId: phase3 ? `${RECORD.id}__r3` : RECORD.id,
    boxes,
    spawns: wallSpawns(),
    finish: { minX: 500, maxX: 501, minZ: 500, maxZ: 501, minFeetY: 0 },
    volumes: [slime('back', -12, -0.2), slime('front', 28.2, 48)],
    pieces,
  })
}

function wallSpawns(): SpawnPoint[] {
  const cols = 8
  const spawns: SpawnPoint[] = []
  for (let i = 0; i < 32; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    spawns.push({
      x: 4.5 + row * 1.2,
      feetY: 0,
      z: (col - (cols - 1) / 2) * 1.2,
      yaw: 0,
    })
  }
  return spawns
}

export const WALL_DODGE = buildWallDodge()
