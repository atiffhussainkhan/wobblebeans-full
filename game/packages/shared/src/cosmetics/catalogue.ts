/**
 * Cosmetic items. Rarity is a label. Nothing here has a drop weight.
 * Slots use the v3 ids (upper, lower, faceplate). Kid-facing names live on the dressing room.
 */

import { ECONOMY } from './economy'
import { SEASON, SEASON_TIERS, type CosmeticSlotName, type SeasonReward } from './season'

export type RarityLabel = 'common' | 'uncommon' | 'rare' | 'epic' | 'special'

export type AcquisitionSource =
  | 'starter'
  | 'seasonpath_free'
  | 'coins'
  | 'weekly_challenge'
  | 'season_goal'
  | 'level'

export type FaceHide = 'none' | 'eyes' | 'full'

export type ItemTrait = 'colour_copy' | 'animated'

export interface CosmeticItem {
  itemId: string
  slot: CosmeticSlotName
  nameKey: string
  displayName: string
  rarityLabel: RarityLabel
  acquisitionSource: AcquisitionSource[]
  seasonId: string | null
  coinPrice: number | null
  hidesFace: FaceHide
  hidesPattern: boolean
  traits: ItemTrait[]
  assetRef: string
  reviewStatus: 'approved'
  howToGet: string
  /** Wire emote code when the shared preset list already has one. */
  wireEmoteCode?: number
  hex?: string
}

export interface ShopSet {
  id: string
  name: string
  priceCoins: number
  rarityLabel: RarityLabel
  itemIds: readonly string[]
  howToGet: string
}

const RARITY_RANK: Record<RarityLabel, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  special: 4,
}

export function rarityRank(label: RarityLabel): number {
  return RARITY_RANK[label]
}

/** Frame shape sits beside the rarity word so the label is not colour alone. */
export const RARITY_FRAME: Record<RarityLabel, string> = {
  common: 'pill',
  uncommon: 'rounded',
  rare: 'gem',
  epic: 'diamond',
  special: 'star',
}

function item(partial: Omit<CosmeticItem, 'reviewStatus'>): CosmeticItem {
  return { ...partial, reviewStatus: 'approved' }
}

const STARTER_COLOURS: Array<{ id: string; name: string; hex: string }> = [
  { id: 'colour_berry', name: 'Berry', hex: '#E8336B' },
  { id: 'colour_ink', name: 'Night Ink', hex: '#1F2140' },
  { id: 'colour_cloud', name: 'Cloud', hex: '#FFFDF7' },
  { id: 'colour_oat', name: 'Oat', hex: '#F2E6C9' },
  { id: 'colour_mint', name: 'Mint', hex: '#BFE8D2' },
  { id: 'colour_cyan', name: 'Cyan', hex: '#22C3E6' },
  { id: 'colour_cocoa', name: 'Cocoa', hex: '#6B4A3A' },
  { id: 'colour_lime', name: 'Lime', hex: '#9BE15D' },
  { id: 'colour_plum', name: 'Plum', hex: '#7A2E8E' },
  { id: 'colour_sun', name: 'Sun', hex: '#FFB627' },
  { id: 'colour_ocean', name: 'Ocean', hex: '#2D7DD2' },
  { id: 'colour_leaf', name: 'Leaf', hex: '#3DBB6B' },
]

const STARTER_PATTERNS = [
  { id: 'pat_03', file: 'patterns/pattern_03.png', name: 'Pebbles' },
  { id: 'pat_07', file: 'patterns/pattern_07.png', name: 'Ripples' },
  { id: 'pat_16', file: 'patterns/pattern_16.png', name: 'Sprigs' },
  { id: 'pat_24', file: 'patterns/pattern_24.png', name: 'Checks' },
  { id: 'pat_29', file: 'patterns/pattern_29.png', name: 'Specks' },
  { id: 'pat_38', file: 'patterns/pattern_38.png', name: 'Swirls' },
]

const STARTER_FACES = [
  { id: 'face_smile', name: 'Smile' },
  { id: 'face_star', name: 'Star' },
  { id: 'face_dot', name: 'Dots' },
  { id: 'face_heart', name: 'Hearts' },
  { id: 'face_moon', name: 'Moon' },
  { id: 'face_sprout', name: 'Sprout' },
]

function starterItems(): CosmeticItem[] {
  const rows: CosmeticItem[] = [
    item({
      itemId: 'top_basic',
      slot: 'upper',
      nameKey: 'item.top.basic',
      displayName: 'Plain top',
      rarityLabel: 'common',
      acquisitionSource: ['starter'],
      seasonId: null,
      coinPrice: null,
      hidesFace: 'none',
      hidesPattern: false,
      traits: ['colour_copy'],
      assetRef: 'repo:/costumes/basic_top',
      howToGet: 'Yours from the start',
    }),
    item({
      itemId: 'bottom_basic',
      slot: 'lower',
      nameKey: 'item.bottom.basic',
      displayName: 'Plain shorts',
      rarityLabel: 'common',
      acquisitionSource: ['starter'],
      seasonId: null,
      coinPrice: null,
      hidesFace: 'none',
      hidesPattern: false,
      traits: ['colour_copy'],
      assetRef: 'repo:/costumes/basic_bottom',
      howToGet: 'Yours from the start',
    }),
    item({
      itemId: 'emote_wave',
      slot: 'emote',
      nameKey: 'item.emote.wave',
      displayName: 'Wave',
      rarityLabel: 'common',
      acquisitionSource: ['starter'],
      seasonId: null,
      coinPrice: null,
      hidesFace: 'none',
      hidesPattern: false,
      traits: [],
      assetRef: 'repo:/emotes/wave',
      howToGet: 'Yours from the start',
      wireEmoteCode: 1,
    }),
    item({
      itemId: 'emote_thumb',
      slot: 'emote',
      nameKey: 'item.emote.thumb',
      displayName: 'Thumbs Up',
      rarityLabel: 'common',
      acquisitionSource: ['starter'],
      seasonId: null,
      coinPrice: null,
      hidesFace: 'none',
      hidesPattern: false,
      traits: [],
      assetRef: 'repo:/emotes/thumb',
      howToGet: 'Yours from the start',
    }),
    item({
      itemId: 'emote_dance',
      slot: 'emote',
      nameKey: 'item.emote.dance',
      displayName: 'Happy Dance',
      rarityLabel: 'common',
      acquisitionSource: ['starter'],
      seasonId: null,
      coinPrice: null,
      hidesFace: 'none',
      hidesPattern: false,
      traits: [],
      assetRef: 'repo:/emotes/dance',
      howToGet: 'Yours from the start',
      wireEmoteCode: 3,
    }),
    item({
      itemId: 'emote_cheer',
      slot: 'emote',
      nameKey: 'item.emote.cheer',
      displayName: 'Cheer',
      rarityLabel: 'common',
      acquisitionSource: ['starter'],
      seasonId: null,
      coinPrice: null,
      hidesFace: 'none',
      hidesPattern: false,
      traits: [],
      assetRef: 'repo:/emotes/cheer',
      howToGet: 'Yours from the start',
      wireEmoteCode: 2,
    }),
    item({
      itemId: 'celebration_basic',
      slot: 'celebration',
      nameKey: 'item.celebration.basic',
      displayName: 'Little bounce',
      rarityLabel: 'common',
      acquisitionSource: ['starter'],
      seasonId: null,
      coinPrice: null,
      hidesFace: 'none',
      hidesPattern: false,
      traits: [],
      assetRef: 'repo:/celebrations/bounce',
      howToGet: 'Yours from the start',
    }),
    item({
      itemId: 'banner_basic',
      slot: 'banner',
      nameKey: 'item.banner.basic',
      displayName: 'Oat sash',
      rarityLabel: 'common',
      acquisitionSource: ['starter'],
      seasonId: null,
      coinPrice: null,
      hidesFace: 'none',
      hidesPattern: false,
      traits: [],
      assetRef: 'repo:/banners/oat',
      howToGet: 'Yours from the start',
    }),
    item({
      itemId: 'title_basic',
      slot: 'title',
      nameKey: 'item.title.basic',
      displayName: 'New Bean',
      rarityLabel: 'common',
      acquisitionSource: ['starter'],
      seasonId: null,
      coinPrice: null,
      hidesFace: 'none',
      hidesPattern: false,
      traits: [],
      assetRef: 'repo:/titles/new_bean',
      howToGet: 'Yours from the start',
    }),
  ]
  for (const colour of STARTER_COLOURS) {
    rows.push(
      item({
        itemId: colour.id,
        slot: 'colour',
        nameKey: `item.colour.${colour.id}`,
        displayName: colour.name,
        rarityLabel: 'common',
        acquisitionSource: ['starter'],
        seasonId: null,
        coinPrice: null,
        hidesFace: 'none',
        hidesPattern: false,
        traits: [],
        assetRef: `repo:/colours/${colour.id}`,
        howToGet: 'Yours from the start',
        hex: colour.hex,
      }),
    )
  }
  for (const pattern of STARTER_PATTERNS) {
    rows.push(
      item({
        itemId: pattern.id,
        slot: 'pattern',
        nameKey: `item.pattern.${pattern.id}`,
        displayName: pattern.name,
        rarityLabel: 'common',
        acquisitionSource: ['starter'],
        seasonId: null,
        coinPrice: null,
        hidesFace: 'none',
        hidesPattern: false,
        traits: [],
        assetRef: pattern.file,
        howToGet: 'Yours from the start',
      }),
    )
  }
  for (const face of STARTER_FACES) {
    rows.push(
      item({
        itemId: face.id,
        slot: 'faceplate',
        nameKey: `item.face.${face.id}`,
        displayName: face.name,
        rarityLabel: 'common',
        acquisitionSource: ['starter'],
        seasonId: null,
        coinPrice: null,
        hidesFace: 'none',
        hidesPattern: false,
        traits: [],
        assetRef: `repo:/faces/${face.id}`,
        howToGet: 'Yours from the start',
      }),
    )
  }
  return rows
}

function shopHow(): string {
  return 'Coin Shop (when it returns)'
}

function shopItems(): CosmeticItem[] {
  const rows: Array<Omit<CosmeticItem, 'reviewStatus'>> = [
    shopPiece('face_star_02', 'faceplate', 'Star face', 'uncommon', 1000, 'item.face.star', 'repo:/faces/star'),
    shopPiece('face_moon_02', 'faceplate', 'Moon face', 'uncommon', 1000, 'item.face.moon', 'repo:/faces/moon'),
    shopPiece('pat_shop_dots', 'pattern', 'Soft dots', 'common', 400, 'item.pattern.dots', 'patterns/pattern_70.png'),
    shopPiece('pat_shop_stars', 'pattern', 'Tiny stars', 'uncommon', 600, 'item.pattern.stars', 'patterns/pattern_72.png'),
    shopPiece('colour_coral', 'colour', 'Coral', 'common', 500, 'item.colour.coral', 'repo:/colours/coral', '#FF6B5B'),
    shopPiece('emote_shop_bounce', 'emote', 'Bounce', 'common', 800, 'item.emote.bounce', 'repo:/emotes/bounce'),
    shopPiece('emote_shop_spin', 'emote', 'Spin', 'uncommon', 900, 'item.emote.spin', 'repo:/emotes/spin'),
    shopPiece('banner_shop_berry', 'banner', 'Berry sash', 'common', 800, 'item.banner.berry', 'repo:/banners/berry'),
    shopPiece('banner_shop_sun', 'banner', 'Sun pennant', 'rare', 1000, 'item.banner.sun', 'repo:/banners/sun'),
    shopPiece('title_shop_sunny', 'title', 'Sunny Pal', 'common', 800, 'item.title.sunny', 'repo:/titles/sunny'),
    shopPiece('celebration_shop_hop', 'celebration', 'Hop', 'uncommon', 1200, 'item.celebration.hop', 'repo:/celebrations/hop'),
    shopPiece('top_shop_oat', 'upper', 'Oat vest', 'common', 1000, 'item.top.oat', 'repo:/costumes/oat_top', undefined, ['colour_copy']),
    shopPiece('bottom_shop_oat', 'lower', 'Oat shorts', 'common', 1000, 'item.bottom.oat', 'repo:/costumes/oat_bottom', undefined, ['colour_copy']),
    shopPiece('top_shop_mint', 'upper', 'Mint vest', 'uncommon', 1500, 'item.top.mintshop', 'repo:/costumes/mint_top', undefined, ['colour_copy']),
    shopPiece('bottom_shop_mint', 'lower', 'Mint shorts', 'uncommon', 1500, 'item.bottom.mintshop', 'repo:/costumes/mint_bottom', undefined, ['colour_copy']),
    shopPiece('top_shop_plum', 'upper', 'Plum vest', 'rare', 2000, 'item.top.plum', 'repo:/costumes/plum_top', undefined, ['colour_copy']),
    shopPiece('bottom_shop_plum', 'lower', 'Plum shorts', 'rare', 2000, 'item.bottom.plum', 'repo:/costumes/plum_bottom', undefined, ['colour_copy']),
    shopPiece('top_hood', 'upper', 'Cozy hood', 'epic', 2500, 'item.top.hood', 'repo:/costumes/hood', undefined, [], 'full', false),
    shopPiece('top_paint', 'upper', 'Painted top', 'rare', 2000, 'item.top.paint', 'repo:/costumes/paint', undefined, [], 'none', true),
  ]
  return rows.map((row) => item(row))
}

function shopPiece(
  itemId: string,
  slot: CosmeticSlotName,
  displayName: string,
  rarityLabel: RarityLabel,
  coinPrice: number,
  nameKey: string,
  assetRef: string,
  hex?: string,
  traits: ItemTrait[] = [],
  hidesFace: FaceHide = 'none',
  hidesPattern = false,
): Omit<CosmeticItem, 'reviewStatus'> {
  return {
    itemId,
    slot,
    nameKey,
    displayName,
    rarityLabel,
    acquisitionSource: ['coins'],
    seasonId: null,
    coinPrice,
    hidesFace,
    hidesPattern,
    traits,
    assetRef,
    howToGet: shopHow(),
    ...(hex ? { hex } : {}),
  }
}

function setPiece(
  itemId: string,
  slot: 'upper' | 'lower',
  displayName: string,
  rarityLabel: RarityLabel,
): CosmeticItem {
  return item({
    itemId,
    slot,
    nameKey: `item.${slot}.${itemId}`,
    displayName,
    rarityLabel,
    acquisitionSource: ['coins'],
    seasonId: null,
    coinPrice: null,
    hidesFace: 'none',
    hidesPattern: false,
    traits: ['colour_copy'],
    assetRef: `repo:/costumes/${itemId}`,
    howToGet: shopHow(),
  })
}

export const SHOP_SETS: readonly ShopSet[] = [
  {
    id: 'set_oat_common',
    name: 'Oat outfit',
    priceCoins: ECONOMY.shop.commonFullCostume,
    rarityLabel: 'common',
    itemIds: ['top_set_oat', 'bottom_set_oat'],
    howToGet: shopHow(),
  },
  {
    id: 'set_leaf_uncommon',
    name: 'Leaf outfit',
    priceCoins: 3000,
    rarityLabel: 'uncommon',
    itemIds: ['top_set_leaf', 'bottom_set_leaf'],
    howToGet: shopHow(),
  },
  {
    id: 'set_ocean_rare',
    name: 'Ocean outfit',
    priceCoins: 3500,
    rarityLabel: 'rare',
    itemIds: ['top_set_ocean', 'bottom_set_ocean'],
    howToGet: shopHow(),
  },
  {
    id: 'set_parade_special',
    name: 'Parade outfit',
    priceCoins: ECONOMY.shop.specialFullCostume,
    rarityLabel: 'special',
    itemIds: ['top_set_parade', 'bottom_set_parade'],
    howToGet: shopHow(),
  },
]

function setPieces(): CosmeticItem[] {
  return [
    setPiece('top_set_oat', 'upper', 'Oat set top', 'common'),
    setPiece('bottom_set_oat', 'lower', 'Oat set shorts', 'common'),
    setPiece('top_set_leaf', 'upper', 'Leaf set top', 'uncommon'),
    setPiece('bottom_set_leaf', 'lower', 'Leaf set shorts', 'uncommon'),
    setPiece('top_set_ocean', 'upper', 'Ocean set top', 'rare'),
    setPiece('bottom_set_ocean', 'lower', 'Ocean set shorts', 'rare'),
    setPiece('top_set_parade', 'upper', 'Parade set top', 'special'),
    setPiece('bottom_set_parade', 'lower', 'Parade set shorts', 'special'),
  ]
}

function seasonItems(): CosmeticItem[] {
  const rows: CosmeticItem[] = []
  const seen = new Set<string>()
  for (const tier of SEASON_TIERS) {
    for (const reward of tier.rewards) {
      if (reward.type !== 'item' || seen.has(reward.ref)) continue
      seen.add(reward.ref)
      rows.push(seasonItem(tier.tier, reward))
    }
  }
  rows.push(
    item({
      itemId: 'pat_season_goal',
      slot: 'pattern',
      nameKey: 'item.pattern.season_goal',
      displayName: 'Goal dots',
      rarityLabel: 'uncommon',
      acquisitionSource: ['season_goal'],
      seasonId: SEASON.id,
      coinPrice: null,
      hidesFace: 'none',
      hidesPattern: false,
      traits: [],
      assetRef: 'patterns/pattern_75.png',
      howToGet: 'Season goal',
    }),
  )
  return rows
}

function seasonItem(tier: number, reward: SeasonReward): CosmeticItem {
  const slot = reward.slot ?? 'banner'
  const costume = slot === 'upper' || slot === 'lower'
  const animated = reward.ref === 'banner_season_anim'
  return item({
    itemId: reward.ref,
    slot,
    nameKey: `item.${slot}.${reward.ref}`,
    displayName: reward.name ?? reward.ref,
    rarityLabel: tier % 10 === 0 ? 'rare' : 'common',
    acquisitionSource: ['seasonpath_free'],
    seasonId: SEASON.id,
    coinPrice: null,
    hidesFace: 'none',
    hidesPattern: false,
    traits: [...(costume ? (['colour_copy'] as ItemTrait[]) : []), ...(animated ? (['animated'] as ItemTrait[]) : [])],
    assetRef: `repo:/season/${reward.ref}`,
    howToGet: `Season Path tier ${tier}`,
  })
}

export function levelRewardItem(level: number): CosmeticItem | undefined {
  if (level < 5 || level % 5 !== 0 || level > ECONOMY.levelRewardCap) return undefined
  const banner = (level / 5) % 2 === 1
  const slot: CosmeticSlotName = banner ? 'banner' : 'title'
  const itemId = `${slot}_level_${level}`
  return item({
    itemId,
    slot,
    nameKey: `item.${slot}.level_${level}`,
    displayName: banner ? `Level ${level} banner` : `Level ${level} title`,
    rarityLabel: 'common',
    acquisitionSource: ['level'],
    seasonId: null,
    coinPrice: null,
    hidesFace: 'none',
    hidesPattern: false,
    traits: [],
    assetRef: `repo:/${slot}s/level_${level}`,
    howToGet: `Player level ${level}`,
  })
}

function buildCatalogue(): CosmeticItem[] {
  return [...starterItems(), ...shopItems(), ...setPieces(), ...seasonItems()]
}

export const CATALOGUE: readonly CosmeticItem[] = buildCatalogue()

const BY_ID = new Map(CATALOGUE.map((row) => [row.itemId, row]))

export function itemById(itemId: string): CosmeticItem | undefined {
  return BY_ID.get(itemId) ?? levelItemFromId(itemId)
}

function levelItemFromId(itemId: string): CosmeticItem | undefined {
  const match = /^(banner|title)_level_(\d+)$/.exec(itemId)
  if (!match) return undefined
  const level = Number(match[2])
  const built = levelRewardItem(level)
  if (!built || built.itemId !== itemId) return undefined
  return built
}

export function itemsBySlot(slot: CosmeticSlotName): CosmeticItem[] {
  return CATALOGUE.filter((row) => row.slot === slot)
}

export function starterItemsFor(slot?: CosmeticSlotName): CosmeticItem[] {
  return CATALOGUE.filter(
    (row) => row.acquisitionSource.includes('starter') && (slot == null || row.slot === slot),
  )
}

export function shopPricedItems(): CosmeticItem[] {
  return CATALOGUE.filter((row) => row.coinPrice != null && row.acquisitionSource.includes('coins'))
}

export function shopSetById(id: string): ShopSet | undefined {
  return SHOP_SETS.find((set) => set.id === id)
}

const BANNED_ITEM_FIELDS = ['weight', 'odds', 'dropRate', 'chance', 'speed', 'gravity', 'capsuleRadius', 'capsuleHalfHeight']

export function assertItemsCosmetic(items: readonly object[]): void {
  for (const row of items) {
    for (const key of Object.keys(row)) {
      if (BANNED_ITEM_FIELDS.includes(key)) throw new Error(`item field not allowed: ${key}`)
    }
  }
}

assertItemsCosmetic(CATALOGUE)
assertItemsCosmetic(SHOP_SETS)
