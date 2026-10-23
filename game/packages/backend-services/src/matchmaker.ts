import { NET, SHOW_RULES } from '@wobblebeans/shared'
import { FleetService, type ShowAllocation } from './fleet'
import { assertRegion, type ShowRegion } from './regions'

export type TicketStatus = 'queued' | 'allocated' | 'cancelled' | 'lowpop' | 'practice'

export interface QueueTicket {
  id: string
  playerIds: string[]
  /** Chosen from ping beacons, never from a precise location. */
  region: string | null
  status: TicketStatus
  showId?: string
  botCount?: number
  cohort?: 'new' | 'open'
  practiceOffered?: boolean
  roster?: { playerId: string; isBot: boolean }[]
  connectTokens?: { playerId: string; token: string; showId: string }[]
}

export interface QueueRequest {
  playerIds: string[]
  region?: string | null
  /** Other beacon ids the client already measured. Used only after 90 s. */
  widenRegions?: readonly string[]
  /** Highest show count in the party. Under 5 joins the new-player pool. */
  showsCompleted?: number
  nowMs?: number
}

export interface Party {
  id: string
  leaderId: string
  memberIds: string[]
}

export interface PracticeOffer {
  humanId: string
  playerIds: string[]
  botCount: number
  xpEarned: 0
  coinsEarned: 0
  offline: true
}

interface WaitingTicket {
  id: string
  playerIds: string[]
  region: ShowRegion | null
  widenRegions: ShowRegion[]
  showsCompleted: number
  enqueuedAt: number
  status: TicketStatus
  showId?: string
  botCount?: number
  cohort?: 'new' | 'open'
  practiceOffered?: boolean
  roster?: { playerId: string; isBot: boolean }[]
  connectTokens?: { playerId: string; token: string; showId: string }[]
}

interface Lobby {
  region: ShowRegion | null
  cohort: 'new' | 'open'
  members: WaitingTicket[]
}

/**
 * Casual matchmaking (doc 09 §3, D-11, D-12, ISS-06).
 * Parties of up to 4 stay whole. Region ids come from the client.
 * After 120 s with no show, the ticket is offered Practice instead of sitting in a dead queue.
 * Nothing here re-queues a finished show.
 */
export class MatchmakerService {
  readonly name = 'matchmaker'
  private readonly tickets: WaitingTicket[] = []
  private readonly parties = new Map<string, Party>()
  private readonly blocks = new Set<string>()
  private seq = 0
  private showSeq = 0

  constructor(
    private readonly fleet = new FleetService(),
    private readonly configVersion = 'foundation-1',
  ) {}

  ready(): { name: string; ready: boolean } {
    return { name: this.name, ready: false }
  }

  block(playerId: string, subjectId: string): void {
    if (playerId === subjectId) return
    this.blocks.add(blockKey(playerId, subjectId))
  }

  blocked(playerId: string, subjectId: string): boolean {
    return this.blocks.has(blockKey(playerId, subjectId))
  }

  createParty(leaderId: string): Party {
    const party: Party = { id: `party_${++this.seq}`, leaderId, memberIds: [leaderId] }
    this.parties.set(party.id, party)
    return { ...party, memberIds: [...party.memberIds] }
  }

  invite(partyId: string, playerId: string): Party {
    const party = this.party(partyId)
    if (party.memberIds.includes(playerId)) return this.publicParty(party)
    if (party.memberIds.length >= SHOW_RULES.maxParty) throw new Error('party is full')
    if (party.memberIds.some((member) => this.blocked(member, playerId))) throw new Error('blocked')
    party.memberIds.push(playerId)
    return this.publicParty(party)
  }

  leaveParty(partyId: string, playerId: string): Party | null {
    const party = this.party(partyId)
    party.memberIds = party.memberIds.filter((member) => member !== playerId)
    if (party.leaderId === playerId) {
      const next = party.memberIds[0]
      if (!next) {
        this.parties.delete(party.id)
        this.cancelMembers([playerId])
        return null
      }
      party.leaderId = next
    }
    this.cancelMembers([playerId])
    return this.publicParty(party)
  }

  /**
   * Leader queues the whole party. A ticket without a party object may still
   * carry 1–4 ids; those ids are allocated together.
   */
  queueParty(partyId: string, requesterId: string, request: Omit<QueueRequest, 'playerIds'> = {}): QueueTicket {
    const party = this.party(partyId)
    if (requesterId !== party.leaderId) throw new Error('leader queues')
    return this.queue({ ...request, playerIds: [...party.memberIds] })
  }

  queue(request: QueueRequest): QueueTicket {
    const playerIds = [...request.playerIds]
    if (playerIds.length < 1 || playerIds.length > SHOW_RULES.maxParty) throw new Error('party size')
    if (new Set(playerIds).size !== playerIds.length) throw new Error('party size')
    const region = assertRegion(request.region)
    const widenRegions = (request.widenRegions ?? []).map((value) => {
      const parsed = assertRegion(value)
      if (!parsed) throw new Error('unknown region')
      return parsed
    })
    for (const playerId of playerIds) {
      if (this.tickets.some((ticket) => ticket.status === 'queued' && ticket.playerIds.includes(playerId))) {
        throw new Error('already queued')
      }
    }
    const ticket: WaitingTicket = {
      id: `mm_${++this.seq}`,
      playerIds,
      region,
      widenRegions,
      showsCompleted: request.showsCompleted ?? 0,
      enqueuedAt: request.nowMs ?? 0,
      status: 'queued',
    }
    this.tickets.push(ticket)
    return this.publish(ticket)
  }

  get(id: string): QueueTicket | undefined {
    const ticket = this.tickets.find((row) => row.id === id)
    return ticket ? this.publish(ticket) : undefined
  }

  cancel(id: string): boolean {
    const ticket = this.tickets.find((row) => row.id === id)
    if (!ticket) return false
    if (ticket.status === 'allocated' || ticket.status === 'practice') return false
    ticket.status = 'cancelled'
    ticket.practiceOffered = false
    return true
  }

  /** Manual "try again" from the low-population offer. Does not fire on its own. */
  retry(id: string, nowMs: number): QueueTicket {
    const ticket = this.must(id)
    if (ticket.status !== 'lowpop') throw new Error('not waiting on practice')
    ticket.status = 'queued'
    ticket.practiceOffered = false
    ticket.enqueuedAt = nowMs
    return this.publish(ticket)
  }

  acceptPractice(id: string, botCount = 3): PracticeOffer {
    const ticket = this.must(id)
    if (ticket.status !== 'lowpop' || !ticket.practiceOffered) throw new Error('practice is offered after a long queue')
    if (botCount < 0 || botCount > SHOW_RULES.practiceMaxBots) throw new Error('practice bot count')
    ticket.status = 'practice'
    return {
      humanId: ticket.playerIds[0]!,
      playerIds: [...ticket.playerIds],
      botCount,
      xpEarned: 0,
      coinsEarned: 0,
      offline: true,
    }
  }

  /** Form lobbies and start shows whose fill step is due. */
  tick(nowMs: number): QueueTicket[] {
    const waiting = this.tickets.filter((ticket) => ticket.status === 'queued')
    const ordered = [...waiting].sort((a, b) => {
      const size = b.playerIds.length - a.playerIds.length
      if (size !== 0) return size
      return a.enqueuedAt - b.enqueuedAt
    })
    const lobbies: Lobby[] = []
    for (const ticket of ordered) this.place(lobbies, ticket, nowMs)
    const started: QueueTicket[] = []
    for (const lobby of lobbies) {
      const decision = this.decisionFor(lobby, nowMs)
      if (decision === 'wait') continue
      if (decision === 'practice') {
        for (const ticket of lobby.members) {
          ticket.status = 'lowpop'
          ticket.practiceOffered = true
        }
        continue
      }
      const allocated = this.allocate(lobby, decision.bots, nowMs)
      if (allocated) started.push(...allocated)
    }
    return started
  }

  fleetAllocation(showId: string): ShowAllocation | undefined {
    return this.fleet.get(showId)
  }

  private place(lobbies: Lobby[], ticket: WaitingTicket, nowMs: number): void {
    const cohort = this.cohortOf(ticket, nowMs)
    const fitting = lobbies.filter((lobby) => {
      if (lobby.cohort !== cohort) return false
      if (!this.regionOk(lobby, ticket, nowMs)) return false
      return this.humans(lobby) + ticket.playerIds.length <= NET.maxPlayers
    })
    const peaceful = fitting.filter((lobby) => !this.conflicts(lobby, ticket))
    const age = nowMs - ticket.enqueuedAt
    const choice = peaceful[0] ?? (age >= SHOW_RULES.blockGraceMs ? fitting[0] : undefined)
    if (choice) {
      choice.members.push(ticket)
      return
    }
    lobbies.push({ region: ticket.region, cohort, members: [ticket] })
  }

  private decisionFor(lobby: Lobby, nowMs: number): 'wait' | 'practice' | { bots: number } {
    const humans = this.humans(lobby)
    const age = nowMs - Math.min(...lobby.members.map((ticket) => ticket.enqueuedAt))
    if (humans >= NET.maxPlayers) return { bots: 0 }
    if (age >= SHOW_RULES.fillAt20Ms && humans >= SHOW_RULES.humansAt20s) return { bots: 0 }
    if (age >= SHOW_RULES.fillAt40Ms && humans >= SHOW_RULES.humansAt40s) return { bots: 0 }
    if (age >= SHOW_RULES.botBackfillMs && humans >= SHOW_RULES.minWithBots) return { bots: 0 }
    if (age >= SHOW_RULES.botBackfillMs && humans >= SHOW_RULES.minHumans) {
      const bots = Math.min(SHOW_RULES.maxBots, NET.maxPlayers - humans)
      if (humans + bots >= SHOW_RULES.minWithBots) return { bots }
    }
    if (age >= SHOW_RULES.lowPopMs) return 'practice'
    return 'wait'
  }

  private allocate(lobby: Lobby, bots: number, nowMs: number): QueueTicket[] | null {
    const showId = `show_${++this.showSeq}`
    const roster = lobby.members.flatMap((ticket) => ticket.playerIds.map((playerId) => ({ playerId, isBot: false })))
    for (let i = 1; i <= bots; i++) roster.push({ playerId: `bot:${showId}:${i}`, isBot: true })
    const allocation = this.fleet.allocate({
      showId,
      region: lobby.region,
      configVersion: this.configVersion,
      roster,
      nowMs,
    })
    if (!allocation) return null
    const cohort = lobby.cohort
    for (const ticket of lobby.members) {
      ticket.status = 'allocated'
      ticket.showId = showId
      ticket.botCount = bots
      ticket.cohort = cohort
      ticket.roster = roster.map((member) => ({ ...member }))
      ticket.connectTokens = allocation.tokens
        .filter((token) => ticket.playerIds.includes(token.playerId))
        .map((token) => ({ playerId: token.playerId, token: token.token, showId: token.showId }))
    }
    return lobby.members.map((ticket) => this.publish(ticket))
  }

  private cohortOf(ticket: WaitingTicket, nowMs: number): 'new' | 'open' {
    if (ticket.showsCompleted >= SHOW_RULES.newPlayerShows) return 'open'
    if (nowMs - ticket.enqueuedAt >= SHOW_RULES.newPlayerFallbackMs) return 'open'
    return 'new'
  }

  private regionOk(lobby: Lobby, ticket: WaitingTicket, nowMs: number): boolean {
    if (lobby.region === ticket.region) return true
    if (nowMs - ticket.enqueuedAt < SHOW_RULES.regionWidenMs) return false
    if (lobby.region === null || ticket.region === null) return false
    return ticket.widenRegions.includes(lobby.region)
  }

  private conflicts(lobby: Lobby, ticket: WaitingTicket): boolean {
    const ids = lobby.members.flatMap((member) => member.playerIds)
    return ticket.playerIds.some((playerId) => ids.some((other) => this.blocked(playerId, other)))
  }

  private humans(lobby: Lobby): number {
    return lobby.members.reduce((sum, ticket) => sum + ticket.playerIds.length, 0)
  }

  private cancelMembers(playerIds: readonly string[]): void {
    for (const ticket of this.tickets) {
      if (ticket.status !== 'queued' && ticket.status !== 'lowpop') continue
      if (ticket.playerIds.some((playerId) => playerIds.includes(playerId))) ticket.status = 'cancelled'
    }
  }

  private party(id: string): Party {
    const party = this.parties.get(id)
    if (!party) throw new Error('missing party')
    return party
  }

  private must(id: string): WaitingTicket {
    const ticket = this.tickets.find((row) => row.id === id)
    if (!ticket) throw new Error('missing ticket')
    return ticket
  }

  private publicParty(party: Party): Party {
    return { id: party.id, leaderId: party.leaderId, memberIds: [...party.memberIds] }
  }

  private publish(ticket: WaitingTicket): QueueTicket {
    return {
      id: ticket.id,
      playerIds: [...ticket.playerIds],
      region: ticket.region,
      status: ticket.status,
      showId: ticket.showId,
      botCount: ticket.botCount,
      cohort: ticket.cohort,
      practiceOffered: ticket.practiceOffered,
      roster: ticket.roster?.map((member) => ({ ...member })),
      connectTokens: ticket.connectTokens?.map((token) => ({ ...token })),
    }
  }
}

function blockKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
