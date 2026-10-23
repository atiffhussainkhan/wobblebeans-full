import { courseHash, FOUNDATION_COURSE } from '../course/foundation-gauntlet'
import { fnv1a } from './math'
import { PHYSICS } from './constants'

/** Stable hash of the tuning blob plus the course colliders. */
export function physicsHash(): number {
  const body = JSON.stringify({
    maxSpeed: PHYSICS.maxSpeed,
    accel: PHYSICS.accel,
    decel: PHYSICS.decel,
    reverseAccel: PHYSICS.reverseAccel,
    gravity: PHYSICS.gravity,
    jumpVelocity: PHYSICS.jumpVelocity,
    fallGravityMult: PHYSICS.fallGravityMult,
    airAccel: PHYSICS.airAccel,
    coyoteTime: PHYSICS.coyoteTime,
    jumpBuffer: PHYSICS.jumpBuffer,
    diveHorizSpeed: PHYSICS.diveHorizSpeed,
    diveVertSpeed: PHYSICS.diveVertSpeed,
    diveSlideDecel: PHYSICS.diveSlideDecel,
    capsuleRadius: PHYSICS.capsuleRadius,
    capsuleHalfHeight: PHYSICS.capsuleHalfHeight,
    course: courseHash(FOUNDATION_COURSE),
  })
  return fnv1a(body)
}
