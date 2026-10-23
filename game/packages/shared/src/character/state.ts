import { Locomotion, type BeanState, type CharacterMotion } from '../physics/types'
import { CHARACTER } from './tuning'

export function defaultMotion(): CharacterMotion {
  return {
    grabPartner: 0,
    grabLeft: 0,
    regrabCooldown: 0,
    hardLand: false,
    immunity: 0,
    emoteId: 0,
    settleHold: 0,
    mashTokens: 1,
    prevMoveX: 0,
    prevMoveZ: 0,
    grabHeld: false,
    mantleFromX: 0,
    mantleFromY: 0,
    mantleFromZ: 0,
    mantleToX: 0,
    mantleToY: 0,
    mantleToZ: 0,
    bumpCooldown: 0,
  }
}

export function ensureCharacter(state: BeanState): CharacterMotion {
  if (!state.motion) {
    state.motion = defaultMotion()
    if (state.locomotion === Locomotion.Ragdoll) state.motion.settleHold = state.coyote
  }
  return state.motion
}

/** Kill-plane teleport. Clears a tumble so the bean stands up on the pad. */
export function clearForRespawn(state: BeanState): void {
  state.locomotion = Locomotion.Idle
  state.stateTime = 0
  state.jumpBuffer = 0
  state.diveBuffer = 0
  state.airDiveUsed = false
  state.getUpBack = false
  const motion = ensureCharacter(state)
  motion.grabPartner = 0
  motion.grabLeft = 0
  motion.settleHold = 0
  motion.hardLand = false
  motion.immunity = CHARACTER.spawnImmunity
  motion.emoteId = 0
}
