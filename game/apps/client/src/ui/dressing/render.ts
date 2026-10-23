import type { DressingView } from '@wobblebeans/shared'

export interface DomNode {
  tag: string
  text?: string
  className?: string
  attrs?: Record<string, string>
  children?: DomNode[]
}

/**
 * Dressing room markup. Stream 5 mounts `mountDressingRoom`.
 * Unowned rows explain how to earn the item. They do not sell it.
 */
export function renderDressing(view: DressingView): DomNode {
  return {
    tag: 'section',
    className: 'wobble-dressing',
    attrs: { 'aria-label': 'Dressing room' },
    children: [
      { tag: 'h2', text: 'Dressing room' },
      { tag: 'p', className: 'level', text: view.levelLabel },
      { tag: 'p', className: 'season', text: view.headline },
      { tag: 'p', className: 'playtime', text: view.playtime },
      { tag: 'p', className: 'save-note', text: view.saveNote },
      button('Help', { 'data-action': 'toggle-help' }),
      ...(view.help ? [{ tag: 'p', className: 'help', text: view.help } satisfies DomNode] : []),
      {
        tag: 'div',
        className: 'tabs',
        attrs: { role: 'tablist' },
        children: view.tabs.map((tab) =>
          button(tab.unseen ? `${tab.label} · new` : tab.label, {
            'data-action': 'tab',
            'data-id': tab.id,
            role: 'tab',
          }),
        ),
      },
      bean(view),
      {
        tag: 'div',
        className: 'turn',
        children: [
          button('Turn left', { 'data-action': 'rotate', 'data-dir': '-1' }),
          button('Turn right', { 'data-action': 'rotate', 'data-dir': '1' }),
        ],
      },
      view.tab === 'outfits' ? outfits(view) : grid(view),
      button('Surprise me', { 'data-action': 'surprise' }),
      shop(view),
    ],
  }
}

function bean(view: DressingView): DomNode {
  const style = [`--yaw:${view.yaw}deg`, `--bean:${view.beanHex}`]
  if (view.patternUrl) style.push(`--pattern:url("${view.patternUrl}")`)
  return {
    tag: 'div',
    className: 'bean-preview',
    attrs: { style: style.join(';') },
    children: [
      { tag: 'p', text: view.previewEmoteName ? `Preview: ${view.previewEmoteName}` : 'Your bean' },
    ],
  }
}

function grid(view: DressingView): DomNode {
  if (view.rows.length === 0) {
    return { tag: 'p', text: 'Nothing here yet.' }
  }
  return {
    tag: 'div',
    className: 'grid',
    children: view.rows.flatMap((row) => {
      const nodes: DomNode[] = [
        button(row.owned && !row.seen ? `${row.name} · new` : row.name, {
          'data-action': row.action,
          'data-id': row.itemId,
          'aria-pressed': row.equipped ? 'true' : 'false',
        }),
      ]
      if (row.howToGet) nodes.push({ tag: 'p', className: 'how', text: row.howToGet })
      return nodes
    }),
  }
}

function outfits(view: DressingView): DomNode {
  return {
    tag: 'div',
    className: 'outfits',
    children: view.outfits.flatMap((outfit) => [
      { tag: 'p', text: outfit.label },
      button(`Wear ${outfit.label}`, { 'data-action': 'wear-preset', 'data-id': String(outfit.index) }),
      button(`Save ${outfit.label}`, { 'data-action': 'save-preset', 'data-id': String(outfit.index) }),
    ]),
  }
}

function shop(view: DressingView): DomNode {
  const children: DomNode[] = [
    { tag: 'h3', text: 'Coin shop' },
    { tag: 'p', text: view.shop.message },
  ]
  if (!view.shop.enabled) {
    for (const row of view.shop.rows) {
      children.push({ tag: 'p', className: 'shop-name', text: `${row.name}. ${row.rarityLabel}.` })
    }
    return { tag: 'section', className: 'shop', attrs: { 'aria-label': 'Coin shop' }, children }
  }
  for (const row of view.shop.rows) {
    children.push({ tag: 'p', text: `${row.name}. ${row.rarityLabel}. ${row.priceLabel ?? ''}` })
    children.push(button('Buy with coins', { 'data-action': 'ask-buy', 'data-id': row.id }))
  }
  if (view.shop.confirm) {
    children.push(button(view.shop.confirm.label, { 'data-action': 'confirm-buy', 'data-id': view.shop.confirm.itemId }))
    children.push(button(view.shop.confirm.cancelLabel, { 'data-action': 'cancel-buy' }))
  }
  return { tag: 'section', className: 'shop', attrs: { 'aria-label': 'Coin shop' }, children }
}

function button(text: string, attrs: Record<string, string>): DomNode {
  return { tag: 'button', text, attrs: { type: 'button', ...attrs } }
}

export function flattenText(node: DomNode): string[] {
  const own = node.text ? [node.text] : []
  return own.concat((node.children ?? []).flatMap(flattenText))
}

export function findButtons(node: DomNode): DomNode[] {
  const here = node.tag === 'button' ? [node] : []
  return here.concat((node.children ?? []).flatMap(findButtons))
}
