import type { CourseBox, SpawnPoint } from '../foundation-gauntlet'
import type { KitPieceId } from '../../obstacles/types'
import { assemble, movingBox, ringSpawns } from '../build'
import type { LevelDef, LevelRecord, RoutePoint } from '../schema'

const RECORD: LevelRecord = {
  id: 'tile_drop',
  nameKey: 'level.tile_drop',
  type: 'FINAL',
  minPlayers: 2,
  maxPlayers: 20,
  rule: 'last-standing',
  pctBySlot: { R1: 0.6, R2: 0.6, R3: 0.6 },
  slots: ['F'],
  fallbackAnySlot: true,
  divisor: 1,
  weight: 1,
  limitS: 300,
  variants: [
    { id: 'layers', enabled: true, speedMult: 1, weight: 1, note: '3 layers for 8-12 players, 2 for 7 or fewer, 4 for 13-20.' },
    { id: 'return', enabled: false, speedMult: 1, weight: 0, note: 'Tiles come back after 6 s. Team-show fallback, disabled until that mode exists.' },
  ],
  enabled: true,
  goalKey: 'goal.tile_drop',
  goalCard: 'Tiles drop! Be last on top!',
  fall: 'eliminate',
  killPlaneY: -10,
  respawnDelayS: 0,
  protectionS: 0,
}

const RADII = [14, 16, 18, 20] as const

export function tileLayerCount(players: number): number {
  if (players >= 13) return 4
  if (players <= 7) return 2
  return 3
}

export function hexCenters(radius: number, across = 1.6): Array<{ x: number; z: number }> {
  const dx = across
  const dz = (across * Math.sqrt(3)) / 2
  const qMax = Math.ceil(radius / dx) + 1
  const out: Array<{ x: number; z: number }> = []
  for (let q = -qMax; q <= qMax; q++) {
    for (let r = -qMax; r <= qMax; r++) {
      const x = dx * (q + r / 2)
      const z = dz * r
      if (x * x + z * z <= radius * radius) out.push({ x, z })
    }
  }
  return out
}

function snapSpawns(count: number, tiles: readonly { x: number; z: number }[], feetY: number): SpawnPoint[] {
  const ring = ringSpawns(count, 4.2, feetY, 0.2)
  const used = new Set<number>()
  return ring.map((spawn) => {
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < tiles.length; i++) {
      if (used.has(i)) continue
      const tile = tiles[i]!
      const d = (tile.x - spawn.x) ** 2 + (tile.z - spawn.z) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) return spawn
    used.add(best)
    const tile = tiles[best]!
    return { ...spawn, x: tile.x, z: tile.z }
  })
}

/**
 * Original circular stack. Hex tiles are 1.6 m apart.
 * Clear gap to the next tile is about 0.16 m, which a capsule can walk.
 * After one tile drops, the hop to the next is about 1.8 m. Dive is never required.
 * In a non-final slot the same layout uses the survival quota (I-5).
 */
export function buildTileDrop(opts: { players?: number; variant?: 'base' | 'return' } = {}): LevelDef {
  const players = opts.players ?? 10
  const returning = opts.variant === 'return'
  const layers = tileLayerCount(players)
  const boxes: CourseBox[] = []
  const pieces: Array<{ boxId: string; piece: KitPieceId }> = []
  const roles = ['oat', 'mint', 'cyan', 'lime'] as const
  let top: Array<{ x: number; z: number }> = []

  for (let layer = 0; layer < layers; layer++) {
    const radius = RADII[layer] ?? 14
    const yTop = (layers - 1 - layer) * 8
    const centers = hexCenters(radius)
    if (layer === 0) top = centers
    centers.forEach((center, index) => {
      const id = `tile-${layer}-${index}`
      boxes.push(
        movingBox(id, 0.72, 0.22, 0.72, center.x, yTop - 0.22, center.z, roles[layer] ?? 'oat', 'drop_tile', 'tile', {
          loop: returning ? 6 : 0,
        }),
      )
      pieces.push({ boxId: id, piece: 'drop_tile' })
    })
  }

  const topY = (layers - 1) * 8
  const courseId = returning ? `${RECORD.id}__return` : layers === 3 ? RECORD.id : `${RECORD.id}__layers${layers}`
  const route: RoutePoint[] = []
  if (top.length > 1) {
    const origin = top.reduce((best, tile) => (tile.x * tile.x + tile.z * tile.z < best.x * best.x + best.z * best.z ? tile : best), top[0]!)
    const neighbor = top
      .filter((tile) => tile !== origin)
      .reduce((best, tile) => {
        const d = (tile.x - origin.x) ** 2 + (tile.z - origin.z) ** 2
        const bd = (best.x - origin.x) ** 2 + (best.z - origin.z) ** 2
        return d < bd ? tile : best
      }, top[1]!)
    route.push({ x: origin.x, y: topY, z: origin.z }, { x: neighbor.x, y: topY, z: neighbor.z, jump: true })
  }

  return assemble({
    record: RECORD,
    courseId,
    boxes,
    spawns: snapSpawns(20, top, topY),
    finish: { minX: 500, maxX: 501, minZ: 500, maxZ: 501, minFeetY: topY },
    volumes: [
      {
        id: 'slime',
        kind: 'slime',
        minX: -40,
        maxX: 40,
        minY: -12,
        maxY: -0.5,
        minZ: -40,
        maxZ: 40,
        index: 0,
        innerRadius: 0,
      },
    ],
    route,
    jumpGaps: [1.8],
    pieces,
  })
}

export const TILE_DROP = buildTileDrop()
