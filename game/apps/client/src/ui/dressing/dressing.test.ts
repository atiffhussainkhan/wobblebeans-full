import { dressingReduce, dressingView, starterDressingState } from '@wobblebeans/shared'
import { describe, expect, it } from 'vitest'
import { findButtons, flattenText, renderDressing, type DomNode } from './render'

function walk(node: DomNode, visit: (row: DomNode) => void): void {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function shopSection(root: DomNode): DomNode {
  let found: DomNode | undefined
  walk(root, (node) => {
    if (node.className === 'shop') found = node
  })
  if (!found) throw new Error('missing shop')
  return found
}

describe('dressing room markup', () => {
  it('uses buttons only and hides prices while the shop is off', () => {
    const tree = renderDressing(dressingView(starterDressingState({ tab: 'colour' })))
    const tags = new Set<string>()
    walk(tree, (node) => tags.add(node.tag))
    expect(tags.has('button')).toBe(true)
    expect([...tags].every((tag) => tag !== 'input' && tag !== 'textarea' && tag !== 'select')).toBe(true)
    expect(findButtons(tree).every((button) => button.attrs?.type === 'button')).toBe(true)
    const shop = shopSection(tree)
    expect(findButtons(shop)).toHaveLength(0)
    expect(flattenText(shop).join(' ')).not.toMatch(/\d+ coins/)
    expect(flattenText(shop).join(' ')).toContain('The coin shop is off')
    const how = flattenText(tree).find((line) => line.includes('Coin Shop'))
    expect(how).toBeTruthy()
  })

  it('asks for a second step before a coin spend', () => {
    let state = starterDressingState({ coinShopEnabled: true, tab: 'upper' })
    const itemId = dressingView(state).shop.rows[0]?.id ?? ''
    state = dressingReduce(state, { type: 'ask-buy', itemId })
    const tree = renderDressing(dressingView(state))
    const labels = findButtons(tree).map((button) => button.text)
    expect(labels).toContain('Buy with coins')
    expect(labels.some((label) => label?.startsWith('Yes, spend '))).toBe(true)
    expect(labels).toContain('Not now')
    const owned = state.ownedIds.length
    state = dressingReduce(state, { type: 'confirm-buy' })
    expect(state.ownedIds).toHaveLength(owned)
  })
})
