import { CHECKPOINT_FALL_BUDGET_S, CONVEYOR_SPEED_CAP, GAP_JUMP_MAX, SPAWN_SPACING_MIN, kitSpec } from '../obstacles/kit'
import { PHYSICS } from '../physics/constants'
import { readKit } from '../obstacles/types'
import { finishFinite, minSpawnSpacing } from './build'
import { assertLevelRecord, type LevelDef } from './schema'

const NAMED_LATER = new Set(['swap', 'windy', 'return'])

/** Structural checks for a level record, its kit tags, and the move-and-jump budget. */
export function auditLevel(level: LevelDef): string[] {
  const issues: string[] = []
  const id = level.record.id
  try {
    assertLevelRecord(level.record)
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err))
  }
  if (level.course.spawns.length < level.record.maxPlayers) {
    issues.push(`${id} has ${level.course.spawns.length} spawns for max ${level.record.maxPlayers}`)
  }
  if (level.course.spawns.length > 1) {
    const spacing = minSpawnSpacing(level.course.spawns)
    if (spacing < SPAWN_SPACING_MIN - 0.02) issues.push(`${id} spawn spacing ${spacing.toFixed(3)}`)
  }
  for (const gap of level.jumpGaps) {
    if (!(gap <= GAP_JUMP_MAX) || !Number.isFinite(gap)) issues.push(`${id} jump gap ${gap}`)
  }
  if (!finishFinite(level.course)) issues.push(`${id} finish volume is not finite`)
  if (!Number.isFinite(level.record.killPlaneY)) issues.push(`${id} kill plane`)

  let prev = -0.01
  for (const cp of level.checkpoints) {
    if (cp.along < prev) issues.push(`${id} checkpoints are out of order`)
    if (cp.pads.length < 1) issues.push(`${id} checkpoint ${cp.index} has no pads`)
    prev = cp.along
  }
  const budget = CHECKPOINT_FALL_BUDGET_S * PHYSICS.maxSpeed
  for (let i = 0; i < level.checkpoints.length; i++) {
    const from = i === 0 ? 0 : level.checkpoints[i - 1]!.along
    const delta = level.checkpoints[i]!.along - from
    if (delta > budget + 0.5) issues.push(`${id} checkpoint spacing ${delta.toFixed(1)} m`)
  }

  const boxes = new Map(level.course.boxes.map((entry) => [entry.id, entry]))
  for (const piece of level.pieces) {
    const spec = kitSpec(piece.piece)
    if (piece.piece === 'bumper' && spec.ragdoll !== 'none') issues.push(`${id} bumper tag`)
    const body = boxes.get(piece.boxId)
    if (!body) {
      issues.push(`${id} missing box ${piece.boxId}`)
      continue
    }
    const kit = readKit(body)
    if (!kit) {
      issues.push(`${id} box ${piece.boxId} has no kit`)
      continue
    }
    if (!kit.ragdoll) issues.push(`${id} ${piece.boxId} missing ragdoll`)
    if (kit.piece !== piece.piece) issues.push(`${id} ${piece.boxId} piece mismatch`)
    if (piece.piece === 'conveyor' && Math.abs(kit.speed) > CONVEYOR_SPEED_CAP + 1e-6) {
      issues.push(`${id} conveyor over cap`)
    }
  }
  for (const zone of level.zones) {
    if (Math.hypot(zone.vx, zone.vz) > CONVEYOR_SPEED_CAP + 1e-6) issues.push(`${id} zone over conveyor cap`)
  }
  for (const volume of level.volumes) {
    const nums = [volume.minX, volume.maxX, volume.minY, volume.maxY, volume.minZ, volume.maxZ]
    if (nums.some((value) => !Number.isFinite(value))) issues.push(`${id} volume ${volume.id} is not finite`)
  }
  for (const launch of level.launches) {
    if (!level.checkpoints.some((cp) => cp.along > launch.along + 1)) {
      issues.push(`${id} launcher has no checkpoint after it`)
    }
  }
  const variants = new Set<string>()
  for (const variant of level.record.variants) {
    if (variants.has(variant.id)) issues.push(`${id} duplicate variant ${variant.id}`)
    variants.add(variant.id)
    if (NAMED_LATER.has(variant.id) && variant.enabled) issues.push(`${id} ${variant.id} should stay disabled`)
  }
  if (id === 'knock_knock_run') {
    const rows = new Map<number, boolean>()
    for (const body of level.course.boxes) {
      const kit = readKit(body)
      if (!kit || kit.piece !== 'trick_door') continue
      const z = Math.round(body.z)
      rows.set(z, Boolean(rows.get(z)) || kit.real)
    }
    if (rows.size !== 5) issues.push(`${id} expected 5 door rows, saw ${rows.size}`)
    for (const [z, real] of rows) {
      if (!real) issues.push(`${id} door row ${z} has no real door`)
    }
  }
  return issues
}
