import { nameForSlot } from '@wobblebeans/shared'
import type { ServiceHealth } from './health'
import { QUEUE_RULES } from './queue-rules'

export interface PublicProfile {
  playerId: string
  generatedNameId: number
  locale: string
  upperId: string
  lowerId: string
  colourId: string
  patternId: string
  faceId: string
  emoteIds?: number[]
  celebrationId?: string
  bannerId?: string
  titleId?: string
  /** Private by default. Presence is not part of this record. */
  settingsPrivate?: boolean
}

const LOCALE = /^[a-z]{2}(-[A-Z]{2})?$/
const PRESET = /^[a-z0-9-]{1,40}$/

export function starterProfile(playerId: string, locale = 'en-GB'): PublicProfile {
  const name = nameForSlot(playerId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0))
  return {
    playerId,
    generatedNameId: name.adj * 100 + name.noun,
    locale: LOCALE.test(locale) ? locale : 'en-GB',
    upperId: 'top-basic',
    lowerId: 'legs-basic',
    colourId: 'berry',
    patternId: 'solid',
    faceId: 'smile',
    emoteIds: [1, 2, 3, 4],
    celebrationId: 'jump',
    bannerId: 'starter',
    titleId: 'starter',
    settingsPrivate: true,
  }
}

export class ProfileService {
  readonly name = 'profile'
  private readonly profiles = new Map<string, PublicProfile>()
  private readonly rerolls = new Map<string, number[]>()
  private live = false

  ready(): ServiceHealth {
    return { name: this.name, ready: this.live }
  }

  markLive(live = true): void {
    this.live = live
  }

  put(profile: PublicProfile): void {
    this.profiles.set(profile.playerId, sanitize(profile))
  }

  get(playerId: string): PublicProfile | undefined {
    const row = this.profiles.get(playerId)
    return row ? { ...row, emoteIds: row.emoteIds ? [...row.emoteIds] : undefined } : undefined
  }

  ensure(playerId: string, locale?: string): PublicProfile {
    const existing = this.get(playerId)
    if (existing) return existing
    const created = starterProfile(playerId, locale)
    this.put(created)
    return created
  }

  updateLoadout(playerId: string, patch: Partial<Omit<PublicProfile, 'playerId' | 'locale' | 'generatedNameId'>>): PublicProfile {
    const current = this.ensure(playerId)
    const next = sanitize({
      ...current,
      ...defined(patch),
      playerId,
      generatedNameId: current.generatedNameId,
      locale: current.locale,
    })
    this.profiles.set(playerId, next)
    return { ...next, emoteIds: next.emoteIds ? [...next.emoteIds] : undefined }
  }

  /** New catalogue name. The child does not type one. */
  rerollName(playerId: string, nowMs = Date.now()): { generatedNameId: number; text: string } {
    const day = Math.floor(nowMs / 86_400_000)
    const stamps = (this.rerolls.get(playerId) ?? []).filter((stamp) => Math.floor(stamp / 86_400_000) === day)
    if (stamps.length >= QUEUE_RULES.nameRerollsPerDay) throw new Error('name reroll limit')
    stamps.push(nowMs)
    this.rerolls.set(playerId, stamps)
    const profile = this.ensure(playerId)
    const nextId = (profile.generatedNameId + stamps.length * 17) % 10_000
    profile.generatedNameId = nextId
    this.profiles.set(playerId, profile)
    const named = nameForSlot(nextId)
    return { generatedNameId: nextId, text: named.text }
  }

  nameOptions(seed: number, count = 4): { generatedNameId: number; text: string }[] {
    const options: { generatedNameId: number; text: string }[] = []
    for (let i = 0; i < count; i++) {
      const generatedNameId = Math.abs(seed + i * 13) % 10_000
      options.push({ generatedNameId, text: nameForSlot(generatedNameId).text })
    }
    return options
  }

  erase(playerId: string): void {
    this.profiles.delete(playerId)
    this.rerolls.delete(playerId)
  }

  snapshot(): PublicProfile[] {
    return [...this.profiles.values()].map((row) => ({ ...row }))
  }

  hydrate(rows: readonly PublicProfile[]): void {
    this.profiles.clear()
    for (const row of rows) this.put(row)
  }
}

function defined<T extends object>(patch: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [key, value] of Object.entries(patch) as [keyof T, T[keyof T]][]) {
    if (value !== undefined) out[key] = value
  }
  return out
}

function sanitize(profile: PublicProfile): PublicProfile {
  const locale = LOCALE.test(profile.locale) ? profile.locale : 'en-GB'
  const preset = (value: string, fallback: string) => (PRESET.test(value) ? value : fallback)
  return {
    playerId: profile.playerId,
    generatedNameId: profile.generatedNameId,
    locale,
    upperId: preset(profile.upperId, 'top-basic'),
    lowerId: preset(profile.lowerId, 'legs-basic'),
    colourId: preset(profile.colourId, 'berry'),
    patternId: preset(profile.patternId, 'solid'),
    faceId: preset(profile.faceId, 'smile'),
    emoteIds: (profile.emoteIds ?? [1, 2, 3, 4]).filter((id) => Number.isInteger(id)).slice(0, 4),
    celebrationId: profile.celebrationId ? preset(profile.celebrationId, 'jump') : 'jump',
    bannerId: profile.bannerId ? preset(profile.bannerId, 'starter') : 'starter',
    titleId: profile.titleId ? preset(profile.titleId, 'starter') : 'starter',
    settingsPrivate: profile.settingsPrivate !== false,
  }
}
