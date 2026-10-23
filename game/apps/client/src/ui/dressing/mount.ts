import {
  dressingReduce,
  dressingView,
  type DressingAction,
  type DressingState,
  type DressingTabId,
  type Loadout,
} from '@wobblebeans/shared'
import './dressing.css'
import { renderDressing, type DomNode } from './render'

export interface DressingMountOptions {
  state: DressingState
  onChange?: (state: DressingState) => void
  /** Called only after the child confirms. This module does not grant coins or items. */
  onConfirmBuy?: (itemId: string) => void
  onLoadout?: (loadout: Loadout) => void
}

/**
 * Stream 5 should mount this with one import from the shell.
 * The gauntlet `main.ts` stays on the sim loop.
 */
export function mountDressingRoom(root: HTMLElement, options: DressingMountOptions): {
  destroy: () => void
  getState: () => DressingState
} {
  let state = options.state
  const onClick = (event: Event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const control = target.closest('[data-action]')
    if (!control || !root.contains(control)) return
    const action = control.getAttribute('data-action')
    const id = control.getAttribute('data-id')
    const nextAction = actionFrom(action, id, control.getAttribute('data-dir'))
    if (!nextAction) return
    const previous = state.loadout
    state = dressingReduce(state, nextAction)
    if (nextAction.type === 'confirm-buy' && state.confirmItemId && options.onConfirmBuy) {
      options.onConfirmBuy(state.confirmItemId)
    }
    if (state.loadout !== previous) options.onLoadout?.(state.loadout)
    options.onChange?.(state)
    paint()
  }
  root.addEventListener('click', onClick)
  paint()
  return {
    destroy() {
      root.removeEventListener('click', onClick)
      root.replaceChildren()
    },
    getState: () => state,
  }

  function paint() {
    root.replaceChildren(toElement(renderDressing(dressingView(state))))
  }
}

function actionFrom(action: string | null, id: string | null, dir: string | null): DressingAction | null {
  switch (action) {
    case 'tab':
      return id ? { type: 'tab', id: id as DressingTabId } : null
    case 'preview':
      return id ? { type: 'preview', itemId: id } : null
    case 'equip':
      return id ? { type: 'equip', itemId: id } : null
    case 'surprise':
      return { type: 'surprise' }
    case 'rotate':
      return { type: 'rotate', dir: dir === '-1' ? -1 : 1 }
    case 'save-preset':
      return id ? { type: 'save-preset', index: Number(id) } : null
    case 'wear-preset':
      return id ? { type: 'wear-preset', index: Number(id) } : null
    case 'ask-buy':
      return id ? { type: 'ask-buy', itemId: id } : null
    case 'confirm-buy':
      return { type: 'confirm-buy' }
    case 'cancel-buy':
      return { type: 'cancel-buy' }
    case 'toggle-help':
      return { type: 'toggle-help' }
    default:
      return null
  }
}

function toElement(node: DomNode): HTMLElement {
  const el = document.createElement(node.tag)
  if (node.className) el.className = node.className
  if (node.text) el.textContent = node.text
  if (node.attrs) {
    for (const [key, value] of Object.entries(node.attrs)) el.setAttribute(key, value)
  }
  for (const child of node.children ?? []) el.append(toElement(child))
  return el
}
