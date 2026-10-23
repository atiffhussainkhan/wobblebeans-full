import { describe, expect, it } from 'vitest'
import { REPORT_PICTURES } from '@wobblebeans/shared'
import { MS } from './durations'
import { NOTICE } from './notices'
import {
  ModerationService,
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  labelsMatchPictures,
  type SafetyReport,
} from './moderation'

const base = {
  reporterPlayerId: 'ply_1',
  subjectPlayerId: 'ply_2',
  category: 'mean' as const,
  showId: 'show_1',
}

describe('moderation queue', () => {
  it('uses the picture categories and rejects a typed description', () => {
    expect(labelsMatchPictures()).toBe(true)
    expect(REPORT_CATEGORIES.map((id) => REPORT_CATEGORY_LABELS[id])).toEqual([
      'Cheating',
      'Being mean',
      'Something upset me',
      'Bad name or picture',
    ])
    expect(REPORT_PICTURES.map((row) => row.id)).toEqual([...REPORT_CATEGORIES])
    const mod = new ModerationService()
    expect(() => mod.file({ ...base, description: 'they were unkind' } as Omit<SafetyReport, 'id'>)).toThrow(/no_free_text/)
  })

  it('auto-blocks the reporter, discards bot reports, and hides a level after three upset reports', () => {
    const mod = new ModerationService()
    const report = mod.file(base)
    expect(report.autoBlocked).toBe(true)
    expect(mod.isBlocked('ply_1', 'ply_2')).toBe(true)
    expect(mod.avoidIds('ply_1')).toEqual(['ply_2'])
    expect(mod.mute('ply_1', 'ply_2').id).toMatch(/^mut_/)
    expect(mod.isMuted('ply_1', 'ply_2')).toBe(true)
    expect(mod.isMuted('ply_2', 'ply_1')).toBe(false)

    const bot = mod.file({ ...base, subjectPlayerId: 'bot_9', subjectKind: 'bot' })
    expect(bot.discarded).toBe(true)
    expect(bot.queued).toBe(false)
    expect(mod.queue().some((row) => row.id === bot.id)).toBe(false)

    for (let n = 0; n < 3; n++) {
      mod.file({
        reporterPlayerId: `ply_${n + 3}`,
        subjectPlayerId: '',
        category: 'scary',
        showId: 'show_9',
        subjectKind: 'level',
        levelId: 'slime-rise',
      })
    }
    expect(mod.isLevelHidden('slime-rise')).toBe(true)
    expect(mod.sanctionsFor('ply_2')).toHaveLength(0)
  })

  it('does not sanction from report volume, and a human decision notifies the parent', () => {
    let now = 0
    const notices: { playerId: string; templateId: number }[] = []
    const mod = new ModerationService({
      now: () => now,
      sink: { notify: (playerId, templateId) => notices.push({ playerId, templateId }) },
    })
    const ids: string[] = []
    for (let n = 0; n < 10; n++) {
      const report = mod.file({ ...base, reporterPlayerId: 'ply_1', showId: `show_${n + 1}` })
      ids.push(report.id)
    }
    expect(mod.queue().some((row) => row.volumeFlag)).toBe(true)
    expect(mod.onlineBlock('ply_2').blocked).toBe(false)
    expect(mod.sanctionsFor('ply_2')).toHaveLength(0)

    const reviewed = mod.review(ids[0]!, 'suspend_24h', 'mod_trust')
    expect(reviewed.sanctionId).toBeTruthy()
    expect(notices).toContainEqual({ playerId: 'ply_2', templateId: NOTICE.sanctionSuspend24h })
    expect(mod.onlineBlock('ply_2').reason).toBe('suspended')
    expect(mod.onlineBlock('ply_2').practiceAllowed).toBe(true)
    mod.appeal('ply_2', reviewed.sanctionId!)
    expect(mod.onlineBlock('ply_2').reason).toBe('suspended')
    expect(notices.some((row) => row.templateId === NOTICE.appealReceived)).toBe(true)

    now += 24 * MS.hour
    expect(mod.onlineBlock('ply_2').reason).toBe('ok')
  })

  it('routes a bad picture to curation with no sanction, and a server cheat removes the bean', () => {
    const mod = new ModerationService()
    const report = mod.file({ ...base, category: 'bug' })
    expect(report.route).toBe('curation')
    expect(() => mod.review(report.id, 'warning', 'mod_trust')).toThrow(/no_sanction_for_curation/)
    mod.review(report.id, 'curation_defect', 'mod_trust')
    expect(mod.rerollRequired('ply_2')).toBe(true)
    expect(mod.sanctionsFor('ply_2')).toHaveLength(0)
    expect(mod.noteCheatSignal('ply_4', 7).removeFromShow).toBe(true)
    expect(mod.pendingShowRemoval('ply_4')).toBe(true)
    const cheat = mod.file({ ...base, reporterPlayerId: 'ply_3', subjectPlayerId: 'ply_4', category: 'unfair' })
    expect(cheat.cheatSignalCount).toBe(1)
  })

  it('opens a human P1 escalation and keeps that report under legal hold', () => {
    let now = 0
    const holds: { showId: string; until: number }[] = []
    const mod = new ModerationService({
      now: () => now,
      sink: {
        notify: () => undefined,
        onLegalHold: (showId, until) => holds.push({ showId, until }),
      },
    })
    const report = mod.file(base)
    mod.review(report.id, 'escalate_p1', 'mod_trust')
    expect(mod.openIncidents()).toHaveLength(1)
    expect(mod.openIncidents()[0]?.humanProcess).toBe('ncmec_ceop')
    expect(holds[0]?.showId).toBe('show_1')
    now += 200 * MS.day
    expect(mod.prune(now)).toBe(0)
    now = (holds[0]?.until ?? 0) + 1
    expect(mod.prune(now)).toBe(1)
  })
})
