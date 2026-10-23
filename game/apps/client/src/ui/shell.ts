/**
 * Mounts the menu shell over the frozen gauntlet canvas.
 * One import from main.ts. The sim loop stays where it is.
 */
import { cssVars } from './tokens'
import { paint } from './dom'
import {
  boot,
  countdownLabel,
  createUi,
  deviceRecord,
  displayTimer,
  fromSave,
  isScreenId,
  lobbyFill,
  preview,
  showWarning,
  step,
  tallyFraction,
  toSave,
  type UiState,
} from './model'
import { buildView } from './view'
import './ui.css'

export interface ShellHost {
  canvas: HTMLCanvasElement
  camera: { fov: number; updateProjectionMatrix: () => void }
  legacy: {
    status: HTMLElement
    net: HTMLElement
    error: HTMLElement
    bubble: HTMLElement
    banner: HTMLElement
    me: HTMLElement
  }
}

const SAVE_KEY = 'wb.ui.v1'
const SHOW_KEY = 'wb.inShow'

export function mountShell(host: ShellHost): void {
  const root = document.querySelector<HTMLElement>('#shell') ?? document.body.appendChild(document.createElement('div'))
  if (!root.id) root.id = 'shell'
  document.body.classList.add('wb-shell')

  const now = Date.now()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const stored = readSave()
  const seed = 1 + Math.floor(Math.random() * 39)
  let state = stored ? fromSave(stored, now, reduce) : createUi(now, seed, reduce)
  const resume = sessionStorage.getItem(SHOW_KEY) === '1'
  state = boot(state, now, resume)
  state = devPreview(state, now)

  let savedJson = JSON.stringify(toSave(state))
  let screenStamp = ''
  let padA = false
  let padB = false

  const render = () => {
    const stamp = [
      state.screen, state.sub, state.overlay ?? '', state.modal ?? '', state.wheel ? 1 : 0,
      state.settingsTab, state.dashTab, state.dressTab, state.station, state.consentStep,
      state.capture ?? '', state.gate.entry, state.show?.phase ?? '', state.show?.round ?? '',
    ].join('|')
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.action ?? '' : ''
    paint(root, buildView(state), state.locale)
    applyChrome(host, state)
    if (stamp !== screenStamp) {
      screenStamp = stamp
      focusDefault(root)
    } else if (previous) {
      const again = root.querySelector<HTMLElement>(`[data-action="${cssEscape(previous)}"]`)
      if (again) again.focus()
    }
    const clock = root.querySelector('.wb-clock .wb-value')
    if (clock && state.show) clock.textContent = formatTimer(state)
  }

  const commit = (next: UiState) => {
    const prev = state
    state = next
    if (state.chatSerial !== prev.chatSerial && state.chatId >= 1 && state.chatId <= 6 && inShow(state)) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: `Digit${state.chatId}`, bubbles: true }))
    }
    if (state.exportNonce !== prev.exportNonce) downloadRecord(state)
    const json = JSON.stringify(toSave(state))
    if (json !== savedJson) {
      savedJson = json
      try { localStorage.setItem(SAVE_KEY, json) } catch { /* private mode */ }
    }
    try {
      if (state.show || state.screen === 'SC-20') sessionStorage.setItem(SHOW_KEY, '1')
      else sessionStorage.removeItem(SHOW_KEY)
    } catch { /* ignore */ }
    render()
  }

  root.addEventListener('click', (event) => {
    const hit = event.target instanceof Element ? event.target.closest('[data-action]') : null
    if (!(hit instanceof HTMLButtonElement) || hit.disabled) return
    const id = hit.dataset.action
    if (!id) return
    const at = Date.now()
    commit(step(state, id === 'back' ? { type: 'back', now: at } : { type: 'press', id, now: at }))
  })

  window.addEventListener('keydown', (event) => {
    if (!event.isTrusted) return
    const at = Date.now()
    if (event.code === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      commit(step(state, { type: 'back', now: at }))
      return
    }
    const slider = event.target instanceof HTMLElement ? event.target.closest('[data-slider]') : null
    if (slider instanceof HTMLElement && event.code.startsWith('Arrow')) {
      event.preventDefault()
      event.stopPropagation()
      const fine = event.shiftKey ? '1' : ''
      const dir = event.code === 'ArrowRight' || event.code === 'ArrowUp' ? 'inc' : 'dec'
      commit(step(state, { type: 'press', id: `vol:${slider.dataset.slider}:${dir}${fine}`, now: at }))
      return
    }
    if (!menusCapture(state)) return
    event.stopPropagation()
    if (state.capture || listensForKeys(state)) {
      event.preventDefault()
      commit(step(state, { type: 'key', code: event.code, now: at }))
      return
    }
    if (state.wheel && /^Digit[1-6]$/.test(event.code)) {
      event.preventDefault()
      commit(step(state, { type: 'press', id: `chat:${event.code.slice(5)}`, now: at }))
    }
  }, true)

  // The gauntlet socket reconnects by itself. SC-20 is a refresh during a show,
  // or an explicit link-lost once the show director owns the socket.
  void host.legacy

  window.setInterval(() => {
    pollPad(root, () => state, commit)
    const at = Date.now()
    const next = step(state, { type: 'tick', now: at })
    if (paintKey(next) !== paintKey(state)) commit(next)
    else {
      state = next
      const clock = root.querySelector('.wb-clock')
      const digits = clock?.querySelector('.wb-value')
      if (digits && state.show) digits.textContent = formatTimer(state)
      if (state.show) clock?.classList.toggle('wb-late', showWarning(state.show, state.now))
    }
  }, 200)

  render()

  function pollPad(
    scope: HTMLElement,
    read: () => UiState,
    apply: (next: UiState) => void,
  ): void {
    const pads = navigator.getGamepads?.() ?? []
    let nextA = false
    let nextB = false
    for (const pad of pads) {
      if (!pad) continue
      nextA = nextA || !!pad.buttons[0]?.pressed
      nextB = nextB || !!pad.buttons[1]?.pressed
    }
    const current = read()
    const inMenu = menusCapture(current)
    if (inMenu && nextA && !padA) {
      const focused = document.activeElement
      if (focused instanceof HTMLButtonElement && scope.contains(focused) && !focused.disabled) focused.click()
      else scope.querySelector<HTMLButtonElement>('[data-primary="true"]')?.click()
    }
    if (inMenu && nextB && !padB) apply(step(current, { type: 'back', now: Date.now() }))
    padA = nextA
    padB = nextB
  }
}

function menusCapture(state: UiState): boolean {
  if (state.overlay || state.modal || state.wheel || state.capture) return true
  if (state.screen === 'SC-05' || state.screen === 'SC-07' || state.screen === 'SC-15') return false
  return true
}

function listensForKeys(state: UiState): boolean {
  if (state.screen === 'SC-11' && state.sub === 'pad') return true
  if (state.screen === 'SC-12' && (state.sub === 'station' || state.sub === 'controller')) return true
  return false
}

function inShow(state: UiState): boolean {
  return state.screen === 'SC-03' || state.screen === 'SC-05' || state.screen === 'SC-07'
}

function formatTimer(state: UiState): string {
  if (!state.show) return ''
  const ms = displayTimer(state.show, state.now)
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function paintKey(state: UiState): string {
  const show = state.show
  const fill = show?.phase === 'lobby' ? lobbyFill(show, state.now) : 0
  const count = show?.phase === 'countdown' ? countdownLabel(show, state.now) : ''
  const tally = Math.round(tallyFraction(state) * 8)
  return [
    state.screen, state.sub, state.overlay ?? '', state.modal ?? '', show?.phase ?? '', show?.round ?? '',
    fill, count, tally, state.toast?.key ?? '', state.wheel ? 1 : 0, state.gate.entry, state.gate.attempts,
    state.station, state.locale, state.profile.coins, state.profile.level, state.dressTab, state.dressShop ? 1 : 0,
    state.settingsTab, state.dashTab, state.consentStep, state.capture ?? '', state.parent.shop ? 1 : 0,
    state.parent.friends ? 1 : 0, state.social.blocked.length, state.party.length, state.profile.committedSlot,
  ].join('|')
}

function applyChrome(host: ShellHost, state: UiState): void {
  const root = document.documentElement
  const vars = cssVars(state.prefs.cvd, state.prefs.textScale)
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)
  root.dataset.cvd = state.prefs.cvd
  root.dataset.motion = state.prefs.motion
  root.dataset.text = String(state.prefs.textScale)
  root.dataset.flashes = state.prefs.flashes
  root.dataset.shake = state.prefs.shake
  root.dataset.lines = state.prefs.speedLines
  root.dataset.blur = state.prefs.blur ? 'on' : 'off'
  const playing = state.screen === 'SC-05' || state.screen === 'SC-07' || state.screen === 'SC-15'
  document.body.dataset.wbPlay = playing && !state.overlay && !state.modal ? 'on' : 'off'
  if (state.prefs.fovTouched && host.camera.fov !== state.prefs.fov) {
    host.camera.fov = state.prefs.fov
    host.camera.updateProjectionMatrix()
  }
}

function focusDefault(root: HTMLElement): void {
  const primary = root.querySelector<HTMLElement>('[data-primary="true"]')
  const first = root.querySelector<HTMLElement>('button:not(:disabled)')
  ;(primary ?? first)?.focus()
}

function downloadRecord(state: UiState): void {
  const blob = new Blob([JSON.stringify(deviceRecord(state), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'wobblebeans-device.json'
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function readSave(): ReturnType<typeof toSave> | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ReturnType<typeof toSave>>
    if (!parsed || typeof parsed !== 'object' || !parsed.profile || !parsed.prefs) return null
    return parsed as ReturnType<typeof toSave>
  } catch {
    return null
  }
}

function devPreview(state: UiState, now: number): UiState {
  if (!import.meta.env.DEV) return state
  const params = new URLSearchParams(location.search)
  const screen = params.get('screen')
  if (!screen || !isScreenId(screen)) return state
  return preview(state, screen, params.get('sub'), now)
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}
