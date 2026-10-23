import { GAMEPLAY_RELEVANT_AUDIO, QUICK_CHAT, SAFETY, EMOTES } from '@wobblebeans/shared'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COPY, type StringId } from './copy'
import { surpriseOwned, starterOwned, ITEMS } from './dressing/items'
import { bannedHit, entry, pseudo, t, wordCount } from './i18n'
import {
  SCREEN_IDS,
  STATION_KEYS,
  applySettlement,
  boot,
  breakKind,
  canPlayOnline,
  createUi,
  deadline,
  deviceRecord,
  fromSave,
  preview,
  step,
  toSave,
  type Action,
  type UiState,
} from './model'
import { PALETTE, TIMING, contrast } from './tokens'
import { buildView, collectActions, soundPicture, type ScreenView, type ViewNode } from './view'

const NOW = 1_735_689_600_000

describe('copy', () => {
  it('keeps child lines short, buttons shorter, and bans pressure phrases', () => {
    const long: string[] = []
    const banned: string[] = []
    for (const [id, row] of Object.entries(COPY) as [StringId, (typeof COPY)[StringId]][]) {
      expect(row.context.length).toBeGreaterThan(0)
      expect(row.screen.length).toBeGreaterThan(0)
      expect(row.max).toBeGreaterThanOrEqual(Math.ceil(Math.max(row['en-GB'].length, row['en-US'].length) * 1.4))
      for (const locale of ['en-GB', 'en-US'] as const) {
        const text = row[locale]
        if (row.audience === 'child' && wordCount(text) > 8) long.push(`${id} ${locale} ${text}`)
        if (row.role === 'button' && wordCount(text) > 4) long.push(`button ${id} ${text}`)
        const hit = bannedHit(text)
        if (hit) banned.push(`${id} ${hit}`)
        expect(pseudo(text).length).toBeGreaterThan(text.length)
      }
    }
    expect(long).toEqual([])
    expect(banned).toEqual([])
  })

  it('fills placeholders on every previewed screen', () => {
    const holes: string[] = []
    const base = createUi(NOW, 1)
    for (const screen of SCREEN_IDS) {
      const view = buildView(preview(base, screen, screen === 'SC-11' ? 'dash' : screen === 'SC-10' ? 'easy' : null, NOW))
      walkCopy(view.nodes, holes)
      if (view.modal) walkCopy(view.modal.nodes, holes)
    }
    expect(holes).toEqual([])
  })

  it('uses Color in en-US and Colour in en-GB', () => {
    expect(t('dress.colour', 'en-GB')).toBe('Colour')
    expect(t('dress.colour', 'en-US')).toBe('Color')
    expect(t('set.colourHelp', 'en-US')).toContain('Color')
    expect(entry('set.colourHelp')['en-GB']).toContain('Colour')
  })

  it('references every catalogue key from the UI sources', () => {
    const blob = ['view.ts', 'model.ts', 'dom.ts', 'shell.ts', 'dressing/items.ts']
      .map((name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'))
      .join('\n')
    const missing = (Object.keys(COPY) as StringId[]).filter((key) => !blob.includes(`'${key}'`) && !blob.includes(`"${key}"`))
    expect(missing).toEqual([])
  })
})

describe('tokens and cues', () => {
  it('keeps ink and primary text above the contrast floor', () => {
    expect(contrast(PALETTE.ink, PALETTE.cloud)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(PALETTE.ink, PALETTE.oat)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(PALETTE.cloud, PALETTE.primary)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(PALETTE.ink, PALETTE.sun)).toBeGreaterThanOrEqual(3)
  })

  it('pairs every gameplay sound with a picture', () => {
    for (const id of GAMEPLAY_RELEVANT_AUDIO) expect(soundPicture(id)).not.toBeNull()
  })

  it('styles targets, flash rate, and wrapping in the shell css', () => {
    const css = readFileSync(new URL('./ui.css', import.meta.url), 'utf8')
    expect(css).toContain('min-height: var(--target)')
    expect(css).toContain('min-height: var(--primary-h)')
    expect(css).toContain('@keyframes wb-flash')
    expect(css).toContain('animation: wb-flash var(--flash)')
    expect(css).not.toContain('ellipsis')
    expect(TIMING.lateMs).toBe(15_000)
  })
})

describe('safety flows', () => {
  it('does not open the dashboard from Back on the gate', () => {
    let state = boot(grown(), NOW)
    state = step(state, { type: 'press', id: 'hub-grownups', now: NOW })
    expect(state.sub).toBe('pad')
    state = step(state, { type: 'back', now: NOW })
    expect(state.screen).not.toBe('SC-11')
    expect(state.sub).not.toBe('dash')
  })

  it('locks for five minutes after three wrong answers', () => {
    let state = atGate()
    for (let i = 0; i < 3; i++) state = typeDigits(state, '10')
    expect(state.sub).toBe('locked')
    expect(state.gate.lockedUntil - state.now).toBe(TIMING.lockMs)
  })

  it('opens consent on the right sum and treats pending as not verified', () => {
    let state = atGate()
    state = typeDigits(state, String(state.gate.a + state.gate.b))
    expect(state.sub).toBe('consent')
    expect(state.parent.purposes).toEqual({ friends: false, sharing: false, note: false })
    state = step(state, { type: 'press', id: 'consent-read', now: state.now })
    state = step(state, { type: 'press', id: 'consent-next', now: state.now })
    state = step(state, { type: 'press', id: 'consent-card', now: state.now })
    expect(state.parent.status).toBe('pending')
    expect(canPlayOnline(state)).toBe(false)
    state = step(state, { type: 'press', id: 'consent-worked', now: state.now })
    expect(state.parent.status).toBe('verified')
    expect(state.sub).toBe('dash')
    expect(canPlayOnline(state)).toBe(true)
  })

  it('keeps the shop confirm focused on Not now and surprise picks owned items', () => {
    let state = grown()
    state = { ...state, parent: { ...state.parent, shop: true }, profile: { ...state.profile, coins: 1250 }, screen: 'SC-09', dressShop: true }
    const closed = collectActions(buildView({ ...state, parent: { ...state.parent, shop: false } }))
    expect(closed.some((id) => id.startsWith('shop-get:'))).toBe(false)
    const open = collectActions(buildView(state))
    const buy = open.find((id) => id.startsWith('shop-get:'))
    expect(buy).toBeTruthy()
    state = step(state, { type: 'press', id: buy ?? '', now: NOW })
    expect(state.modal).toBe('shop')
    const modal = buildView(state).modal
    expect(modal?.nodes.find((node) => node.kind === 'button' && node.primary)?.kind === 'button' && modal.nodes.find((node) => node.kind === 'button' && node.primary && node.action === 'shop-no')).toBeTruthy()
    const owned = starterOwned()
    const pick = surpriseOwned('colour', owned, 'col-berry', 3)
    expect(pick).toBeTruthy()
    expect(owned).toContain(pick)
    expect(surpriseOwned('colour', [], 'col-berry', 1)).toBeNull()
  })

  it('settles a show once and does not auto play again', () => {
    let state = step(grown(), { type: 'press', id: 'hub-play', now: NOW })
    state = runShow(state)
    expect(state.screen).toBe('SC-08')
    const coins = state.profile.coins
    const again = applySettlement(state)
    expect(again.profile.coins).toBe(coins)
    const ticked = step(state, { type: 'tick', now: state.now + 60_000 })
    expect(ticked.screen).toBe('SC-08')
    expect(ticked.show?.phase).toBe('results')
  })

  it('rate limits quick chat to the shared interval and preset ids', () => {
    let state = step(grown(), { type: 'press', id: 'hub-play', now: NOW })
    state = step(state, { type: 'press', id: 'chat:1', now: NOW })
    expect(state.chatId).toBe(1)
    const soon = step(state, { type: 'press', id: 'chat:2', now: NOW + 200 })
    expect(soon.toast?.key).toBe('toast.moment')
    expect(soon.chatSerial).toBe(state.chatSerial)
    const later = step(state, { type: 'press', id: 'chat:2', now: NOW + SAFETY.quickChatMinIntervalS * 1000 })
    expect(later.chatId).toBe(2)
    expect(QUICK_CHAT.map((row) => row.id)).toEqual([1, 2, 3, 4, 5, 6])
    const names = ['item.wave', 'item.cheer', 'item.dance'].map((id) => t(id as 'item.wave', 'en-GB'))
    expect(EMOTES.map((row) => row.name)).toEqual(names)
  })

  it('exports only device keys and keeps the fourth emote locked', () => {
    const state = createUi(NOW, 4)
    expect(Object.keys(deviceRecord(state)).sort()).toEqual(['level', 'minutes', 'nameSlot', 'playerId', 'trophies'])
    const fourth = ITEMS.find((item) => item.id === 'emote-4')
    expect(fourth?.ownedStart).toBe(false)
    expect(fourth?.price).toBeNull()
  })

  it('round trips a save without trusting a missing profile', () => {
    const state = grown()
    const saved = toSave(state)
    const back = fromSave(saved, NOW)
    expect(back.profile.guestId).toBe(state.profile.guestId)
    expect(back.prefs.bindings.jump).toBe('Space')
  })

  it('replays a stuck tutorial station after 20 seconds', () => {
    const state = { ...createUi(0, 1), screen: 'SC-12' as const, sub: 'station', stationSince: 0 }
    const next = step(state, { type: 'tick', now: TIMING.stationReplayMs })
    expect(next.stationSince).toBe(TIMING.stationReplayMs)
  })
})

describe('reachability', () => {
  it('can open every screen and the important subviews', () => {
    const reached = new Set<string>()
    const seen = new Set<string>()
    const queue: UiState[] = [createUi(NOW, 2), grown(), rich(), limited(), offline(), boot(grown(), NOW, true)]
    let guard = 0
    while (queue.length && seen.size < 9000 && guard < 40_000) {
      const state = queue.shift()!
      const key = sig(state)
      if (seen.has(key)) continue
      seen.add(key)
      guard += 1
      for (const id of visible(state)) reached.add(id)
      const view = buildView(state)
      expect(primaryCount(view)).toBeLessThanOrEqual(1)
      const now = state.now
      const actions: Action[] = collectActions(view).map((id) => (
        id === 'back' ? { type: 'back', now } : { type: 'press', id, now }
      ))
      const due = deadline(state)
      if (due != null) actions.push({ type: 'tick', now: due + 1 })
      if (state.show && state.screen !== 'SC-15' && state.screen !== 'SC-20' && state.screen !== 'SC-14') {
        actions.push({ type: 'link-lost', now })
      }
      if (state.capture) actions.push({ type: 'key', code: 'KeyK', now })
      if (state.screen === 'SC-12' && state.sub === 'station') {
        const code = STATION_KEYS[state.station]?.[0]
        if (code) actions.push({ type: 'key', code, now })
      }
      if (state.screen === 'SC-12' && state.sub === 'controller' && !state.detected) {
        actions.push({ type: 'key', code: 'KeyEnter', now })
      }
      for (const action of actions) {
        const next = step(state, action)
        const nextKey = sig(next)
        if (!seen.has(nextKey)) queue.push(next)
      }
    }
    markPath(reached, readyPath())
    markPath(reached, showsThenHome(grown(), 2))
    markPath(reached, showsThenHome(limited(), 1))
    const subs = [
      'SC-11:pad', 'SC-11:locked', 'SC-11:consent', 'SC-11:dash',
      'SC-12:language', 'SC-12:controller', 'SC-12:offer', 'SC-12:station', 'SC-12:ready',
      'SC-06:qualified', 'SC-06:out',
      'SC-09:shop', 'SC-09:room',
      'SC-14:offline', 'SC-14:gone',
      'SC-19:reminder', 'SC-19:limit',
    ]
    const missing = [...SCREEN_IDS, ...subs].filter((id) => !reached.has(id))
    expect(missing, `visited ${seen.size}`).toEqual([])
    const intro = buildView({ ...grown(), screen: 'SC-04', sub: 'intro' })
    expect(collectActions(intro).some((id) => id.includes('skip'))).toBe(false)
  })
})

function grown(): UiState {
  const state = createUi(NOW, 3)
  state.profile = { ...state.profile, firstLaunch: false, tutorialDone: true, privacySeen: true }
  return boot(state, NOW)
}

function rich(): UiState {
  const state = grown()
  return {
    ...state,
    parent: { ...state.parent, status: 'verified', friends: true, shop: true },
    profile: { ...state.profile, coins: 1250, privacySeen: false },
  }
}

function limited(): UiState {
  const state = grown()
  return { ...state, parent: { ...state.parent, status: 'verified', dailyLimit: 30 } }
}

function offline(): UiState {
  return { ...grown(), offline: true }
}

function atGate(): UiState {
  return step(grown(), { type: 'press', id: 'hub-grownups', now: NOW })
}

function typeDigits(state: UiState, digits: string): UiState {
  let next = state
  for (const digit of digits) next = step(next, { type: 'press', id: `digit:${digit}`, now: next.now })
  return step(next, { type: 'press', id: 'digit:ok', now: next.now })
}

function runShow(state: UiState): UiState {
  let next = state
  for (let i = 0; i < 12; i++) {
    const due = deadline(next)
    if (due == null) break
    next = step(next, { type: 'tick', now: due + 1 })
    if (next.screen === 'SC-06' && next.sub === 'out') next = step(next, { type: 'press', id: 'out-watch', now: next.now })
    if (next.screen === 'SC-08') break
  }
  return next
}

function visible(state: UiState): string[] {
  const ids: string[] = [state.screen]
  if (state.overlay === 'settings') ids.push('SC-10')
  if (state.overlay === 'card') ids.push('SC-16')
  if (state.overlay === 'report') ids.push('SC-13')
  if (state.screen === 'SC-11') ids.push(`SC-11:${state.sub}`)
  if (state.screen === 'SC-12') ids.push(`SC-12:${state.sub}`)
  if (state.screen === 'SC-06') ids.push(`SC-06:${state.sub || state.show?.phase || ''}`)
  if (state.screen === 'SC-09') ids.push(state.dressShop ? 'SC-09:shop' : 'SC-09:room')
  if (state.screen === 'SC-14') ids.push(`SC-14:${state.sub}`)
  if (state.screen === 'SC-19') ids.push(`SC-19:${state.sub}`)
  return ids
}

function sig(state: UiState): string {
  return [
    state.screen,
    state.sub,
    state.overlay ?? '-',
    state.modal ?? '-',
    state.show?.phase ?? '-',
    state.show?.round ?? '-',
    state.profile.firstLaunch ? 1 : 0,
    state.profile.tutorialDone ? 1 : 0,
    state.parent.status,
    state.parent.friends ? 1 : 0,
    state.parent.shop ? 1 : 0,
    state.parent.dailyLimit,
    state.profile.privacySeen ? 1 : 0,
    state.offline ? 1 : 0,
    breakKind(state),
    Math.min(state.sessionMinutes, 120),
    Math.min(state.showsDone, 2),
    state.gate.attempts,
    state.screen === 'SC-11' && state.sub === 'pad' ? state.gate.entry : '',
    state.gate.lockedUntil > state.now ? 1 : 0,
    state.dressTab,
    state.dressShop ? 1 : 0,
    state.settingsTab,
    state.dashTab,
    state.consentStep,
    state.station,
    state.capture ?? '',
    state.screen === 'SC-21' ? state.nameRolls : 0,
    state.seasonFocus,
    state.show?.watch ?? 0,
    state.social.blocked.length,
    state.social.reports.length,
    state.parent.children.length,
    state.social.friends.filter((friend) => friend.status === 'pending').length,
    state.party.length,
    state.show?.tallyDone ? 1 : 0,
    state.toast ? 1 : 0,
    state.wheel ? 1 : 0,
    state.profile.coins > 0 ? 1 : 0,
    state.profile.rerollsLeft,
  ].join('|')
}

function markPath(reached: Set<string>, states: UiState[]): void {
  for (const state of states) {
    for (const id of visible(state)) reached.add(id)
  }
}

function readyPath(): UiState[] {
  const states: UiState[] = []
  let state = createUi(NOW, 2)
  const press = (id: string) => {
    state = step(state, { type: 'press', id, now: state.now })
    states.push(state)
  }
  press('title-ok')
  press('onboard-ok')
  press('onboard-go')
  press('name-like')
  press('tutorial-start')
  while (state.sub === 'station') {
    const code = STATION_KEYS[state.station]?.[0] ?? 'Space'
    state = step(state, { type: 'key', code, now: state.now })
    states.push(state)
  }
  return states
}

function continueShow(start: UiState): UiState[] {
  const states: UiState[] = []
  let state = start.screen === 'SC-03' ? start : step(start, { type: 'press', id: 'hub-play', now: start.now })
  states.push(state)
  for (let i = 0; i < 16 && state.screen !== 'SC-08'; i++) {
    if (state.screen === 'SC-06' && state.sub === 'out') {
      state = step(state, { type: 'press', id: 'out-watch', now: state.now })
      states.push(state)
    }
    const due = deadline(state)
    if (due == null) break
    state = step(state, { type: 'tick', now: due + 1 })
    states.push(state)
  }
  return states
}

function showsThenHome(start: UiState, count: number): UiState[] {
  const states: UiState[] = []
  let state = start
  for (let n = 0; n < count; n++) {
    const played = continueShow(state)
    states.push(...played)
    state = played[played.length - 1] ?? state
    if (state.screen !== 'SC-08') break
    const last = n === count - 1 || breakKind(state) === 'limit'
    state = step(state, { type: 'press', id: last ? 'results-home' : 'results-again', now: state.now })
    states.push(state)
    if (state.screen === 'SC-19') break
  }
  return states
}

function walkCopy(nodes: ViewNode[], holes: string[]): void {
  for (const node of nodes) {
    if (node.kind === 'text' || node.kind === 'button' || node.kind === 'icon' || node.kind === 'counter' || node.kind === 'empty' || node.kind === 'track' || node.kind === 'dots' || node.kind === 'bars') {
      const filled = t(node.label, 'en-GB', 'vars' in node ? node.vars : undefined)
      if (filled.includes('{')) holes.push(`${node.kind} ${node.label} ${filled}`)
    }
    if (node.kind === 'tile') {
      const filled = t(node.label, 'en-GB')
      if (filled.includes('{')) holes.push(`tile ${node.label}`)
      if (node.detail && t(node.detail, 'en-GB').includes('{')) holes.push(`detail ${node.detail}`)
    }
    if (node.kind === 'tabs') {
      if (t(node.label, 'en-GB').includes('{')) holes.push(`tabs ${node.label}`)
      for (const tab of node.tabs) if (t(tab.label, 'en-GB').includes('{')) holes.push(`tab ${tab.label}`)
    }
    if (node.kind === 'slider' || node.kind === 'segment') {
      if (t(node.label, 'en-GB').includes('{')) holes.push(`${node.kind} ${node.label}`)
    }
    if (node.kind === 'segment') {
      for (const option of node.options) if (t(option.label, 'en-GB').includes('{')) holes.push(`seg ${option.label}`)
    }
    if (node.kind === 'hud') {
      if (t(node.objective, 'en-GB').includes('{')) holes.push(`hud ${node.objective}`)
      for (const cue of node.cues) if (t(cue.label, 'en-GB').includes('{')) holes.push(`cue ${cue.label}`)
    }
    if (node.kind === 'row' || node.kind === 'col' || node.kind === 'grid' || node.kind === 'panel') walkCopy(node.children, holes)
  }
}

function primaryCount(view: ScreenView): number {
  let count = 0
  const walk = (nodes: ViewNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'button' && node.primary) count += 1
      if (node.kind === 'row' || node.kind === 'col' || node.kind === 'grid' || node.kind === 'panel') walk(node.children)
    }
  }
  walk(view.nodes)
  if (view.modal) walk(view.modal.nodes)
  return count
}
