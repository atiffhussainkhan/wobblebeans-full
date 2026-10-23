import { REPORT_PICTURES, type ReportPictureId } from '@wobblebeans/shared'
import { MS, POLICY } from './durations'
import { SafetyError } from './errors'
import { NOTICE } from './notices'
import { partitionRetention, type ExpiringRow } from './retention'

export const REPORT_CATEGORIES = ['unfair', 'mean', 'scary', 'bug'] as const
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  unfair: 'Cheating',
  mean: 'Being mean',
  scary: 'Something upset me',
  bug: 'Bad name or picture',
}

const PICTURE_IDS = REPORT_PICTURES.map((row) => row.id)
if (PICTURE_IDS.join() !== REPORT_CATEGORIES.join()) {
  throw new Error('report picture ids drifted from REPORT_CATEGORIES')
}

export interface SafetyReport {
  id: string
  reporterPlayerId: string
  subjectPlayerId: string
  category: ReportCategory
  showId: string
  subjectKind?: 'player' | 'level' | 'bot'
  levelId?: string
  round?: number
  phraseIds?: readonly number[]
  emoteIds?: readonly number[]
  createdAt?: string
  queued?: boolean
  discarded?: boolean
  autoBlocked?: boolean
  route?: 'queue' | 'curation' | 'discarded' | 'level'
  slaDueAt?: string | null
  state?: 'open' | 'closed'
  volumeFlag?: boolean
  cheatSignalCount?: number
}

export type ModeratorDecision =
  | 'no_action'
  | 'warning'
  | 'suspend_24h'
  | 'suspend_7d'
  | 'ban'
  | 'curation_defect'
  | 'escalate_p1'

export interface Sanction {
  id: string
  playerId: string
  reportId: string
  decision: Exclude<ModeratorDecision, 'no_action' | 'curation_defect' | 'escalate_p1'>
  createdAt: number
  until: number | null
  practiceAllowed: true
  appeal: 'none' | 'open'
}

export interface SafetyIncident {
  id: string
  reportId: string
  playerId: string
  severity: 'P1'
  humanProcess: 'ncmec_ceop'
  openedAt: number
  legalHoldUntil: number
}

interface BlockRow {
  id: string
  reporterPlayerId: string
  subjectPlayerId: string
  at: number
}

interface MuteRow {
  id: string
  listenerPlayerId: string
  speakerPlayerId: string
  at: number
}

interface StoredReport extends SafetyReport {
  subjectKind: 'player' | 'level' | 'bot'
  createdAtMs: number
  state: 'open' | 'closed'
  closedAtMs?: number
  holdUntil?: number
}

export interface ModerationSink {
  notify(playerId: string, templateId: number, params: Record<string, number | boolean>): void
  onLegalHold?(showId: string, until: number): void
}

const ID = /^[A-Za-z0-9_-]{1,64}$/
const LEVEL_ID = /^[a-z0-9-]{1,40}$/
const FREE_TEXT_KEYS = ['description', 'text', 'note', 'message', 'comment', 'body', 'reasonText']
const SANCTIONS = new Set<ModeratorDecision>(['warning', 'suspend_24h', 'suspend_7d', 'ban'])

/**
 * Picture-category reports, block, mute, and a human moderation queue.
 * Report counts never sanction a player. Bots are acknowledged and discarded.
 */
export class ModerationService {
  private readonly reports: StoredReport[] = []
  private readonly blocks: BlockRow[] = []
  private readonly mutes: MuteRow[] = []
  private readonly sanctions: Sanction[] = []
  private readonly incidents: SafetyIncident[] = []
  private readonly curation: { id: string; reportId: string; levelId: string | null; at: number }[] = []
  private readonly cheatSignals: { playerId: string; signal: number; at: number }[] = []
  private readonly removals = new Set<string>()
  private readonly rerolls = new Set<string>()
  private seq = 0

  constructor(
    private readonly opts: { now?: () => number; sink?: ModerationSink } = {},
  ) {}

  file(input: Omit<SafetyReport, 'id'>): SafetyReport {
    this.rejectFreeText(input)
    if (!REPORT_CATEGORIES.includes(input.category)) throw new SafetyError('unknown_category')
    if (!ID.test(input.reporterPlayerId) || !ID.test(input.showId)) throw new SafetyError('bad_id')
    const subjectKind = input.subjectKind ?? 'player'
    if (subjectKind === 'player' && !ID.test(input.subjectPlayerId)) throw new SafetyError('bad_id')
    if (subjectKind === 'level') {
      if (!input.levelId || !LEVEL_ID.test(input.levelId)) throw new SafetyError('bad_level')
    }
    this.requirePresetIds(input.phraseIds)
    this.requirePresetIds(input.emoteIds)
    if (input.round != null && !Number.isInteger(input.round)) throw new SafetyError('preset_ids_only')

    const now = this.now()
    const recent = this.reports.filter(
      (row) => row.reporterPlayerId === input.reporterPlayerId && now - row.createdAtMs <= MS.hour,
    ).length
    const route = this.routeFor(subjectKind, input.category)
    const slaMs = route === 'level' ? 4 * MS.hour : 24 * MS.hour
    const queued = route === 'queue' || route === 'level' || route === 'curation'
    const report: StoredReport = {
      id: `rpt_${++this.seq}`,
      reporterPlayerId: input.reporterPlayerId,
      subjectPlayerId: input.subjectPlayerId,
      category: input.category,
      showId: input.showId,
      subjectKind,
      createdAtMs: now,
      createdAt: new Date(now).toISOString(),
      queued,
      discarded: route === 'discarded',
      autoBlocked: false,
      route,
      slaDueAt: queued ? new Date(now + slaMs).toISOString() : null,
      state: route === 'discarded' ? 'closed' : 'open',
      ...(route === 'discarded' ? { closedAtMs: now } : {}),
      volumeFlag: recent + 1 >= POLICY.reportVolumePerHour,
      cheatSignalCount:
        input.category === 'unfair' ? this.cheatSignals.filter((row) => row.playerId === input.subjectPlayerId).length : 0,
    }
    if (input.levelId) report.levelId = input.levelId
    if (input.round != null) report.round = input.round
    if (input.phraseIds) report.phraseIds = [...input.phraseIds]
    if (input.emoteIds) report.emoteIds = [...input.emoteIds]
    this.reports.push(report)

    if (subjectKind === 'player') {
      this.block(input.reporterPlayerId, input.subjectPlayerId)
      report.autoBlocked = true
    }
    if (route === 'curation') {
      this.curation.push({
        id: `cur_${this.seq}`,
        reportId: report.id,
        levelId: input.levelId ?? null,
        at: now,
      })
    }
    return this.publicReport(report)
  }

  block(reporterPlayerId: string, subjectPlayerId: string): { id: string } {
    if (!ID.test(reporterPlayerId) || !ID.test(subjectPlayerId)) throw new SafetyError('bad_id')
    if (reporterPlayerId === subjectPlayerId) throw new SafetyError('bad_id')
    const existing = this.blocks.find(
      (row) => row.reporterPlayerId === reporterPlayerId && row.subjectPlayerId === subjectPlayerId,
    )
    if (existing) return { id: existing.id }
    const row: BlockRow = {
      id: `blk_${++this.seq}`,
      reporterPlayerId,
      subjectPlayerId,
      at: this.now(),
    }
    this.blocks.push(row)
    return { id: row.id }
  }

  unblock(reporterPlayerId: string, subjectPlayerId: string): void {
    const index = this.blocks.findIndex(
      (row) => row.reporterPlayerId === reporterPlayerId && row.subjectPlayerId === subjectPlayerId,
    )
    if (index >= 0) this.blocks.splice(index, 1)
  }

  mute(listenerPlayerId: string, speakerPlayerId: string): { id: string } {
    if (!ID.test(listenerPlayerId) || !ID.test(speakerPlayerId)) throw new SafetyError('bad_id')
    if (listenerPlayerId === speakerPlayerId) throw new SafetyError('bad_id')
    const existing = this.mutes.find(
      (row) => row.listenerPlayerId === listenerPlayerId && row.speakerPlayerId === speakerPlayerId,
    )
    if (existing) return { id: existing.id }
    const row: MuteRow = {
      id: `mut_${++this.seq}`,
      listenerPlayerId,
      speakerPlayerId,
      at: this.now(),
    }
    this.mutes.push(row)
    return { id: row.id }
  }

  unmute(listenerPlayerId: string, speakerPlayerId: string): void {
    const index = this.mutes.findIndex(
      (row) => row.listenerPlayerId === listenerPlayerId && row.speakerPlayerId === speakerPlayerId,
    )
    if (index >= 0) this.mutes.splice(index, 1)
  }

  isBlocked(a: string, b: string): boolean {
    return this.blocks.some(
      (row) =>
        (row.reporterPlayerId === a && row.subjectPlayerId === b) ||
        (row.reporterPlayerId === b && row.subjectPlayerId === a),
    )
  }

  isMuted(listenerPlayerId: string, speakerPlayerId: string): boolean {
    return this.mutes.some(
      (row) => row.listenerPlayerId === listenerPlayerId && row.speakerPlayerId === speakerPlayerId,
    )
  }

  /** Ids to keep out of a future lobby, both directions (FR-07-15). */
  avoidIds(playerId: string): string[] {
    const ids = new Set<string>()
    for (const row of this.blocks) {
      if (row.reporterPlayerId === playerId) ids.add(row.subjectPlayerId)
      if (row.subjectPlayerId === playerId) ids.add(row.reporterPlayerId)
    }
    return [...ids]
  }

  blocksBy(playerId: string): string[] {
    return this.blocks.filter((row) => row.reporterPlayerId === playerId).map((row) => row.subjectPlayerId)
  }

  mutesBy(playerId: string): string[] {
    return this.mutes.filter((row) => row.listenerPlayerId === playerId).map((row) => row.speakerPlayerId)
  }

  reportsBy(reporterPlayerId: string): SafetyReport[] {
    return this.reports.filter((row) => row.reporterPlayerId === reporterPlayerId).map((row) => this.publicReport(row))
  }

  queue(): SafetyReport[] {
    return this.reports
      .filter((row) => row.state === 'open')
      .sort((a, b) => String(a.slaDueAt).localeCompare(String(b.slaDueAt)))
      .map((row) => this.publicReport(row))
  }

  hiddenLevels(): string[] {
    const counts = new Map<string, number>()
    for (const row of this.reports) {
      if (row.route !== 'level' || row.category !== 'scary' || !row.levelId) continue
      counts.set(row.levelId, (counts.get(row.levelId) ?? 0) + 1)
    }
    return [...counts.entries()].filter(([, count]) => count >= POLICY.levelHideReports).map(([id]) => id)
  }

  isLevelHidden(levelId: string): boolean {
    return this.hiddenLevels().includes(levelId)
  }

  noteCheatSignal(playerId: string, signal: number): { removeFromShow: true } {
    if (!ID.test(playerId) || !Number.isInteger(signal)) throw new SafetyError('bad_id')
    this.cheatSignals.push({ playerId, signal, at: this.now() })
    this.removals.add(playerId)
    return { removeFromShow: true }
  }

  pendingShowRemoval(playerId: string): boolean {
    return this.removals.has(playerId)
  }

  review(reportId: string, decision: ModeratorDecision, reviewerId: string): { closed: true; sanctionId?: string } {
    if (!/^mod_[a-z0-9-]{1,40}$/.test(reviewerId)) throw new SafetyError('bad_reviewer')
    const report = this.reports.find((row) => row.id === reportId)
    if (!report || report.state !== 'open') throw new SafetyError('not_reviewable')
    if (report.subjectKind === 'bot') throw new SafetyError('not_reviewable')
    if (report.category === 'bug' && SANCTIONS.has(decision)) throw new SafetyError('no_sanction_for_curation')

    const now = this.now()
    report.state = 'closed'
    report.closedAtMs = now
    if (decision === 'no_action') return { closed: true }
    if (decision === 'curation_defect') {
      this.curation.push({ id: `cur_${++this.seq}`, reportId, levelId: report.levelId ?? null, at: now })
      if (report.subjectKind === 'player') this.rerolls.add(report.subjectPlayerId)
      return { closed: true }
    }
    if (decision === 'escalate_p1') {
      if (report.subjectKind !== 'player') throw new SafetyError('not_reviewable')
      const legalHoldUntil = now + POLICY.legalHoldMs
      report.holdUntil = legalHoldUntil
      const incident: SafetyIncident = {
        id: `inc_${++this.seq}`,
        reportId,
        playerId: report.subjectPlayerId,
        severity: 'P1',
        humanProcess: 'ncmec_ceop',
        openedAt: now,
        legalHoldUntil,
      }
      this.incidents.push(incident)
      this.opts.sink?.onLegalHold?.(report.showId, legalHoldUntil)
      this.opts.sink?.notify(report.subjectPlayerId, NOTICE.incidentEscalated, { incident: 1 })
      return { closed: true }
    }

    const until =
      decision === 'warning' ? null : now + (decision === 'suspend_24h' ? POLICY.suspend24hMs : decision === 'suspend_7d' ? POLICY.suspend7dMs : 0)
    const sanction: Sanction = {
      id: `san_${++this.seq}`,
      playerId: report.subjectPlayerId,
      reportId,
      decision,
      createdAt: now,
      until: decision === 'ban' ? null : until,
      practiceAllowed: true,
      appeal: 'none',
    }
    this.sanctions.push(sanction)
    this.opts.sink?.notify(report.subjectPlayerId, noticeFor(decision), { sanction: 1 })
    return { closed: true, sanctionId: sanction.id }
  }

  appeal(playerId: string, sanctionId: string): { status: 'open' } {
    const sanction = this.sanctions.find((row) => row.id === sanctionId && row.playerId === playerId)
    if (!sanction) throw new SafetyError('unknown_sanction')
    sanction.appeal = 'open'
    this.opts.sink?.notify(playerId, NOTICE.appealReceived, { appeal: 1 })
    return { status: 'open' }
  }

  onlineBlock(playerId: string, now = this.now()): { blocked: boolean; practiceAllowed: boolean; reason: 'ok' | 'suspended' | 'banned' } {
    let reason: 'ok' | 'suspended' | 'banned' = 'ok'
    for (const sanction of this.sanctions) {
      if (sanction.playerId !== playerId) continue
      if (sanction.decision === 'warning') continue
      if (sanction.decision === 'ban') {
        reason = 'banned'
        break
      }
      if (sanction.until != null && now < sanction.until) reason = 'suspended'
    }
    return { blocked: reason !== 'ok', practiceAllowed: true, reason }
  }

  rerollRequired(playerId: string): boolean {
    return this.rerolls.has(playerId)
  }

  sanctionsFor(playerId: string): Sanction[] {
    return this.sanctions.filter((row) => row.playerId === playerId).map((row) => ({ ...row }))
  }

  openIncidents(): readonly SafetyIncident[] {
    return this.incidents
  }

  sla(now = this.now()): { met: number; missed: number; open: number; ratio: number } {
    let met = 0
    let missed = 0
    let open = 0
    for (const row of this.reports) {
      if (row.discarded || !row.slaDueAt) continue
      const due = Date.parse(row.slaDueAt)
      if (row.state === 'closed') {
        const closed = row.closedAtMs ?? row.createdAtMs
        if (closed <= due) met += 1
        else missed += 1
      } else if (now > due) missed += 1
      else open += 1
    }
    const decided = met + missed
    return { met, missed, open, ratio: decided === 0 ? 1 : met / decided }
  }

  prune(now = this.now()): number {
    const rows: ExpiringRow[] = this.reports.map((row) => ({
      id: row.id,
      kind: 'report',
      at: row.createdAtMs,
      ...(row.holdUntil != null ? { holdUntil: row.holdUntil } : {}),
    }))
    const { dropIds } = partitionRetention(rows, now)
    const drop = new Set(dropIds)
    const before = this.reports.length
    const kept = this.reports.filter((row) => !drop.has(row.id))
    this.reports.length = 0
    this.reports.push(...kept)
    return before - this.reports.length
  }

  forgetPlayer(playerId: string, keepHeld: boolean): void {
    const heldReports = new Set(
      this.reports.filter((row) => row.holdUntil != null && row.holdUntil > this.now()).map((row) => row.id),
    )
    const keepReport = (row: StoredReport) =>
      keepHeld && heldReports.has(row.id) && (row.subjectPlayerId === playerId || row.reporterPlayerId === playerId)
    const reports = this.reports.filter((row) => {
      const involved = row.reporterPlayerId === playerId || row.subjectPlayerId === playerId
      if (!involved) return true
      return keepReport(row)
    })
    this.reports.length = 0
    this.reports.push(...reports)
    this.removeWhere(this.blocks, (row) => row.reporterPlayerId === playerId || row.subjectPlayerId === playerId)
    this.removeWhere(this.mutes, (row) => row.listenerPlayerId === playerId || row.speakerPlayerId === playerId)
    const incidentHeld = this.incidents.some((row) => row.playerId === playerId && row.legalHoldUntil > this.now())
    if (!keepHeld || !incidentHeld) {
      this.removeWhere(this.sanctions, (row) => row.playerId === playerId)
    }
    this.removals.delete(playerId)
    this.rerolls.delete(playerId)
  }

  private removeWhere<T>(rows: T[], drop: (row: T) => boolean): void {
    const kept = rows.filter((row) => !drop(row))
    rows.length = 0
    rows.push(...kept)
  }

  private routeFor(kind: 'player' | 'level' | 'bot', category: ReportCategory): StoredReport['route'] {
    if (kind === 'bot') return 'discarded'
    if (category === 'bug') return 'curation'
    if (category === 'scary' && kind === 'level') return 'level'
    return 'queue'
  }

  private publicReport(row: StoredReport): SafetyReport {
    return { ...row }
  }

  private requirePresetIds(ids: readonly number[] | undefined): void {
    if (!ids) return
    if (ids.some((id) => !Number.isInteger(id) || id < 0 || id > 255)) throw new SafetyError('preset_ids_only')
  }

  private rejectFreeText(input: object): void {
    for (const key of Object.keys(input)) {
      if (FREE_TEXT_KEYS.includes(key)) throw new SafetyError('no_free_text')
    }
  }

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now()
  }
}

function noticeFor(decision: 'warning' | 'suspend_24h' | 'suspend_7d' | 'ban'): number {
  switch (decision) {
    case 'warning':
      return NOTICE.sanctionWarning
    case 'suspend_24h':
      return NOTICE.sanctionSuspend24h
    case 'suspend_7d':
      return NOTICE.sanctionSuspend7d
    case 'ban':
      return NOTICE.sanctionBan
  }
}

export function labelsMatchPictures(): boolean {
  return REPORT_CATEGORIES.every((id: ReportPictureId, index) => REPORT_PICTURES[index]?.label === REPORT_CATEGORY_LABELS[id])
}
