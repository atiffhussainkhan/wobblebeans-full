import { randomBytes } from 'node:crypto'
import {
  EventKind,
  PHYSICS,
  RoundStateCode,
  SLOT_QUALIFY_PCT,
  qualifyQuota,
  registeredLevels,
  slotForRound,
  type LevelPlug,
  type QualifyDecision,
  type RoundSample,
  type RoundType,
  type ShowSlot,
  type MatchResult,
} from '@wobblebeans/shared'
import { botInput, createBotMind, type BotMind } from '../bots/brain'
import type { ShowCheckpoint, ShowCheckpointStore } from './checkpoint'
import { SHOW, productionPhaseTicks, tickMs, type PhaseTicks } from './constants'
import type { RoundDriver } from './driver'
import { evaluateRound } from './qualify'
import { mergeLevels, MVP_LEVELS } from './levels'
import { matchResultFrom, type RewardParticipant } from './rewards'
import { mulberry32, selectLevel } from './select'
import type { FlowHost, ShowFlow } from './host'

export type ShowPhase =
  | 'round-intro'
  | 'spawn-hold'
  | 'countdown'
  | 'play'
  | 'outcome'
  | 'interstitial'
  | 'final-intro'
  | 'final'
  | 'results'
  | 'menu'
  | 'aborted'

export interface RosterMember {
  slotId: number
  playerId: string
  isBot: boolean
  showsCompleted?: number
}

interface Entrant {
  slotId: number
  playerId: string
  isBot: boolean
  connected: boolean
  disconnectedAtMs: number | null
  reconnectToken: string | null
  reconnectsUsed: number
  eliminated: boolean
  quit: boolean
  spectating: boolean
  finished: boolean
  finishTick: number | null
  alive: boolean
  fallTick: number | null
  score: number
  scoreTick: number | null
  qualifiedRounds: number
  reachedFinal: boolean
  won: boolean
  sawResolvedRound: boolean
  elimEventSent: boolean
}

export interface FlowEvent {
  kind: number
  subjectId: number
  code: number
  extra: number
}

export interface DirectorOptions {
  showId: string
  configVersion: string
  region: string
  seed: number
  roster: readonly RosterMember[]
  cohort?: 'new' | 'open'
  nowMs?: number
  recentLevelIds?: ReadonlyMap<string, readonly string[]>
  disabledLevels?: readonly { id: string; disabledAtMs: number }[]
  allocatedAtMs?: number
  checkpoints?: ShowCheckpointStore
  driver?: RoundDriver
  levels?: readonly LevelPlug[]
  phaseTicks?: Partial<PhaseTicks>
  onResult?: (result: MatchResult) => void
}

/**
 * Main Show director. Queue and low-population live on the matchmaker;
 * this machine runs from the filled lobby through Results and stops at Menu.
 * Play again does not re-queue (FR-08-18).
 */
export class ShowDirector implements ShowFlow {
  readonly events: FlowEvent[] = []
  readonly qualifierPath: number[] = []
  private readonly entrants: Entrant[]
  private readonly minds = new Map<number, BotMind>()
  private readonly recent: ReadonlyMap<string, readonly string[]>
  private readonly disabled: readonly { id: string; disabledAtMs: number }[]
  private readonly levels: LevelPlug[]
  private readonly rng: () => number
  private readonly ticks: PhaseTicks
  private readonly driver: RoundDriver | null
  private readonly checkpoints: ShowCheckpointStore | null
  private readonly onResult: ((result: MatchResult) => void) | null
  private readonly cohort: 'new' | 'open'
  private host: FlowHost | null = null
  private phaseName: ShowPhase = 'round-intro'
  private phaseTick = 0
  private simTick = 0
  private nowMs: number
  private roundNumber = 0
  private mode: 'qualifier' | 'final' = 'qualifier'
  private level: LevelPlug | null = null
  private quotaValue = 0
  private activeIds: number[] = []
  private played = new Set<string>()
  private lastType: RoundType | null = null
  private resolvedRounds = 0
  private countdownShown = -1
  private published = false
  private finalSlotIds: number[] = []
  private finalStarted = false

  constructor(private readonly options: DirectorOptions) {
    this.entrants = options.roster.map((member) => ({
      slotId: member.slotId,
      playerId: member.playerId,
      isBot: member.isBot,
      connected: true,
      disconnectedAtMs: null,
      reconnectToken: null,
      reconnectsUsed: 0,
      eliminated: false,
      quit: false,
      spectating: false,
      finished: false,
      finishTick: null,
      alive: true,
      fallTick: null,
      score: 0,
      scoreTick: null,
      qualifiedRounds: 0,
      reachedFinal: false,
      won: false,
      sawResolvedRound: false,
      elimEventSent: false,
    }))
    for (const member of options.roster) {
      if (member.isBot) this.minds.set(member.slotId, createBotMind(member.slotId, options.seed + member.slotId))
    }
    this.recent = options.recentLevelIds ?? new Map()
    this.disabled = options.disabledLevels ?? []
    this.levels = mergeLevels(options.levels ?? MVP_LEVELS, registeredLevels())
    this.rng = mulberry32(options.seed)
    this.ticks = { ...productionPhaseTicks(), ...options.phaseTicks }
    this.driver = options.driver ?? null
    this.checkpoints = options.checkpoints ?? null
    this.onResult = options.onResult ?? null
    this.cohort = options.cohort ?? 'open'
    this.nowMs = options.nowMs ?? 0
    this.openRound()
  }

  get showId(): string {
    return this.options.showId
  }

  get phase(): ShowPhase {
    return this.phaseName
  }

  get round(): number {
    return this.roundNumber
  }

  get quota(): number {
    return this.quotaValue
  }

  get levelId(): string | null {
    return this.level?.id ?? null
  }

  get inputLocked(): boolean {
    return this.phaseName !== 'play' && this.phaseName !== 'final'
  }

  get winners(): readonly { slotId: number; playerId: string; isBot: boolean }[] {
    return this.entrants
      .filter((entrant) => entrant.won)
      .map((entrant) => ({ slotId: entrant.slotId, playerId: entrant.playerId, isBot: entrant.isBot }))
  }

  get finalists(): readonly { slotId: number; playerId: string; isBot: boolean }[] {
    const ids = new Set(this.finalSlotIds)
    return this.entrants
      .filter((entrant) => ids.has(entrant.slotId))
      .map((entrant) => ({ slotId: entrant.slotId, playerId: entrant.playerId, isBot: entrant.isBot }))
  }

  get finalDidStart(): boolean {
    return this.finalStarted
  }

  step(ticks = 1): void {
    for (let i = 0; i < ticks; i++) this.stepOne()
  }

  prepare(host: FlowHost): void {
    this.host = host
    this.syncInputs(host)
    this.readFinishes(host)
    this.stepOne()
  }

  onSocketClosed(slotId: number): boolean {
    const entrant = this.entrants.find((row) => row.slotId === slotId)
    if (!entrant || entrant.isBot) return false
    if (entrant.reconnectsUsed >= SHOW.maxReconnects || this.terminal()) {
      this.markGone(entrant, false)
      return false
    }
    entrant.connected = false
    entrant.disconnectedAtMs = this.nowMs
    entrant.reconnectToken = randomBytes(16).toString('hex')
    return true
  }

  resume(token: string, playerId: string, showId: string): number | null {
    if (showId !== this.options.showId) return null
    const entrant = this.entrants.find((row) => row.playerId === playerId && row.reconnectToken === token)
    if (!entrant || entrant.disconnectedAtMs === null) return null
    if (this.nowMs - entrant.disconnectedAtMs >= SHOW.reconnectMs) return null
    if (entrant.reconnectsUsed >= SHOW.maxReconnects) return null
    entrant.reconnectsUsed += 1
    entrant.connected = true
    entrant.disconnectedAtMs = null
    entrant.reconnectToken = null
    return entrant.slotId
  }

  reconnectTokenFor(playerId: string): string | null {
    return this.entrants.find((row) => row.playerId === playerId)?.reconnectToken ?? null
  }

  leave(playerId: string): void {
    const entrant = this.entrants.find((row) => row.playerId === playerId && !row.isBot)
    if (!entrant || entrant.quit) return
    this.markGone(entrant, true)
  }

  noteFinish(slotId: number): void {
    const entrant = this.activeEntrant(slotId)
    if (!entrant || entrant.finished || entrant.eliminated || entrant.quit) return
    entrant.finished = true
    entrant.finishTick = this.simTick
  }

  noteFall(slotId: number): void {
    const entrant = this.activeEntrant(slotId)
    if (!entrant || entrant.eliminated || entrant.quit) return
    entrant.alive = false
    entrant.eliminated = true
    entrant.fallTick = this.simTick
    entrant.spectating = true
    this.emitEliminated(entrant)
  }

  noteScore(slotId: number, score: number): void {
    const entrant = this.activeEntrant(slotId)
    if (!entrant || entrant.eliminated || entrant.quit) return
    if (entrant.score === score) return
    entrant.score = score
    entrant.scoreTick = this.simTick
    const code = Math.max(0, Math.min(65535, Math.round(score)))
    this.emit(EventKind.Score, entrant.slotId, code, 0)
  }

  /** Manual press only. The show never queues another one. */
  playAgain(): { requeued: false } {
    this.phaseName = 'menu'
    return { requeued: false }
  }

  abort(): MatchResult | null {
    if (this.phaseName !== 'aborted') {
      this.phaseName = 'aborted'
      this.emit(EventKind.RoundState, 0, RoundStateCode.Aborted, this.resolvedRounds)
    }
    return this.publish()
  }

  toMatchResult(): MatchResult | null {
    return matchResultFrom({
      showId: this.options.showId,
      configVersion: this.options.configVersion,
      region: this.options.region,
      participants: this.entrants.map((entrant) => this.rewardRow(entrant)),
    })
  }

  checkpoint(): ShowCheckpoint {
    return {
      showId: this.options.showId,
      configVersion: this.options.configVersion,
      region: this.options.region,
      completedRounds: this.resolvedRounds,
      participants: this.entrants.map((entrant) => ({
        playerId: entrant.playerId,
        isBot: entrant.isBot,
        qualifiedRounds: entrant.qualifiedRounds,
        reachedFinal: entrant.reachedFinal,
        wonFinal: entrant.won,
        quit: entrant.quit,
        sawResolvedRound: entrant.sawResolvedRound,
      })),
    }
  }

  private stepOne(): void {
    if (this.phaseName === 'menu' || this.phaseName === 'aborted') return
    this.simTick += 1
    this.nowMs += tickMs()
    this.expireDisconnects()
    if (this.phaseName === 'play' || this.phaseName === 'final') {
      if (this.humansStillIn().length === 0) {
        this.closeNoWinner()
        return
      }
      this.runDriver()
      const decision = this.evaluate(this.phaseTick >= this.playTicks())
      if (decision.done) {
        this.resolveRound(decision)
        return
      }
    }
    if (this.phaseName === 'countdown') this.markCountdown()
    this.phaseTick += 1
    if (this.phaseName !== 'play' && this.phaseName !== 'final' && this.phaseTick >= this.limitOf(this.phaseName)) {
      this.completePhase()
    }
  }

  private runDriver(): void {
    if (!this.driver || !this.level) return
    const entrants = this.activeEntrants()
    this.driver.tick({
      roundType: this.level.roundType,
      quota: this.quotaValue,
      elapsedTicks: this.phaseTick,
      entrants: entrants.map((entrant) => ({
        slotId: entrant.slotId,
        isBot: entrant.isBot,
        finished: entrant.finished,
        alive: entrant.alive,
        eliminated: entrant.eliminated,
        score: entrant.score,
      })),
      finish: (slotId) => this.noteFinish(slotId),
      fall: (slotId) => this.noteFall(slotId),
      score: (slotId, value) => this.noteScore(slotId, value),
    })
  }

  private evaluate(timedOut: boolean): QualifyDecision {
    if (!this.level) return { done: false, qualifiedSlotIds: [], eliminatedSlotIds: [], allWin: false }
    const sample: RoundSample = {
      tick: this.simTick,
      elapsedS: this.phaseTick / PHYSICS.tickHz,
      timeLimitS: this.level.timeLimitS,
      quota: this.quotaValue,
      roundType: this.level.roundType,
      timedOut,
      entrants: this.activeEntrants().map((entrant) => ({
        slotId: entrant.slotId,
        isBot: entrant.isBot,
        eliminated: entrant.eliminated,
        connected: entrant.connected || this.withinReconnect(entrant),
        finished: entrant.finished,
        finishTick: entrant.finishTick,
        alive: entrant.alive,
        fallTick: entrant.fallTick,
        score: entrant.score,
        scoreTick: entrant.scoreTick,
      })),
    }
    return this.level.qualify ? this.level.qualify(sample) : evaluateRound(sample)
  }

  private resolveRound(decision: QualifyDecision): void {
    const qualified = new Set(decision.qualifiedSlotIds)
    const finalRound = this.mode === 'final'
    for (const entrant of this.activeEntrants()) {
      if (entrant.quit) continue
      entrant.sawResolvedRound = true
      const qualifies = qualified.has(entrant.slotId) && !(finalRound && entrant.isBot)
      if (qualifies) {
        if (finalRound) {
          entrant.won = true
          entrant.reachedFinal = true
        } else if (!entrant.isBot) {
          entrant.qualifiedRounds += 1
        }
        continue
      }
      if (!entrant.eliminated) {
        entrant.eliminated = true
        entrant.alive = false
        entrant.spectating = !entrant.isBot
        if (finalRound && !entrant.isBot) entrant.reachedFinal = true
        this.emitEliminated(entrant)
      } else if (finalRound && !entrant.isBot) {
        entrant.reachedFinal = true
      }
    }
    if (this.level) {
      this.played.add(this.level.id)
      this.lastType = this.level.roundType
    }
    if (!finalRound) this.qualifierPath.push(this.stillIn().length)
    this.resolvedRounds += 1
    this.saveCheckpoint()
    this.enter('outcome')
  }

  private openRound(): void {
    if (this.terminal()) return
    this.roundNumber += 1
    const field = this.stillIn()
    if (field.every((entrant) => entrant.isBot)) {
      this.closeNoWinner()
      return
    }
    const finalRound = field.length <= SHOW.finalMax || this.roundNumber >= SHOW.maxRounds
    if (finalRound) {
      this.stripBots()
      const humans = this.stillIn().filter((entrant) => !entrant.isBot)
      if (humans.length === 0) {
        this.finalStarted = false
        this.closeNoWinner()
        return
      }
      if (humans.length === 1) {
        this.instantWin(humans[0]!)
        return
      }
      this.mode = 'final'
      this.finalStarted = true
      this.finalSlotIds = this.stillIn().map((entrant) => entrant.slotId)
      this.beginLevel('F', this.stillIn().length)
      return
    }
    this.mode = 'qualifier'
    this.beginLevel(slotForRound(this.roundNumber), field.length)
  }

  private beginLevel(slot: ShowSlot, fieldSize: number): void {
    const picked = selectLevel({
      slot,
      playerCount: fieldSize,
      roundNumber: this.roundNumber,
      playedIds: this.played,
      lastRoundType: this.lastType,
      cohort: this.cohort,
      levels: this.levels,
      freshness: (levelId) => this.freshness(levelId),
      rng: this.rng,
      allocatedAtMs: this.options.allocatedAtMs ?? this.nowMs,
      disabled: this.disabled,
    })
    this.level = picked.level
    const percent = picked.level.qualifyPct ?? SLOT_QUALIFY_PCT[slot]
    this.quotaValue = this.mode === 'final' ? Math.max(1, fieldSize) : qualifyQuota(fieldSize, percent)
    this.activeIds = this.stillIn().map((entrant) => entrant.slotId)
    for (const entrant of this.activeEntrants()) {
      entrant.finished = false
      entrant.finishTick = null
      entrant.alive = true
      entrant.fallTick = null
      entrant.score = 0
      entrant.scoreTick = null
    }
    this.enter(this.mode === 'final' ? 'final-intro' : 'round-intro')
    this.emit(EventKind.RoundState, 0, RoundStateCode.Quota, this.quotaValue)
  }

  private instantWin(human: Entrant): void {
    human.won = true
    human.reachedFinal = true
    human.sawResolvedRound = true
    this.finalSlotIds = [human.slotId]
    this.finalStarted = false
    this.saveCheckpoint()
    this.enter('results')
  }

  private closeNoWinner(): void {
    this.saveCheckpoint()
    this.enter('results')
  }

  private stripBots(): void {
    for (const entrant of this.entrants) {
      if (!entrant.isBot || entrant.eliminated) continue
      entrant.eliminated = true
      entrant.alive = false
      entrant.spectating = false
    }
  }

  private completePhase(): void {
    switch (this.phaseName) {
      case 'round-intro':
      case 'final-intro':
        this.enter('spawn-hold')
        break
      case 'spawn-hold':
        this.enter('countdown')
        break
      case 'countdown':
        this.emit(EventKind.RoundState, 0, RoundStateCode.Go, 0)
        this.enter(this.mode === 'final' ? 'final' : 'play')
        break
      case 'outcome':
        this.afterOutcome()
        break
      case 'interstitial':
        this.openRound()
        break
      case 'results':
        this.enter('menu')
        break
      default:
        break
    }
  }

  private afterOutcome(): void {
    if (this.humansStillIn().length === 0) {
      this.closeNoWinner()
      return
    }
    if (this.mode === 'final') {
      this.enter('results')
      return
    }
    this.enter('interstitial')
  }

  private enter(phase: ShowPhase): void {
    this.phaseName = phase
    this.phaseTick = 0
    this.countdownShown = -1
    const code = phaseCode(phase)
    if (code !== 0) this.emit(EventKind.RoundState, 0, code, this.roundNumber)
    if (phase === 'countdown') this.markCountdown()
    if (phase === 'results') this.publish()
    if (this.limitOf(phase) === 0) this.completePhase()
  }

  private markCountdown(): void {
    const span = Math.max(1, Math.floor(this.limitOf('countdown') / 3))
    const step = Math.min(2, Math.floor(this.phaseTick / span))
    const number = 3 - step
    if (number === this.countdownShown) return
    this.countdownShown = number
    this.emit(EventKind.RoundState, 0, RoundStateCode.Countdown, number)
  }

  private expireDisconnects(): void {
    for (const entrant of this.entrants) {
      if (entrant.isBot || entrant.connected || entrant.disconnectedAtMs === null) continue
      if (this.nowMs - entrant.disconnectedAtMs < SHOW.reconnectMs) continue
      entrant.reconnectToken = null
      entrant.disconnectedAtMs = null
      if (!entrant.eliminated && !entrant.quit) {
        entrant.eliminated = true
        entrant.alive = false
        entrant.spectating = true
        this.emitEliminated(entrant)
      }
    }
  }

  private syncInputs(host: FlowHost): void {
    if (this.inputLocked) {
      for (const player of host.players.values()) {
        if (player.lastInput) {
          player.lastInput = {
            ...player.lastInput,
            moveX: 0,
            moveZ: 0,
            jump: false,
            dive: false,
          }
        }
        for (const frame of player.queue) {
          frame.moveX = 0
          frame.moveZ = 0
          frame.jump = false
          frame.dive = false
        }
      }
      return
    }
    for (const entrant of this.entrants) {
      if (!entrant.isBot || entrant.eliminated || entrant.quit) continue
      const player = host.players.get(entrant.slotId)
      const mind = this.minds.get(entrant.slotId)
      if (!player || !mind) continue
      const frame = botInput(mind, host.tick + 1, false)
      frame.seq = ((player.ack + 1) & 0xffff) || 1
      frame.quickChat = 0
      frame.emote = 0
      player.queue.push(frame)
    }
  }

  private readFinishes(host: FlowHost): void {
    if (!host.beanFinished) return
    for (const entrant of this.activeEntrants()) {
      if (host.beanFinished(entrant.slotId)) this.noteFinish(entrant.slotId)
    }
  }

  private freshness(levelId: string): number {
    const humans = this.entrants.filter((entrant) => !entrant.isBot)
    if (humans.length === 0) return 1
    let hits = 0
    for (const human of humans) {
      const recent = this.recent.get(human.playerId) ?? []
      if (recent.includes(levelId)) hits += 1
    }
    return hits / humans.length > 0.5 ? 0.5 : 1
  }

  private playTicks(): number {
    const seconds = this.level?.timeLimitS ?? 60
    return Math.max(1, Math.round(seconds * PHYSICS.tickHz))
  }

  private limitOf(phase: ShowPhase): number {
    if (phase === 'menu' || phase === 'aborted') return Number.POSITIVE_INFINITY
    if (phase === 'play' || phase === 'final') return this.playTicks()
    if (phase === 'round-intro' || phase === 'final-intro') return this.ticks.intro
    if (phase === 'spawn-hold') return this.ticks.spawnHold
    if (phase === 'countdown') return this.ticks.countdown
    if (phase === 'outcome') return this.ticks.outcome
    if (phase === 'interstitial') return this.ticks.interstitial
    return this.ticks.results
  }

  private stillIn(): Entrant[] {
    return this.entrants.filter((entrant) => !entrant.eliminated && !entrant.quit)
  }

  private humansStillIn(): Entrant[] {
    return this.stillIn().filter((entrant) => !entrant.isBot)
  }

  private activeEntrants(): Entrant[] {
    const ids = new Set(this.activeIds)
    return this.entrants.filter((entrant) => ids.has(entrant.slotId))
  }

  private activeEntrant(slotId: number): Entrant | undefined {
    if (!this.activeIds.includes(slotId)) return undefined
    return this.entrants.find((entrant) => entrant.slotId === slotId)
  }

  private withinReconnect(entrant: Entrant): boolean {
    return entrant.disconnectedAtMs !== null && this.nowMs - entrant.disconnectedAtMs < SHOW.reconnectMs
  }

  private emitEliminated(entrant: Entrant): void {
    if (entrant.isBot || entrant.elimEventSent) return
    entrant.elimEventSent = true
    this.emit(EventKind.Eliminated, entrant.slotId, 0, this.roundNumber)
    this.emit(EventKind.RoundState, entrant.slotId, RoundStateCode.Spectate, this.roundNumber)
  }

  private emit(kind: number, subjectId: number, code: number, extra = 0): void {
    this.events.push({ kind, subjectId, code, extra })
    this.host?.serverEvent(kind, subjectId, code, extra)
  }

  private saveCheckpoint(): void {
    const row = this.checkpoint()
    this.checkpoints?.save(row)
  }

  private publish(): MatchResult | null {
    const result = this.toMatchResult()
    if (result && !this.published) {
      this.published = true
      this.onResult?.(result)
    }
    return result
  }

  private rewardRow(entrant: Entrant): RewardParticipant {
    return {
      playerId: entrant.playerId,
      isBot: entrant.isBot,
      qualifiedRounds: entrant.qualifiedRounds,
      reachedFinal: entrant.reachedFinal,
      won: entrant.won,
      sawResolvedRound: entrant.sawResolvedRound,
    }
  }

  private markGone(entrant: Entrant, quit: boolean): void {
    entrant.quit = quit || entrant.quit
    entrant.eliminated = true
    entrant.alive = false
    entrant.connected = false
    entrant.reconnectToken = null
    entrant.disconnectedAtMs = null
  }

  private terminal(): boolean {
    return this.phaseName === 'results' || this.phaseName === 'menu' || this.phaseName === 'aborted'
  }
}

function phaseCode(phase: ShowPhase): number {
  switch (phase) {
    case 'round-intro':
      return RoundStateCode.RoundIntro
    case 'spawn-hold':
      return RoundStateCode.SpawnHold
    case 'countdown':
      return RoundStateCode.Countdown
    case 'play':
      return RoundStateCode.Play
    case 'outcome':
      return RoundStateCode.Outcome
    case 'interstitial':
      return RoundStateCode.Interstitial
    case 'final-intro':
      return RoundStateCode.FinalIntro
    case 'final':
      return RoundStateCode.Final
    case 'results':
      return RoundStateCode.Results
    case 'menu':
      return RoundStateCode.Menu
    case 'aborted':
      return RoundStateCode.Aborted
    default:
      return 0
  }
}

export function runUntilSettled(director: ShowDirector, maxTicks = 250_000): void {
  let guard = 0
  while (director.phase !== 'menu' && director.phase !== 'aborted' && guard < maxTicks) {
    director.step(1)
    guard += 1
  }
  if (guard >= maxTicks) throw new Error(`show did not finish (${director.phase})`)
}
