/**
 * Screen state. Pure transitions so every SC-01…SC-22 path can be tested
 * without a browser. Show, shop, and parent flows are mock adapters.
 */
import {
  AUDIO,
  QUICK_CHAT,
  SAFETY,
  type AudioEventId,
} from '@wobblebeans/shared'
import type { StringId } from './copy'
import {
  itemById,
  settlementFor,
  starterLook,
  starterOwned,
  surpriseOwned,
  type DressTab,
  type Look,
} from './dressing/items'
import type { LocaleId } from './i18n'
import { TIMING, makeChallenge, type CvdMode, type TeamId } from './tokens'

export const SCREEN_IDS = [
  'title',
  'SC-01', 'SC-02', 'SC-03', 'SC-04', 'SC-05', 'SC-06', 'SC-07', 'SC-08',
  'SC-09', 'SC-10', 'SC-11', 'SC-12', 'SC-13', 'SC-14', 'SC-15', 'SC-16',
  'SC-17', 'SC-18', 'SC-19', 'SC-20', 'SC-21', 'SC-22',
] as const

export type ScreenId = (typeof SCREEN_IDS)[number]

export function isScreenId(value: string): value is ScreenId {
  return (SCREEN_IDS as readonly string[]).includes(value)
}

export const REPORT_IDS = ['unfair', 'mean', 'scary', 'bug'] as const
export type ReportId = (typeof REPORT_IDS)[number]

export const LEVELS = {
  'knock-knock-run': { name: 'level.knock', objective: 'obj.crown', kind: 'race' },
  'bumpy-parade': { name: 'level.bumpy', objective: 'obj.crown', kind: 'race' },
  'slime-rise': { name: 'level.slime', objective: 'obj.slime', kind: 'survive' },
  'beam-hop': { name: 'level.beam', objective: 'obj.beams', kind: 'survive' },
  'wall-dodge': { name: 'level.wall', objective: 'obj.walls', kind: 'survive' },
  'tail-chase': { name: 'level.tail', objective: 'obj.tail', kind: 'race' },
  'tile-drop': { name: 'level.tile', objective: 'obj.tiles', kind: 'final' },
  'summit-grab': { name: 'level.summit', objective: 'obj.grab', kind: 'final' },
} as const

export type LevelId = keyof typeof LEVELS

export const SHOW_ROUNDS: { level: LevelId; outcome: 'qualify' | 'out' }[] = [
  { level: 'knock-knock-run', outcome: 'qualify' },
  { level: 'tile-drop', outcome: 'out' },
]

export const STATION_KEYS: readonly (readonly string[])[] = [
  ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
  ['Space'],
  ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'KeyX'],
  ['KeyG'],
  ['KeyF', 'KeyC', 'KeyV'],
  ['Space'],
]

export const SEASON_REWARDS: StringId[] = [
  'item.berry', 'item.plain', 'item.smile', 'item.cloud', 'item.legs', 'item.wave',
  'item.cheer', 'item.banner', 'item.titleBean', 'item.hearts', 'item.plum', 'item.starBanner',
]

export type BindAction = 'jump' | 'dive' | 'grab' | 'emote' | 'quickChat' | 'back'
export type SettingsTab = 'sound' | 'controls' | 'screen' | 'easy' | 'lang' | 'help'
export type DashTab = 'activity' | 'friends' | 'safety' | 'controls' | 'purchases' | 'data'
export type Tri = 'on' | 'low' | 'off'
export type VolKey = 'master' | 'music' | 'effects' | 'buttons'

export interface Prefs {
  textScale: 100 | 125 | 150
  cvd: CvdMode
  motion: 'full' | 'reduce'
  soundPictures: boolean
  shake: Tri
  flashes: Tri
  speedLines: Tri
  blur: boolean
  fov: 60 | 70 | 85
  fovTouched: boolean
  grab: 'hold' | 'toggle'
  mash: 'tap' | 'hold'
  master: number
  music: number
  effects: number
  buttons: number
  muteMaster: boolean
  muteMusic: boolean
  muteEffects: boolean
  muteButtons: boolean
  bindings: Record<BindAction, string>
}

export interface Profile {
  guestId: string
  nameSlot: number
  committedSlot: number
  rerollsLeft: number
  rerollDay: string
  tutorialDone: boolean
  privacySeen: boolean
  firstLaunch: boolean
  level: number
  xpInto: number
  xpNeed: number
  coins: number
  trophies: number
  owned: string[]
  equipped: Look
  emotes: string[]
}

export interface ParentModel {
  status: 'none' | 'pending' | 'verified'
  friends: boolean
  quickChat: boolean
  shop: boolean
  builder: boolean
  sharing: boolean
  breakMinutes: 30 | 45 | 60 | 90 | 120
  dailyLimit: 'off' | 30 | 60 | 90 | 120
  purposes: { friends: boolean; sharing: boolean; note: boolean }
  children: { id: string; nameSlot: number }[]
  movedGuest: boolean
  method: 'none' | 'card' | 'id'
  dataAsOf: number
}

export interface FriendRow {
  id: string
  nameSlot: number
  status: 'online' | 'away' | 'pending'
}

export interface SocialModel {
  friends: FriendRow[]
  blocked: string[]
  muted: string[]
  reports: { id: string; category: ReportId; subjectId: string }[]
}

export interface ShowModel {
  id: string
  phase: 'lobby' | 'intro' | 'hold' | 'countdown' | 'play' | 'qualified' | 'out' | 'spectate' | 'results'
  round: number
  phaseUntil: number
  phaseStarted: number
  players: { id: string; nameSlot: number; party: boolean }[]
  watch: number
  minutesApplied: boolean
  rewards: { xp: number; coins: number; trophy: number } | null
  tallyDone: boolean
  team: TeamId | null
}

export interface GateModel {
  a: number
  b: number
  entry: string
  attempts: number
  lockedUntil: number
  intent: 'dash' | 'delete'
  from: ScreenId
  fromSub: string
}

export interface UiState {
  now: number
  screen: ScreenId
  sub: string
  overlay: null | 'settings' | 'card' | 'report'
  modal: null | 'delete' | 'shop' | 'report-thanks' | 'data' | 'exported'
  locale: LocaleId
  prefs: Prefs
  profile: Profile
  parent: ParentModel
  social: SocialModel
  show: ShowModel | null
  gate: GateModel
  settingsTab: SettingsTab
  dashTab: DashTab
  dressTab: DressTab
  dressShop: boolean
  dressYaw: number
  selectedId: string | null
  seasonFocus: number
  cardPlayer: string | null
  offline: boolean
  wheel: boolean
  toast: { key: StringId; until: number } | null
  capture: BindAction | null
  station: number
  stationSince: number
  detected: null | 'keys' | 'pad'
  nameDraft: number | null
  nameRolls: number
  nameFrom: 'boot' | 'hub'
  returnTo: ScreenId | null
  returnSub: string
  privacyFrom: 'friends' | 'help'
  shopItem: string | null
  breakNext: 'hub' | 'lobby'
  errorCode: 'NET-01' | 'NET-02' | null
  reconnectUntil: number
  sessionMinutes: number
  showsDone: number
  settled: string[]
  party: string[]
  quickChatLive: boolean
  lastChatAt: number
  chatSerial: number
  chatId: number
  exportNonce: number
  consentStep: number
  childIndex: number
}

export type Action =
  | { type: 'boot'; now: number; resume?: boolean }
  | { type: 'back'; now: number }
  | { type: 'press'; id: string; now: number }
  | { type: 'tick'; now: number }
  | { type: 'key'; code: string; now: number }
  | { type: 'link-lost'; now: number }

const BIND_DEFAULT: Record<BindAction, string> = {
  jump: 'Space',
  dive: 'ShiftLeft',
  grab: 'KeyG',
  emote: 'KeyF',
  quickChat: 'Digit1',
  back: 'Escape',
}

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

export function qualifyCount(alive: number, pct = 0.5): number {
  const raw = Math.floor(alive * pct)
  return Math.min(Math.max(raw, 1), Math.max(1, alive - 1))
}

export function roundAlive(round: number): number {
  let n = 32
  for (let i = 0; i < round; i++) n = qualifyCount(n)
  return n
}

export function canPlayOnline(state: UiState): boolean {
  return state.parent.status === 'verified'
}

export function chatAllowed(state: UiState): boolean {
  return state.show ? state.quickChatLive : state.parent.quickChat
}

export function breakKind(state: UiState): 'none' | 'reminder' | 'limit' {
  if (state.parent.dailyLimit !== 'off' && state.sessionMinutes >= state.parent.dailyLimit) return 'limit'
  if (state.sessionMinutes >= state.parent.breakMinutes) return 'reminder'
  return 'none'
}

export function displayTimer(show: ShowModel, now: number): number {
  if (show.phase !== 'play') return TIMING.displayRoundMs
  const left = Math.max(0, show.phaseUntil - now)
  return Math.round((left / TIMING.playMs) * TIMING.displayRoundMs)
}

export function showWarning(show: ShowModel, now: number): boolean {
  return show.phase === 'play' && displayTimer(show, now) <= TIMING.lateMs
}

export function countdownLabel(show: ShowModel, now: number): '3' | '2' | '1' | 'go' {
  const left = show.phaseUntil - now
  if (left <= 400) return 'go'
  if (left <= 1400) return '1'
  if (left <= 2400) return '2'
  return '3'
}

export function lobbyFill(show: ShowModel, now: number): number {
  const span = Math.max(1, show.phaseUntil - show.phaseStarted)
  const u = 1 - Math.max(0, show.phaseUntil - now) / span
  return Math.round(18 + 14 * Math.min(1, Math.max(0, u)))
}

export function activeCues(show: ShowModel, now: number): AudioEventId[] {
  const cues: AudioEventId[] = []
  const timer = displayTimer(show, now)
  if (show.phase === 'play' && timer > 30_000) cues.push(AUDIO.checkpoint)
  if (show.phase === 'play' && timer <= TIMING.lateMs && timer >= 9_000) cues.push(AUDIO.fallOff)
  if (show.phase === 'spectate' && now - show.phaseStarted < 2000) cues.push(AUDIO.respawn)
  if (show.phase === 'qualified') cues.push(AUDIO.qualified)
  if (show.phase === 'out') cues.push(AUDIO.greatTry)
  return cues
}

export function tallyFraction(state: UiState): number {
  const show = state.show
  if (!show || show.phase !== 'results') return 1
  if (show.tallyDone || state.prefs.motion === 'reduce') return 1
  const u = (state.now - show.phaseStarted) / TIMING.tallyMs
  return Math.min(1, Math.max(0, u))
}

export function deviceRecord(state: UiState): Record<string, string | number> {
  return {
    playerId: state.profile.guestId,
    nameSlot: state.profile.committedSlot,
    trophies: state.profile.trophies,
    minutes: state.sessionMinutes,
    level: state.profile.level,
  }
}

export function visibleIds(state: UiState): ScreenId[] {
  const ids: ScreenId[] = [state.screen]
  if (state.overlay === 'settings' && state.screen !== 'SC-10') ids.push('SC-10')
  if (state.overlay === 'card') ids.push('SC-16')
  if (state.overlay === 'report') ids.push('SC-13')
  return ids
}

export function topScreen(state: UiState): ScreenId {
  if (state.overlay === 'card') return 'SC-16'
  if (state.overlay === 'report') return 'SC-13'
  if (state.overlay === 'settings') return 'SC-10'
  return state.screen
}

export function deadline(state: UiState): number | null {
  if (state.toast) return state.toast.until
  if (state.screen === 'SC-20') return state.reconnectUntil
  if (state.screen === 'SC-11' && state.sub === 'locked' && state.gate.lockedUntil > state.now) return state.gate.lockedUntil
  if (state.show && state.show.phaseUntil > state.now) return state.show.phaseUntil
  return null
}

export function playtimeBars(sessionMinutes: number): number[] {
  const bars = Array.from({ length: 30 }, () => 0)
  bars[29] = sessionMinutes
  return bars
}

export function createUi(now = 0, seed = 1, reduce = false): UiState {
  const owned = starterOwned()
  return {
    now,
    screen: 'title',
    sub: 'logo',
    overlay: null,
    modal: null,
    locale: 'en-GB',
    prefs: {
      textScale: 100,
      cvd: 'off',
      motion: reduce ? 'reduce' : 'full',
      soundPictures: true,
      shake: 'on',
      flashes: 'on',
      speedLines: 'on',
      blur: false,
      fov: 70,
      fovTouched: false,
      grab: 'hold',
      mash: 'tap',
      master: 70,
      music: 50,
      effects: 80,
      buttons: 60,
      muteMaster: false,
      muteMusic: false,
      muteEffects: false,
      muteButtons: false,
      bindings: { ...BIND_DEFAULT },
    },
    profile: {
      guestId: `ply_${seed}`,
      nameSlot: Math.abs(seed) % 40,
      committedSlot: Math.abs(seed) % 40,
      rerollsLeft: TIMING.rerolls,
      rerollDay: dayKey(now),
      tutorialDone: false,
      privacySeen: false,
      firstLaunch: true,
      level: 1,
      xpInto: 0,
      xpNeed: 200,
      coins: 0,
      trophies: 0,
      owned,
      equipped: starterLook(),
      emotes: ['emote-1', 'emote-2', 'emote-3', ''],
    },
    parent: {
      status: 'none',
      friends: false,
      quickChat: true,
      shop: false,
      builder: false,
      sharing: false,
      breakMinutes: 60,
      dailyLimit: 'off',
      purposes: { friends: false, sharing: false, note: false },
      children: [],
      movedGuest: false,
      method: 'none',
      dataAsOf: now,
    },
    social: {
      friends: [
        { id: 'f1', nameSlot: 4, status: 'online' },
        { id: 'f2', nameSlot: 9, status: 'away' },
        { id: 'f3', nameSlot: 12, status: 'pending' },
      ],
      blocked: [],
      muted: [],
      reports: [],
    },
    show: null,
    gate: {
      a: 24,
      b: 27,
      entry: '',
      attempts: TIMING.attempts,
      lockedUntil: 0,
      intent: 'dash',
      from: 'SC-01',
      fromSub: 'hub',
    },
    settingsTab: 'sound',
    dashTab: 'activity',
    dressTab: 'colour',
    dressShop: false,
    dressYaw: 0,
    selectedId: null,
    seasonFocus: 0,
    cardPlayer: null,
    offline: false,
    wheel: false,
    toast: null,
    capture: null,
    station: 0,
    stationSince: now,
    detected: null,
    nameDraft: null,
    nameRolls: 0,
    nameFrom: 'boot',
    returnTo: null,
    returnSub: '',
    privacyFrom: 'friends',
    shopItem: null,
    breakNext: 'hub',
    errorCode: null,
    reconnectUntil: 0,
    sessionMinutes: 0,
    showsDone: 0,
    settled: [],
    party: [],
    quickChatLive: true,
    lastChatAt: 0,
    chatSerial: 0,
    chatId: 0,
    exportNonce: 0,
    consentStep: 0,
    childIndex: 0,
  }
}

export interface SaveData {
  locale: LocaleId
  prefs: Prefs
  profile: Profile
  parent: ParentModel
  social: SocialModel
  seasonFocus: number
  sessionMinutes: number
  showsDone: number
  settled: string[]
  party: string[]
  lockedUntil: number
}

export function toSave(state: UiState): SaveData {
  return {
    locale: state.locale,
    prefs: state.prefs,
    profile: state.profile,
    parent: state.parent,
    social: state.social,
    seasonFocus: state.seasonFocus,
    sessionMinutes: state.sessionMinutes,
    showsDone: state.showsDone,
    settled: state.settled,
    party: state.party,
    lockedUntil: state.gate.lockedUntil,
  }
}

export function fromSave(saved: SaveData, now: number, reduce = false): UiState {
  const base = createUi(now, 1, reduce)
  return {
    ...base,
    locale: saved.locale === 'en-US' ? 'en-US' : 'en-GB',
    prefs: { ...base.prefs, ...saved.prefs, bindings: { ...BIND_DEFAULT, ...saved.prefs?.bindings } },
    profile: { ...base.profile, ...saved.profile },
    parent: { ...base.parent, ...saved.parent, purposes: { ...base.parent.purposes, ...saved.parent?.purposes } },
    social: { ...base.social, ...saved.social },
    seasonFocus: saved.seasonFocus ?? 0,
    sessionMinutes: saved.sessionMinutes ?? 0,
    showsDone: saved.showsDone ?? 0,
    settled: saved.settled ?? [],
    party: saved.party ?? [],
    gate: { ...base.gate, lockedUntil: saved.lockedUntil ?? 0 },
  }
}

export function step(state: UiState, action: Action): UiState {
  const now = action.now
  if (action.type === 'boot') return boot(state, now, action.resume === true)
  if (action.type === 'tick') return onTick(state, now)
  if (action.type === 'back') return goBack(state, now)
  if (action.type === 'key') return onKey(state, action.code, now)
  if (action.type === 'link-lost') return onLinkLost(state, now)
  return onPress({ ...state, now }, action.id, now)
}

export function boot(state: UiState, now: number, resume = false): UiState {
  const next = refreshRerolls({ ...state, now, overlay: null, modal: null, wheel: false, show: null, toast: null }, now)
  if (resume) {
    return { ...next, screen: 'SC-20', sub: 'wait', reconnectUntil: now + TIMING.reconnectMs, errorCode: null }
  }
  if (next.profile.firstLaunch) return { ...next, screen: 'title', sub: 'logo' }
  return { ...next, screen: 'SC-01', sub: 'hub' }
}

function refreshRerolls(state: UiState, now: number): UiState {
  const day = dayKey(now)
  if (state.profile.rerollDay === day) return state
  return { ...state, profile: { ...state.profile, rerollDay: day, rerollsLeft: TIMING.rerolls } }
}

function onTick(state: UiState, now: number): UiState {
  let next = { ...state, now }
  if (next.toast && now >= next.toast.until) next = { ...next, toast: null }
  if (next.screen === 'SC-20' && now >= next.reconnectUntil) return fail(next, 'NET-02', 'gone', now)
  if (next.screen === 'SC-11' && next.sub === 'locked' && next.gate.lockedUntil > 0 && now >= next.gate.lockedUntil) {
    return openGate(next, now, next.gate.intent, next.gate.from, next.gate.fromSub)
  }
  if (next.screen === 'SC-12' && next.sub === 'station' && now - next.stationSince >= TIMING.stationReplayMs) {
    next = { ...next, stationSince: now }
  }
  if (next.show && next.show.phaseUntil > 0 && now >= next.show.phaseUntil) return advance(next, now)
  return next
}

function onLinkLost(state: UiState, now: number): UiState {
  if (!state.show) return { ...state, now }
  if (state.screen === 'SC-15' || state.screen === 'SC-20' || state.screen === 'SC-14') return { ...state, now }
  return {
    ...state,
    now,
    screen: 'SC-20',
    sub: 'wait',
    overlay: null,
    modal: null,
    wheel: false,
    reconnectUntil: now + TIMING.reconnectMs,
  }
}

function onKey(state: UiState, code: string, now: number): UiState {
  if (state.capture) return assignBind(state, code, now)
  if (state.screen === 'SC-12' && state.sub === 'controller' && code !== 'Escape') {
    const detected = code.startsWith('Gamepad') ? 'pad' : 'keys'
    if (!state.detected) return { ...state, now, detected }
    return openName({ ...state, detected }, 'boot', now)
  }
  if (state.screen === 'SC-12' && state.sub === 'station') return stationKey(state, code, now)
  if (state.screen === 'SC-11' && state.sub === 'pad') {
    if (/^Digit[0-9]$/.test(code)) return onDigit(state, code.slice(5), now)
    if (code === 'Backspace') return onDigit(state, 'del', now)
    if (code === 'Enter' || code === 'NumpadEnter') return onDigit(state, 'ok', now)
  }
  return { ...state, now }
}

function assignBind(state: UiState, code: string, now: number): UiState {
  const cap = state.capture
  if (!cap) return { ...state, now }
  if (code === 'Escape') return { ...state, now, capture: null }
  const bindings = { ...state.prefs.bindings }
  const prev = bindings[cap]
  const other = (Object.keys(bindings) as BindAction[]).find((key) => key !== cap && bindings[key] === code)
  bindings[cap] = code
  if (other) bindings[other] = prev
  return { ...state, now, capture: null, prefs: { ...state.prefs, bindings } }
}

function stationKey(state: UiState, code: string, now: number): UiState {
  const keys = STATION_KEYS[state.station] ?? []
  if (!keys.includes(code)) return { ...state, now }
  const station = state.station + 1
  if (station >= STATION_KEYS.length) {
    return {
      ...state,
      now,
      sub: 'ready',
      station: 0,
      profile: { ...state.profile, tutorialDone: true },
    }
  }
  return { ...state, now, station, stationSince: now }
}

function onPress(state: UiState, id: string, now: number): UiState {
  if (state.modal && id !== 'back' && !id.startsWith('shop-') && id !== 'delete-yes' && id !== 'delete-no' && id !== 'report-ok' && id !== 'data-ok') {
    return state
  }
  if (id.startsWith('digit:')) return onDigit(state, id.slice(6), now)
  if (id.startsWith('vol:')) return onVol(state, id, now)
  if (id.startsWith('seg:')) return onSeg(state, id, now)
  if (id.startsWith('chat:')) return onChat(state, Number(id.slice(5)), now)
  if (id.startsWith('locale:')) {
    const locale = id.endsWith('en-US') ? 'en-US' : 'en-GB'
    return { ...state, locale }
  }
  if (id.startsWith('dress-tab:')) {
    const tab = id.slice(10) as DressTab
    return { ...state, dressTab: tab, dressShop: false }
  }
  if (id.startsWith('set-tab:')) return { ...state, settingsTab: id.slice(8) as SettingsTab }
  if (id.startsWith('dash-tab:')) return { ...state, dashTab: id.slice(9) as DashTab }
  if (id.startsWith('bind:')) return { ...state, capture: id.slice(5) as BindAction }
  if (id.startsWith('purpose:')) return togglePurpose(state, id.slice(8))
  if (id.startsWith('child:')) return { ...state, childIndex: Number(id.slice(6)) || 0 }
  if (id.startsWith('card:')) return openCard(state, id.slice(5))
  if (id.startsWith('report:')) return fileReport(state, id.slice(7), now)
  if (id.startsWith('equip:')) return equip(state, id.slice(6))
  if (id.startsWith('shop-get:')) return askShop(state, id.slice(9))
  if (id.startsWith('invite:')) return invite(state, id.slice(7))
  if (id.startsWith('approve:')) return decideFriend(state, id.slice(8), 'online')
  if (id.startsWith('decline:')) return decideFriend(state, id.slice(8), 'away')
  switch (id) {
    case 'title-ok':
      return state.profile.firstLaunch
        ? { ...state, screen: 'SC-12', sub: 'language' }
        : toHub(state, now)
    case 'onboard-ok':
      return { ...state, screen: 'SC-12', sub: 'controller', detected: null }
    case 'onboard-go':
      return openName(state, 'boot', now)
    case 'name-roll':
      return rollName(state)
    case 'name-like':
      return confirmName(state, now)
    case 'tutorial-start':
      return { ...state, screen: 'SC-12', sub: 'station', station: 0, stationSince: now }
    case 'tutorial-later':
      return toHub(state, now)
    case 'tutorial-skip':
      if (!state.profile.tutorialDone) return state
      if (state.returnTo) return { ...state, screen: state.returnTo, sub: state.returnSub || 'sound', returnTo: null }
      return toHub(state, now)
    case 'ready-play':
      return startShow(state, now)
    case 'ready-later':
      return toHub({ ...state, profile: { ...state.profile, tutorialDone: true } }, now)
    case 'hub-play':
    case 'shows-play':
      if (state.offline) return fail(state, 'NET-01', 'offline', now)
      return startShow(state, now)
    case 'hub-shows':
      if (state.offline) return fail(state, 'NET-01', 'offline', now)
      return { ...state, screen: 'SC-02', sub: 'pick' }
    case 'hub-dressing':
      return { ...state, screen: 'SC-09', sub: 'room', dressShop: false }
    case 'hub-shop':
      return { ...state, screen: 'SC-09', sub: 'room', dressShop: true }
    case 'hub-season':
      if (state.offline) return fail(state, 'NET-01', 'offline', now)
      return { ...state, screen: 'SC-18', sub: 'path' }
    case 'hub-friends':
      if (state.offline) return fail(state, 'NET-01', 'offline', now)
      return { ...state, screen: 'SC-17', sub: 'list' }
    case 'hub-practice':
    case 'err-practice':
      return { ...state, screen: 'SC-15', sub: 'play', show: null, overlay: null, errorCode: null }
    case 'hub-settings':
      return { ...state, screen: 'SC-10', sub: state.settingsTab, overlay: null }
    case 'hub-grownups':
    case 'set-parent':
      return openGate(state, now, 'dash', state.screen === 'SC-11' ? 'SC-01' : state.screen, state.sub)
    case 'hub-name':
      return openName(state, 'hub', now)
    case 'hub-tutorial':
      return { ...state, screen: 'SC-12', sub: 'station', station: 0, stationSince: now, returnTo: 'SC-01', returnSub: 'hub' }
    case 'lobby-cancel':
      if (state.show?.phase === 'lobby') return toHub(state, now)
      return state
    case 'chat-open':
      if (!chatAllowed(state)) return state
      return { ...state, wheel: !state.wheel }
    case 'hud-pause':
    case 'practice-settings':
      return { ...state, overlay: 'settings', wheel: false }
    case 'out-watch':
      return enterSpectate(state, now)
    case 'out-home':
    case 'spec-leave':
      return finishShowTo(state, 'hub', now)
    case 'spec-prev':
      return cycle(state, -1)
    case 'spec-next':
      return cycle(state, 1)
    case 'results-home':
      return leaveResults(state, 'hub', now)
    case 'results-again':
      if (breakKind(state) === 'limit') return leaveResults(state, 'hub', now)
      return leaveResults(state, 'lobby', now)
    case 'results-skip':
      if (!state.show) return state
      return { ...state, show: { ...state.show, tallyDone: true, phaseUntil: 0 } }
    case 'practice-leave':
      return toHub(state, now)
    case 'dress-shop':
      return { ...state, dressShop: true }
    case 'dress-surprise':
      return surprise(state, now)
    case 'dress-left':
      return { ...state, dressYaw: (state.dressYaw + 315) % 360 }
    case 'dress-right':
      return { ...state, dressYaw: (state.dressYaw + 45) % 360 }
    case 'shop-yes':
      return confirmShop(state)
    case 'shop-no':
      return { ...state, modal: null, shopItem: null }
    case 'set-delete':
      return openGate(state, now, 'delete', state.overlay ? state.screen : 'SC-10', state.sub)
    case 'set-replay':
      return { ...state, screen: 'SC-12', sub: 'station', station: 0, stationSince: now, returnTo: 'SC-10', returnSub: state.settingsTab, overlay: null }
    case 'set-privacy':
      return { ...state, screen: 'SC-22', sub: 'cards', privacyFrom: 'help', overlay: null }
    case 'delete-yes':
      return wipe(state, now)
    case 'delete-no':
    case 'data-ok':
    case 'report-ok':
      return { ...state, modal: null }
    case 'consent-read':
      return { ...state, consentStep: 1 }
    case 'consent-next':
      return { ...state, consentStep: 2 }
    case 'consent-card':
      return { ...state, consentStep: 3, parent: { ...state.parent, method: 'card', status: 'pending' } }
    case 'consent-id':
      return { ...state, consentStep: 3, parent: { ...state.parent, method: 'id', status: 'pending' } }
    case 'consent-later':
    case 'consent-failed':
      return toHub(state, now)
    case 'consent-worked':
      if (state.consentStep < 3 || state.parent.status === 'none') return state
      return { ...state, screen: 'SC-11', sub: 'dash', parent: { ...state.parent, status: 'verified', dataAsOf: now } }
    case 'dash-add':
      return addChild(state)
    case 'dash-move':
      if (state.parent.movedGuest) return state
      return { ...state, parent: { ...state.parent, movedGuest: true } }
    case 'dash-view':
      return { ...state, modal: 'data' }
    case 'dash-export':
      return { ...state, exportNonce: state.exportNonce + 1, modal: 'exported' }
    case 'dash-delete':
      return { ...state, modal: 'delete' }
    case 'friends-add':
    case 'card-add':
      return beginFriend(state)
    case 'priv-ok':
      return finishPrivacy(state)
    case 'card-block':
      return blockPlayer(state)
    case 'card-mute':
      return mutePlayer(state, now)
    case 'card-report':
      return { ...state, overlay: 'report' }
    case 'season-prev':
      return { ...state, seasonFocus: Math.max(0, state.seasonFocus - 1) }
    case 'season-next':
      return { ...state, seasonFocus: Math.min(SEASON_REWARDS.length - 1, state.seasonFocus + 1) }
    case 'break-ok':
      return finishBreak(state, now)
    case 'err-retry':
      if (state.offline) return state
      return toHub(state, now)
    default:
      return state
  }
}

function onDigit(state: UiState, key: string, now: number): UiState {
  if (state.screen !== 'SC-11' || state.sub !== 'pad') return state
  if (key === 'del') return { ...state, now, gate: { ...state.gate, entry: state.gate.entry.slice(0, -1) } }
  if (key === 'ok') return submitGate(state, now)
  if (!/^\d$/.test(key)) return state
  if (state.gate.entry.length >= 2) return state
  return { ...state, now, gate: { ...state.gate, entry: state.gate.entry + key } }
}

function submitGate(state: UiState, now: number): UiState {
  const answer = state.gate.a + state.gate.b
  const guess = Number(state.gate.entry)
  if (state.gate.entry.length < 2 || guess !== answer) {
    const attempts = state.gate.attempts - 1
    if (attempts <= 0) {
      return {
        ...state,
        now,
        sub: 'locked',
        gate: { ...state.gate, attempts: 0, entry: '', lockedUntil: now + TIMING.lockMs },
      }
    }
    return { ...state, now, gate: { ...state.gate, attempts, entry: '' } }
  }
  if (state.gate.intent === 'delete') {
    return { ...state, now, screen: state.gate.from, sub: state.gate.fromSub, modal: 'delete', overlay: null }
  }
  if (state.parent.status === 'verified') {
    return { ...state, now, screen: 'SC-11', sub: 'dash', dashTab: 'activity', parent: { ...state.parent, dataAsOf: now } }
  }
  return { ...state, now, screen: 'SC-11', sub: 'consent', consentStep: 0 }
}

function openGate(state: UiState, now: number, intent: 'dash' | 'delete', from: ScreenId, fromSub: string): UiState {
  const gate = { ...state.gate, intent, from, fromSub }
  if (gate.lockedUntil > now) {
    return { ...state, now, screen: 'SC-11', sub: 'locked', overlay: null, modal: null, gate }
  }
  const challenge = makeChallenge(now + intent.length)
  return {
    ...state,
    now,
    screen: 'SC-11',
    sub: 'pad',
    overlay: null,
    modal: null,
    gate: { ...gate, a: challenge.a, b: challenge.b, entry: '', attempts: TIMING.attempts },
  }
}

function goBack(state: UiState, now: number): UiState {
  if (state.capture) return { ...state, now, capture: null }
  if (state.modal) return { ...state, now, modal: null, shopItem: null }
  if (state.wheel) return { ...state, now, wheel: false }
  if (state.overlay === 'report') return { ...state, now, overlay: 'card' }
  if (state.overlay === 'card') return { ...state, now, overlay: null, cardPlayer: null }
  if (state.overlay === 'settings') return { ...state, now, overlay: null }
  if (state.screen === 'SC-20' || state.screen === 'SC-04') return { ...state, now }
  if (state.screen === 'SC-03' && state.show?.phase === 'lobby') return toHub(state, now)
  if (state.screen === 'SC-03') return { ...state, now }
  if (state.screen === 'SC-05' && state.show) return { ...state, now, overlay: 'settings', wheel: false }
  if (state.screen === 'SC-07') return finishShowTo(state, 'hub', now)
  if (state.screen === 'SC-17' && state.sub === 'code') return { ...state, now, sub: 'list' }
  if (state.screen === 'SC-06' && state.sub === 'out') return finishShowTo(state, 'hub', now)
  if (state.screen === 'SC-06') return { ...state, now }
  if (state.screen === 'SC-08') return leaveResults(state, 'hub', now)
  if (state.screen === 'SC-19') return finishBreak(state, now)
  if (state.screen === 'SC-15') return toHub(state, now)
  if (state.screen === 'SC-11' && (state.sub === 'dash' || state.sub === 'consent')) return toHub(state, now)
  if (state.screen === 'SC-11') return goScreen(state, state.gate.from, state.gate.fromSub, now)
  if (state.screen === 'SC-21') return cancelName(state, now)
  if (state.screen === 'SC-22') return state.privacyFrom === 'help'
    ? { ...state, now, screen: 'SC-10', sub: 'help', settingsTab: 'help' }
    : { ...state, now, screen: 'SC-17', sub: 'list' }
  if (state.screen === 'SC-12') return backOnboard(state, now)
  if (state.screen === 'SC-01' || state.screen === 'title') return { ...state, now }
  return toHub(state, now)
}

function backOnboard(state: UiState, now: number): UiState {
  if (state.sub === 'station') {
    if (state.station > 0) return { ...state, now, station: state.station - 1, stationSince: now }
    if (state.returnTo) return { ...state, now, screen: state.returnTo, sub: state.returnSub || 'hub', returnTo: null }
    return { ...state, now, sub: 'offer' }
  }
  if (state.sub === 'ready') return { ...state, now, sub: 'offer' }
  if (state.sub === 'offer') return openName(state, 'boot', now)
  if (state.sub === 'controller') return { ...state, now, sub: 'language', detected: null }
  if (state.sub === 'language') return { ...state, now, screen: 'title', sub: 'logo' }
  return toHub(state, now)
}

function toHub(state: UiState, now: number): UiState {
  return {
    ...state,
    now,
    screen: 'SC-01',
    sub: 'hub',
    overlay: null,
    modal: null,
    wheel: false,
    show: null,
    toast: null,
    returnTo: null,
    profile: { ...state.profile, firstLaunch: false },
  }
}

function goScreen(state: UiState, screen: ScreenId, sub: string, now: number): UiState {
  return { ...state, now, screen, sub, overlay: null, modal: null }
}

function fail(state: UiState, code: 'NET-01' | 'NET-02', sub: string, now: number): UiState {
  return { ...state, now, screen: 'SC-14', sub, errorCode: code, show: null, overlay: null, modal: null, wheel: false }
}

function openName(state: UiState, from: 'boot' | 'hub', now: number): UiState {
  const refreshed = refreshRerolls(state, now)
  return {
    ...refreshed,
    now,
    screen: 'SC-21',
    sub: 'pick',
    nameFrom: from,
    nameDraft: refreshed.profile.committedSlot,
    nameRolls: 0,
  }
}

function rollName(state: UiState): UiState {
  if (state.profile.rerollsLeft - state.nameRolls <= 0) return state
  const slot = (state.nameDraft ?? state.profile.committedSlot) + 1
  return { ...state, nameDraft: slot, nameRolls: state.nameRolls + 1 }
}

function confirmName(state: UiState, now: number): UiState {
  const slot = state.nameDraft ?? state.profile.committedSlot
  const profile = {
    ...state.profile,
    nameSlot: slot,
    committedSlot: slot,
    rerollsLeft: Math.max(0, state.profile.rerollsLeft - state.nameRolls),
  }
  if (state.nameFrom === 'hub') return toHub({ ...state, profile, nameDraft: null, nameRolls: 0 }, now)
  return { ...state, now, profile, nameDraft: null, nameRolls: 0, screen: 'SC-12', sub: 'offer' }
}

function cancelName(state: UiState, now: number): UiState {
  const cleared = { ...state, nameDraft: null, nameRolls: 0 }
  if (state.nameFrom === 'hub') return toHub(cleared, now)
  return { ...cleared, now, screen: 'SC-12', sub: 'controller' }
}

function startShow(state: UiState, now: number): UiState {
  const players = Array.from({ length: 8 }, (_, i) => ({
    id: `npc-${i + 1}`,
    nameSlot: i + 3,
    party: false,
  }))
  if (state.party.length && players[0]) players[0].party = true
  const show: ShowModel = {
    id: `show-${state.showsDone + 1}`,
    phase: 'lobby',
    round: 0,
    phaseUntil: now + TIMING.lobbyMs,
    phaseStarted: now,
    players,
    watch: 0,
    minutesApplied: false,
    rewards: null,
    tallyDone: false,
    team: state.party.length ? 'a' : null,
  }
  return {
    ...state,
    now,
    screen: 'SC-03',
    sub: 'lobby',
    overlay: null,
    modal: null,
    wheel: false,
    show,
    quickChatLive: state.parent.quickChat,
    profile: { ...state.profile, firstLaunch: false },
  }
}

function advance(state: UiState, now: number): UiState {
  const show = state.show
  if (!show) return { ...state, now }
  if (show.phase === 'lobby') return setPhase(state, 'intro', 'SC-04', 'intro', now, TIMING.introMs)
  if (show.phase === 'intro') return setPhase(state, 'hold', 'SC-04', 'hold', now, TIMING.holdMs)
  if (show.phase === 'hold') return setPhase(state, 'countdown', 'SC-04', 'countdown', now, TIMING.countMs)
  if (show.phase === 'countdown') return setPhase(state, 'play', 'SC-05', 'play', now, TIMING.playMs)
  if (show.phase === 'play') return finishRound(state, now)
  if (show.phase === 'qualified') {
    const next = show.round + 1
    if (next >= SHOW_ROUNDS.length) return enterResults(state, now)
    return setPhase({ ...state, show: { ...show, round: next } }, 'intro', 'SC-04', 'intro', now, TIMING.introMs)
  }
  if (show.phase === 'spectate') return enterResults(state, now)
  if (show.phase === 'results') return { ...state, now, show: { ...show, tallyDone: true, phaseUntil: 0 } }
  return { ...state, now }
}

function setPhase(state: UiState, phase: ShowModel['phase'], screen: ScreenId, sub: string, now: number, ms: number): UiState {
  if (!state.show) return { ...state, now }
  const drop = phase === 'qualified' || phase === 'out' || phase === 'results'
  return {
    ...state,
    now,
    screen,
    sub,
    overlay: drop ? null : state.overlay,
    wheel: drop ? false : state.wheel,
    show: { ...state.show, phase, phaseStarted: now, phaseUntil: now + ms },
  }
}

function finishRound(state: UiState, now: number): UiState {
  const show = state.show
  if (!show) return { ...state, now }
  const outcome = SHOW_ROUNDS[show.round]?.outcome ?? 'out'
  if (outcome === 'out') {
    return {
      ...state,
      now,
      screen: 'SC-06',
      sub: 'out',
      overlay: null,
      wheel: false,
      show: { ...show, phase: 'out', phaseStarted: now, phaseUntil: 0 },
    }
  }
  return {
    ...state,
    now,
    screen: 'SC-06',
    sub: 'qualified',
    overlay: null,
    wheel: false,
    show: { ...show, phase: 'qualified', phaseStarted: now, phaseUntil: now + TIMING.qualifiedMs },
  }
}

function enterSpectate(state: UiState, now: number): UiState {
  if (!state.show) return toHub(state, now)
  const watch = state.show.players.findIndex((p) => p.party && !state.social.blocked.includes(p.id))
  return {
    ...state,
    now,
    screen: 'SC-07',
    sub: 'watch',
    overlay: null,
    show: {
      ...state.show,
      phase: 'spectate',
      phaseStarted: now,
      phaseUntil: now + TIMING.spectateMs,
      watch: watch >= 0 ? watch : 0,
    },
  }
}

function enterResults(state: UiState, now: number): UiState {
  if (!state.show) return toHub(state, now)
  const show: ShowModel = {
    ...state.show,
    phase: 'results',
    phaseStarted: now,
    phaseUntil: state.prefs.motion === 'reduce' ? 0 : now + TIMING.tallyMs,
  }
  return applySettlement({
    ...state,
    now,
    screen: 'SC-08',
    sub: 'results',
    overlay: null,
    modal: null,
    wheel: false,
    show,
  })
}

export function applySettlement(state: UiState): UiState {
  const show = state.show
  if (!show || state.settled.includes(show.id)) return state
  const rewards = settlementFor(show.id, false)
  let level = state.profile.level
  let into = state.profile.xpInto + rewards.xp
  let need = state.profile.xpNeed
  while (into >= need) {
    into -= need
    level += 1
    need = 200 + (level - 1) * 20
  }
  return {
    ...state,
    settled: [...state.settled, show.id],
    sessionMinutes: state.sessionMinutes + TIMING.showMinutes,
    showsDone: state.showsDone + 1,
    profile: {
      ...state.profile,
      coins: state.profile.coins + rewards.coins,
      trophies: state.profile.trophies + rewards.trophy,
      level,
      xpInto: into,
      xpNeed: need,
    },
    show: { ...show, rewards, minutesApplied: true, tallyDone: show.tallyDone || state.prefs.motion === 'reduce' },
  }
}

function finishShowTo(state: UiState, dest: 'hub' | 'lobby', now: number): UiState {
  const settled = state.show
    ? applySettlement({
      ...state,
      show: { ...state.show, phase: 'results', phaseStarted: now, phaseUntil: 0, tallyDone: true },
    })
    : state
  return leaveResults(settled, dest, now)
}

function leaveResults(state: UiState, dest: 'hub' | 'lobby', now: number): UiState {
  const kind = breakKind(state)
  if (kind !== 'none') {
    return { ...state, now, screen: 'SC-19', sub: kind, breakNext: kind === 'limit' ? 'hub' : dest, show: null, overlay: null }
  }
  if (dest === 'lobby') return startShow({ ...state, show: null }, now)
  return toHub(state, now)
}

function finishBreak(state: UiState, now: number): UiState {
  if (state.sub === 'limit' || state.breakNext === 'hub') return toHub(state, now)
  return startShow(state, now)
}

function cycle(state: UiState, dir: number): UiState {
  if (!state.show) return state
  const players = state.show.players
  if (!players.length) return state
  let watch = state.show.watch
  for (let i = 0; i < players.length; i++) {
    watch = (watch + dir + players.length) % players.length
    const player = players[watch]
    if (player && !state.social.blocked.includes(player.id)) break
  }
  return { ...state, show: { ...state.show, watch } }
}

function openCard(state: UiState, id: string): UiState {
  return { ...state, overlay: 'card', cardPlayer: id, wheel: false }
}

function blockPlayer(state: UiState): UiState {
  const id = state.cardPlayer
  if (!id || state.social.blocked.includes(id)) return state
  return { ...state, social: { ...state.social, blocked: [...state.social.blocked, id] } }
}

function mutePlayer(state: UiState, now: number): UiState {
  const id = state.cardPlayer
  if (!id || state.social.muted.includes(id)) return state
  const toast = state.show?.phase === 'play' ? state.toast : { key: 'toast.muted' as const, until: now + TIMING.toastMs }
  return { ...state, toast, social: { ...state.social, muted: [...state.social.muted, id] } }
}

function fileReport(state: UiState, category: string, now: number): UiState {
  if (!REPORT_IDS.includes(category as ReportId)) return state
  const subjectId = state.cardPlayer ?? 'npc-1'
  const blocked = state.social.blocked.includes(subjectId)
    ? state.social.blocked
    : [...state.social.blocked, subjectId]
  return {
    ...state,
    now,
    overlay: null,
    modal: 'report-thanks',
    social: {
      ...state.social,
      blocked,
      reports: [...state.social.reports, { id: `rpt_${state.social.reports.length + 1}`, category: category as ReportId, subjectId }],
    },
  }
}

function beginFriend(state: UiState): UiState {
  if (!state.parent.friends) return openGate(state, state.now, 'dash', state.screen, state.sub)
  if (!state.profile.privacySeen) return { ...state, screen: 'SC-22', sub: 'cards', privacyFrom: 'friends', overlay: null }
  return { ...state, screen: 'SC-17', sub: 'code', overlay: null }
}

function finishPrivacy(state: UiState): UiState {
  const profile = { ...state.profile, privacySeen: true }
  if (state.privacyFrom === 'help') {
    return { ...state, profile, screen: 'SC-10', sub: 'help', settingsTab: 'help' }
  }
  const id = `pend-${state.social.friends.length + 1}`
  const friends = [...state.social.friends, { id, nameSlot: 15, status: 'pending' as const }]
  return { ...state, profile, social: { ...state.social, friends }, screen: 'SC-17', sub: 'code' }
}

function invite(state: UiState, id: string): UiState {
  if (!state.parent.friends || state.party.includes(id)) return state
  return { ...state, party: [...state.party, id] }
}

function decideFriend(state: UiState, id: string, status: 'online' | 'away'): UiState {
  const friends = status === 'online'
    ? state.social.friends.map((friend) => friend.id === id ? { ...friend, status } : friend)
    : state.social.friends.filter((friend) => friend.id !== id)
  return { ...state, social: { ...state.social, friends } }
}

function addChild(state: UiState): UiState {
  if (state.parent.status !== 'verified') return state
  if (state.parent.children.length >= TIMING.maxChildren) return state
  const child = { id: `chi_${state.parent.children.length + 1}`, nameSlot: state.parent.children.length + 2 }
  return { ...state, parent: { ...state.parent, children: [...state.parent.children, child] } }
}

function togglePurpose(state: UiState, key: string): UiState {
  if (key !== 'friends' && key !== 'sharing' && key !== 'note') return state
  return { ...state, parent: { ...state.parent, purposes: { ...state.parent.purposes, [key]: !state.parent.purposes[key] } } }
}

function equip(state: UiState, id: string): UiState {
  const item = itemById(id)
  if (!item || !state.profile.owned.includes(id)) return { ...state, selectedId: id }
  const equipped = { ...state.profile.equipped, [item.tab]: id }
  let emotes = state.profile.emotes
  if (item.tab === 'emote') {
    emotes = [...state.profile.emotes]
    const empty = emotes.findIndex((slot) => slot === '')
    emotes[empty >= 0 ? empty : 0] = id
  }
  return { ...state, selectedId: id, profile: { ...state.profile, equipped, emotes } }
}

function surprise(state: UiState, now: number): UiState {
  const current = state.profile.equipped[state.dressTab]
  const id = surpriseOwned(state.dressTab, state.profile.owned, current, now + state.dressYaw)
  if (!id) return state
  return equip(state, id)
}

function askShop(state: UiState, id: string): UiState {
  if (!state.parent.shop || state.offline) return state
  const item = itemById(id)
  if (!item || item.price == null || state.profile.owned.includes(id)) return state
  if (state.profile.coins < item.price) return { ...state, selectedId: id }
  return { ...state, modal: 'shop', shopItem: id }
}

function confirmShop(state: UiState): UiState {
  if (!state.parent.shop || !state.shopItem) return { ...state, modal: null }
  const item = itemById(state.shopItem)
  if (!item || item.price == null) return { ...state, modal: null, shopItem: null }
  if (state.profile.owned.includes(item.id) || state.profile.coins < item.price) {
    return { ...state, modal: null, shopItem: null }
  }
  return {
    ...state,
    modal: null,
    shopItem: null,
    selectedId: item.id,
    profile: {
      ...state.profile,
      coins: state.profile.coins - item.price,
      owned: [...state.profile.owned, item.id],
      equipped: { ...state.profile.equipped, [item.tab]: item.id },
    },
  }
}

function onVol(state: UiState, id: string, now: number): UiState {
  const parts = id.split(':')
  const channel = parts[1] as VolKey
  const op = parts[2] ?? ''
  if (channel !== 'master' && channel !== 'music' && channel !== 'effects' && channel !== 'buttons') return state
  const prefs = { ...state.prefs }
  if (op === 'mute') {
    if (channel === 'master') prefs.muteMaster = !prefs.muteMaster
    if (channel === 'music') prefs.muteMusic = !prefs.muteMusic
    if (channel === 'effects') prefs.muteEffects = !prefs.muteEffects
    if (channel === 'buttons') prefs.muteButtons = !prefs.muteButtons
    return { ...state, now, prefs, toast: noteSaved(state, now) }
  }
  const fine = op.endsWith('1')
  const step = fine ? 1 : 5
  const dir = op.startsWith('inc') ? 1 : -1
  prefs[channel] = Math.min(100, Math.max(0, prefs[channel] + dir * step))
  return { ...state, now, prefs, toast: noteSaved(state, now) }
}

function onSeg(state: UiState, id: string, now: number): UiState {
  const parts = id.split(':')
  const group = parts[1] ?? ''
  const value = parts[2] ?? ''
  const prefs = { ...state.prefs }
  const parent = { ...state.parent }
  if (group === 'text' && (value === '100' || value === '125' || value === '150')) prefs.textScale = Number(value) as 100 | 125 | 150
  if (group === 'cvd' && (value === 'off' || value === 'protan' || value === 'deutan' || value === 'tritan')) prefs.cvd = value
  if (group === 'motion' && (value === 'full' || value === 'reduce')) prefs.motion = value
  if (group === 'pics') prefs.soundPictures = value === 'on'
  if (group === 'grab' && (value === 'hold' || value === 'toggle')) prefs.grab = value
  if (group === 'mash' && (value === 'tap' || value === 'hold')) prefs.mash = value
  if (group === 'shake' && isTri(value)) prefs.shake = value
  if (group === 'flashes' && isTri(value)) prefs.flashes = value
  if (group === 'lines' && isTri(value)) prefs.speedLines = value
  if (group === 'blur') prefs.blur = value === 'on'
  if (group === 'fov' && (value === '60' || value === '70' || value === '85')) {
    prefs.fov = Number(value) as 60 | 70 | 85
    prefs.fovTouched = true
  }
  if (group === 'break' && (value === '30' || value === '45' || value === '60' || value === '90' || value === '120')) {
    parent.breakMinutes = Number(value) as ParentModel['breakMinutes']
  }
  if (group === 'limit') {
    parent.dailyLimit = value === 'off' ? 'off' : (Number(value) as ParentModel['dailyLimit'])
    if (value !== 'off' && value !== '30' && value !== '60' && value !== '90' && value !== '120') parent.dailyLimit = state.parent.dailyLimit
  }
  if (group === 'quick') parent.quickChat = value === 'on'
  if (group === 'shop') parent.shop = value === 'on'
  if (group === 'pals') parent.friends = value === 'on'
  if (group === 'builder') parent.builder = value === 'on'
  if (group === 'sharing') parent.sharing = value === 'on'
  return { ...state, now, prefs, parent, toast: noteSaved(state, now) }
}

function noteSaved(state: UiState, now: number): UiState['toast'] {
  const phase = state.show?.phase
  if (phase === 'play' || phase === 'countdown' || phase === 'hold') return state.toast
  return { key: 'toast.saved', until: now + TIMING.toastMs }
}

function isTri(value: string): value is Tri {
  return value === 'on' || value === 'low' || value === 'off'
}

function onChat(state: UiState, id: number, now: number): UiState {
  if (!QUICK_CHAT.some((row) => row.id === id)) return { ...state, wheel: false }
  if (!chatAllowed(state)) return { ...state, wheel: false }
  const wait = SAFETY.quickChatMinIntervalS * 1000
  if (now - state.lastChatAt < wait) {
    const inRound = state.show?.phase === 'play' || state.show?.phase === 'countdown' || state.show?.phase === 'hold'
    if (inRound) return { ...state, now, wheel: false }
    return { ...state, now, wheel: false, toast: { key: 'toast.moment', until: now + TIMING.toastMs } }
  }
  return { ...state, now, wheel: false, lastChatAt: now, chatSerial: state.chatSerial + 1, chatId: id }
}

function wipe(state: UiState, now: number): UiState {
  const fresh = createUi(now, 3, state.prefs.motion === 'reduce')
  fresh.locale = state.locale
  fresh.gate.lockedUntil = state.gate.lockedUntil
  const booted = boot(fresh, now)
  return { ...booted, toast: { key: 'dash.done', until: now + TIMING.toastMs } }
}

export function preview(state: UiState, screen: ScreenId, sub: string | null, now: number): UiState {
  const rich: UiState = {
    ...state,
    now,
    profile: { ...state.profile, firstLaunch: false, level: 7, coins: 1250, xpInto: 80, xpNeed: 200, tutorialDone: true },
    parent: { ...state.parent, status: 'verified', friends: true, shop: false, dataAsOf: now },
  }
  if (screen === 'title') return { ...rich, screen: 'title', sub: 'logo', profile: { ...rich.profile, firstLaunch: true } }
  if (screen === 'SC-12') return { ...rich, screen: 'SC-12', sub: sub || 'language', profile: { ...rich.profile, firstLaunch: true } }
  if (screen === 'SC-21') return openName(rich, 'hub', now)
  if (screen === 'SC-02') return { ...rich, screen: 'SC-02', sub: 'pick' }
  if (screen === 'SC-09') return { ...rich, screen: 'SC-09', sub: 'room', dressShop: sub === 'shop' }
  if (screen === 'SC-10') return { ...rich, screen: 'SC-10', sub: sub || 'easy', settingsTab: (sub as SettingsTab) || 'easy' }
  if (screen === 'SC-15') return { ...rich, screen: 'SC-15', sub: 'play', show: null }
  if (screen === 'SC-17') return { ...rich, screen: 'SC-17', sub: sub || 'list' }
  if (screen === 'SC-18') return { ...rich, screen: 'SC-18', sub: 'path', seasonFocus: 2 }
  if (screen === 'SC-22') return { ...rich, screen: 'SC-22', sub: 'cards' }
  if (screen === 'SC-14') return { ...rich, screen: 'SC-14', sub: sub || 'offline', errorCode: sub === 'gone' ? 'NET-02' : 'NET-01' }
  if (screen === 'SC-19') return { ...rich, screen: 'SC-19', sub: sub || 'reminder', breakNext: 'hub' }
  if (screen === 'SC-20') return { ...rich, screen: 'SC-20', sub: 'wait', reconnectUntil: now + TIMING.reconnectMs }
  if (screen === 'SC-11') {
    if (sub === 'dash') return { ...rich, screen: 'SC-11', sub: 'dash', dashTab: 'activity' }
    if (sub === 'consent') return { ...rich, screen: 'SC-11', sub: 'consent', consentStep: 0, parent: { ...rich.parent, status: 'none' } }
    if (sub === 'locked') return { ...rich, screen: 'SC-11', sub: 'locked', gate: { ...rich.gate, lockedUntil: now + TIMING.lockMs, attempts: 0 } }
    return openGate(rich, now, 'dash', 'SC-01', 'hub')
  }
  const started = startShow(rich, now)
  const show = started.show
  if (!show) return { ...rich, screen }
  if (screen === 'SC-03' || screen === 'SC-16') {
    const card = screen === 'SC-16' ? { overlay: 'card' as const, cardPlayer: 'npc-1' } : {}
    return { ...started, ...card }
  }
  const round = sub === 'final' ? 1 : 0
  const levelShow = { ...show, round, team: 'a' as const, players: show.players.map((p, i) => ({ ...p, party: i === 0 })) }
  if (screen === 'SC-04') {
    return { ...started, screen: 'SC-04', sub: sub === 'countdown' ? 'countdown' : 'intro', show: { ...levelShow, phase: sub === 'countdown' ? 'countdown' : 'intro', phaseStarted: now, phaseUntil: now + (sub === 'countdown' ? TIMING.countMs : TIMING.introMs) } }
  }
  if (screen === 'SC-05') {
    const left = Math.round(TIMING.playMs * (12_000 / TIMING.displayRoundMs))
    return { ...started, screen: 'SC-05', sub: 'play', show: { ...levelShow, phase: 'play', phaseStarted: now - (TIMING.playMs - left), phaseUntil: now + left } }
  }
  if (screen === 'SC-06') {
    const out = sub !== 'qualified'
    return { ...started, screen: 'SC-06', sub: out ? 'out' : 'qualified', show: { ...levelShow, phase: out ? 'out' : 'qualified', phaseStarted: now, phaseUntil: out ? 0 : now + TIMING.qualifiedMs } }
  }
  if (screen === 'SC-07') {
    return { ...started, screen: 'SC-07', sub: 'watch', show: { ...levelShow, phase: 'spectate', phaseStarted: now, phaseUntil: now + TIMING.spectateMs, watch: 0 } }
  }
  if (screen === 'SC-08') return enterResults({ ...started, show: { ...levelShow, round: 1 } }, now)
  return { ...rich, screen: 'SC-01', sub: 'hub' }
}
