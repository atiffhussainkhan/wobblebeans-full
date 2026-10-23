/**
 * Daily, weekly, and season challenges.
 * None require a win. None reward grabbing or knocking other beans.
 * Copy is a catalogue string, at most 40 characters.
 */

import { fnv1a } from '../physics/math'
import { ECONOMY, addUtcDays, shiftedUtcDate } from './economy'
import { weeklyPeriodKey } from './season'

export type ChallengeKind = 'daily' | 'weekly' | 'season'

export type ChallengeMetric =
  | 'shows_played'
  | 'rounds_qualified'
  | 'races_finished'
  | 'finals_reached'
  | 'emotes_lobby'
  | 'team_rounds'

export type ChallengeDifficulty = 'play' | 'do' | 'qualify'

export interface ChallengeTemplate {
  id: string
  kind: ChallengeKind
  difficulty: ChallengeDifficulty
  text: string
  icon: 'star' | 'flag' | 'bean' | 'emote' | 'team'
  metric: ChallengeMetric
  target: number
  xp: number
  coins: number
  itemId: string | null
  enabled: boolean
  minAgeOk: boolean
}

export interface ActivityDelta {
  showsPlayed: number
  roundsQualified: number
  racesFinished: number
  finalsReached: number
  emotesLobby: number
  teamRounds: number
}

export const EMPTY_ACTIVITY: ActivityDelta = {
  showsPlayed: 0,
  roundsQualified: 0,
  racesFinished: 0,
  finalsReached: 0,
  emotesLobby: 0,
  teamRounds: 0,
}

const DAILY_XP = ECONOMY.xp.dailyChallenge
const DAILY_COINS = ECONOMY.coins.dailyChallenge
const WEEKLY_XP = ECONOMY.xp.weeklyChallenge

function daily(
  id: string,
  difficulty: ChallengeDifficulty,
  text: string,
  icon: ChallengeTemplate['icon'],
  metric: ChallengeMetric,
  target: number,
): ChallengeTemplate {
  return {
    id,
    kind: 'daily',
    difficulty,
    text,
    icon,
    metric,
    target,
    xp: DAILY_XP,
    coins: DAILY_COINS,
    itemId: null,
    enabled: true,
    minAgeOk: true,
  }
}

function weekly(
  id: string,
  difficulty: ChallengeDifficulty,
  text: string,
  icon: ChallengeTemplate['icon'],
  metric: ChallengeMetric,
  target: number,
  itemId: string | null = null,
): ChallengeTemplate {
  return {
    id,
    kind: 'weekly',
    difficulty,
    text,
    icon,
    metric,
    target,
    xp: WEEKLY_XP,
    coins: 0,
    itemId,
    enabled: true,
    minAgeOk: true,
  }
}

export const CHALLENGE_TEMPLATES: readonly ChallengeTemplate[] = [
  daily('play_3', 'play', 'Play 3 shows', 'bean', 'shows_played', 3),
  daily('play_1', 'play', 'Play 1 show', 'bean', 'shows_played', 1),
  daily('emote_3', 'do', 'Do an emote in the lobby 3 times', 'emote', 'emotes_lobby', 3),
  daily('team_1', 'do', 'Try a team round', 'team', 'team_rounds', 1),
  daily('qualify_4', 'qualify', 'Qualify from 4 rounds', 'flag', 'rounds_qualified', 4),
  daily('finish_2', 'qualify', 'Finish 2 races', 'flag', 'races_finished', 2),
  daily('final_1', 'qualify', 'Reach 1 Final', 'star', 'finals_reached', 1),
  weekly('week_play_10', 'play', 'Play 10 shows', 'bean', 'shows_played', 10),
  weekly('week_play_8', 'play', 'Play 8 shows', 'bean', 'shows_played', 8),
  weekly('week_qualify_12', 'qualify', 'Qualify from 12 rounds', 'flag', 'rounds_qualified', 12),
  weekly('week_qualify_8', 'qualify', 'Qualify from 8 rounds', 'flag', 'rounds_qualified', 8),
  weekly('week_final_2', 'qualify', 'Reach 2 Finals', 'star', 'finals_reached', 2),
  weekly('week_races_6', 'qualify', 'Finish 6 races', 'flag', 'races_finished', 6),
  weekly('week_emote_5', 'do', 'Cheer in the lobby 5 times', 'emote', 'emotes_lobby', 5),
  weekly('week_team_2', 'do', 'Try 2 team rounds', 'team', 'team_rounds', 2),
  {
    id: 'season_s1_stage_1',
    kind: 'season',
    difficulty: 'play',
    text: 'Play 5 shows this season',
    icon: 'bean',
    metric: 'shows_played',
    target: 5,
    xp: 0,
    coins: 0,
    itemId: null,
    enabled: true,
    minAgeOk: true,
  },
  {
    id: 'season_s1_stage_2',
    kind: 'season',
    difficulty: 'play',
    text: 'Play 15 shows this season',
    icon: 'bean',
    metric: 'shows_played',
    target: 15,
    xp: 0,
    coins: 0,
    itemId: null,
    enabled: true,
    minAgeOk: true,
  },
  {
    id: 'season_s1_stage_3',
    kind: 'season',
    difficulty: 'play',
    text: 'Play 30 shows this season',
    icon: 'bean',
    metric: 'shows_played',
    target: 30,
    xp: 0,
    coins: 0,
    itemId: null,
    enabled: true,
    minAgeOk: true,
  },
  {
    id: 'season_s1_stage_4',
    kind: 'season',
    difficulty: 'play',
    text: 'Play 50 shows this season',
    icon: 'bean',
    metric: 'shows_played',
    target: 50,
    xp: 0,
    coins: 0,
    itemId: null,
    enabled: true,
    minAgeOk: true,
  },
  {
    id: 'season_s1_stage_5',
    kind: 'season',
    difficulty: 'play',
    text: 'Play 80 shows this season',
    icon: 'star',
    metric: 'shows_played',
    target: 80,
    xp: ECONOMY.xp.seasonChallenge,
    coins: 0,
    itemId: 'pat_season_goal',
    enabled: true,
    minAgeOk: true,
  },
]

const BY_ID = new Map(CHALLENGE_TEMPLATES.map((row) => [row.id, row]))

export function templateById(id: string): ChallengeTemplate | undefined {
  return BY_ID.get(id)
}

export function templatesFor(kind: ChallengeKind, difficulty?: ChallengeDifficulty): ChallengeTemplate[] {
  return CHALLENGE_TEMPLATES.filter(
    (row) => row.kind === kind && row.enabled && (difficulty == null || row.difficulty === difficulty),
  )
}

function pick(period: string, pool: readonly ChallengeTemplate[], salt: number): ChallengeTemplate {
  const index = fnv1a(`${period}:${salt}`) % pool.length
  return pool[index] ?? pool[0]!
}

export function dailiesFor(period: string): ChallengeTemplate[] {
  return [
    pick(period, templatesFor('daily', 'play'), 1),
    pick(period, templatesFor('daily', 'do'), 2),
    pick(period, templatesFor('daily', 'qualify'), 3),
  ]
}

export function weekliesFor(period: string): ChallengeTemplate[] {
  const pool = templatesFor('weekly')
  const start = fnv1a(period) % pool.length
  const picked: ChallengeTemplate[] = []
  for (let i = 0; i < ECONOMY.challenges.weeklySlots; i++) {
    const row = pool[(start + i) % pool.length]
    if (row && !picked.some((existing) => existing.id === row.id)) picked.push(row)
  }
  return picked
}

export function seasonStages(): ChallengeTemplate[] {
  return templatesFor('season')
}

export function dailyStillBanked(slotDate: string, now: Date): boolean {
  const today = shiftedUtcDate(now)
  return today <= addUtcDays(slotDate, ECONOMY.challenges.dailyBankDays - 1)
}

export function currentDailyPeriod(now: Date): string {
  return shiftedUtcDate(now)
}

export function currentWeeklyPeriod(now: Date): string {
  return weeklyPeriodKey(now)
}

export function metricDelta(metric: ChallengeMetric, activity: ActivityDelta): number {
  switch (metric) {
    case 'shows_played':
      return activity.showsPlayed
    case 'rounds_qualified':
      return activity.roundsQualified
    case 'races_finished':
      return activity.racesFinished
    case 'finals_reached':
      return activity.finalsReached
    case 'emotes_lobby':
      return activity.emotesLobby
    case 'team_rounds':
      return activity.teamRounds
    default:
      return 0
  }
}

const BANNED_METRICS = ['wins', 'win', 'grabs', 'grab', 'knockdowns', 'knock']

export function challengeMetricAllowed(metric: string): boolean {
  return !BANNED_METRICS.includes(metric)
}
