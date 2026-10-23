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
export { SOCIAL_ABUSE, createSocialGate, stepSocialGate } from './safety/social-gate'
export type { SocialGateState, SocialGateInput } from './safety/social-gate'
export { FRIEND_CODE_ICONS, FRIEND_CODE_ICON_COUNT, FRIEND_CODE_LENGTH, isPictureFriendCode } from './safety/friend-code'
export { REPORT_PICTURES, reportPictureLabel } from './safety/reports'
export type { ReportPictureId } from './safety/reports'
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
