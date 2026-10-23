import { FOUNDATION_COURSE, inFinish, moverOffset, type CourseBox, type CourseDef } from '../course/foundation-gauntlet'
import { CAPSULE_CENTER, PHYSICS, feetY } from './constants'
import { resolveBumps } from '../character/bumps'
import { clearForRespawn } from '../character/state'
import { makeBean, stepKinematics } from './integrate'
import { quatFromXRotation } from './math'
import {
  NEUTRAL_SURFACE,
  type BeanState,
  type InputFrame,
  type SurfaceModifiers,
} from './types'

type RapierApi = typeof import('@dimforge/rapier3d-compat').default

let rapierPromise: Promise<RapierApi> | null = null

export function loadRapier(): Promise<RapierApi> {
  if (!rapierPromise) {
    // The package "main" is CommonJS, which Node refuses inside this ESM repo.
    // The ES build inits the same WASM and is what the browser bundle loads.
    rapierPromise = import('@dimforge/rapier3d-compat/rapier.es.js').then(async (mod) => {
      const api = mod.default
      await api.init()
      return api
    })
  }
  return rapierPromise
}

interface BodySlot {
  body: InstanceType<RapierApi['RigidBody']>
  collider: InstanceType<RapierApi['Collider']>
}

interface MoverSlot extends BodySlot {
  def: CourseBox
}

/**
 * One Rapier world running the shared kinematic bean step.
 * The server holds every bean. A predicting client holds only its own bean
 * plus the same static course and server-timed movers.
 */
export class BeanWorld {
  readonly course: CourseDef
  tick = 0
  /**
   * Predicting clients set this false so a grabbed pose stays on the
   * snapshot instead of being simulated without the other bean (D-04).
   */
  authoritative = true
  private readonly R: RapierApi
  private readonly world: InstanceType<RapierApi['World']>
  private readonly controller: InstanceType<RapierApi['KinematicCharacterController']>
  private readonly beans = new Map<number, BodySlot>()
  private readonly states = new Map<number, BeanState>()
  private readonly movers: MoverSlot[] = []
  private destroyed = false

  private constructor(R: RapierApi, course: CourseDef) {
    this.R = R
    this.course = course
    this.world = new R.World({ x: 0, y: 0, z: 0 })
    for (const def of course.boxes) {
      const slot = this.makeBox(def, def.mover !== null)
      if (def.mover) this.movers.push({ ...slot, def })
    }
    this.controller = this.world.createCharacterController(0.02)
    this.controller.setSlideEnabled(true)
    this.controller.enableSnapToGround(0.28)
    this.controller.enableAutostep(PHYSICS.stepOffset, 0.2, true)
    this.controller.setMaxSlopeClimbAngle((PHYSICS.slopeLimitDeg * Math.PI) / 180)
    this.controller.setMinSlopeSlideAngle(((PHYSICS.slopeLimitDeg + 8) * Math.PI) / 180)
    this.controller.setApplyImpulsesToDynamicBodies(false)
    this.world.step()
  }

  static async create(course: CourseDef = FOUNDATION_COURSE): Promise<BeanWorld> {
    const R = await loadRapier()
    return new BeanWorld(R, course)
  }

  spawn(id: number, spawnIndex: number): BeanState {
    const spawn = this.course.spawns[spawnIndex % this.course.spawns.length] ?? this.course.spawns[0]
    if (!spawn) throw new Error('course has no spawns')
    const py = spawn.feetY + CAPSULE_CENTER
    return this.addBean(makeBean(id, spawn.x, py, spawn.z, spawnIndex), spawn.yaw)
  }

  /** Insert a bean at an explicit pose. Used by prediction replay and the shuttle test. */
  addBean(state: BeanState, yaw = state.yaw): BeanState {
    if (this.beans.has(state.id)) this.removeBean(state.id)
    const body = this.world.createRigidBody(
      this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(state.px, state.py, state.pz),
    )
    const collider = this.world.createCollider(
      this.R.ColliderDesc.capsule(PHYSICS.capsuleHalfHeight, PHYSICS.capsuleRadius),
      body,
    )
    this.beans.set(state.id, { body, collider })
    const next = { ...state, yaw }
    this.states.set(state.id, next)
    const pose = { x: next.px, y: next.py, z: next.pz }
    body.setTranslation(pose, true)
    body.setNextKinematicTranslation(pose)
    // Register the collider with the broadphase before the next query.
    this.world.step()
    return next
  }

  removeBean(id: number): void {
    const slot = this.beans.get(id)
    if (!slot) return
    this.world.removeRigidBody(slot.body)
    this.beans.delete(id)
    this.states.delete(id)
  }

  getState(id: number): BeanState | undefined {
    const s = this.states.get(id)
    return s ? { ...s } : undefined
  }

  ids(): number[] {
    return [...this.states.keys()]
  }

  /** Teleport a bean onto an authoritative pose without stepping. */
  applyState(state: BeanState): void {
    const slot = this.beans.get(state.id)
    if (!slot) return
    const next = { ...state }
    this.states.set(state.id, next)
    slot.body.setTranslation({ x: next.px, y: next.py, z: next.pz }, true)
    slot.body.setNextKinematicTranslation({ x: next.px, y: next.py, z: next.pz })
  }

  /**
   * Advance every bean one 50 Hz step. Inputs are camera-space; missing
   * entries repeat no buttons and no stick.
   */
  step(inputs: ReadonlyMap<number, InputFrame>): void {
    this.tick += 1
    this.syncMovers()
    if (this.authoritative) resolveBumps(this.states)
    const ids = [...this.states.keys()].sort((a, b) => a - b)
    for (const id of ids) {
      const state = this.states.get(id)
      const slot = this.beans.get(id)
      if (!state || !slot) continue
      const input = inputs.get(id)
      const frame: InputFrame = input ?? {
        seq: state.lastSeq,
        tick: this.tick,
        moveX: 0,
        moveZ: 0,
        jump: false,
        dive: false,
        camYaw: state.yaw,
        quickChat: 0,
        emote: 0,
        grab: false,
      }
      const surface = this.surfaceFor(state)
      this.controller.enableSnapToGround(state.vy > 0.2 ? 0 : 0.28)
      stepKinematics(state, frame, PHYSICS.dt, (_s, dx, dy, dz) => {
        this.controller.computeColliderMovement(slot.collider, { x: dx, y: dy, z: dz })
        const m = this.controller.computedMovement()
        const grounded = this.controller.computedGrounded()
        return { movedX: m.x, movedY: m.y, movedZ: m.z, grounded }
      }, surface, { course: this.course, peers: this.states, authoritative: this.authoritative })
      slot.body.setNextKinematicTranslation({ x: state.px, y: state.py, z: state.pz })
      this.noteMoverContact(state)
      this.noteFinish(state)
      if (feetY(state.py) < PHYSICS.respawnY) this.respawn(state)
    }
    this.world.step()
    for (const id of ids) {
      const slot = this.beans.get(id)
      const state = this.states.get(id)
      if (!slot || !state) continue
      const t = slot.body.translation()
      state.px = t.x
      state.py = t.y
      state.pz = t.z
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.world.free()
  }

  private makeBox(def: CourseBox, kinematic: boolean): BodySlot {
    const q = quatFromXRotation(def.rx)
    const desc = kinematic
      ? this.R.RigidBodyDesc.kinematicPositionBased()
      : this.R.RigidBodyDesc.fixed()
    desc.setTranslation(def.x, def.y, def.z).setRotation(q)
    const body = this.world.createRigidBody(desc)
    const collider = this.world.createCollider(this.R.ColliderDesc.cuboid(def.hx, def.hy, def.hz), body)
    return { body, collider }
  }

  private syncMovers(): void {
    for (const mover of this.movers) {
      const motion = mover.def.mover
      if (!motion) continue
      const x = mover.def.x + moverOffset(this.tick, motion.amplitude, motion.period)
      const pos = { x, y: mover.def.y, z: mover.def.z }
      mover.body.setTranslation(pos, true)
      mover.body.setNextKinematicTranslation(pos)
    }
  }

  private surfaceFor(state: BeanState): SurfaceModifiers {
    if (!state.onMover) return NEUTRAL_SURFACE
    const mover = this.movers[0]
    const motion = mover?.def.mover
    if (!mover || !motion) return NEUTRAL_SURFACE
    const prev = mover.def.x + moverOffset(this.tick - 1, motion.amplitude, motion.period)
    const next = mover.def.x + moverOffset(this.tick, motion.amplitude, motion.period)
    return {
      ...NEUTRAL_SURFACE,
      platformVelocityX: (next - prev) / PHYSICS.dt,
    }
  }

  private noteMoverContact(state: BeanState): void {
    const mover = this.movers[0]
    if (!mover) {
      state.onMover = false
      return
    }
    const motion = mover.def.mover
    if (!motion) return
    const mx = mover.def.x + moverOffset(this.tick, motion.amplitude, motion.period)
    const top = mover.def.y + mover.def.hy
    const feet = feetY(state.py)
    const onX = Math.abs(state.px - mx) < mover.def.hx + 0.15
    const onZ = Math.abs(state.pz - mover.def.z) < mover.def.hz + 0.15
    const onY = Math.abs(feet - top) < 0.35
    state.onMover = state.grounded && onX && onZ && onY
  }

  private noteFinish(state: BeanState): void {
    if (state.finished) return
    if (inFinish(this.course, state.px, feetY(state.py), state.pz)) state.finished = true
  }

  private respawn(state: BeanState): void {
    const spawn = this.course.spawns[state.spawnIndex % this.course.spawns.length]
    if (!spawn) return
    state.px = spawn.x
    state.py = spawn.feetY + CAPSULE_CENTER
    state.pz = spawn.z
    state.vx = 0
    state.vy = 0
    state.vz = 0
    state.grounded = true
    state.onMover = false
    state.airDiveUsed = false
    clearForRespawn(state)
    const slot = this.beans.get(state.id)
    slot?.body.setTranslation({ x: state.px, y: state.py, z: state.pz }, true)
    slot?.body.setNextKinematicTranslation({ x: state.px, y: state.py, z: state.pz })
  }
}
