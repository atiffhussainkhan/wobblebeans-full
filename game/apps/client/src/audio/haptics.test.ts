import { HAPTICS } from '@wobblebeans/shared'
import { describe, expect, it } from 'vitest'
import { resolveHaptic } from './haptics'

describe('haptics', () => {
  it('fires GO, grab, and qualified, and scales them down for comfort', () => {
    expect(resolveHaptic('go', 'full', false)?.strong).toBe(HAPTICS.go.strong)
    expect(resolveHaptic('grab', 'full', false)?.durationMs).toBe(HAPTICS.grab.durationMs)
    expect(resolveHaptic('qualified', 'off', false)).toBeNull()
    const soft = resolveHaptic('go', 'full', true)
    expect(soft!.strong).toBeLessThan(HAPTICS.go.strong)
    expect(soft!.strong).toBeCloseTo(HAPTICS.go.strong * HAPTICS.reduce, 3)
    expect(resolveHaptic(null, 'full', false)).toBeNull()
  })
})
