import type { CourseDef, SpawnPoint } from './foundation-gauntlet'
import type { SurfaceZone } from '../obstacles/pose'
import type { KitPieceId } from '../obstacles/types'
import type { SlimeParams } from '../obstacles/motion'

/**
 * Level record (FR-02-01). Goal-card copy lives here for the show UI.
 * It is never written into a snapshot or an event. Preset ids stay on the wire.
 *
 * `CourseDef` is unchanged. Levels add volumes, checkpoints, and qualify data
 * beside it. `BeanWorld` only reads the course. The course director reads the rest.
 */

export type RoundSlot = 'R1' | 'R2' | 'R3' | 'F'
export type LevelType = 'COURSE' | 'COURSE_SLIME' | 'SURVIVAL' | 'POINTS' | 'FINAL'
export type QualifyMode = 'race' | 'survival' | 'points' | 'last-standing' | 'trophy'
export type FallRule = 'respawn' | 'eliminate' | 'checkpoint-or-slime'

export interface LevelVariant {
  id: string
  enabled: boolean
  speedMult: number
  weight: number
  /** Picture-card stays on the base record. This is a designer note, not wire text. */
  note: string
}

export interface LevelRecord {
  id: string
  nameKey: string
  type: LevelType
  minPlayers: number
  maxPlayers: number
  rule: QualifyMode
  pctBySlot: Partial<Record<RoundSlot, number>>
  slots: RoundSlot[]
  /** Tile Drop is the Main Show fallback. In a non-final slot it uses the survival quota (I-5). */
  fallbackAnySlot: boolean
  divisor: number
  weight: number
  limitS: number
  variants: LevelVariant[]
  enabled: boolean
  goalKey: string
  /** At most 8 words. One icon is the UI's job. */
  goalCard: string
  fall: FallRule
  killPlaneY: number
  respawnDelayS: number
  protectionS: number
}

export interface Volume {
  id: string
  kind: 'checkpoint' | 'slime' | 'trophy' | 'pit' | 'soft-oob' | 'finish'
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  index: number
  /**
   * Slime on Beam Hop: ignore points inside this radius (the platform).
   * Soft out-of-bounds: the volume is the disc of this radius.
   */
  innerRadius: number
}

export interface Checkpoint {
  index: number
  /** Distance along the route, metres. The 12 s rule compares these. */
  along: number
  pads: SpawnPoint[]
}

export interface RoutePoint {
  x: number
  y: number
  z: number
  jump?: boolean
}

export interface LaunchSite {
  along: number
  x: number
  y: number
  z: number
  floorY: number
}

export interface TrophySite {
  x: number
  y: number
  z: number
}

export interface LevelDef {
  record: LevelRecord
  course: CourseDef
  volumes: Volume[]
  zones: SurfaceZone[]
  checkpoints: Checkpoint[]
  route: RoutePoint[]
  /** Width of each jump gap on the move-and-jump line. Each must be ≤ 3 m. */
  jumpGaps: number[]
  launches: LaunchSite[]
  trophy: TrophySite | null
  slime: SlimeParams | null
  pieces: Array<{ boxId: string; piece: KitPieceId }>
}

/** Preset elimination slate. The show UI may render this. It is never player text. */
export const OUT_SLATE = 'Out this time - great try!'

export function goalWordCount(card: string): number {
  return card.trim().split(/\s+/).filter(Boolean).length
}

export function assertLevelRecord(record: LevelRecord): void {
  if (!/^[a-z][a-z0-9_]*$/.test(record.id)) {
    throw new Error(`level id ${record.id} must be snake_case`)
  }
  if (record.nameKey !== `level.${record.id}`) {
    throw new Error(`level ${record.id} nameKey must be level.${record.id}`)
  }
  if (record.goalKey !== `goal.${record.id}`) {
    throw new Error(`level ${record.id} goalKey must be goal.${record.id}`)
  }
  const words = goalWordCount(record.goalCard)
  if (words < 1 || words > 8) {
    throw new Error(`level ${record.id} goal card has ${words} words`)
  }
  if (record.minPlayers < 1 || record.maxPlayers < record.minPlayers) {
    throw new Error(`level ${record.id} has a bad player range`)
  }
  if (record.limitS <= 0) throw new Error(`level ${record.id} needs a time limit`)
  if (!Number.isFinite(record.killPlaneY)) throw new Error(`level ${record.id} kill plane is not finite`)
}

/** Nearest integer, halves go down. 22.5 → 22, 7.8 → 8. */
export function roundHalfDown(value: number): number {
  const scaled = Math.round(value * 1e9) / 1e9
  return Math.ceil(scaled - 0.5 - 1e-12)
}

/** Quota = clamp(round_half_down(N × pct), 1, N − 1). */
export function qualifyQuota(playerCount: number, pct: number): number {
  if (playerCount <= 1) return 1
  const raw = roundHalfDown(playerCount * pct)
  return Math.max(1, Math.min(playerCount - 1, raw))
}

export function pointInVolume(volume: Volume, x: number, y: number, z: number): boolean {
  if (x < volume.minX || x > volume.maxX || y < volume.minY || y > volume.maxY || z < volume.minZ || z > volume.maxZ) {
    return false
  }
  const cx = (volume.minX + volume.maxX) / 2
  const cz = (volume.minZ + volume.maxZ) / 2
  const radius = Math.hypot(x - cx, z - cz)
  if (volume.kind === 'slime' && volume.innerRadius > 0 && radius < volume.innerRadius) return false
  if (volume.kind === 'soft-oob' && volume.innerRadius > 0 && radius > volume.innerRadius) return false
  return true
}
