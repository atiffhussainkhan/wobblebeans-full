// Pulls the Rapier ES-build types into every project that imports this package.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./rapier-es.d.ts" />
export { PHYSICS, DT, CAPSULE_CENTER, feetY, centerYFromFeet } from './physics/constants'
export { V3, clamp, wrapAngle, approachAngle, wishDirection, fnv1a, quatFromXRotation } from './physics/math'
export type { Vec3 } from './physics/math'
export {
  Locomotion,
  emptyInput,
  cloneBean,
  NEUTRAL_SURFACE,
} from './physics/types'
export type { InputFrame, BeanState, SurfaceModifiers, MoveResolution } from './physics/types'
export { stepKinematics, makeBean } from './physics/integrate'
export { BeanWorld, loadRapier } from './physics/world'
export { physicsHash } from './physics/hash'
export {
  FOUNDATION_COURSE,
  foundationGauntlet,
  courseHash,
  moverOffset,
  inFinish,
  boxRotation,
} from './course/foundation-gauntlet'
export type { CourseBox, CourseDef, SpawnPoint, SurfaceRole } from './course/foundation-gauntlet'
export { NET, isNearSnapshotTick, isFarSnapshotTick } from './net/rates'
export { PredictedBean } from './net/predict'
export { SAFETY, QUICK_CHAT, EMOTES, EventKind, quickChatText, isQuickChatId, isEmoteId, isAllowedClientEvent } from './safety/rules'
export type { QuickChatId, EmoteId } from './safety/rules'
export { NAME_ADJECTIVES, NAME_NOUNS, BEAN_COLOURS, formatDisplayName, nameForSlot, colourForSlot } from './names/generator'
export type { GeneratedName } from './names/generator'
export { AUDIO, GAMEPLAY_RELEVANT_AUDIO } from './audio/events'
export type { AudioEventId } from './audio/events'
export {
  Msg,
  RejectReason,
  encodeHello,
  encodeWelcome,
  encodeReject,
  encodeInput,
  encodeSnapshot,
  encodePing,
  encodePong,
  encodeEvent,
  decodeClient,
  decodeServer,
  beanToSnap,
  snapToBean,
} from './protocol/codec'
export {
  OBSTACLE_KIT,
  kitSpec,
  makeKit,
  clampConveyor,
  spinBarHit,
  CONVEYOR_SPEED_CAP,
} from './obstacles/kit'
export type { RagdollTag, KitPieceId, ObstacleSpec, BoxKit, SampledPose } from './obstacles/types'
export { KIT_TELEGRAPH_AUDIO, readKit } from './obstacles/types'
export { sampleMoverPose } from './obstacles/pose'
export {
  SHOW_LEVELS,
  LEVEL_CODE,
  PLUG_COURSE_ID,
  levelById,
  levelForCourse,
  levelForPlug,
  courseForShow,
} from './course/registry'
export type { LevelId, ShowCourseOpts } from './course/registry'
export { registerLevel, registeredLevels, RoundStateCode, SLOT_QUALIFY_PCT, slotForRound } from './show/round'
export type {
  RoundStateCodeId,
  RoundType,
  ShowSlot,
  EntrantSample,
  RoundSample,
  QualifyDecision,
  LevelPlug,
} from './show/round'
export { qualifyRound, pickTailHolders } from './course/qualify'
export type { RoundActor, QualifyResult } from './course/qualify'
export { qualifyQuota, roundHalfDown, OUT_SLATE, goalWordCount } from './course/schema'
export type { LevelDef, LevelRecord, QualifyMode, FallRule } from './course/schema'
export { courseDirector, directorFor } from './course/director'
export { forwardJumpDriver, routeDriver, wallDriver, beamDriver } from './course/drive'
export type {
  Hello,
  Welcome,
  Reject,
  InputMsg,
  SnapBean,
  SnapshotMsg,
  PingMsg,
  PongMsg,
  EventMsg,
  ServerMsg,
  ClientMsg,
} from './protocol/codec'
