import { CAPSULE_CENTER, feetY, PHYSICS } from '../physics/constants'
import type { BeanState } from '../physics/types'
import type { CourseDef, SpawnPoint } from './foundation-gauntlet'
import { inFinish } from './foundation-gauntlet'
import { DOOR_BREAK_SPEED, TILE_VANISH_S, spinBarHit } from '../obstacles/kit'
import { slimeHeight, tiltStep } from '../obstacles/motion'
import { obbOverlap, queueImpulse, queueSpeedMult, sampleMoverPose } from '../obstacles/pose'
import { readKit, type BoxKit } from '../obstacles/types'
import { levelForCourse } from './registry'
import {
  pickTailHolders,
  qualifyRound,
  type QualifyResult,
  type RoundActor,
} from './qualify'
import { pointInVolume, qualifyQuota, type LevelDef } from './schema'

/**
 * Per-show obstacle brain. `BeanWorld.step` calls `courseDirector` once, before
 * movers sync, so doors, tiles, conveyors, and hit impulses all read the server tick.
 * The gauntlet has no level record and the call returns immediately.
 *
 * Respawn delay is a lock on the checkpoint pad. The frozen world teleports any
 * bean whose feet cross -6 m back to the spawn pad in the same step, so the
 * 1.5 s wait cannot be spent in mid-air. See the workstream notes in registry.ts.
 */

export interface DirectorHost {
  tick: number
  readonly course: CourseDef
  ids(): number[]
  getState(id: number): BeanState | undefined
  applyState(state: BeanState): void
}

interface Actor extends RoundActor {
  cp: number
  lastFastTick: number
  invulnUntil: number
  lockUntil: number
  lockPad: SpawnPoint | null
  oobTicks: number
  tailImmuneUntil: number
}

export interface TileRemoval {
  id: string
  tick: number
}

const sims = new WeakMap<DirectorHost, CourseSim>()

export class CourseSim {
  readonly actors = new Map<number, Actor>()
  /** Tiles that reached the gone pose. The show sends these as EventKind.TileRemoved. */
  readonly removed: TileRemoval[] = []
  private readonly announced = new Set<string>()
  private seeded = false

  constructor(readonly level: LevelDef) {}

  checkpointOf(id: number): number {
    return this.actors.get(id)?.cp ?? 0
  }

  roster(): RoundActor[] {
    return [...this.actors.values()].map((actor) => ({
      id: actor.id,
      eliminated: actor.eliminated,
      finishTick: actor.finishTick,
      elimTick: actor.elimTick,
      score: actor.score,
      trophyTick: actor.trophyTick,
    }))
  }

  oobWarning(id: number): boolean {
    const actor = this.actors.get(id)
    if (!actor) return false
    const warn = 3 * PHYSICS.tickHz
    const fall = 5 * PHYSICS.tickHz
    return actor.oobTicks >= warn && actor.oobTicks < fall
  }

  qualify(opts: { tick?: number; playerCount?: number; quota?: number; final?: boolean; limitTick?: number } = {}): QualifyResult {
    const record = this.level.record
    const count = opts.playerCount ?? Math.max(1, this.actors.size)
    const slot = record.slots[0]
    const pct = (slot && record.pctBySlot[slot]) || 0.6
    return qualifyRound(this.roster(), {
      mode: record.rule,
      final: opts.final ?? true,
      quota: opts.quota ?? qualifyQuota(count, pct),
      tick: opts.tick ?? 0,
      limitTick: opts.limitTick ?? Math.round(record.limitS * PHYSICS.tickHz),
    })
  }

  /**
   * Server-confirmed tail steal. The new holder is immune for 1 s so the
   * tail cannot be snatched straight back (doc 02 §6).
   */
  stealTail(thiefId: number, victimId: number, tick: number): boolean {
    if (thiefId === victimId) return false
    const thief = this.actors.get(thiefId)
    const victim = this.actors.get(victimId)
    if (!thief || !victim || thief.eliminated || victim.eliminated) return false
    if (victim.score <= 0 || thief.score > 0) return false
    if (tick < victim.tailImmuneUntil) return false
    victim.score = 0
    thief.score = 1
    thief.tailImmuneUntil = tick + PHYSICS.tickHz
    return true
  }

  beforeStep(world: DirectorHost): void {
    const ids = world.ids()
    if (!this.seeded && ids.length && this.level.record.rule === 'points') {
      this.seedTails(ids)
      this.seeded = true
    }
    for (const id of ids) this.prepareActor(world, id)
    this.tiltPlanks(world)
    this.noteTileRemovals(world)
  }

  private seedTails(ids: number[]): void {
    const record = this.level.record
    const slot = record.slots[0]
    const pct = (slot && record.pctBySlot[slot]) || 0.6
    const holders = new Set(pickTailHolders(ids, qualifyQuota(ids.length, pct), 1))
    for (const id of ids) {
      const actor = this.ensure(id)
      actor.score = holders.has(id) ? 1 : 0
    }
  }

  private ensure(id: number): Actor {
    let actor = this.actors.get(id)
    if (!actor) {
      actor = {
        id,
        eliminated: false,
        finishTick: null,
        elimTick: null,
        score: 0,
        trophyTick: null,
        cp: 0,
        lastFastTick: -1000,
        invulnUntil: 0,
        lockUntil: 0,
        lockPad: null,
        oobTicks: 0,
        tailImmuneUntil: 0,
      }
      this.actors.set(id, actor)
    }
    return actor
  }

  private prepareActor(world: DirectorHost, id: number): void {
    const state = world.getState(id)
    if (!state) return
    const actor = this.ensure(id)
    const tick = world.tick
    if (actor.eliminated) {
      this.snap(world, state, holdPad(id), true)
      return
    }
    if (tick < actor.lockUntil && actor.lockPad) {
      this.snap(world, state, actor.lockPad, true)
      queueSpeedMult(world, id, 0)
      return
    }
    const feet = feetY(state.py)
    this.bankProgress(world, actor, state, feet, tick)
    if (actor.eliminated) {
      this.snap(world, state, holdPad(id), true)
      return
    }
    const speed = Math.hypot(state.vx, state.vz)
    if (speed >= DOOR_BREAK_SPEED) actor.lastFastTick = tick
    this.touchSpecials(world, actor, state, feet, tick)
    if (tick < actor.lockUntil) {
      queueSpeedMult(world, id, 0)
      return
    }
    if (tick < actor.invulnUntil) return
    this.hitHazards(world, actor, state, tick)
  }

  private bankProgress(world: DirectorHost, actor: Actor, state: BeanState, feet: number, tick: number): void {
    const level = this.level
    const slimeH = level.slime ? slimeHeight(tick, level.slime) : -1000
    for (const volume of level.volumes) {
      if (volume.kind === 'checkpoint' && pointInVolume(volume, state.px, feet, state.pz)) {
        const cp = level.checkpoints.find((entry) => entry.index === volume.index)
        if (cp && cp.pads[0] && cp.pads[0].feetY >= slimeH - 0.05) actor.cp = Math.max(actor.cp, volume.index)
      }
      if (volume.kind === 'trophy' && actor.trophyTick == null && pointInVolume(volume, state.px, state.py, state.pz)) {
        actor.trophyTick = tick
      }
    }
    if (actor.finishTick == null && (state.finished || inFinish(level.course, state.px, feet, state.pz))) {
      actor.finishTick = tick
    }
    if (actor.finishTick != null) return
    if (level.slime && feet <= slimeH) {
      this.eliminate(actor, tick)
      return
    }
    for (const volume of level.volumes) {
      if (volume.kind === 'slime' && pointInVolume(volume, state.px, feet, state.pz)) {
        this.eliminate(actor, tick)
        return
      }
    }
    let inOob = false
    for (const volume of level.volumes) {
      if (volume.kind === 'soft-oob' && pointInVolume(volume, state.px, feet, state.pz)) inOob = true
    }
    actor.oobTicks = inOob ? actor.oobTicks + 1 : 0
    if (actor.oobTicks >= 5 * PHYSICS.tickHz) {
      this.applyFall(world, actor, state, tick)
      return
    }
    let inPit = false
    for (const volume of level.volumes) {
      if (volume.kind === 'pit' && pointInVolume(volume, state.px, feet, state.pz)) inPit = true
    }
    if (feet < -3 || inPit) this.applyFall(world, actor, state, tick)
  }

  private applyFall(world: DirectorHost, actor: Actor, state: BeanState, tick: number): void {
    const rule = this.level.record.fall
    const cp = this.level.checkpoints.find((entry) => entry.index === actor.cp) ?? this.level.checkpoints[0]
    const slimeH = this.level.slime ? slimeHeight(tick, this.level.slime) : -1000
    const cpCovered = !cp || !cp.pads[0] || cp.pads[0].feetY < slimeH - 0.05
    if (rule === 'eliminate' || (rule === 'checkpoint-or-slime' && cpCovered)) {
      this.eliminate(actor, tick)
      return
    }
    if (!cp || !cp.pads.length) {
      this.eliminate(actor, tick)
      return
    }
    const pad = cp.pads[actor.id % cp.pads.length]!
    actor.lockPad = pad
    actor.lockUntil = tick + Math.round(this.level.record.respawnDelayS * PHYSICS.tickHz)
    actor.invulnUntil = actor.lockUntil + Math.round(this.level.record.protectionS * PHYSICS.tickHz)
    this.snap(world, state, pad, true)
  }

  private eliminate(actor: Actor, tick: number): void {
    if (actor.eliminated) return
    actor.eliminated = true
    actor.elimTick = tick
    actor.score = 0
  }

  private touchSpecials(world: DirectorHost, actor: Actor, state: BeanState, feet: number, tick: number): void {
    const recent = tick - actor.lastFastTick <= 15
    const speed = Math.hypot(state.vx, state.vz)
    for (const entry of world.course.boxes) {
      const kit = readKit(entry)
      if (!kit || kit.triggeredTick != null) continue
      const pose = sampleMoverPose(entry, tick)
      if (kit.motion === 'door' && kit.real && (speed >= DOOR_BREAK_SPEED || recent)) {
        if (obbOverlap(state.px, state.py, state.pz, pose, entry.hx, entry.hy, entry.hz, 0.75)) {
          kit.triggeredTick = tick
        }
      } else if (kit.motion === 'tile') {
        const top = pose.y + entry.hy
        const inside = Math.abs(state.px - pose.x) <= entry.hx + 0.15 && Math.abs(state.pz - pose.z) <= entry.hz + 0.15
        if (inside && feet <= top + 0.35 && feet >= top - 0.45) kit.triggeredTick = tick
      }
    }
  }

  private hitHazards(world: DirectorHost, actor: Actor, state: BeanState, tick: number): void {
    for (const entry of world.course.boxes) {
      const kit = readKit(entry)
      if (!kit || kit.motion === 'door' || kit.motion === 'tile' || kit.motion === 'rise') continue
      if (kit.motion === 'tilt' || kit.piece === 'conveyor' || kit.piece === 'slime') continue
      if (kit.motion === 'static' && kit.piece !== 'bumper') continue
      const pose = sampleMoverPose(entry, tick)
      if (pose.y < -20) continue
      const hit = obbOverlap(state.px, state.py, state.pz, pose, entry.hx, entry.hy, entry.hz, 0.4)
      if (!hit) continue
      this.applyHit(world, actor, state, kit, pose, tick)
      if (tick < actor.invulnUntil) return
    }
  }

  private applyHit(
    world: DirectorHost,
    actor: Actor,
    state: BeanState,
    kit: BoxKit,
    pose: { x: number; y: number; z: number },
    tick: number,
  ): void {
    const awayX = state.px - pose.x
    const awayZ = state.pz - pose.z
    const len = Math.hypot(awayX, awayZ) || 1
    let ix = (awayX / len) * kit.dv
    let iy = kit.dvUp
    let iz = (awayZ / len) * kit.dv
    let invuln = 0.5
    if (kit.piece === 'spin_bar') {
      const resolved = spinBarHit(state.grounded, kit.dv)
      ix = (awayX / len) * resolved.dv
      iz = (awayZ / len) * resolved.dv
      iy = 0
      invuln = resolved.tag === 'knockdown' ? 3.5 : 0.8
    } else if (kit.ragdoll === 'knockdown' || kit.piece === 'spin_mallet') {
      invuln = 3.5
    } else if (kit.ragdoll === 'stumble') {
      ix = kit.axis === 'z' ? 0 : kit.dir * kit.dv
      iz = kit.axis === 'z' ? kit.dir * kit.dv : 0
      iy = 0
      invuln = 0.8
    } else if (kit.piece === 'bumper') {
      invuln = 0.5
    }
    if (kit.motion === 'travel') {
      ix = kit.dv
      iy = 0
      iz = 0
      invuln = 0.8
    }
    queueImpulse(world, state.id, ix, iy, iz)
    actor.invulnUntil = tick + Math.round(invuln * PHYSICS.tickHz)
  }

  private tiltPlanks(world: DirectorHost): void {
    const tick = world.tick
    const dt = PHYSICS.dt
    for (const entry of world.course.boxes) {
      const kit = readKit(entry)
      if (!kit || kit.motion !== 'tilt') continue
      const pose = sampleMoverPose(entry, tick)
      let occupants = 0
      for (const id of world.ids()) {
        const state = world.getState(id)
        if (!state) continue
        const feet = feetY(state.py)
        const top = pose.y + entry.hy
        const on =
          Math.abs(feet - top) < 0.55 &&
          Math.abs(state.px - pose.x) <= entry.hx + 0.2 &&
          Math.abs(state.pz - pose.z) <= entry.hz + 0.2
        if (on) occupants += 1
      }
      const max = kit.amplitude > 0 ? kit.amplitude : (25 * Math.PI) / 180
      kit.tilt = tiltStep(kit.tilt, occupants, max, dt)
    }
  }

  private noteTileRemovals(world: DirectorHost): void {
    const tick = world.tick
    for (const entry of world.course.boxes) {
      const kit = readKit(entry)
      if (!kit || kit.motion !== 'tile') continue
      if (kit.triggeredTick == null) {
        this.announced.delete(entry.id)
        continue
      }
      const age = (tick - kit.triggeredTick) / PHYSICS.tickHz
      if (age < TILE_VANISH_S || this.announced.has(entry.id)) continue
      this.announced.add(entry.id)
      this.removed.push({ id: entry.id, tick })
    }
  }

  private snap(world: DirectorHost, state: BeanState, pad: SpawnPoint, lockVel: boolean): void {
    const next = { ...state }
    next.px = pad.x
    next.py = pad.feetY + CAPSULE_CENTER
    next.pz = pad.z
    next.yaw = pad.yaw
    if (lockVel) {
      next.vx = 0
      next.vy = 0
      next.vz = 0
      next.grounded = true
    }
    world.applyState(next)
  }
}

function holdPad(id: number): SpawnPoint {
  return { x: (id % 5) * 1.5 - 3, feetY: 80, z: -80, yaw: 0 }
}

export function courseDirector(world: DirectorHost): void {
  const level = levelForCourse(world.course.id)
  if (!level) return
  let sim = sims.get(world)
  if (!sim) {
    sim = new CourseSim(level)
    sims.set(world, sim)
  }
  sim.beforeStep(world)
}

export function directorFor(world: DirectorHost): CourseSim | null {
  return sims.get(world) ?? null
}
