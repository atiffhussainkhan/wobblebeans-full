import { fnv1a } from '@wobblebeans/shared'
import { canonicalJson, signPayload, verifyPayload } from './codec'
import { QUEUE_RULES } from './queue-rules'

/** Stream 3 level ids. Fallbacks cannot be vaulted (doc 10 §B5). */
export const MVP_LEVEL_IDS = [
  'knock-knock-run',
  'bumpy-parade',
  'slime-rise',
  'beam-hop',
  'wall-dodge',
  'tail-chase',
  'tile-drop',
  'summit-grab',
] as const

export type MvpLevelId = (typeof MVP_LEVEL_IDS)[number]

export const FALLBACK_LEVEL_IDS = ['tile-drop', 'bumpy-parade'] as const

const LOC_KEY = /^[a-z0-9_.]+$/
const LEVEL_ID = /^[a-z0-9-]{1,40}$/

export interface LevelRule {
  levelId: string
  enabled: boolean
  weight: number
  /** Set when the level was disabled. Null while it is enabled. */
  disabledAt: string | null
  minPlayers: number
  maxPlayers: number
}

export interface ShowDefinition {
  showId: string
  enabled: boolean
  minPlayers: number
  maxPlayers: number
}

export type LiveOpsEventType = 'lts' | 'xp_boost' | 'theme_week' | 'returning_favourite'

/** Scheduled live-ops event. Dates are absolute. There is no countdown field. */
export interface LiveOpsEvent {
  eventId: string
  type: LiveOpsEventType
  titleLocKey: string
  startUtc: string
  endUtc: string
  playlistRef: string
  rewardTableRef: string
  xpMult: number
  newsPostRef: string
  reviewId: string
  killSwitch: boolean
}

export interface NewsPost {
  id: string
  titleLocKey: string
  bodyLocKey: string
  reviewId: string
  publishedAt: string
}

export interface SeasonWindow {
  id: string
  startsAt: string
  endsAt: string
}

export interface LiveConfig {
  version: string
  physicsHash: number
  accountCreationEnabled: boolean
  friendRequestsEnabled: boolean
  coinShopEnabled: boolean
  schemaVersion?: number
  levels?: LevelRule[]
  shows?: ShowDefinition[]
  events?: LiveOpsEvent[]
  news?: NewsPost[]
  season?: SeasonWindow | null
  conveyorMaxMps?: number
  /** XP cost of season-path tiers 1–10. Tiers 11–70 cost 5000. Stream 7 may replace this. */
  seasonRamp?: number[]
}

export interface PinnedShowConfig {
  showId: string
  version: string
  physicsHash: number
  pinnedAt: string
  levels: LevelRule[]
  events: LiveOpsEvent[]
}

export interface SignedConfig {
  config: LiveConfig
  signature: string
}

interface Draft {
  config: LiveConfig
  authorId: string
  approvers: string[]
  signature: string | null
}

interface Activation {
  version: string
  actorId: string
  mode: 'staging' | 'canary' | 'global'
  canaryPercent: number
  at: string
}

export function defaultLevelRules(nowIso: string | null = null): LevelRule[] {
  void nowIso
  return MVP_LEVEL_IDS.map((levelId) => ({
    levelId,
    enabled: true,
    weight: 1,
    disabledAt: null,
    minPlayers: 8,
    maxPlayers: 32,
  }))
}

export function defaultSeasonRamp(): number[] {
  return [1500, 1889, 2278, 2667, 3056, 3444, 3833, 4222, 4611, 5000]
}

/** Tier reached for season XP. Caps at 70. */
export function tierForSeasonXp(xp: number, ramp = defaultSeasonRamp()): number {
  let remaining = Math.max(0, xp)
  let tier = 0
  for (const cost of ramp) {
    if (remaining < cost) return tier
    remaining -= cost
    tier += 1
  }
  while (tier < 70 && remaining >= 5000) {
    remaining -= 5000
    tier += 1
  }
  return tier
}

export function levelFromLifetimeXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / QUEUE_RULES.xpLevelStep) + 1
}

/**
 * Levels a show may choose. A disable is ignored until it is at least
 * `disableLeadMs` before `showStartMs`, so a last-moment toggle cannot
 * yank a level from a show that is about to start.
 */
export function eligibleLevelIds(
  levels: readonly LevelRule[],
  showStartMs: number,
  leadMs = QUEUE_RULES.disableLeadMs,
): string[] {
  const chosen: string[] = []
  for (const level of levels) {
    if (level.weight < 0) continue
    if (level.enabled) {
      chosen.push(level.levelId)
      continue
    }
    if (!level.disabledAt) continue
    const disabledAt = Date.parse(level.disabledAt)
    if (Number.isNaN(disabledAt)) continue
    if (showStartMs - disabledAt < leadMs) chosen.push(level.levelId)
  }
  return chosen
}

export function activeEvents(events: readonly LiveOpsEvent[], atMs: number): LiveOpsEvent[] {
  return events.filter((event) => {
    if (event.killSwitch) return false
    const start = Date.parse(event.startUtc)
    const end = Date.parse(event.endUtc)
    return atMs >= start && atMs < end
  })
}

/** Effective XP multiplier for a moment. Never above the kid cap. */
export function xpMultiplierAt(events: readonly LiveOpsEvent[], atMs: number): number {
  const boosts = activeEvents(events, atMs).filter((event) => event.type === 'xp_boost')
  const mult = boosts.reduce((max, event) => Math.max(max, event.xpMult), 1)
  return Math.min(QUEUE_RULES.xpBoostCap, mult)
}

export function validateLiveConfig(config: LiveConfig): void {
  if (!config.version || config.version.length > 80) throw new Error('config version is required')
  if (!Number.isInteger(config.physicsHash) || config.physicsHash < 0) throw new Error('physics hash must be an integer')
  if (config.conveyorMaxMps !== undefined && config.conveyorMaxMps > QUEUE_RULES.conveyorMaxMps) {
    throw new Error('conveyor is above the speed cap')
  }
  rejectCountdown(config)
  const levels = config.levels ?? []
  const seen = new Set<string>()
  for (const level of levels) {
    if (!LEVEL_ID.test(level.levelId)) throw new Error('level id is not a preset id')
    if (seen.has(level.levelId)) throw new Error('duplicate level id')
    seen.add(level.levelId)
    if (level.weight < 0) throw new Error('level weight must be >= 0')
    if (!level.enabled && FALLBACK_LEVEL_IDS.includes(level.levelId as (typeof FALLBACK_LEVEL_IDS)[number])) {
      throw new Error('fallback levels stay in rotation')
    }
    if (!level.enabled && !level.disabledAt) throw new Error('a disabled level records when it was disabled')
  }
  for (const event of config.events ?? []) {
    if (!LOC_KEY.test(event.titleLocKey) || !LOC_KEY.test(event.eventId)) throw new Error('event keys are loc ids')
    if (!event.reviewId) throw new Error('event needs a review id')
    if (event.xpMult < 1 || event.xpMult > QUEUE_RULES.xpBoostCap) throw new Error('xp boost is capped')
    const start = Date.parse(event.startUtc)
    const end = Date.parse(event.endUtc)
    if (Number.isNaN(start) || Number.isNaN(end) || end - start < QUEUE_RULES.eventMinMs) {
      throw new Error('events run for at least 7 days')
    }
  }
  for (const post of config.news ?? []) {
    if (!LOC_KEY.test(post.titleLocKey) || !LOC_KEY.test(post.bodyLocKey)) throw new Error('news uses loc keys')
    if (!post.reviewId) throw new Error('news needs a review id')
  }
  if (config.season) {
    const start = Date.parse(config.season.startsAt)
    const end = Date.parse(config.season.endsAt)
    if (Number.isNaN(start) || end - start !== QUEUE_RULES.seasonMs) throw new Error('a season is 8 weeks')
  }
  const ramp = config.seasonRamp
  if (ramp && ramp.reduce((sum, cost) => sum + cost, 0) !== 32_500) throw new Error('season ramp must sum to 32500')
}

function rejectCountdown(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) rejectCountdown(item)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/countdown|onlynleft|secondsremaining/i.test(key)) throw new Error('config must not carry a countdown')
    rejectCountdown(child)
  }
}

function cloneConfig(config: LiveConfig): LiveConfig {
  return structuredClone(config)
}

export class ConfigService {
  readonly name = 'config'
  current: LiveConfig = {
    version: 'foundation-1',
    physicsHash: 0,
    accountCreationEnabled: true,
    friendRequestsEnabled: false,
    coinShopEnabled: false,
    schemaVersion: 1,
    levels: defaultLevelRules(),
    shows: [{ showId: 'main-show', enabled: true, minPlayers: 8, maxPlayers: 32 }],
    events: [],
    news: [],
    season: null,
    conveyorMaxMps: 3.6,
    seasonRamp: defaultSeasonRamp(),
  }

  private readonly drafts = new Map<string, Draft>()
  private readonly pins = new Map<string, PinnedShowConfig>()
  private readonly activations: Activation[] = []
  private canary: { config: LiveConfig; percent: number } | null = null
  private previousGlobal: LiveConfig | null = null
  private live = false

  ready(): { name: string; ready: boolean } {
    return { name: this.name, ready: this.live }
  }

  propose(config: LiveConfig, authorId: string): { version: string } {
    validateLiveConfig(config)
    if (this.drafts.has(config.version) || config.version === this.current.version) {
      throw new Error('config version already exists')
    }
    this.drafts.set(config.version, { config: cloneConfig(config), authorId, approvers: [], signature: null })
    return { version: config.version }
  }

  approve(version: string, approverId: string): { approvals: number; satisfied: boolean } {
    const draft = this.mustDraft(version)
    if (!draft.approvers.includes(approverId)) draft.approvers.push(approverId)
    const distinct = new Set(draft.approvers)
    return { approvals: distinct.size, satisfied: distinct.size >= 2 }
  }

  sign(version: string, key: string): SignedConfig {
    const draft = this.mustDraft(version)
    if (new Set(draft.approvers).size < 2) throw new Error('two approvals are required')
    const signature = signPayload(canonicalJson(draft.config), key)
    draft.signature = signature
    return { config: cloneConfig(draft.config), signature }
  }

  verify(signed: SignedConfig, key: string): boolean {
    return verifyPayload(canonicalJson(signed.config), signed.signature, key)
  }

  activate(
    version: string,
    actorId: string,
    mode: 'staging' | 'canary' | 'global',
    canaryPercent = 5,
    at = new Date(),
  ): LiveConfig {
    const draft = this.mustDraft(version)
    if (!draft.signature) throw new Error('config is not signed')
    const config = cloneConfig(draft.config)
    const percent = mode === 'canary' ? Math.min(100, Math.max(0, canaryPercent)) : 0
    this.activations.push({ version, actorId, mode, canaryPercent: percent, at: at.toISOString() })
    if (mode === 'canary') {
      this.canary = { config, percent }
    } else if (mode === 'global') {
      this.previousGlobal = cloneConfig(this.current)
      this.current = config
      this.canary = null
      this.live = true
    }
    return cloneConfig(mode === 'global' ? this.current : config)
  }

  /** One-step return to the previous global bundle. Pins already taken stay put. */
  rollback(actorId: string, at = new Date()): LiveConfig {
    if (!this.previousGlobal) throw new Error('nothing to roll back')
    const restored = cloneConfig(this.previousGlobal)
    this.previousGlobal = cloneConfig(this.current)
    this.current = restored
    this.canary = null
    this.activations.push({
      version: restored.version,
      actorId,
      mode: 'global',
      canaryPercent: 0,
      at: at.toISOString(),
    })
    this.live = true
    return cloneConfig(this.current)
  }

  /**
   * Break-glass toggle. Writes a new signed version instead of editing the old one.
   * A single MFA admin can throw it; the action is still audited by the caller.
   */
  killSwitch(
    actorId: string,
    patch: Partial<Pick<LiveConfig, 'accountCreationEnabled' | 'friendRequestsEnabled' | 'coinShopEnabled'>> & {
      showId?: string
      showEnabled?: boolean
    },
    key: string,
    at = new Date(),
  ): LiveConfig {
    const next = cloneConfig(this.current)
    next.version = `${this.current.version}-ks-${this.activations.length + 1}`
    if (patch.accountCreationEnabled !== undefined) next.accountCreationEnabled = patch.accountCreationEnabled
    if (patch.friendRequestsEnabled !== undefined) next.friendRequestsEnabled = patch.friendRequestsEnabled
    if (patch.coinShopEnabled !== undefined) next.coinShopEnabled = patch.coinShopEnabled
    if (patch.showId && patch.showEnabled !== undefined) {
      next.shows = (next.shows ?? []).map((show) =>
        show.showId === patch.showId ? { ...show, enabled: patch.showEnabled as boolean } : show,
      )
    }
    validateLiveConfig(next)
    const signature = signPayload(canonicalJson(next), key)
    this.drafts.set(next.version, { config: next, authorId: actorId, approvers: [actorId, 'kill-switch'], signature })
    return this.activate(next.version, actorId, 'global', 0, at)
  }

  versionForShow(showId: string): LiveConfig {
    if (this.canary && this.canary.percent > 0) {
      const bucket = fnv1a(showId) % 100
      if (bucket < this.canary.percent) return cloneConfig(this.canary.config)
    }
    return cloneConfig(this.current)
  }

  /** First call wins. Later activations do not move a show off the bundle it started with. */
  pinForShow(showId: string, at = new Date()): PinnedShowConfig {
    const existing = this.pins.get(showId)
    if (existing) return structuredClone(existing)
    const config = this.versionForShow(showId)
    const pinned: PinnedShowConfig = {
      showId,
      version: config.version,
      physicsHash: config.physicsHash,
      pinnedAt: at.toISOString(),
      levels: structuredClone(config.levels ?? defaultLevelRules()),
      events: structuredClone(config.events ?? []),
    }
    this.pins.set(showId, pinned)
    return structuredClone(pinned)
  }

  getPin(showId: string): PinnedShowConfig | undefined {
    const pinned = this.pins.get(showId)
    return pinned ? structuredClone(pinned) : undefined
  }

  eligibleForPin(showId: string, showStart: Date): string[] {
    const pinned = this.pins.get(showId)
    if (!pinned) return []
    return eligibleLevelIds(pinned.levels, showStart.getTime())
  }

  clientView(version?: string): SignedConfig | null {
    const config = version ? this.bundle(version) : this.current
    if (!config) return null
    const draft = this.drafts.get(config.version)
    const signature = draft?.signature
    if (!signature) return { config: publicSubset(config), signature: '' }
    return { config: publicSubset(config), signature }
  }

  activationLog(): readonly Activation[] {
    return this.activations.map((row) => ({ ...row }))
  }

  private bundle(version: string): LiveConfig | undefined {
    if (this.current.version === version) return this.current
    return this.drafts.get(version)?.config
  }

  private mustDraft(version: string): Draft {
    const draft = this.drafts.get(version)
    if (!draft) throw new Error('unknown config version')
    return draft
  }
}

function publicSubset(config: LiveConfig): LiveConfig {
  return {
    version: config.version,
    physicsHash: config.physicsHash,
    accountCreationEnabled: config.accountCreationEnabled,
    friendRequestsEnabled: config.friendRequestsEnabled,
    coinShopEnabled: config.coinShopEnabled,
    schemaVersion: config.schemaVersion ?? 1,
    levels: config.levels?.map((level) => ({ ...level })),
    shows: config.shows?.map((show) => ({ ...show })),
    events: config.events?.map((event) => ({ ...event })),
    news: config.news?.map((post) => ({ ...post })),
    season: config.season ? { ...config.season } : null,
    conveyorMaxMps: config.conveyorMaxMps,
  }
}
