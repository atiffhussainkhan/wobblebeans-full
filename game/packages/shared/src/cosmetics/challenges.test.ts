import { describe, expect, it } from 'vitest'
import { ECONOMY } from './economy'
import {
  CHALLENGE_TEMPLATES,
  challengeMetricAllowed,
  dailiesFor,
  dailyStillBanked,
  templatesFor,
} from './challenges'

describe('challenges', () => {
  it('keeps copy short and refuses win or grab metrics', () => {
    expect(CHALLENGE_TEMPLATES.every((row) => row.text.length <= ECONOMY.challenges.textMaxChars)).toBe(true)
    expect(CHALLENGE_TEMPLATES.every((row) => challengeMetricAllowed(row.metric))).toBe(true)
    expect(CHALLENGE_TEMPLATES.some((row) => row.metric === 'shows_played')).toBe(true)
    expect(templatesFor('daily', 'play').length).toBeGreaterThan(1)
    expect(templatesFor('daily', 'do').length).toBeGreaterThan(1)
    expect(templatesFor('daily', 'qualify').length).toBeGreaterThan(1)
  })

  it('offers one play, one do, and one qualify task, banked for seven dates', () => {
    const today = dailiesFor('2026-10-26')
    expect(today.map((row) => row.difficulty)).toEqual(['play', 'do', 'qualify'])
    expect(new Set(today.map((row) => row.id)).size).toBe(3)
    expect(dailyStillBanked('2026-10-20', new Date('2026-10-26T10:00:00.000Z'))).toBe(true)
    expect(dailyStillBanked('2026-10-20', new Date('2026-10-27T10:00:00.000Z'))).toBe(false)
  })
})
