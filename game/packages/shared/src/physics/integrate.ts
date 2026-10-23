import { findLedge } from '../character/ledge'
import { beginGrab, findGrabTarget, pullSpring, releaseGrab, takeBreakPulses } from '../character/grab'
import { defaultMotion, ensureCharacter } from '../character/state'
import { CHARACTER } from '../character/tuning'
import { isEmoteId } from '../safety/rules'
import type { CourseDef } from '../course/foundation-gauntlet'
import { PHYSICS, centerYFromFeet } from './constants'
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

export interface StepContext {
  course?: CourseDef
  peers?: ReadonlyMap<number, BeanState>
  /** False on the predicting client. Grabs are not predicted (D-04). */
  authoritative?: boolean
}

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
  if (
    (state.locomotion === Locomotion.DiveSlide || state.locomotion === Locomotion.Recover) &&
    state.stateTime >= PHYSICS.diveCancelToJumpAfter
  ) {
    return state.grounded || state.coyote > 0
  }
  return false
}

function canDive(state: BeanState): boolean {
  if (state.airDiveUsed) return false
  if (state.locomotion === Locomotion.Dive || state.locomotion === Locomotion.DiveSlide || state.locomotion === Locomotion.Recover) {
    return false
  }
  return (
    state.locomotion === Locomotion.Idle ||
    state.locomotion === Locomotion.Run ||
    state.locomotion === Locomotion.Jump ||
    state.locomotion === Locomotion.Fall
  )
}

function ignoresBuffers(loco: Locomotion): boolean {
  return (
    loco === Locomotion.Ragdoll ||
    loco === Locomotion.GetUp ||
    loco === Locomotion.Climb ||
    loco === Locomotion.Grabbed ||
    loco === Locomotion.Grab ||
    loco === Locomotion.Stumble
  )
}

/**
 * One 50 Hz locomotion step. `resolve` applies the proposed displacement
 * (Rapier on the server and the predicting client, or a test double).
 * Collision never lives in this function, so the feel constants stay shared.
 *
 * Priority when several triggers land on the same tick:
 * Knockdown > Stumble > Grabbed > Dive > Jump > Grab > Move.
 */
export function stepKinematics(
  state: BeanState,
  input: InputFrame,
  dt: number,
  resolve: (state: BeanState, dx: number, dy: number, dz: number) => MoveResolution,
  surface: SurfaceModifiers = NEUTRAL_SURFACE,
  ctx: StepContext = {},
): void {
  const motion = ensureCharacter(state)
  const authoritative = ctx.authoritative !== false
  state.lastSeq = input.seq

  if (!authoritative && (state.locomotion === Locomotion.Grab || state.locomotion === Locomotion.Grabbed)) {
    return
  }

  motion.regrabCooldown = Math.max(0, motion.regrabCooldown - dt)
  motion.immunity = Math.max(0, motion.immunity - dt)
  motion.bumpCooldown = Math.max(0, motion.bumpCooldown - dt)

  const grabHeld = input.grab === true
  let jumpConsumed = false
  let diveConsumed = false

  if (authoritative && state.locomotion === Locomotion.Grabbed) {
    const grabber = motion.grabPartner ? ctx.peers?.get(motion.grabPartner) : undefined
    const stillHeld =
      grabber &&
      grabber.locomotion === Locomotion.Grab &&
      ensureCharacter(grabber).grabPartner === state.id
    if (!stillHeld) {
      state.locomotion = state.grounded ? Locomotion.Idle : Locomotion.Fall
      state.stateTime = 0
      motion.grabPartner = 0
      motion.grabLeft = 0
    } else {
      const pulses = takeBreakPulses(state, input, dt)
      if (input.jump) jumpConsumed = true
      if (input.dive) diveConsumed = true
      motion.grabLeft -= dt + pulses * CHARACTER.breakFreePerInput
      if (motion.grabLeft <= 0) releaseGrab(grabber, state, 'break')
      else pullSpring(state, grabber, dt)
    }
  }

  if (authoritative && state.locomotion === Locomotion.Grab) {
    const victim = motion.grabPartner ? ctx.peers?.get(motion.grabPartner) : undefined
    const victimHeld = victim && victim.locomotion === Locomotion.Grabbed
    if (!victimHeld) {
      releaseGrab(state, victim, 'cap')
    } else if (!grabHeld) {
      releaseGrab(state, victim, 'throw')
    } else if (state.stateTime >= CHARACTER.grabMaxHoldPlayer || motion.grabLeft <= 0) {
      releaseGrab(state, victim, 'cap')
    }
  }

  if (
    state.locomotion === Locomotion.Emote &&
    (wishMag(input) > PHYSICS.stickDeadzone || input.jump || input.dive || grabHeld)
  ) {
    state.locomotion = Locomotion.Idle
    state.stateTime = 0
    motion.emoteId = 0
  }

  const locoNow = state.locomotion
  if (ignoresBuffers(locoNow)) {
    state.jumpBuffer = 0
    state.diveBuffer = 0
  } else {
    if (input.jump && !jumpConsumed) state.jumpBuffer = PHYSICS.jumpBuffer
    else state.jumpBuffer = Math.max(0, state.jumpBuffer - dt)
    if (input.dive && !diveConsumed) state.diveBuffer = PHYSICS.diveBuffer
    else state.diveBuffer = Math.max(0, state.diveBuffer - dt)
  }

  if (state.landCooldown > 0) state.landCooldown = Math.max(0, state.landCooldown - dt)

  if (state.locomotion === Locomotion.Ragdoll) {
    // coyote carries the settle clock while tumbling.
  } else if (state.grounded) state.coyote = PHYSICS.coyoteTime
  else state.coyote = Math.max(0, state.coyote - dt)

  exitTimedStates(state, dt)

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
  wishSpeed *= speedScale(state.locomotion, grabHeld)

  const loco = state.locomotion
  if (loco === Locomotion.Ragdoll) {
    const h = Math.hypot(state.vx, state.vz)
    const nh = Math.max(0, h - 6 * dt)
    if (h > 1e-4) {
      state.vx = (state.vx / h) * nh
      state.vz = (state.vz / h) * nh
    }
  } else if (loco === Locomotion.GetUp || loco === Locomotion.Emote) {
    const h = Math.hypot(state.vx, state.vz)
    const nh = Math.max(0, h - PHYSICS.decel * dt)
    if (h > 1e-4) {
      state.vx = (state.vx / h) * nh
      state.vz = (state.vz / h) * nh
    }
  } else if (loco === Locomotion.Grabbed) {
    const cap = maxSpeed * CHARACTER.victimSpeedMult
    const h = Math.hypot(state.vx, state.vz)
    if (h > cap && h > 1e-4) {
      state.vx = (state.vx / h) * cap
      state.vz = (state.vz / h) * cap
    }
  } else if (loco === Locomotion.Dive) {
    // Committed. No steering.
  } else if (loco === Locomotion.DiveSlide || loco === Locomotion.Recover) {
    const h = Math.hypot(state.vx, state.vz)
    const nh = Math.max(0, h - PHYSICS.diveSlideDecel * surface.decelMult * dt)
    if (h > 1e-4) {
      state.vx = (state.vx / h) * nh
      state.vz = (state.vz / h) * nh
    }
  } else if (state.grounded && loco !== Locomotion.Jump) {
    const rate =
      mag === 0
        ? PHYSICS.decel * surface.decelMult * (loco === Locomotion.Stumble ? CHARACTER.stumbleControl : 1)
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
      PHYSICS.airAccel * surface.accelMult * (loco === Locomotion.Stumble ? CHARACTER.stumbleControl : 1),
    )
    state.vx = next.vx
    state.vz = next.vz
  }

  const steerLocked =
    loco === Locomotion.Dive ||
    loco === Locomotion.DiveSlide ||
    loco === Locomotion.Recover ||
    loco === Locomotion.Ragdoll ||
    loco === Locomotion.GetUp ||
    loco === Locomotion.Climb ||
    loco === Locomotion.Emote
  if (mag > 0 && !steerLocked) {
    const face = Math.atan2(dirX, dirZ)
    state.yaw = approachAngle(state.yaw, face, TURN * dt)
  }

  let acted = false
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
    acted = true
  } else if (state.jumpBuffer > 0 && canJump(state)) {
    state.vy = PHYSICS.jumpVelocity
    state.jumpBuffer = 0
    state.coyote = 0
    state.grounded = false
    state.airDiveUsed = false
    state.locomotion = Locomotion.Jump
    state.stateTime = 0
    state.landCooldown = 0
    acted = true
  } else if (!acted && grabHeld && ctx.course && canLedge(state)) {
    const lx = mag > 0 ? dirX : Math.sin(state.yaw)
    const lz = mag > 0 ? dirZ : Math.cos(state.yaw)
    const ledge = findLedge(state, ctx.course, lx, lz)
    if (ledge && (mag > 0.2 || !state.grounded)) {
      startClimb(state, ledge.x, ledge.top, ledge.z, ctx.peers)
      acted = true
    }
  }

  if (
    !acted &&
    authoritative &&
    grabHeld &&
    state.grounded &&
    motion.regrabCooldown <= 0 &&
    (state.locomotion === Locomotion.Idle || state.locomotion === Locomotion.Run) &&
    ctx.peers
  ) {
    const target = findGrabTarget(state, ctx.peers)
    if (target) {
      beginGrab(state, target)
      acted = true
    }
  }

  if (
    !acted &&
    input.emote > 0 &&
    isEmoteId(input.emote) &&
    state.grounded &&
    (state.locomotion === Locomotion.Idle || state.locomotion === Locomotion.Run)
  ) {
    state.locomotion = Locomotion.Emote
    state.stateTime = 0
    motion.emoteId = input.emote
    state.vx = 0
    state.vz = 0
  }

  if (state.locomotion !== Locomotion.Climb && state.locomotion !== Locomotion.GetUp && !state.grounded) {
    const falling = state.vy <= 0
    const g = PHYSICS.gravity * (falling ? PHYSICS.fallGravityMult : 1) * surface.gravityMult
    state.vy -= g * dt
    if (state.vy < -PHYSICS.terminalVelocity) state.vy = -PHYSICS.terminalVelocity
  }

  state.vx += surface.externalAccelX * dt
  state.vy += surface.externalAccelY * dt
  state.vz += surface.externalAccelZ * dt

  let dispX = state.vx * dt
  let dispY = state.vy * dt
  let dispZ = state.vz * dt
  if (state.locomotion === Locomotion.Climb) {
    const u = smoothstep(clamp01((state.stateTime + dt) / CHARACTER.ledgeMantleTime))
    dispX = motion.mantleFromX + (motion.mantleToX - motion.mantleFromX) * u - state.px
    dispY = motion.mantleFromY + (motion.mantleToY - motion.mantleFromY) * u - state.py
    dispZ = motion.mantleFromZ + (motion.mantleToZ - motion.mantleFromZ) * u - state.pz
    state.vx = 0
    state.vy = 0
    state.vz = 0
  }
  if ((state.grounded || state.onMover) && state.locomotion !== Locomotion.Climb) {
    dispX += surface.platformVelocityX * dt
    dispY += surface.platformVelocityY * dt
    dispZ += surface.platformVelocityZ * dt
  }

  const was = state.locomotion
  const impactVy = state.vy
  const resolved = resolve(state, dispX, dispY, dispZ)
  state.px += resolved.movedX
  state.py += resolved.movedY
  state.pz += resolved.movedZ

  const blockedX = Math.abs(resolved.movedX - dispX) > 0.004
  const blockedZ = Math.abs(resolved.movedZ - dispZ) > 0.004
  if (blockedX && state.locomotion !== Locomotion.Climb) state.vx = resolved.movedX / dt
  if (blockedZ && state.locomotion !== Locomotion.Climb) state.vz = resolved.movedZ / dt
  if (dispY > 0.001 && resolved.movedY < dispY * 0.5 && state.locomotion !== Locomotion.Climb) state.vy = 0

  let grounded = resolved.grounded
  if (grounded && state.vy < 0 && state.locomotion !== Locomotion.Climb) state.vy = 0

  if (state.locomotion === Locomotion.Climb) {
    const done = state.stateTime + dt >= CHARACTER.ledgeMantleTime
    if (done) {
      state.px = motion.mantleToX
      state.py = motion.mantleToY
      state.pz = motion.mantleToZ
      state.vx = 0
      state.vy = 0
      state.vz = 0
      state.locomotion = Locomotion.Idle
      state.stateTime = 0
      state.airDiveUsed = false
      grounded = true
    }
  } else if (state.locomotion === Locomotion.Dive && grounded) {
    state.locomotion = Locomotion.DiveSlide
    state.stateTime = 0
  } else if (state.locomotion === Locomotion.DiveSlide) {
    const speed = Math.hypot(state.vx, state.vz)
    if (speed < 1.2 || state.stateTime >= PHYSICS.diveRecoveryTime) {
      state.locomotion = Locomotion.Recover
    }
  } else if (state.locomotion === Locomotion.Recover && state.stateTime >= PHYSICS.diveRecoveryTime) {
    state.locomotion = grounded ? (Math.hypot(state.vx, state.vz) > 0.6 && mag > 0 ? Locomotion.Run : Locomotion.Idle) : Locomotion.Fall
    state.stateTime = 0
    if (grounded) state.airDiveUsed = false
  } else if (
    (state.locomotion === Locomotion.Jump || state.locomotion === Locomotion.Fall) &&
    grounded &&
    impactVy <= 0
  ) {
    landFromAir(state, impactVy, mag, surface)
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

  if (state.locomotion === Locomotion.Ragdoll) {
    const speed = Math.hypot(state.vx, state.vy, state.vz)
    if (speed < CHARACTER.settleSpeed) motion.settleHold += dt
    else motion.settleHold = 0
    state.coyote = motion.settleHold
    if (motion.settleHold >= CHARACTER.settleHold || state.stateTime + dt >= CHARACTER.ragdollMax) {
      state.locomotion = Locomotion.GetUp
      state.stateTime = 0
      motion.settleHold = 0
      state.vx = 0
      state.vz = 0
    }
  }

  if (!grounded && state.grounded && state.locomotion !== Locomotion.Ragdoll) {
    state.coyote = PHYSICS.coyoteTime
  }
  state.grounded = grounded
  motion.prevMoveX = input.moveX
  motion.prevMoveZ = input.moveZ
  motion.grabHeld = grabHeld
  if (state.locomotion === was) state.stateTime += dt
}

function exitTimedStates(state: BeanState, _dt: number): void {
  const motion = ensureCharacter(state)
  if (state.locomotion === Locomotion.Stumble) {
    const dur = motion.hardLand ? CHARACTER.hardStumbleTime : CHARACTER.stumbleTime
    if (state.stateTime >= dur) {
      state.locomotion = state.grounded ? (Math.hypot(state.vx, state.vz) > 0.6 ? Locomotion.Run : Locomotion.Idle) : Locomotion.Fall
      state.stateTime = 0
      motion.hardLand = false
    }
  } else if (state.locomotion === Locomotion.GetUp && state.stateTime >= CHARACTER.getUpTime) {
    state.locomotion = Locomotion.Idle
    state.stateTime = 0
    motion.immunity = CHARACTER.knockdownImmunity
    state.airDiveUsed = false
  } else if (state.locomotion === Locomotion.Emote && state.stateTime >= CHARACTER.emoteMax) {
    state.locomotion = Locomotion.Idle
    state.stateTime = 0
    motion.emoteId = 0
  }
}

function landFromAir(state: BeanState, impactVy: number, mag: number, surface: SurfaceModifiers): void {
  const motion = ensureCharacter(state)
  const allow = !surface.suppressRagdoll && motion.immunity <= 0
  if (allow && impactVy <= CHARACTER.landKnockdownVy) {
    state.locomotion = Locomotion.Ragdoll
    state.stateTime = 0
    state.airDiveUsed = false
    state.getUpBack = true
    motion.settleHold = 0
    state.jumpBuffer = 0
    state.diveBuffer = 0
    return
  }
  if (allow && impactVy <= CHARACTER.landStumbleVy) {
    state.locomotion = Locomotion.Stumble
    state.stateTime = 0
    state.airDiveUsed = false
    state.landCooldown = PHYSICS.landCooldown
    motion.hardLand = true
    state.jumpBuffer = 0
    state.diveBuffer = 0
    return
  }
  state.locomotion = Math.hypot(state.vx, state.vz) > 0.6 && mag > 0 ? Locomotion.Run : Locomotion.Idle
  state.stateTime = 0
  state.landCooldown = PHYSICS.landCooldown
  state.airDiveUsed = false
}

function startClimb(
  state: BeanState,
  x: number,
  top: number,
  z: number,
  peers: ReadonlyMap<number, BeanState> | undefined,
): void {
  const motion = ensureCharacter(state)
  if (state.locomotion === Locomotion.Grab && motion.grabPartner && peers) {
    releaseGrab(state, peers.get(motion.grabPartner), 'cap')
  }
  motion.mantleFromX = state.px
  motion.mantleFromY = state.py
  motion.mantleFromZ = state.pz
  motion.mantleToX = x
  motion.mantleToY = centerYFromFeet(top)
  motion.mantleToZ = z
  state.locomotion = Locomotion.Climb
  state.stateTime = 0
  state.vx = 0
  state.vy = 0
  state.vz = 0
  state.jumpBuffer = 0
  state.diveBuffer = 0
}

function canLedge(state: BeanState): boolean {
  return (
    state.locomotion === Locomotion.Idle ||
    state.locomotion === Locomotion.Run ||
    state.locomotion === Locomotion.Jump ||
    state.locomotion === Locomotion.Fall ||
    state.locomotion === Locomotion.Grab
  )
}

function speedScale(loco: Locomotion, grabHeld: boolean): number {
  if (loco === Locomotion.Grab) return CHARACTER.grabberSpeedMult
  if (loco === Locomotion.Grabbed) return CHARACTER.victimSpeedMult
  if (loco === Locomotion.Stumble) return CHARACTER.stumbleControl
  if (grabHeld && (loco === Locomotion.Idle || loco === Locomotion.Run || loco === Locomotion.Jump || loco === Locomotion.Fall)) {
    return CHARACTER.grabberSpeedMult
  }
  return 1
}

function wishMag(input: InputFrame): number {
  return Math.hypot(input.moveX, input.moveZ)
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function smoothstep(u: number): number {
  return u * u * (3 - 2 * u)
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
    getUpBack: false,
    motion: defaultMotion(),
  }
}
