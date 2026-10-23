import { describe, expect, it } from 'vitest'
import { LOUDNESS, SERVER_TICK_P99_MS, SERVER_TICK_REFERENCE_MS } from './budgets'

describe('performance budgets', () => {
  it('locks the server tick gates from doc 08', () => {
    expect(SERVER_TICK_P99_MS[32]).toBe(9)
    expect(SERVER_TICK_P99_MS[40]).toBe(12)
    expect(SERVER_TICK_P99_MS[60]).toBe(20)
    expect(SERVER_TICK_REFERENCE_MS[60]).toBe(12)
  })

  it('locks kid-safe loudness from doc 06', () => {
    expect(LOUDNESS.musicLufs).toBe(-16)
    expect(LOUDNESS.musicToleranceLu).toBe(1)
    expect(LOUDNESS.truePeakDbtp).toBe(-1)
    expect(LOUDNESS.shortTermMaxLufs).toBe(-10)
    expect(LOUDNESS.masterDefault).toBe(70)
    expect(LOUDNESS.musicDefault).toBe(60)
    expect(LOUDNESS.sfxDefault).toBe(80)
    expect(LOUDNESS.uiDefault).toBe(70)
    expect(LOUDNESS.jumpMaxLu).toBeLessThanOrEqual(6)
    expect(LOUDNESS.lraMaxLu).toBe(10)
  })
})
