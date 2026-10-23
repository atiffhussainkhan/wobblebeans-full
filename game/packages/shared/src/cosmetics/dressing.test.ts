import { describe, expect, it } from 'vitest'
import { dressingReduce, dressingView, starterDressingState, starterOwnedIds } from './dressing'

describe('dressing room state', () => {
  it('explains unowned items and does not sell them from the wardrobe', () => {
    const view = dressingView(starterDressingState({ tab: 'colour' }))
    const coral = view.rows.find((row) => row.itemId === 'colour_coral')
    expect(coral?.owned).toBe(false)
    expect(coral?.action).toBe('preview')
    expect(coral?.howToGet).toBe('Coin Shop (when it returns)')
    expect(view.rows.every((row) => row.action === 'equip' || row.action === 'preview')).toBe(true)
    expect(view.shop.enabled).toBe(false)
    expect(view.shop.rows.every((row) => row.buyable === false && row.priceLabel == null)).toBe(true)
    expect(view.menuDot).toBe(false)
    expect(view.help).toBeNull()
  })

  it('confirms a coin spend without granting the item', () => {
    let state = starterDressingState({ coinShopEnabled: true })
    const itemId = dressingView(state).shop.rows[0]?.id
    expect(itemId).toBeTruthy()
    state = dressingReduce(state, { type: 'ask-buy', itemId: itemId! })
    const confirm = dressingView(state).shop.confirm
    expect(confirm?.label).toMatch(/^Yes, spend \d+ coins$/)
    expect(confirm?.cancelLabel).toBe('Not now')
    const owned = [...state.ownedIds]
    state = dressingReduce(state, { type: 'confirm-buy' })
    expect(state.ownedIds).toEqual(owned)
    expect(state.confirmItemId).toBe(itemId)
  })

  it('ignores a buy while the shop is off and clears the new dot after the tab opens', () => {
    const off = dressingReduce(starterDressingState(), { type: 'ask-buy', itemId: 'face_star_02' })
    expect(off.pendingBuyId).toBeNull()
    const fresh = starterDressingState({
      ownedIds: [...starterOwnedIds(), 'colour_coral'],
      seenIds: starterOwnedIds(),
    })
    expect(dressingView(fresh).menuDot).toBe(true)
    const opened = dressingReduce(fresh, { type: 'tab', id: 'colour' })
    expect(dressingView(opened).menuDot).toBe(false)
    const help = dressingView(dressingReduce(opened, { type: 'toggle-help' }))
    expect(help.help).toBe('This free Season Path runs until 21 December 2026.')
    expect(help.playtime).not.toMatch(/ends in|streak|hurry|only \d+ left/i)
  })
})
