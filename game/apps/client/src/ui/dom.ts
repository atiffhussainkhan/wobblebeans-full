/**
 * Paints a screen view into DOM nodes.
 * Catalogue strings use textContent. SVG paths come from the icon table only.
 */
import { QUICK_CHAT, quickChatText } from '@wobblebeans/shared'
import type { StringId } from './copy'
import { t, type LocaleId } from './i18n'
import { KENNEY, MIRROR_ICONS, SVG, type IconId } from './icons'
import type { ModalView, ScreenView, Vars, ViewNode } from './view'
import { teamMark } from './view'

export function paint(root: HTMLElement, view: ScreenView, locale: LocaleId): void {
  root.replaceChildren()
  root.className = 'wb-root'
  root.dataset.screen = view.screen
  root.dataset.sub = view.sub
  root.dataset.backdrop = view.backdrop
  root.dir = 'ltr'

  const safe = el('div', 'wb-safe')
  if (view.back) safe.append(press('back', 'back', 'common.back', locale, 'wb-back wb-icon-btn'))
  const stage = el('main', 'wb-stage')
  stage.id = 'wb-main'
  for (const node of view.nodes) stage.append(paintNode(node, locale))
  safe.append(stage)
  root.append(safe)

  if (view.modal) root.append(paintModal(view.modal, locale))
  if (view.toast) {
    const toast = el('div', 'wb-toast wb-hit')
    toast.setAttribute('role', 'status')
    toast.textContent = t(view.toast.label, locale)
    root.append(toast)
  }
}

function paintNode(node: ViewNode, locale: LocaleId): HTMLElement {
  switch (node.kind) {
    case 'button':
      return press(node.action, node.icon, node.label, locale, `wb-big wb-${node.variant}`, node.primary, node.disabled, node.reason, node.vars)
    case 'icon':
      return press(node.action, node.icon, node.label, locale, 'wb-icon-btn')
    case 'text':
      return sentence(t(node.label, locale, node.vars), node.role)
    case 'raw':
      return sentence(node.text, node.role)
    case 'row':
    case 'col':
    case 'grid':
    case 'panel': {
      const box = el('div', `wb-${node.kind}`)
      for (const child of node.children) box.append(paintNode(child, locale))
      return box
    }
    case 'tabs':
      return tabs(node.label, node.tabs, node.active, node.prefix, locale)
    case 'slider':
      return slider(node.id, node.label, node.value, node.muted, locale)
    case 'segment':
      return segment(node.id, node.label, node.value, node.options, locale)
    case 'counter':
      return counter(node.icon, node.label, node.value, locale)
    case 'tile':
      return tile(node, locale)
    case 'track':
      return track(node.label, node.value, node.max, locale)
    case 'empty':
      return empty(node.icon, node.label, locale, node.action, node.actionLabel, node.actionIcon)
    case 'preview':
      return preview(node.upper, node.lower, node.yaw, node.face)
    case 'pad':
      return pad(node.entry, locale)
    case 'wheel':
      return wheel(locale)
    case 'hud':
      return hud(node, locale)
    case 'dots':
      return dots(node.filled, node.total, t(node.label, locale, node.vars))
    case 'bars':
      return bars(node.label, node.values, locale)
    case 'code':
      return code(node.shapes)
    default:
      return el('div')
  }
}

function press(
  action: string,
  icon: IconId,
  label: StringId,
  locale: LocaleId,
  className: string,
  primary = false,
  disabled = false,
  reason?: StringId,
  vars?: Vars,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `${className} wb-hit`
  button.dataset.action = action
  if (primary) button.dataset.primary = 'true'
  button.append(glyph(icon), words(t(label, locale, vars)))
  if (disabled) button.disabled = true
  if (reason) {
    const note = el('span', 'wb-reason')
    note.textContent = t(reason, locale)
    button.append(note)
  }
  return button
}

function sentence(text: string, role: 'h1' | 'body' | 'secondary' | 'adult'): HTMLElement {
  const node = role === 'h1' ? document.createElement('h1') : document.createElement('p')
  node.className = role === 'h1' ? 'wb-h1' : `wb-${role}`
  node.textContent = text
  return node
}

function words(text: string): HTMLElement {
  const node = el('span', 'wb-label')
  node.textContent = text
  return node
}

function glyph(icon: IconId): HTMLElement {
  const node = el('span', 'wb-glyph')
  node.setAttribute('aria-hidden', 'true')
  if (MIRROR_ICONS.has(icon)) node.classList.add('wb-mirror')
  const file = KENNEY[icon]
  if (file) {
    node.classList.add('wb-kenney')
    node.style.setProperty('--icon', `url("/assets/ui/${file}")`)
    return node
  }
  const path = SVG[icon]
  if (!path) return node
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 32 32')
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('wb-svg')
  svg.innerHTML = path
  node.append(svg)
  return node
}

function tabs(
  label: StringId,
  items: { id: string; icon: IconId; label: StringId }[],
  active: string,
  prefix: string,
  locale: LocaleId,
): HTMLElement {
  const box = el('div', 'wb-tabs')
  box.setAttribute('role', 'tablist')
  box.setAttribute('aria-label', t(label, locale))
  for (const tab of items) {
    const button = press(`${prefix}${tab.id}`, tab.icon, tab.label, locale, 'wb-tab')
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-selected', tab.id === active ? 'true' : 'false')
    if (tab.id === active) button.classList.add('is-on')
    box.append(button)
  }
  return box
}

function slider(id: string, label: StringId, value: number, muted: boolean, locale: LocaleId): HTMLElement {
  const box = el('div', 'wb-slider')
  const name = t(label, locale)
  const caption = el('span', 'wb-label')
  caption.textContent = name
  caption.id = `wb-vol-${id}`
  const down = stepButton(`vol:${id}:dec`, '−', `${name} −`)
  const control = el('div', 'wb-slider-bar')
  control.tabIndex = 0
  control.setAttribute('role', 'slider')
  control.setAttribute('aria-valuemin', '0')
  control.setAttribute('aria-valuemax', '100')
  control.setAttribute('aria-valuenow', String(value))
  control.setAttribute('aria-labelledby', caption.id)
  control.dataset.slider = id
  const fill = el('span', 'wb-slider-fill')
  fill.style.width = `${value}%`
  const readout = el('span', 'wb-slider-value')
  readout.textContent = muted ? '0' : String(value)
  control.append(fill, readout)
  const up = stepButton(`vol:${id}:inc`, '+', `${name} +`)
  const mute = press(`vol:${id}:mute`, muted ? 'audioOff' : 'audioOn', 'set.mute', locale, 'wb-icon-btn')
  mute.setAttribute('aria-pressed', muted ? 'true' : 'false')
  box.append(caption, down, control, up, mute)
  return box
}

function stepButton(action: string, symbol: string, aria: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'wb-icon-btn wb-hit'
  button.dataset.action = action
  button.setAttribute('aria-label', aria)
  button.textContent = symbol
  return button
}

function segment(
  id: string,
  label: StringId,
  value: string,
  options: { id: string; label: StringId }[],
  locale: LocaleId,
): HTMLElement {
  const box = el('div', 'wb-segment')
  box.setAttribute('role', 'radiogroup')
  box.setAttribute('aria-label', t(label, locale))
  const caption = el('span', 'wb-label')
  caption.textContent = t(label, locale)
  box.append(caption)
  const row = el('div', 'wb-row')
  for (const option of options) {
    const button = press(`seg:${id}:${option.id}`, 'check', option.label, locale, 'wb-seg')
    button.setAttribute('role', 'radio')
    const on = option.id === value
    button.setAttribute('aria-checked', on ? 'true' : 'false')
    if (on) button.classList.add('is-on')
    row.append(button)
  }
  box.append(row)
  return box
}

function counter(icon: IconId, label: StringId, value: string, locale: LocaleId): HTMLElement {
  const box = el('div', 'wb-counter')
  box.append(glyph(icon), words(t(label, locale)))
  const amount = el('span', 'wb-value')
  amount.textContent = value
  box.append(amount)
  return box
}

function tile(node: Extract<ViewNode, { kind: 'tile' }>, locale: LocaleId): HTMLElement {
  const button = press(node.action || 'equip:none', node.icon, node.label, locale, 'wb-tile', false, node.disabled || !node.action, node.reason)
  if (node.badge) {
    const badge = el('span', `wb-badge wb-badge-${node.badge}`)
    const key = node.badge === 'equipped' ? 'common.equipped' : node.badge === 'owned' ? 'common.yours' : 'common.locked'
    badge.textContent = t(key, locale)
    button.append(badge)
  }
  if (node.detail) {
    const detail = el('span', 'wb-detail')
    detail.textContent = t(node.detail, locale)
    button.append(detail)
  }
  if (node.price) {
    const price = el('span', 'wb-price')
    price.append(glyph('coin'))
    const amount = el('span', 'wb-value')
    amount.textContent = node.price
    price.append(amount)
    button.append(price)
  }
  return button
}

function track(label: StringId, value: number, max: number, locale: LocaleId): HTMLElement {
  const box = el('div', 'wb-track')
  box.setAttribute('role', 'progressbar')
  box.setAttribute('aria-valuemin', '0')
  box.setAttribute('aria-valuemax', String(max))
  box.setAttribute('aria-valuenow', String(value))
  box.setAttribute('aria-label', t(label, locale))
  const caption = words(t(label, locale))
  const fill = el('span', 'wb-track-fill')
  const span = Math.max(1, max)
  fill.style.width = `${Math.min(100, Math.round((value / span) * 100))}%`
  const readout = el('span', 'wb-value')
  readout.textContent = String(value)
  box.append(caption, fill, readout)
  return box
}

function empty(
  icon: IconId,
  label: StringId,
  locale: LocaleId,
  action?: string,
  actionLabel?: StringId,
  actionIcon?: IconId,
): HTMLElement {
  const box = el('div', 'wb-empty')
  box.append(glyph(icon), sentence(t(label, locale), 'body'))
  if (action && actionLabel && actionIcon) box.append(press(action, actionIcon, actionLabel, locale, 'wb-big wb-secondary'))
  return box
}

function preview(upper: string, lower: string, yaw: number, face: string): HTMLElement {
  const box = el('div', 'wb-preview')
  box.style.setProperty('--upper', upper)
  box.style.setProperty('--lower', lower)
  box.style.setProperty('--yaw', `${yaw}deg`)
  const faceName = face.replace(/^face-/, '').replace(/[^a-z0-9-]/gi, '')
  const bean = el('div', `wb-bean wb-face-${faceName}`)
  bean.append(el('span', 'wb-bean-top'), el('span', 'wb-bean-legs'), el('span', 'wb-bean-eye'), el('span', 'wb-bean-eye wb-bean-eye-r'))
  box.append(bean)
  return box
}

function pad(entry: string, locale: LocaleId): HTMLElement {
  const box = el('div', 'wb-pad')
  const readout = el('p', 'wb-pad-read')
  readout.setAttribute('role', 'status')
  readout.setAttribute('aria-label', t('gate.answer', locale))
  readout.textContent = entry || '–'
  box.append(readout)
  const grid = el('div', 'wb-pad-grid')
  for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']) {
    if (digit === 'del') grid.append(press('digit:del', 'back', 'gate.delete', locale, 'wb-big wb-quiet'))
    else if (digit === 'ok') grid.append(press('digit:ok', 'check', 'common.ok', locale, 'wb-big wb-secondary'))
    else grid.append(stepButton(`digit:${digit}`, digit, digit))
    const last = grid.lastElementChild
    if (last instanceof HTMLButtonElement) last.classList.add('wb-pad-key')
  }
  box.append(grid)
  return box
}

function wheel(locale: LocaleId): HTMLElement {
  const box = el('div', 'wb-wheel wb-hit')
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-label', t('chat.pick', locale))
  const title = sentence(t('chat.pick', locale), 'h1')
  box.append(title)
  for (const row of QUICK_CHAT) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'wb-big wb-secondary wb-hit'
    button.dataset.action = `chat:${row.id}`
    button.append(glyph('chat'), words(quickChatText(row.id) ?? ''))
    box.append(button)
  }
  box.append(press('chat-open', 'cross', 'common.close', locale, 'wb-big wb-quiet'))
  return box
}

function hud(node: Extract<ViewNode, { kind: 'hud' }>, locale: LocaleId): HTMLElement {
  const box = el('section', 'wb-hud wb-panel')
  box.append(sentence(t(node.objective, locale), 'body'))
  if (node.practice) box.append(sentence(t('hud.practice', locale), 'secondary'))
  if (node.count) {
    const left = el('p', 'wb-count')
    left.textContent = t('hud.left', locale, { count: node.count })
    box.append(left)
  }
  if (node.timer) {
    const clock = el('p', node.late ? 'wb-clock wb-late' : 'wb-clock')
    const name = el('span', 'wb-label')
    name.textContent = t('hud.time', locale)
    const digits = el('span', 'wb-value')
    digits.textContent = node.timer
    clock.append(name, digits)
    box.append(clock)
  }
  if (node.warning) box.append(sentence(t('hud.warn', locale), 'body'))
  if (node.team) {
    const mark = teamMark(node.team)
    const team = el('p', 'wb-team')
    const shape = el('span', 'wb-shape')
    shape.dataset.shape = mark.shape
    shape.dataset.pattern = mark.pattern
    team.append(shape, words(t('hud.team', locale)))
    box.append(team)
  }
  if (node.cues.length) {
    const list = el('ul', 'wb-cues')
    list.setAttribute('aria-live', 'polite')
    for (const cue of node.cues) {
      const item = document.createElement('li')
      item.className = 'wb-cue'
      item.append(glyph(cue.icon), words(t(cue.label, locale)))
      list.append(item)
    }
    box.append(list)
  }
  return box
}

function dots(filled: number, total: number, label: string): HTMLElement {
  const box = el('div', 'wb-dots')
  box.setAttribute('role', 'img')
  box.setAttribute('aria-label', label)
  const caption = el('span', 'wb-label')
  caption.textContent = label
  box.append(caption)
  for (let i = 0; i < total; i++) {
    const dot = el('span', i < filled ? 'wb-dot is-on' : 'wb-dot')
    box.append(dot)
  }
  return box
}

function bars(label: StringId, values: number[], locale: LocaleId): HTMLElement {
  const box = el('div', 'wb-bars')
  box.setAttribute('role', 'img')
  box.setAttribute('aria-label', t(label, locale))
  const max = Math.max(1, ...values)
  for (const value of values) {
    const bar = el('span', 'wb-bar')
    bar.style.height = `${Math.round((value / max) * 100)}%`
    box.append(bar)
  }
  return box
}

function code(shapes: number[]): HTMLElement {
  const box = el('div', 'wb-code')
  const names = ['circle', 'triangle', 'square', 'star', 'wave']
  for (const shape of shapes) {
    const mark = el('span', 'wb-shape')
    mark.dataset.shape = names[shape] ?? 'circle'
    mark.dataset.pattern = 'solid'
    box.append(mark)
  }
  return box
}

function paintModal(modal: ModalView, locale: LocaleId): HTMLElement {
  const back = el('div', 'wb-modal-back wb-hit')
  const dialog = el('div', 'wb-modal')
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  const title = document.createElement('h2')
  title.className = 'wb-h1'
  title.id = 'wb-modal-title'
  title.textContent = t(modal.title, locale)
  dialog.setAttribute('aria-labelledby', title.id)
  dialog.append(title)
  if (modal.body) dialog.append(sentence(t(modal.body, locale), 'adult'))
  for (const node of modal.nodes) dialog.append(paintNode(node, locale))
  back.append(dialog)
  return back
}

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}
