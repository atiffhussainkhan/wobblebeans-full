export {
  ECONOMY,
  ECONOMY_RANGES,
  DAILY_REFRESH_HOUR_UTC,
  RewardCode,
  normalizeShowFacts,
  showRewards,
  levelForXp,
  fullUtcDaysBetween,
  accrueRested,
  applyRested,
  coinsAfterSoftCap,
  shiftedUtcDate,
  addUtcDays,
  clampBreakMinutes,
  showEndWellbeing,
} from './economy'
export type {
  ShowKind,
  ShowFacts,
  ShowFactsInput,
  RewardLine,
  ShowMedal,
  ShowRewards,
  WellbeingInput,
  WellbeingNotice,
} from './economy'

export {
  SEASON,
  SEASON_TIERS,
  tierXpCost,
  buildSeasonTiers,
  tierByNumber,
  tierForSeasonXp,
  cumulativeXp,
  xpToNextReward,
  overflowGrants,
  pathCoinsThrough,
  playtimeSentence,
  seasonStatus,
  shopWeekStart,
  shopWeekIndex,
  weeklyPeriodKey,
} from './season'
export type { SeasonReward, SeasonTier, RewardType, CosmeticSlotName } from './season'

export {
  CATALOGUE,
  SHOP_SETS,
  RARITY_FRAME,
  rarityRank,
  itemById,
  itemsBySlot,
  starterItemsFor,
  shopPricedItems,
  shopSetById,
  levelRewardItem,
  assertItemsCosmetic,
} from './catalogue'
export type { CosmeticItem, ShopSet, RarityLabel, AcquisitionSource, FaceHide, ItemTrait } from './catalogue'

export {
  shopPayload,
  shopRoute,
  rotationItems,
  rotationSets,
  priceForShopId,
  shopGrants,
} from './shop'
export type { ShopPayload, ShopClientItem, ShopClientSet, ShopRoute, ShopRouteRow } from './shop'

export {
  RENDER_LAYER_ORDER,
  WAIST_SEAM_MAX_MM,
  OUTFIT_PRESET_COUNT,
  EMOTE_SLOTS,
  starterLoadout,
  cloneLoadout,
  idsInLoadout,
  capsuleForLook,
  previewItem,
  tryEquip,
  sanitizeLoadout,
  resolveLook,
  surpriseMe,
  starterLookCount,
} from './loadout'
export type { Loadout, ResolvedLook } from './loadout'

export {
  CHALLENGE_TEMPLATES,
  EMPTY_ACTIVITY,
  templateById,
  templatesFor,
  dailiesFor,
  weekliesFor,
  seasonStages,
  dailyStillBanked,
  currentDailyPeriod,
  currentWeeklyPeriod,
  metricDelta,
  challengeMetricAllowed,
} from './challenges'
export type { ChallengeKind, ChallengeMetric, ChallengeDifficulty, ChallengeTemplate, ActivityDelta } from './challenges'

export {
  DRESSING_TABS,
  starterDressingState,
  starterOwnedIds,
  dressingReduce,
  dressingView,
} from './dressing'
export type { DressingTabId, DressingTab, DressingState, DressingAction, DressingRow, DressingView } from './dressing'

export {
  SEGMENTS,
  impliedShowXpPerWeek,
  simulateSegment,
  simulateSeason,
  pathCoinsAtPublishedTier,
} from './simulate'
export type { SegmentSpec, SegmentResult } from './simulate'
