import { PHYSICS } from './constants'
import { approachAngle, wishDirection } from './math'
import {
  Locomotion,
  type BeanState,
  type InputFrame,
  type MoveResolution,
  type SurfaceModifiers,
  NEUTRAL_SURFACE,
} from './types'

const TURN = (PHYSICS.turnRateDeg * Math.PI) / 180

function accelToward(
  vx: number,
  vz: number,
  wishX: number,
  wishZ: number,
  wishSpeed: number,
  dt: number,
  rate: number,
): { vx: number; vz: number } {
  const tx = wishX * wishSpeed
  const tz = wishZ * wishSpeed
  const dx = tx - vx
  const dz = tz - vz
  const dist = Math.hypot(dx, dz)
  if (dist < 1e-6) return { vx: tx, vz: tz }
  const step = Math.min(dist, rate * dt)
  return { vx: vx + (dx / dist) * step, vz: vz + (dz / dist) * step }
}

function horizontalRate(
  vx: number,
  vz: number,
  wishX: number,
  wishZ: number,
  wishSpeed: number,
  surface: SurfaceModifiers,
): number {
  const current = Math.hypot(vx, vz)
  const dot = vx * wishX + vz * wishZ
  if (dot < -0.01) return PHYSICS.reverseAccel * surface.accelMult
  if (wishSpeed < current - 0.05) return PHYSICS.decel * surface.decelMult
  return PHYSICS.accel * surface.accelMult
}

function canJump(state: BeanState): boolean {
  if (state.landCooldown > 0) return false
  if (
    state.locomotion === Locomotion.Idle ||
    state.locomotion === Locomotion.Run ||
    state.locomotion === Locomotion.Fall ||
    state.locomotion === Locomotion.Jump
  ) {
    return state.coyote > 0
  }
  if (state.locomotion === Locomotion.DiveSlide && state.stateTime >= PHYSICS.diveCancelToJumpAfter) {
    return state.grounded || state.coyote > 0
  }
  return false
}

function canDive(state: BeanState): boolean {
  if (state.airDiveUsed) return false
  if (state.locomotion === Locomotion.Dive || state.locomotion === Locomotion.DiveSlide) return false
  return (
    state.locomotion === Locomotion.Idle ||
    state.locomotion === Locomotion.Run ||
    state.locomotion === Locomotion.Jump ||
    state.locomotion === Locomotion.Fall
  )
}

/**
 * One 50 Hz locomotion step. `resolve` applies the proposed displacement
 * (Rapier on the server and the predicting client, or a test double).
 * Collision never lives in this function, so the feel constants stay shared.
 */
export function stepKinematics(
  state: BeanState,
  input: InputFrame,
  dt: number,
  resolve: (state: BeanState, dx: number, dy: number, dz: number) => MoveResolution,
  surface: SurfaceModifiers = NEUTRAL_SURFACE,
): void {
  state.lastSeq = input.seq

  if (input.jump) state.jumpBuffer = PHYSICS.jumpBuffer
  else state.jumpBuffer = Math.max(0, state.jumpBuffer - dt)

  if (input.dive) state.diveBuffer = PHYSICS.diveBuffer
  else state.diveBuffer = Math.max(0, state.diveBuffer - dt)

  if (state.landCooldown > 0) state.landCooldown = Math.max(0, state.landCooldown - dt)

  if (state.grounded) state.coyote = PHYSICS.coyoteTime
  else state.coyote = Math.max(0, state.coyote - dt)

  const wish = wishDirection(input.moveX, input.moveZ, input.camYaw)
  const dead = PHYSICS.stickDeadzone
  let dirX = 0
  let dirZ = 0
  let mag = 0
  if (wish.mag > dead) {
    const remapped = (wish.mag - dead) / (1 - dead)
    mag = Math.min(1, remapped)
    const len = Math.hypot(wish.x, wish.z) || 1
    dirX = wish.x / len
    dirZ = wish.z / len
  }

  const maxSpeed = PHYSICS.maxSpeed * surface.speedMult
  let wishSpeed = 0
  if (mag > 0) {
    wishSpeed = mag >= 0.999 ? maxSpeed : Math.max(PHYSICS.minWalkSpeed, mag * maxSpeed)
  }

  const loco = state.locomotion
  if (loco === Locomotion.Dive) {
    // Committed. No steering.
  } else if (loco === Locomotion.DiveSlide) {
    const h = Math.hypot(state.vx, state.vz)
    const nh = Math.max(0, h - PHYSICS.diveSlideDecel * surface.decelMult * dt)
    if (h > 1e-4) {
      state.vx = (state.vx / h) * nh
      state.vz = (state.vz / h) * nh
    }
  } else if (state.grounded && loco !== Locomotion.Jump) {
    const rate =
      mag === 0
        ? PHYSICS.decel * surface.decelMult
        : horizontalRate(state.vx, state.vz, dirX, dirZ, wishSpeed, surface)
    const next = accelToward(state.vx, state.vz, dirX, dirZ, wishSpeed, dt, rate)
    state.vx = next.vx
    state.vz = next.vz
  } else {
    const next = accelToward(
      state.vx,
      state.vz,
      dirX,
      dirZ,
      wishSpeed,
      dt,
      PHYSICS.airAccel * surface.accelMult,
    )
    state.vx = next.vx
    state.vz = next.vz
  }

  if (mag > 0 && loco !== Locomotion.Dive && loco !== Locomotion.DiveSlide) {
    const face = Math.atan2(dirX, dirZ)
    state.yaw = approachAngle(state.yaw, face, TURN * dt)
  }

  // Priority: Dive over Jump (doc 03 §1.1).
  if (state.diveBuffer > 0 && canDive(state)) {
    let dx = dirX
    let dz = dirZ
    if (mag === 0) {
      dx = Math.sin(state.yaw)
      dz = Math.cos(state.yaw)
    }
    const h = Math.hypot(state.vx, state.vz)
    const speed = Math.max(h, PHYSICS.diveHorizSpeed)
    state.vx = dx * speed
    state.vz = dz * speed
    state.vy += PHYSICS.diveVertSpeed
    state.yaw = Math.atan2(dx, dz)
    state.diveBuffer = 0
    state.airDiveUsed = true
    state.grounded = false
    state.coyote = 0
    state.locomotion = Locomotion.Dive
    state.stateTime = 0
  } else if (state.jumpBuffer > 0 && canJump(state)) {
    state.vy = PHYSICS.jumpVelocity
    state.jumpBuffer = 0
    state.coyote = 0
    state.grounded = false
    state.airDiveUsed = false
    state.locomotion = Locomotion.Jump
    state.stateTime = 0
    state.landCooldown = 0
  }

  if (!state.grounded) {
    const falling = state.vy <= 0
    const g =
      PHYSICS.gravity * (falling ? PHYSICS.fallGravityMult : 1) * surface.gravityMult
    state.vy -= g * dt
    if (state.vy < -PHYSICS.terminalVelocity) state.vy = -PHYSICS.terminalVelocity
  }

  state.vx += surface.externalAccelX * dt
  state.vy += surface.externalAccelY * dt
  state.vz += surface.externalAccelZ * dt

  let dispX = state.vx * dt
  let dispY = state.vy * dt
  let dispZ = state.vz * dt
  if (state.grounded || state.onMover) {
    dispX += surface.platformVelocityX * dt
    dispY += surface.platformVelocityY * dt
    dispZ += surface.platformVelocityZ * dt
  }

  const was = state.locomotion
  const resolved = resolve(state, dispX, dispY, dispZ)
  state.px += resolved.movedX
  state.py += resolved.movedY
  state.pz += resolved.movedZ

  const blockedX = Math.abs(resolved.movedX - dispX) > 0.004
  const blockedZ = Math.abs(resolved.movedZ - dispZ) > 0.004
  if (blockedX) state.vx = resolved.movedX / dt
  if (blockedZ) state.vz = resolved.movedZ / dt
  if (dispY > 0.001 && resolved.movedY < dispY * 0.5) state.vy = 0

  const grounded = resolved.grounded
  if (grounded && state.vy < 0) state.vy = 0

  if (state.locomotion === Locomotion.Dive && grounded) {
    state.locomotion = Locomotion.DiveSlide
    state.stateTime = 0
  }

  if (state.locomotion === Locomotion.DiveSlide) {
    if (state.stateTime >= PHYSICS.diveRecoveryTime || Math.hypot(state.vx, state.vz) < 1.2) {
      state.locomotion = grounded ? (Math.hypot(state.vx, state.vz) > 0.6 ? Locomotion.Run : Locomotion.Idle) : Locomotion.Fall
      state.stateTime = 0
      if (grounded) state.airDiveUsed = false
    }
  } else if (
    (state.locomotion === Locomotion.Jump || state.locomotion === Locomotion.Fall) &&
    grounded &&
    state.vy <= 0
  ) {
    state.locomotion = Math.hypot(state.vx, state.vz) > 0.6 && mag > 0 ? Locomotion.Run : Locomotion.Idle
    state.stateTime = 0
    state.landCooldown = PHYSICS.landCooldown
    state.airDiveUsed = false
  } else if (state.locomotion === Locomotion.Jump && state.vy <= 0) {
    state.locomotion = Locomotion.Fall
    state.stateTime = 0
  } else if (
    (state.locomotion === Locomotion.Idle || state.locomotion === Locomotion.Run) &&
    !grounded
  ) {
    state.locomotion = Locomotion.Fall
    state.stateTime = 0
  } else if (state.locomotion === Locomotion.Idle && mag > 0 && grounded) {
    state.locomotion = Locomotion.Run
    state.stateTime = 0
  } else if (state.locomotion === Locomotion.Run && mag === 0 && Math.hypot(state.vx, state.vz) < 0.4) {
    state.locomotion = Locomotion.Idle
    state.stateTime = 0
  }

  if (!grounded && state.grounded) {
    state.coyote = PHYSICS.coyoteTime
  }
  state.grounded = grounded
  if (state.locomotion === was) state.stateTime += dt
}

export function makeBean(id: number, px: number, py: number, pz: number, spawnIndex: number): BeanState {
  return {
    id,
    px,
    py,
    pz,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    grounded: true,
    coyote: PHYSICS.coyoteTime,
    jumpBuffer: 0,
    diveBuffer: 0,
    airDiveUsed: false,
    locomotion: Locomotion.Idle,
    stateTime: 0,
    landCooldown: 0,
    lastSeq: 0,
    finished: false,
    onMover: false,
    spawnIndex,
  }
}
