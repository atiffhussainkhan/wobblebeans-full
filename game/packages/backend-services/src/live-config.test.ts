import { describe, expect, it } from 'vitest'
import {
  ConfigService,
  activeEvents,
  defaultLevelRules,
  eligibleLevelIds,
  validateLiveConfig,
  xpMultiplierAt,
  type LiveConfig,
  type LiveOpsEvent,
} from './live-config'

function draft(overrides: Partial<LiveConfig> = {}): LiveConfig {
  return {
    version: 'cfg-2',
    physicsHash: 42,
    accountCreationEnabled: true,
    friendRequestsEnabled: false,
    coinShopEnabled: false,
    schemaVersion: 1,
    levels: defaultLevelRules(),
    events: [],
    news: [],
    season: null,
    conveyorMaxMps: 3.6,
    ...overrides,
  }
}

function event(overrides: Partial<LiveOpsEvent> = {}): LiveOpsEvent {
  return {
    eventId: 'slime_week',
    type: 'theme_week',
    titleLocKey: 'event.slime.title',
    startUtc: '2026-11-01T00:00:00.000Z',
    endUtc: '2026-11-08T00:00:00.000Z',
    playlistRef: 'main-show',
    rewardTableRef: 'none',
    xpMult: 1,
    newsPostRef: 'news.slime',
    reviewId: 'review-slime',
    killSwitch: false,
    ...overrides,
  }
}

describe('live config pin and level eligibility', () => {
  it('excludes a level disabled at least 60 seconds before start', () => {
    const levels = defaultLevelRules()
    const knock = levels.find((level) => level.levelId === 'knock-knock-run')
    if (!knock) throw new Error('missing level')
    knock.enabled = false
    knock.disabledAt = new Date(0).toISOString()
    expect(eligibleLevelIds(levels, 60_000)).not.toContain('knock-knock-run')
    expect(eligibleLevelIds(levels, 59_999)).toContain('knock-knock-run')
    expect(eligibleLevelIds(levels, 60_000)).toContain('tile-drop')
  })

  it('keeps the bundle a show pinned even after rollback', () => {
    const config = new ConfigService()
    const pinned = config.pinForShow('show_a', new Date('2026-06-01T00:00:00.000Z'))
    expect(pinned.version).toBe('foundation-1')
    const next = draft({ version: 'cfg-2', physicsHash: 7 })
    config.propose(next, 'author')
    config.approve('cfg-2', 'reviewer-a')
    config.approve('cfg-2', 'reviewer-b')
    config.sign('cfg-2', 'signing-key')
    config.activate('cfg-2', 'operator', 'global')
    expect(config.current.version).toBe('cfg-2')
    expect(config.getPin('show_a')?.version).toBe('foundation-1')
    expect(config.getPin('show_a')?.physicsHash).toBe(0)
    config.rollback('operator')
    expect(config.current.version).toBe('foundation-1')
    expect(config.getPin('show_a')?.version).toBe('foundation-1')
    expect(config.pinForShow('show_a').physicsHash).toBe(0)
    const later = config.pinForShow('show_b')
    expect(later.version).toBe('foundation-1')
  })

  it('rejects an unsigned bundle, a short event, a high boost, and a countdown', () => {
    const config = new ConfigService()
    config.propose(draft(), 'author')
    config.approve('cfg-2', 'reviewer-a')
    expect(() => config.sign('cfg-2', 'signing-key')).toThrow(/two approvals/)
    config.approve('cfg-2', 'reviewer-a')
    expect(config.approve('cfg-2', 'reviewer-b').satisfied).toBe(true)
    const signed = config.sign('cfg-2', 'signing-key')
    expect(config.verify(signed, 'signing-key')).toBe(true)
    expect(config.verify({ ...signed, signature: '00' }, 'signing-key')).toBe(false)
    expect(() => validateLiveConfig(draft({ version: 'bad', conveyorMaxMps: 9 }))).toThrow(/conveyor/)
    expect(() => validateLiveConfig(draft({ version: 'bad', events: [event({ xpMult: 3 })] }))).toThrow(/capped/)
    expect(() => validateLiveConfig(draft({ version: 'bad', events: [event({ endUtc: '2026-11-02T00:00:00.000Z' })] }))).toThrow(/7 days/)
    expect(() => validateLiveConfig(draft({ version: 'bad', levels: [{ levelId: 'tile-drop', enabled: false, weight: 1, disabledAt: new Date().toISOString(), minPlayers: 1, maxPlayers: 32 }] }))).toThrow(/fallback/)
    expect(() => validateLiveConfig({ ...draft({ version: 'bad' }), countdown: 10 } as LiveConfig)).toThrow(/countdown/)
  })

  it('schedules events in UTC and caps the XP multiplier', () => {
    const events = [
      event({ type: 'xp_boost', xpMult: 2, eventId: 'boost_week' }),
      event({ eventId: 'later', startUtc: '2026-12-01T00:00:00.000Z', endUtc: '2026-12-08T00:00:00.000Z' }),
      event({ eventId: 'killed', killSwitch: true }),
    ]
    const during = Date.parse('2026-11-03T00:00:00.000Z')
    expect(activeEvents(events, during).map((row) => row.eventId)).toEqual(['boost_week'])
    expect(xpMultiplierAt(events, during)).toBe(2)
    expect(activeEvents(events, Date.parse('2026-10-01T00:00:00.000Z'))).toHaveLength(0)
  })
})
