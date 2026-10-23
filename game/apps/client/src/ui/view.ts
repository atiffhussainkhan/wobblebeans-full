/**
 * Screen view models. The DOM layer paints these nodes; tests walk them.
 */
import { AUDIO, QUICK_CHAT, formatDisplayName, nameForSlot } from '@wobblebeans/shared'
import type { StringId } from './copy'
import { itemById, itemsFor, shopItems, type DressTab, type Rarity } from './dressing/items'
import { formatClockTime, formatDay, formatNum, SEASON_END_ISO } from './i18n'
import type { IconId } from './icons'
import {
  LEVELS,
  SEASON_REWARDS,
  SHOW_ROUNDS,
  activeCues,
  breakKind,
  chatAllowed,
  countdownLabel,
  displayTimer,
  lobbyFill,
  playtimeBars,
  qualifyCount,
  roundAlive,
  showWarning,
  tallyFraction,
  topScreen,
  type BindAction,
  type DashTab,
  type SettingsTab,
  type UiState,
  type VolKey,
} from './model'
import { formatClock, numberWords, TEAMS, TIMING, type TeamId } from './tokens'

export interface Vars {
  [key: string]: string | number
}

export type ViewNode =
  | { kind: 'button'; variant: 'primary' | 'secondary' | 'quiet'; icon: IconId; label: StringId; action: string; primary?: boolean; disabled?: boolean; reason?: StringId; vars?: Vars }
  | { kind: 'icon'; icon: IconId; label: StringId; action: string }
  | { kind: 'text'; label: StringId; role: 'h1' | 'body' | 'secondary' | 'adult'; vars?: Vars }
  | { kind: 'raw'; text: string; role: 'h1' | 'body' | 'secondary' }
  | { kind: 'row'; children: ViewNode[] }
  | { kind: 'col'; children: ViewNode[] }
  | { kind: 'grid'; children: ViewNode[] }
  | { kind: 'tabs'; label: StringId; tabs: { id: string; icon: IconId; label: StringId }[]; active: string; prefix: string }
  | { kind: 'slider'; id: VolKey; label: StringId; value: number; muted: boolean }
  | { kind: 'segment'; id: string; label: StringId; value: string; options: { id: string; label: StringId }[] }
  | { kind: 'counter'; icon: IconId; label: StringId; value: string }
  | { kind: 'tile'; icon: IconId; label: StringId; action: string; badge?: 'owned' | 'equipped' | 'locked'; disabled?: boolean; detail?: StringId; price?: string; reason?: StringId }
  | { kind: 'track'; label: StringId; value: number; max: number }
  | { kind: 'empty'; icon: IconId; label: StringId; action?: string; actionLabel?: StringId; actionIcon?: IconId }
  | { kind: 'preview'; upper: string; lower: string; yaw: number; face: string }
  | { kind: 'pad'; entry: string; attempts: number }
  | { kind: 'wheel' }
  | { kind: 'hud'; objective: StringId; timer: string; late: boolean; count: string; warning: boolean; team: TeamId | null; cues: { icon: IconId; label: StringId; audio: string }[]; practice: boolean }
  | { kind: 'dots'; filled: number; total: number; label: StringId; vars?: Vars }
  | { kind: 'bars'; label: StringId; values: number[] }
  | { kind: 'code'; shapes: number[] }
  | { kind: 'panel'; children: ViewNode[] }

export interface ModalView {
  title: StringId
  body?: StringId
  nodes: ViewNode[]
}

export interface ScreenView {
  screen: ReturnType<typeof topScreen>
  sub: string
  backdrop: 'menu' | 'play' | 'dim'
  back: boolean
  nodes: ViewNode[]
  modal: ModalView | null
  toast: { label: StringId } | null
}

const SOUND_PICTURE: Record<string, { icon: IconId; label: StringId }> = {
  [AUDIO.fallOff]: { icon: 'fall', label: 'cue.fall' },
  [AUDIO.respawn]: { icon: 'back', label: 'cue.respawn' },
  [AUDIO.checkpoint]: { icon: 'flag', label: 'cue.checkpoint' },
  [AUDIO.qualified]: { icon: 'check', label: 'cue.qualified' },
  [AUDIO.greatTry]: { icon: 'star', label: 'cue.try' },
}

export function soundPicture(id: string): { icon: IconId; label: StringId } | null {
  return SOUND_PICTURE[id] ?? null
}

const DRESS_META: { id: DressTab; icon: IconId; label: StringId }[] = [
  { id: 'colour', icon: 'colour', label: 'dress.colour' },
  { id: 'pattern', icon: 'pattern', label: 'dress.pattern' },
  { id: 'face', icon: 'face', label: 'dress.face' },
  { id: 'upper', icon: 'shirt', label: 'dress.upper' },
  { id: 'lower', icon: 'shirt', label: 'dress.lower' },
  { id: 'emote', icon: 'spark', label: 'dress.emote' },
  { id: 'celebration', icon: 'spark', label: 'dress.celebration' },
  { id: 'banner', icon: 'flag', label: 'dress.banner' },
  { id: 'title', icon: 'tag', label: 'dress.title' },
]

const SET_META: { id: SettingsTab; icon: IconId; label: StringId }[] = [
  { id: 'sound', icon: 'audioOn', label: 'set.sound' },
  { id: 'controls', icon: 'gamepad', label: 'set.controls' },
  { id: 'screen', icon: 'gear', label: 'set.screen' },
  { id: 'easy', icon: 'heart', label: 'set.easy' },
  { id: 'lang', icon: 'chat', label: 'set.lang' },
  { id: 'help', icon: 'question', label: 'set.help' },
]

const DASH_META: { id: DashTab; icon: IconId; label: StringId }[] = [
  { id: 'activity', icon: 'clock', label: 'dash.activity' },
  { id: 'friends', icon: 'friends', label: 'dash.friends' },
  { id: 'safety', icon: 'shield', label: 'dash.safety' },
  { id: 'controls', icon: 'gear', label: 'dash.controls' },
  { id: 'purchases', icon: 'coin', label: 'dash.purchases' },
  { id: 'data', icon: 'info', label: 'dash.data' },
]

const BIND_ROWS: { id: BindAction; label: StringId }[] = [
  { id: 'jump', label: 'set.jump' },
  { id: 'dive', label: 'set.dive' },
  { id: 'grab', label: 'set.grab' },
  { id: 'emote', label: 'dress.emote' },
  { id: 'quickChat', label: 'set.chat' },
  { id: 'back', label: 'common.back' },
]

const STATION_COPY: StringId[] = ['tutorial.move', 'tutorial.jump', 'tutorial.dive', 'tutorial.grab', 'tutorial.emote', 'tutorial.finish']
const STATION_ICON: IconId[] = ['keyboard', 'spark', 'fall', 'plus', 'face', 'flag']

export function buildView(state: UiState): ScreenView {
  const toast = state.toast && state.show?.phase !== 'play' ? { label: state.toast.key } : null
  if (state.overlay === 'settings') return { ...settingsView(state), backdrop: 'dim', toast }
  if (state.overlay === 'card') return { ...cardView(state), toast }
  if (state.overlay === 'report') return { ...reportView(state), toast }
  const base = screenView(state)
  return { ...base, modal: modalOf(state), toast }
}

export function collectActions(view: ScreenView): string[] {
  const ids: string[] = []
  if (view.back) ids.push('back')
  walk(view.nodes, ids)
  if (view.modal) walk(view.modal.nodes, ids)
  return ids
}

function walk(nodes: ViewNode[], ids: string[]): void {
  for (const node of nodes) {
    if (node.kind === 'button' || node.kind === 'tile') {
      if (node.action && !node.disabled) ids.push(node.action)
    } else if (node.kind === 'icon') {
      if (node.action) ids.push(node.action)
    } else if (node.kind === 'empty' && node.action) ids.push(node.action)
    else if (node.kind === 'row' || node.kind === 'col' || node.kind === 'grid' || node.kind === 'panel') walk(node.children, ids)
    else if (node.kind === 'tabs') for (const tab of node.tabs) ids.push(`${node.prefix}${tab.id}`)
    else if (node.kind === 'slider') ids.push(`vol:${node.id}:dec`, `vol:${node.id}:inc`, `vol:${node.id}:mute`)
    else if (node.kind === 'segment') for (const opt of node.options) ids.push(`seg:${node.id}:${opt.id}`)
    else if (node.kind === 'pad') {
      ids.push('digit:del', 'digit:ok')
      for (const digit of '1234567890') ids.push(`digit:${digit}`)
    } else if (node.kind === 'wheel') {
      ids.push('chat-open')
      for (const row of QUICK_CHAT) ids.push(`chat:${row.id}`)
    }
  }
}

function screenView(state: UiState): ScreenView {
  switch (state.screen) {
    case 'title': return titleView(state)
    case 'SC-01': return hubView(state)
    case 'SC-02': return showsView()
    case 'SC-03': return lobbyView(state)
    case 'SC-04': return introView(state)
    case 'SC-05': return hudScreen(state, false)
    case 'SC-06': return outcomeView(state)
    case 'SC-07': return spectateView(state)
    case 'SC-08': return resultsView(state)
    case 'SC-09': return dressView(state)
    case 'SC-10': return settingsView(state)
    case 'SC-11': return parentView(state)
    case 'SC-12': return onboardView(state)
    case 'SC-13': return reportView(state)
    case 'SC-14': return errorView(state)
    case 'SC-15': return hudScreen(state, true)
    case 'SC-17': return friendsView(state)
    case 'SC-18': return seasonView(state)
    case 'SC-19': return breakView(state)
    case 'SC-20': return shell(state, 'dim', false, [text('recon.title', 'h1'), previewNode(state)])
    case 'SC-21': return nameView(state)
    case 'SC-22': return privacyView(state)
    default: return hubView(state)
  }
}

function titleView(state: UiState): ScreenView {
  return shell(state, 'menu', false, [
    text('brand.name', 'h1'),
    previewNode(state),
    btn('primary', 'check', 'common.ok', 'title-ok', true),
  ])
}

function hubView(state: UiState): ScreenView {
  const offline = state.offline
  const look = beanLook(state)
  return shell(state, 'menu', false, [
    text('brand.name', 'h1'),
    { kind: 'row', children: [
      btn('quiet', 'lock', 'hub.grownups', 'hub-grownups'),
      { kind: 'raw', text: displayName(state.profile.committedSlot), role: 'body' },
      btn('quiet', 'dice', 'name.roll', 'hub-name'),
      { kind: 'counter', icon: 'star', label: 'hub.level', value: String(state.profile.level) },
      { kind: 'counter', icon: 'coin', label: 'hub.coins', value: formatNum(state.locale, state.profile.coins) },
      btn('quiet', 'gear', 'hub.settings', 'hub-settings'),
    ] },
    { kind: 'row', children: [
      { kind: 'col', children: [
        btn('secondary', 'shirt', 'hub.dressing', 'hub-dressing'),
        btn('secondary', 'flag', 'hub.season', 'hub-season'),
        btn('secondary', 'shop', 'hub.shop', 'hub-shop'),
      ] },
      { kind: 'preview', ...look, yaw: state.dressYaw },
      { kind: 'col', children: [
        btn('secondary', 'friends', 'hub.friends', 'hub-friends'),
        btn(offline ? 'primary' : 'secondary', 'single', 'hub.practice', 'hub-practice', offline),
      ] },
    ] },
    offline ? text('hub.offline', 'body') : text('lobby.tip', 'secondary'),
    { kind: 'row', children: [
      btn('secondary', 'medal', 'hub.shows', 'hub-shows'),
      btn(offline ? 'quiet' : 'primary', 'play', 'common.play', 'hub-play', !offline),
    ] },
    state.profile.tutorialDone ? { kind: 'row', children: [] } : btn('quiet', 'flag', 'hub.tutorial', 'hub-tutorial'),
  ])
}

function showsView(): ScreenView {
  return {
    screen: 'SC-02',
    sub: 'pick',
    backdrop: 'menu',
    back: true,
    modal: null,
    toast: null,
    nodes: [
      text('shows.title', 'h1'),
      { kind: 'grid', children: [
        { kind: 'tile', icon: 'medal', label: 'shows.main', action: 'shows-play', badge: 'owned', detail: 'shows.beans' },
        { kind: 'tile', icon: 'lock', label: 'common.later', action: '', disabled: true, badge: 'locked' },
        { kind: 'tile', icon: 'lock', label: 'common.later', action: '', disabled: true, badge: 'locked' },
      ] },
      btn('primary', 'play', 'common.play', 'shows-play', true),
    ],
  }
}

function lobbyView(state: UiState): ScreenView {
  const show = state.show
  const count = show ? lobbyFill(show, state.now) : 18
  const nodes: ViewNode[] = [
    { kind: 'row', children: [
      btn('secondary', 'cross', 'common.cancel', 'lobby-cancel'),
      { kind: 'counter', icon: 'friends', label: 'lobby.beans', value: `${count} / 32` },
    ] },
    text('lobby.gather', 'h1'),
    text('lobby.bots', 'body'),
    text('lobby.tip', 'secondary'),
    previewNode(state),
    { kind: 'row', children: (show?.players ?? []).slice(0, 6).map((player) => (
      { kind: 'icon', icon: 'bean', label: 'spec.card', action: `card:${player.id}` } as ViewNode
    )) },
  ]
  if (chatAllowed(state)) nodes.push(btn('secondary', 'chat', 'lobby.chat', 'chat-open'))
  if (state.wheel) nodes.push({ kind: 'wheel' })
  return { screen: 'SC-03', sub: 'lobby', backdrop: 'dim', back: true, modal: null, toast: null, nodes }
}

function introView(state: UiState): ScreenView {
  const show = state.show
  const round = show?.round ?? 0
  const spec = SHOW_ROUNDS[round] ?? SHOW_ROUNDS[0]!
  const level = LEVELS[spec.level]
  const nodes: ViewNode[] = [
    text('intro.round', 'secondary', { round: round + 1, total: SHOW_ROUNDS.length }),
    text(level.kind === 'final' ? 'intro.final' : level.kind === 'survive' ? 'intro.survive' : 'intro.race', 'secondary'),
    text(level.name, 'h1'),
    text(level.objective, 'body'),
    previewNode(state),
  ]
  if (!show || show.phase === 'intro') {
    nodes.push(text('intro.quota', 'body', { count: qualifyCount(roundAlive(round)) }))
  } else if (show.phase === 'hold') nodes.push(text('intro.ready', 'h1'))
  else if (show.phase === 'countdown') {
    const label = countdownLabel(show, state.now)
    nodes.push(label === 'go' ? text('intro.go', 'h1') : { kind: 'raw', text: label, role: 'h1' })
  }
  return { screen: 'SC-04', sub: show?.phase ?? 'intro', backdrop: 'menu', back: false, modal: null, toast: null, nodes }
}

function hudScreen(state: UiState, practice: boolean): ScreenView {
  const show = state.show
  const round = show?.round ?? 0
  const spec = SHOW_ROUNDS[round] ?? SHOW_ROUNDS[0]!
  const level = LEVELS[spec.level]
  const timer = show ? displayTimer(show, state.now) : TIMING.displayRoundMs
  const cues = !practice && show && state.prefs.soundPictures
    ? activeCues(show, state.now).flatMap((id) => {
      const pic = SOUND_PICTURE[id]
      return pic ? [{ ...pic, audio: id }] : []
    })
    : []
  const nodes: ViewNode[] = [
    {
      kind: 'hud',
      objective: practice ? 'hub.tutorial' : level.objective,
      timer: practice ? '' : formatClock(timer),
      late: !practice && timer <= TIMING.lateMs,
      count: practice ? '' : String(roundAlive(round)),
      warning: !practice && !!show && showWarning(show, state.now),
      team: practice ? null : show?.team ?? null,
      cues,
      practice,
    },
  ]
  if (practice) nodes.push(btn('secondary', 'home', 'spec.leave', 'practice-leave'))
  nodes.push(btn('quiet', 'gear', 'hub.settings', practice ? 'practice-settings' : 'hud-pause'))
  if (chatAllowed(state)) nodes.push(btn('secondary', 'chat', 'lobby.chat', 'chat-open'))
  if (state.wheel) nodes.push({ kind: 'wheel' })
  return {
    screen: practice ? 'SC-15' : 'SC-05',
    sub: practice ? 'play' : 'hud',
    backdrop: 'play',
    back: false,
    modal: null,
    toast: null,
    nodes,
  }
}

function outcomeView(state: UiState): ScreenView {
  const qualified = state.sub === 'qualified' || state.show?.phase === 'qualified'
  if (qualified) {
    return shell(state, 'menu', false, [
      text('qual.title', 'h1'),
      previewNode(state),
      text('cue.qualified', 'body'),
    ])
  }
  return shell(state, 'menu', false, [
    text('out.title', 'h1'),
    previewNode(state),
    text('cue.try', 'body'),
    { kind: 'row', children: [
      btn('primary', 'eye', 'out.watch', 'out-watch', true),
      btn('secondary', 'home', 'common.home', 'out-home'),
    ] },
  ])
}

function spectateView(state: UiState): ScreenView {
  const player = state.show?.players[state.show.watch]
  const nodes: ViewNode[] = [
    { kind: 'row', children: [
      btn('secondary', 'home', 'spec.leave', 'spec-leave'),
      text('spec.watching', 'body'),
      player ? { kind: 'raw', text: displayName(player.nameSlot), role: 'body' } : text('brand.name', 'secondary'),
      player?.party ? text('spec.party', 'secondary') : text('spec.watching', 'secondary'),
    ] },
    { kind: 'row', children: [
      btn('secondary', 'prev', 'common.previous', 'spec-prev'),
      previewNode(state),
      btn('secondary', 'next', 'common.next', 'spec-next'),
    ] },
    btn('secondary', 'bean', 'spec.card', player ? `card:${player.id}` : 'card:npc-1'),
  ]
  if (chatAllowed(state)) nodes.push(btn('quiet', 'chat', 'lobby.chat', 'chat-open'))
  if (state.wheel) nodes.push({ kind: 'wheel' })
  return { screen: 'SC-07', sub: 'watch', backdrop: 'play', back: true, modal: null, toast: null, nodes }
}

function resultsView(state: UiState): ScreenView {
  const rewards = state.show?.rewards ?? { xp: 0, coins: 0, trophy: 0 }
  const frac = tallyFraction(state)
  const winner = state.show?.players[0]
  const nodes: ViewNode[] = [
    text('results.winner', 'secondary'),
    winner ? { kind: 'raw', text: displayName(winner.nameSlot), role: 'h1' } : text('brand.name', 'h1'),
    previewNode(state),
    text('results.you', 'body', { round: (state.show?.round ?? 0) + 1 }),
    { kind: 'track', label: 'results.xp', value: Math.round(rewards.xp * frac), max: state.profile.xpNeed },
    { kind: 'row', children: [
      { kind: 'counter', icon: 'coin', label: 'hub.coins', value: `+${Math.round(rewards.coins * frac)}` },
      { kind: 'counter', icon: 'trophy', label: 'results.trophy', value: `+${Math.round(rewards.trophy * frac)}` },
    ] },
    { kind: 'row', children: (state.show?.players ?? []).slice(0, 4).map((player) => (
      { kind: 'icon', icon: 'bean', label: 'spec.card', action: `card:${player.id}` } as ViewNode
    )) },
  ]
  if (frac < 1) nodes.push(btn('quiet', 'check', 'results.skip', 'results-skip'))
  const again = breakKind(state) !== 'limit'
  nodes.push({ kind: 'row', children: [
    btn('primary', 'home', 'common.home', 'results-home', true),
    ...(again ? [btn('secondary', 'play', 'results.again', 'results-again')] : []),
  ] })
  return { screen: 'SC-08', sub: 'results', backdrop: 'menu', back: true, modal: null, toast: null, nodes }
}

function dressView(state: UiState): ScreenView {
  const look = beanLook(state)
  const nodes: ViewNode[] = [
    text('hub.dressing', 'h1'),
    { kind: 'tabs', label: 'hub.dressing', tabs: DRESS_META, active: state.dressTab, prefix: 'dress-tab:' },
    btn('secondary', 'shop', 'hub.shop', 'dress-shop'),
    { kind: 'row', children: [
      btn('quiet', 'prev', 'dress.left', 'dress-left'),
      { kind: 'preview', ...look, yaw: state.dressYaw },
      btn('quiet', 'next', 'dress.right', 'dress-right'),
    ] },
  ]
  if (state.dressShop) nodes.push(...shopNodes(state))
  else nodes.push(...closetNodes(state))
  return { screen: 'SC-09', sub: state.dressShop ? 'shop' : 'room', backdrop: 'menu', back: true, modal: null, toast: null, nodes }
}

function closetNodes(state: UiState): ViewNode[] {
  const items = itemsFor(state.dressTab)
  const selected = state.selectedId ?? state.profile.equipped[state.dressTab]
  const current = items.find((item) => item.id === selected) ?? items[0]
  const nodes: ViewNode[] = [
    { kind: 'grid', children: items.map((item) => tileFor(state, item, false)) },
    btn('secondary', 'dice', 'dress.surprise', 'dress-surprise'),
  ]
  if (current && !state.profile.owned.includes(current.id)) {
    nodes.push(text('dress.how', 'secondary'), text(current.how, 'body'))
  }
  return nodes
}

function shopNodes(state: UiState): ViewNode[] {
  if (state.offline) {
    return [{ kind: 'empty', icon: 'cloud', label: 'dress.offline', action: 'hub-practice', actionLabel: 'hub.practice', actionIcon: 'single' }]
  }
  if (!state.parent.shop) {
    return [{ kind: 'empty', icon: 'lock', label: 'dress.spending', action: 'hub-grownups', actionLabel: 'hub.grownups', actionIcon: 'lock' }]
  }
  return [
    { kind: 'counter', icon: 'coin', label: 'hub.coins', value: formatNum(state.locale, state.profile.coins) },
    { kind: 'grid', children: shopItems().map((item) => tileFor(state, item, true)) },
  ]
}

function tileFor(state: UiState, item: ReturnType<typeof itemsFor>[number], shop: boolean): ViewNode {
  const owned = state.profile.owned.includes(item.id)
  const equipped = state.profile.equipped[item.tab] === item.id
  const badge = equipped ? 'equipped' : owned ? 'owned' : 'locked'
  const price = shop && state.parent.shop && item.price != null && !owned
    ? formatNum(state.locale, item.price)
    : undefined
  const short = item.price != null && state.profile.coins < item.price
  return {
    kind: 'tile',
    icon: owned ? 'check' : 'lock',
    label: item.label,
    action: shop && !owned ? `shop-get:${item.id}` : `equip:${item.id}`,
    badge,
    detail: rarityKey(item.rarity),
    ...(price ? { price } : {}),
    ...(shop && !owned && short ? { disabled: true, reason: 'dress.short' as StringId } : {}),
  }
}

function settingsView(state: UiState): ScreenView {
  const tab = state.settingsTab
  const nodes: ViewNode[] = [
    text('hub.settings', 'h1'),
    { kind: 'tabs', label: 'hub.settings', tabs: SET_META, active: tab, prefix: 'set-tab:' },
    ...settingsBody(state, tab),
  ]
  return { screen: 'SC-10', sub: tab, backdrop: 'menu', back: true, modal: null, toast: null, nodes }
}

function settingsBody(state: UiState, tab: SettingsTab): ViewNode[] {
  const p = state.prefs
  if (tab === 'sound') {
    return [
      slider('master', 'set.all', p.master, p.muteMaster),
      slider('music', 'set.music', p.music, p.muteMusic),
      slider('effects', 'set.effects', p.effects, p.muteEffects),
      slider('buttons', 'set.buttons', p.buttons, p.muteButtons),
    ]
  }
  if (tab === 'controls') {
    const rows: ViewNode[] = BIND_ROWS.map((row) => ({
      kind: 'row',
      children: [
        text(row.label, 'body'),
        { kind: 'raw', text: p.bindings[row.id], role: 'secondary' },
        btn('secondary', 'gear', 'set.change', `bind:${row.id}`),
      ],
    }))
    if (state.capture) rows.push(text('set.press', 'body'))
    return rows
  }
  if (tab === 'screen') {
    return [
      seg('motion', 'set.screen', p.motion, [
        { id: 'full', label: 'set.full' },
        { id: 'reduce', label: 'set.calm' },
      ]),
      seg('fov', 'set.fov', String(p.fov), [
        { id: '60', label: 'fov.60' },
        { id: '70', label: 'fov.70' },
        { id: '85', label: 'fov.85' },
      ]),
    ]
  }
  if (tab === 'easy') {
    return [
      seg('text', 'set.text', String(p.textScale), [
        { id: '100', label: 'set.a' },
        { id: '125', label: 'set.aplus' },
        { id: '150', label: 'set.abig' },
      ]),
      seg('cvd', 'set.colourHelp', p.cvd, [
        { id: 'off', label: 'common.off' },
        { id: 'protan', label: 'set.cvdP' },
        { id: 'deutan', label: 'set.cvdD' },
        { id: 'tritan', label: 'set.cvdT' },
      ]),
      seg('grab', 'set.grab', p.grab, [
        { id: 'hold', label: 'set.hold' },
        { id: 'toggle', label: 'set.toggle' },
      ]),
      seg('mash', 'set.mash', p.mash, [
        { id: 'tap', label: 'set.tap' },
        { id: 'hold', label: 'set.hold' },
      ]),
      seg('pics', 'set.pics', p.soundPictures ? 'on' : 'off', onOff()),
      seg('shake', 'set.shake', p.shake, tri()),
      seg('flashes', 'set.flashes', p.flashes, tri()),
      seg('lines', 'set.lines', p.speedLines, tri()),
      seg('blur', 'set.blur', p.blur ? 'on' : 'off', onOff()),
      btn('secondary', 'flag', 'set.replay', 'set-replay'),
    ]
  }
  if (tab === 'lang') {
    return [
      btn(state.locale === 'en-GB' ? 'primary' : 'secondary', 'flag', 'lang.enGB', 'locale:en-GB', state.locale === 'en-GB'),
      btn(state.locale === 'en-US' ? 'primary' : 'secondary', 'flag', 'lang.enUS', 'locale:en-US', state.locale === 'en-US'),
    ]
  }
  return [
    text('set.season', 'body', { date: formatDay(state.locale, SEASON_END_ISO) }),
    btn('secondary', 'shield', 'set.privacy', 'set-privacy'),
    btn('secondary', 'flag', 'set.replay', 'set-replay'),
    btn('quiet', 'lock', 'set.parent', 'set-parent'),
    btn('quiet', 'cross', 'set.delete', 'set-delete'),
  ]
}

function parentView(state: UiState): ScreenView {
  if (state.sub === 'locked') return lockView(state)
  if (state.sub === 'consent') return consentView(state)
  if (state.sub === 'dash') return dashView(state)
  return gateView(state)
}

function gateView(state: UiState): ScreenView {
  return shell(state, 'menu', true, [
    text('gate.title', 'h1'),
    text('gate.prompt', 'body', { a: numberWords(state.gate.a), b: numberWords(state.gate.b) }),
    { kind: 'pad', entry: state.gate.entry, attempts: state.gate.attempts },
    { kind: 'dots', filled: state.gate.attempts, total: TIMING.attempts, label: 'gate.tries' },
  ])
}

function lockView(state: UiState): ScreenView {
  const left = Math.max(0, state.gate.lockedUntil - state.now)
  return shell(state, 'menu', true, [
    text('gate.locked', 'h1'),
    previewNode(state),
    text('gate.lockedBody', 'body'),
    text('gate.wait', 'secondary', { time: formatClock(left) }),
    left <= 0 ? btn('primary', 'check', 'gate.retry', 'hub-grownups', true) : text('gate.lockedBody', 'secondary'),
  ])
}

function consentView(state: UiState): ScreenView {
  const step = state.consentStep
  const nodes: ViewNode[] = [text('gate.title', 'h1')]
  if (step <= 0) {
    nodes.push(text('consent.notice', 'adult'), btn('primary', 'check', 'consent.read', 'consent-read', true), btn('quiet', 'back', 'consent.later', 'consent-later'))
  } else if (step === 1) {
    nodes.push(
      text('consent.purpose', 'h1'),
      text('consent.off', 'adult'),
      btn(state.parent.purposes.friends ? 'primary' : 'quiet', 'friends', 'consent.friends', 'purpose:friends'),
      btn(state.parent.purposes.sharing ? 'primary' : 'quiet', 'flag', 'consent.share', 'purpose:sharing'),
      btn(state.parent.purposes.note ? 'primary' : 'quiet', 'info', 'consent.note', 'purpose:note'),
      btn('primary', 'next', 'consent.next', 'consent-next', true),
    )
  } else if (step === 2) {
    nodes.push(
      text('consent.device', 'adult'),
      btn('secondary', 'cards', 'consent.card', 'consent-card'),
      btn('secondary', 'shield', 'consent.id', 'consent-id'),
      btn('primary', 'back', 'consent.later', 'consent-later', true),
    )
  } else {
    nodes.push(
      text('consent.pending', 'adult'),
      text('consent.device', 'body'),
      btn('primary', 'back', 'consent.failed', 'consent-failed', true),
      btn('secondary', 'check', 'consent.worked', 'consent-worked'),
    )
  }
  return shell(state, 'menu', true, nodes)
}

function dashView(state: UiState): ScreenView {
  const nodes: ViewNode[] = [
    text('gate.title', 'h1'),
    text('dash.asOf', 'adult', { time: formatClockTime(state.locale, state.parent.dataAsOf) }),
  ]
  if (state.parent.status !== 'verified') nodes.push(text('dash.notYet', 'adult'))
  nodes.push(
    { kind: 'tabs', label: 'dash.activity', tabs: DASH_META, active: state.dashTab, prefix: 'dash-tab:' },
    ...dashBody(state),
  )
  return shell(state, 'menu', true, nodes)
}

function dashBody(state: UiState): ViewNode[] {
  if (state.dashTab === 'activity') {
    return [
      { kind: 'bars', label: 'dash.playtime', values: playtimeBars(state.sessionMinutes) },
      { kind: 'counter', icon: 'trophy', label: 'dash.trophies', value: String(state.profile.trophies) },
      text('season.step', 'adult', { step: state.seasonFocus + 1 }),
    ]
  }
  if (state.dashTab === 'friends') {
    const pending = state.social.friends.filter((friend) => friend.status === 'pending')
    if (!pending.length) return [{ kind: 'empty', icon: 'friends', label: 'dash.none' }]
    return pending.map((friend) => ({
      kind: 'row' as const,
      children: [
        { kind: 'raw' as const, text: displayName(friend.nameSlot), role: 'body' as const },
        btn('primary', 'check', 'dash.approve', `approve:${friend.id}`),
        btn('quiet', 'cross', 'dash.decline', `decline:${friend.id}`),
      ],
    }))
  }
  if (state.dashTab === 'safety') {
    const nodes: ViewNode[] = []
    if (!state.social.reports.length) nodes.push({ kind: 'empty', icon: 'shield', label: 'dash.reports' })
    else nodes.push(text('dash.reports', 'adult'))
    nodes.push(text('dash.blocks', 'adult'))
    for (const id of state.social.blocked) nodes.push({ kind: 'raw', text: id, role: 'secondary' })
    return nodes
  }
  if (state.dashTab === 'controls') {
    return [
      text('dash.applies', 'adult'),
      seg('quick', 'dash.quick', state.parent.quickChat ? 'on' : 'off', onOff()),
      seg('builder', 'dash.builder', state.parent.builder ? 'on' : 'off', onOff()),
      seg('sharing', 'dash.sharing', state.parent.sharing ? 'on' : 'off', onOff()),
      seg('shop', 'dash.coins', state.parent.shop ? 'on' : 'off', onOff()),
      seg('pals', 'dash.allow', state.parent.friends ? 'on' : 'off', onOff()),
      seg('break', 'dash.break', String(state.parent.breakMinutes), minuteOpts()),
      seg('limit', 'dash.limit', String(state.parent.dailyLimit), [
        { id: 'off', label: 'common.off' },
        { id: '30', label: 'time.30' },
        { id: '60', label: 'time.60' },
        { id: '90', label: 'time.90' },
        { id: '120', label: 'time.120' },
      ]),
    ]
  }
  if (state.dashTab === 'purchases') {
    return [{ kind: 'empty', icon: 'lock', label: 'dash.spend' }]
  }
  const kids: ViewNode[] = [
    text('dash.stored', 'adult'),
    text('dash.guest', 'adult'),
    text('dash.child', 'adult'),
    ...state.parent.children.map((child) => ({ kind: 'raw' as const, text: displayName(child.nameSlot), role: 'body' as const })),
    btn('secondary', 'info', 'dash.view', 'dash-view'),
    btn('secondary', 'flag', 'dash.export', 'dash-export'),
    btn('quiet', 'cross', 'dash.delete', 'dash-delete'),
    state.parent.children.length >= TIMING.maxChildren
      ? text('dash.full', 'adult')
      : btn('secondary', 'plus', 'dash.add', 'dash-add'),
    state.parent.movedGuest
      ? text('dash.moved', 'adult')
      : btn('secondary', 'home', 'dash.move', 'dash-move'),
  ]
  return kids
}

function onboardView(state: UiState): ScreenView {
  if (state.sub === 'controller') {
    return shell(state, 'menu', true, [
      text('onboard.press', 'h1'),
      { kind: 'row', children: [
        { kind: 'icon', icon: 'gamepad', label: 'onboard.pad', action: 'onboard-go' },
        { kind: 'icon', icon: 'keyboard', label: 'onboard.keys', action: 'onboard-go' },
      ] },
      text(state.detected === 'pad' ? 'onboard.pad' : 'onboard.keys', 'body'),
      btn('primary', 'play', 'common.go', 'onboard-go', true),
    ])
  }
  if (state.sub === 'offer') {
    return shell(state, 'menu', true, [
      text('tutorial.ask', 'h1'),
      previewNode(state),
      btn('primary', 'flag', 'tutorial.start', 'tutorial-start', true),
      btn('secondary', 'play', 'tutorial.later', 'tutorial-later'),
    ])
  }
  if (state.sub === 'station') {
    const index = Math.min(state.station, STATION_COPY.length - 1)
    const nodes: ViewNode[] = [
      text(STATION_COPY[index] ?? 'tutorial.move', 'h1'),
      { kind: 'dots', filled: index + 1, total: STATION_COPY.length, label: 'tutorial.ask' },
      { kind: 'icon', icon: STATION_ICON[index] ?? 'keyboard', label: STATION_COPY[index] ?? 'tutorial.move', action: '' },
      previewNode(state),
    ]
    if (state.profile.tutorialDone) nodes.push(btn('quiet', 'next', 'tutorial.skip', 'tutorial-skip'))
    return shell(state, 'menu', true, nodes)
  }
  if (state.sub === 'ready') {
    return shell(state, 'menu', true, [
      text('tutorial.ready', 'h1'),
      btn('primary', 'play', 'common.play', 'ready-play', true),
      btn('secondary', 'home', 'tutorial.notNow', 'ready-later'),
    ])
  }
  return shell(state, 'menu', true, [
    text('onboard.words', 'h1'),
    { kind: 'row', children: [
      btn(state.locale === 'en-GB' ? 'primary' : 'secondary', 'flag', 'lang.enGB', 'locale:en-GB'),
      btn(state.locale === 'en-US' ? 'primary' : 'secondary', 'flag', 'lang.enUS', 'locale:en-US'),
    ] },
    btn('primary', 'check', 'common.ok', 'onboard-ok', true),
  ])
}

function nameView(state: UiState): ScreenView {
  const slot = state.nameDraft ?? state.profile.committedSlot
  const left = Math.max(0, state.profile.rerollsLeft - state.nameRolls)
  return shell(state, 'menu', true, [
    text('name.title', 'h1'),
    previewNode(state),
    { kind: 'raw', text: displayName(slot), role: 'h1' },
    { kind: 'dots', filled: left, total: TIMING.rerolls, label: 'name.tries', vars: { count: left } },
    btn('secondary', 'dice', 'name.roll', 'name-roll', false, left <= 0, left <= 0 ? 'name.none' : undefined),
    btn('primary', 'check', 'name.like', 'name-like', true),
  ])
}

function friendsView(state: UiState): ScreenView {
  if (!state.parent.friends) {
    return shell(state, 'menu', true, [
      text('friends.title', 'h1'),
      { kind: 'empty', icon: 'lock', label: 'friends.locked', action: 'hub-grownups', actionLabel: 'hub.grownups', actionIcon: 'lock' },
    ])
  }
  if (state.sub === 'code') {
    return shell(state, 'menu', true, [
      text('friends.code', 'h1'),
      { kind: 'code', shapes: pictureCode(state.profile.guestId) },
      text('friends.pending', 'body'),
    ])
  }
  const visible = state.social.friends.filter((friend) => friend.status !== 'pending')
  const pending = state.social.friends.filter((friend) => friend.status === 'pending').length
  const nodes: ViewNode[] = [text('friends.title', 'h1')]
  if (!visible.length) nodes.push({ kind: 'empty', icon: 'friends', label: 'friends.empty', action: 'friends-add', actionLabel: 'friends.add', actionIcon: 'plus' })
  for (const friend of visible) {
    nodes.push({ kind: 'row', children: [
      { kind: 'raw', text: displayName(friend.nameSlot), role: 'body' },
      text(friend.status === 'online' ? 'friends.online' : 'friends.away', 'secondary'),
      friend.status === 'online'
        ? btn('secondary', 'plus', 'friends.invite', `invite:${friend.id}`)
        : text('friends.away', 'secondary'),
    ] })
  }
  if (pending) nodes.push(text('friends.pending', 'body'))
  nodes.push(btn('primary', 'plus', 'friends.add', 'friends-add', true))
  return shell(state, 'menu', true, nodes)
}

function seasonView(state: UiState): ScreenView {
  const focus = state.seasonFocus
  return shell(state, 'menu', true, [
    text('season.title', 'h1'),
    text('season.free', 'body'),
    { kind: 'row', children: [
      btn('quiet', 'prev', 'common.previous', 'season-prev'),
      btn('quiet', 'next', 'common.next', 'season-next'),
    ] },
    { kind: 'grid', children: SEASON_REWARDS.map((reward, index) => ({
      kind: 'tile' as const,
      icon: index === focus ? 'star' : index < focus ? 'check' : 'lock',
      label: reward,
      action: index === focus ? 'season-next' : '',
      badge: index === focus ? 'equipped' as const : index < focus ? 'owned' as const : 'locked' as const,
      detail: index === focus ? 'season.now' as const : index < focus ? 'common.yours' as const : 'common.locked' as const,
      disabled: index !== focus,
    })) },
    text('season.step', 'body', { step: focus + 1 }),
    text('season.how', 'secondary'),
  ])
}

function breakView(state: UiState): ScreenView {
  const limit = state.sub === 'limit'
  return shell(state, 'menu', false, [
    text(limit ? 'limit.title' : 'break.title', 'h1'),
    previewNode(state),
    limit ? text('limit.body', 'body') : text('break.title', 'secondary'),
    btn('primary', 'home', 'common.ok', 'break-ok', true),
  ])
}

function errorView(state: UiState): ScreenView {
  const gone = state.sub === 'gone' || state.errorCode === 'NET-02'
  return shell(state, 'menu', true, [
    text(gone ? 'err.gone' : 'err.offline', 'h1'),
    previewNode(state),
    text('err.code', 'secondary', { code: state.errorCode ?? 'NET-01' }),
    btn('primary', 'single', 'hub.practice', 'err-practice', true),
    btn('secondary', 'next', 'err.retry', 'err-retry'),
  ])
}

function cardView(state: UiState): ScreenView {
  const player = findPlayer(state, state.cardPlayer)
  const blocked = !!state.cardPlayer && state.social.blocked.includes(state.cardPlayer)
  const muted = !!state.cardPlayer && state.social.muted.includes(state.cardPlayer)
  return {
    screen: 'SC-16',
    sub: 'card',
    backdrop: 'dim',
    back: true,
    modal: null,
    toast: null,
    nodes: [
      { kind: 'panel', children: [
        player ? { kind: 'raw', text: displayName(player.nameSlot), role: 'h1' } : text('spec.card', 'h1'),
        previewNode(state),
        btn('secondary', 'plus', 'card.add', 'card-add', false, !state.parent.friends),
        btn('secondary', 'cross', blocked ? 'card.blocked' : 'card.block', 'card-block', false, blocked),
        btn('secondary', 'audioOff', muted ? 'card.muted' : 'card.mute', 'card-mute', false, muted),
        btn('primary', 'shield', 'card.report', 'card-report', true),
      ] },
    ],
  }
}

function reportView(_state: UiState): ScreenView {
  return {
    screen: 'SC-13',
    sub: 'reasons',
    backdrop: 'dim',
    back: true,
    modal: null,
    toast: null,
    nodes: [
      text('report.title', 'h1'),
      { kind: 'grid', children: [
        btn('secondary', 'mean', 'report.mean', 'report:mean'),
        btn('secondary', 'cards', 'report.cheat', 'report:unfair'),
        btn('secondary', 'tag', 'report.picture', 'report:bug'),
        btn('primary', 'sad', 'report.upset', 'report:scary', true),
      ] },
    ],
  }
}

function privacyView(state: UiState): ScreenView {
  return shell(state, 'menu', true, [
    text('priv.title', 'h1'),
    { kind: 'grid', children: [
      { kind: 'panel', children: [text('priv.safe', 'body')] },
      { kind: 'panel', children: [text('priv.chat', 'body')] },
      { kind: 'panel', children: [text('priv.friends', 'body')] },
    ] },
    btn('primary', 'check', 'common.ok', 'priv-ok', true),
  ])
}

function modalOf(state: UiState): ModalView | null {
  if (state.modal === 'shop') {
    return {
      title: 'dress.get',
      nodes: [
        btn('primary', 'back', 'dress.no', 'shop-no', true),
        btn('secondary', 'coin', 'dress.yes', 'shop-yes'),
      ],
    }
  }
  if (state.modal === 'delete') {
    return {
      title: 'dash.ask',
      nodes: [
        btn('primary', 'check', 'dash.keep', 'delete-no', true),
        btn('quiet', 'cross', 'dash.delete', 'delete-yes'),
      ],
    }
  }
  if (state.modal === 'report-thanks') {
    return {
      title: 'report.thanks',
      body: 'report.adult',
      nodes: [
        text('report.blocked', 'body'),
        btn('primary', 'check', 'common.ok', 'report-ok', true),
      ],
    }
  }
  if (state.modal === 'data') {
    return {
      title: 'dash.stored',
      nodes: [
        text('dash.id', 'adult'),
        { kind: 'raw', text: state.profile.guestId, role: 'secondary' },
        text('dash.minutes', 'adult'),
        { kind: 'raw', text: String(state.sessionMinutes), role: 'secondary' },
        btn('primary', 'check', 'common.ok', 'data-ok', true),
      ],
    }
  }
  if (state.modal === 'exported') {
    return {
      title: 'dash.exported',
      nodes: [btn('primary', 'check', 'common.ok', 'data-ok', true)],
    }
  }
  return null
}

function shell(state: UiState, backdrop: ScreenView['backdrop'], back: boolean, nodes: ViewNode[]): ScreenView {
  return { screen: topScreen(state), sub: state.sub, backdrop, back, nodes, modal: null, toast: null }
}

function btn(
  variant: 'primary' | 'secondary' | 'quiet',
  icon: IconId,
  label: StringId,
  action: string,
  primary = false,
  disabled = false,
  reason?: StringId,
): ViewNode {
  return { kind: 'button', variant, icon, label, action, primary, disabled, ...(reason ? { reason } : {}) }
}

function text(label: StringId, role: 'h1' | 'body' | 'secondary' | 'adult', vars?: Vars): ViewNode {
  return vars ? { kind: 'text', label, role, vars } : { kind: 'text', label, role }
}

function slider(id: VolKey, label: StringId, value: number, muted: boolean): ViewNode {
  return { kind: 'slider', id, label, value, muted }
}

function seg(id: string, label: StringId, value: string, options: { id: string; label: StringId }[]): ViewNode {
  return { kind: 'segment', id, label, value, options }
}

function onOff(): { id: string; label: StringId }[] {
  return [
    { id: 'on', label: 'common.on' },
    { id: 'off', label: 'common.off' },
  ]
}

function tri(): { id: string; label: StringId }[] {
  return [
    { id: 'on', label: 'common.on' },
    { id: 'low', label: 'common.low' },
    { id: 'off', label: 'common.off' },
  ]
}

function minuteOpts(): { id: string; label: StringId }[] {
  return [
    { id: '30', label: 'time.30' },
    { id: '45', label: 'time.45' },
    { id: '60', label: 'time.60' },
    { id: '90', label: 'time.90' },
    { id: '120', label: 'time.120' },
  ]
}

function rarityKey(rarity: Rarity): StringId {
  if (rarity === 'rare') return 'rarity.rare'
  if (rarity === 'uncommon') return 'rarity.uncommon'
  return 'rarity.common'
}

function displayName(slot: number): string {
  const generated = nameForSlot(slot)
  return formatDisplayName(generated.adj, generated.noun, generated.num)
}

function beanLook(state: UiState): { upper: string; lower: string; face: string } {
  return {
    upper: itemById(state.profile.equipped.colour)?.swatch ?? '#E8336B',
    lower: itemById(state.profile.equipped.lower)?.swatch ?? '#F2E6C9',
    face: state.profile.equipped.face,
  }
}

function previewNode(state: UiState): ViewNode {
  const look = beanLook(state)
  return { kind: 'preview', ...look, yaw: state.dressYaw }
}

function findPlayer(state: UiState, id: string | null): { nameSlot: number } | null {
  if (!id) return null
  const npc = state.show?.players.find((player) => player.id === id)
  if (npc) return npc
  const friend = state.social.friends.find((player) => player.id === id)
  if (friend) return friend
  return { nameSlot: 1 }
}

export function pictureCode(id: string): number[] {
  let hash = 0
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) % 997
  return [0, 1, 2, 3].map((i) => (hash >> (i * 2)) % 5)
}

export function teamMark(team: TeamId): { shape: string; pattern: string } {
  return TEAMS[team]
}
