import {
  AUDIO,
  VOLUME,
  audioDef,
  dbToGain,
  sliderGain,
  sliderRamp,
  stepDuck,
  type AudioBus,
  type AudioEventDef,
  type AudioEventId,
} from '@wobblebeans/shared'
import { distanceBetween, distanceGain, ringAngle, type CueView, type ListenerPose, type VisualCue } from './cues'
import { buildBusGraph, type BusGraph } from './graph'
import { fireHaptic, resolveHaptic, type HapticMode, type HapticPulse } from './haptics'
import type { AudioHost, AudioNodeLike } from './host'
import {
  commitLayers,
  defaultMusicRequest,
  emptyLayers,
  resolveMusic,
  scheduleBed,
  barIndex,
  type MusicLayers,
  type MusicPlan,
  type MusicRequest,
} from './music-plan'
import { recipeFor, recipeLength, type Recipe } from './recipes'
import { loadSettings, saveSettings, type AudioSettings, type KeyValueStore, type SoundRingMode } from './settings'
import { startRecipe } from './synth'
import { VoiceAllocator } from './voices'

export interface PlayOptions {
  self?: boolean
  x?: number
  y?: number
  z?: number
  playerId?: number
  variation?: number
}

export type DropReason = 'throttle' | 'blocked' | 'muted' | 'voices' | 'far' | 'bed'

export interface Played {
  id: AudioEventId
  bus: AudioBus
  dropped: boolean
  reason?: DropReason
  spatial: boolean
  visual: VisualCue | null
  haptic: HapticPulse | null
}

export interface EngineSnapshot {
  voiced: AudioEventId[]
  music: MusicStateIdName
  bed: AudioEventId
  bpm: number
  intensity: 1 | 2 | 3
  layers: MusicLayers
  cues: VisualCue[]
  haptics: HapticPulse[]
  master: number
  musicGain: number
  sfxGain: number
  uiGain: number
  duckDb: number
  socialDuckDb: number
  voices: number
  headphones: boolean
  fade: number
  ring: boolean
  silentNotes: number
}

type MusicStateIdName = MusicPlan['state']

interface LiveVoice {
  id: AudioEventId
  until: number
  ducksMusic: boolean
  ducksSocial: boolean
  stop: () => void
}

interface Ramp {
  from: number
  to: number
  elapsed: number
}

export interface EngineOptions {
  store?: KeyValueStore | null
  host?: AudioHost | null
  handheld?: boolean
  now?: () => number
  /** First-run fade. Tests that are not about the fade pass false. */
  fadeIn?: boolean
  hapticSink?: (pulse: HapticPulse) => void
}

/**
 * Web Audio bus for Wobblebeans.
 * Master is limited at −1 dBTP and high-passed at 30 Hz.
 * Music, SFX, and UI have their own sliders. Stingers and gameplay UI duck the
 * bed. Obstacle tells duck social sounds. Gameplay cues still emit when muted.
 */
export class AudioEngine {
  private readonly store: KeyValueStore | null
  private readonly now: () => number
  private readonly fadeEnabled: boolean
  private readonly hapticSink: (pulse: HapticPulse) => void
  private settings: AudioSettings
  private request: MusicRequest = defaultMusicRequest()
  private plan: MusicPlan
  private layers: MusicLayers = emptyLayers()
  private voices = new VoiceAllocator()
  private live = new Map<number, LiveVoice>()
  private cues: VisualCue[] = []
  private blocked = new Set<number>()
  private lastAt = new Map<AudioEventId, number>()
  private voiced: AudioEventId[] = []
  private haptics: HapticPulse[] = []
  private listener: ListenerPose | null = null
  private ctx: AudioHost | null = null
  private graph: BusGraph | null = null
  private clockWritable = false
  private time = 0
  private origin = 0
  private cursor = 0
  private transportReady = false
  private lastChangeBar = -2
  private appliedBar = -1
  private stingerKey = ''
  private ambienceId: AudioEventId | null = null
  private duck = 0
  private duckTarget = 0
  private duckFresh = false
  private socialDuck = 0
  private socialTarget = 0
  private socialFresh = false
  private fade = 1
  private fadingIn = false
  private heard = false
  private audible = 1
  private restoring = false
  private background = false
  private controllerMuted = false
  private sawGamepad = false
  private view: CueView | null = null
  private applied = { master: 0, music: 0, sfx: 0, ui: 0 }
  private ramps: Record<'master' | 'music' | 'sfx' | 'ui', Ramp>
  silentNotes = 0

  constructor(opts: EngineOptions = {}) {
    this.store = opts.store === undefined ? null : opts.store
    this.now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
    this.fadeEnabled = opts.fadeIn ?? true
    this.hapticSink = opts.hapticSink ?? ((pulse) => fireHaptic(pulse))
    this.settings = loadSettings(this.store, opts.handheld ?? false)
    if (this.fadeEnabled) this.fade = 0
    this.applied = {
      master: sliderGain(this.cappedMaster()),
      music: sliderGain(this.settings.music),
      sfx: sliderGain(this.settings.sfx),
      ui: sliderGain(this.settings.ui),
    }
    this.ramps = {
      master: done(this.applied.master),
      music: done(this.applied.music),
      sfx: done(this.applied.sfx),
      ui: done(this.applied.ui),
    }
    this.plan = resolveMusic(this.request, null)
    this.layers = { ...this.plan.layers }
    this.lastChangeBar = 0
    if (opts.host) this.useHost(opts.host)
  }

  getSettings(): AudioSettings {
    return { ...this.settings, parentMax: this.settings.parentMax }
  }

  musicState(): MusicPlan['state'] {
    return this.plan.state
  }

  planNow(): MusicPlan {
    return this.plan
  }

  activeCues(): VisualCue[] {
    return this.cues.filter((cue) => cue.until > this.now())
  }

  attachView(view: CueView): void {
    this.view = view
  }

  resume(): void {
    this.ensureContext()
    void this.ctx?.resume?.()
    this.controllerMuted = false
    if (!this.heard) {
      this.heard = true
      if (this.fadeEnabled) {
        this.fade = 0
        this.fadingIn = true
      } else {
        this.fade = 1
      }
    } else if (!this.background) {
      this.restoring = true
    }
  }

  setBackground(hidden: boolean): void {
    this.background = hidden
    if (hidden) this.audible = 0
    else this.restoring = true
  }

  noteGamepads(count: number): void {
    if (count > 0) this.sawGamepad = true
    if (this.sawGamepad && count === 0) {
      this.controllerMuted = true
      this.audible = 0
    }
  }

  setListener(pose: ListenerPose): void {
    this.listener = pose
  }

  block(playerId: number): void {
    this.blocked.add(playerId)
  }

  unblock(playerId: number): void {
    this.blocked.delete(playerId)
  }

  setShow(partial: Partial<MusicRequest>): MusicPlan {
    this.request = { ...this.request, ...partial }
    const next = resolveMusic(this.request, this.plan)
    const stateChanged = next.state !== this.plan.state || next.bed !== this.plan.bed
    this.plan = next
    if (stateChanged && next.hardCut) {
      const commit = commitLayers(this.layers, next.layers, 0, -2, true)
      this.layers = commit.layers
      this.lastChangeBar = commit.lastChangeBar
      this.transportReady = false
    }
    if (this.ambienceId !== next.ambience) {
      if (this.ambienceId) this.stop(this.ambienceId)
      this.ambienceId = next.ambience
      if (next.ambience) this.play(next.ambience)
    }
    const key = `${next.state}:${this.request.roundType}:${next.stinger ?? ''}`
    if (next.stinger && key !== this.stingerKey) {
      this.stingerKey = key
      this.play(next.stinger, { self: true })
    }
    this.refreshDuck(0)
    return this.plan
  }

  play(id: AudioEventId, opts: PlayOptions = {}): Played {
    const def = audioDef(id)
    const spatial = ((opts.self ? def.ownSpatial : def.spatial) === '3d') && opts.x !== undefined
    if (def.group === 'music') return this.finish(def, true, 'bed', spatial, null, null)
    if (def.social && !opts.self && opts.playerId !== undefined && this.blocked.has(opts.playerId)) {
      return this.finish(def, true, 'blocked', spatial, null, null)
    }
    if (def.throttleSec > 0) {
      const last = this.lastAt.get(id) ?? Number.NEGATIVE_INFINITY
      if (this.now() - last < def.throttleSec * 1000) return this.finish(def, true, 'throttle', spatial, null, null)
      this.lastAt.set(id, this.now())
    }
    let distance = 0
    if (spatial && this.listener) {
      distance = distanceBetween(this.listener, { x: opts.x ?? 0, y: opts.y ?? 0, z: opts.z ?? 0 })
      if (distance > VOLUME.ringMeters) return this.finish(def, true, 'far', spatial, null, null)
    }
    const visual = this.pushCue(def, opts, spatial)
    const haptic = resolveHaptic(def.haptic, this.hapticMode(), this.settings.motionComfort)
    if (haptic) {
      this.haptics.push(haptic)
      this.hapticSink(haptic)
    }
    if (this.busMuted(def)) return this.finish(def, true, 'muted', spatial, visual, haptic)
    const recipe = recipeFor(id)
    if (!recipe) return this.finish(def, true, 'bed', spatial, visual, haptic)

    if (spatial && distance >= def.rolloffMax && this.listener) return this.finish(def, true, 'far', spatial, visual, haptic)

    const priority = def.priority + (opts.self && def.group !== 'footstep' ? 40 : 0)
    const slot = this.voices.request({
      group: def.group,
      priority,
      distance,
      obstacleId: def.group === 'obstacle' ? def.id : null,
      music: false,
      now: this.now(),
    })
    if (!slot.ok) return this.finish(def, true, 'voices', spatial, visual, haptic)
    if (slot.stole) this.silence(slot.stole)

    const own = opts.self && (def.group === 'character' || def.group === 'footstep') ? dbToGain(VOLUME.ownBeanDb) : 1
    const usePanner = spatial && !this.settings.mono && this.ctx !== null
    const distScale = usePanner ? 1 : spatial ? distanceGain(distance, def.rolloffMin, def.rolloffMax) : 1
    const when = this.clock()
    const playing = this.start(def, recipe, when, own * distScale, opts.variation ?? 0, usePanner, opts)
    const until = def.loop ? Number.POSITIVE_INFINITY : when + recipeLength(recipe) + 0.08
    this.live.set(slot.token, {
      id,
      until,
      ducksMusic: def.stinger || def.bus === 'ui_gameplay',
      ducksSocial: def.telegraph,
      stop: playing,
    })
    this.voiced.push(id)
    if (this.voiced.length > 80) this.voiced.shift()
    this.refreshDuck(0)
    return this.finish(def, false, undefined, spatial, visual, haptic)
  }

  stop(id: AudioEventId): void {
    for (const [token, live] of this.live) {
      if (live.id !== id) continue
      live.stop()
      this.voices.release(token)
      this.live.delete(token)
    }
    this.refreshDuck(0)
  }

  update(dt: number): void {
    const step = Math.max(0, dt)
    this.time += step
    if (this.ctx && this.clockWritable) {
      try {
        this.ctx.currentTime = this.time
      } catch {
        this.clockWritable = false
      }
    }
    this.advanceRamps(step)
    this.advanceFade(step)
    this.refreshDuck(step)
    this.expire(this.clock())
    this.advanceMusic()
    this.applyGraph()
    this.cues = this.cues.filter((cue) => cue.until > this.now())
    this.view?.render(this.activeCues(), this.ringEnabled(), this.reduceMotion())
  }

  setMaster(value: number): Played | null {
    return this.setSlider('master', value)
  }

  setMusic(value: number): Played | null {
    return this.setSlider('music', value)
  }

  setSfx(value: number): Played | null {
    return this.setSlider('sfx', value)
  }

  setUi(value: number): Played | null {
    return this.setSlider('ui', value)
  }

  setMusicMuted(muted: boolean): void {
    this.settings.musicMuted = muted
    this.persist()
    this.applyGraph()
  }

  setSfxMuted(muted: boolean): void {
    this.settings.sfxMuted = muted
    this.persist()
    this.applyGraph()
  }

  setHeadphones(on: boolean): void {
    this.settings.headphones = on
    this.persist()
    this.applyGraph()
  }

  setMono(on: boolean): void {
    this.settings.mono = on
    this.persist()
  }

  setBalance(value: number): void {
    this.settings.balance = Math.max(-1, Math.min(1, value))
    this.persist()
    this.applyGraph()
  }

  setHaptics(mode: HapticMode): void {
    this.settings.haptics = mode
    this.persist()
  }

  setMotionComfort(on: boolean): void {
    this.settings.motionComfort = on
    this.persist()
  }

  setSoundRing(mode: SoundRingMode): void {
    this.settings.soundRing = mode
    this.persist()
  }

  setSoundIcons(on: boolean): void {
    this.settings.soundIcons = on
    this.persist()
  }

  setParentMax(value: number | null): void {
    this.settings.parentMax = value === null ? null : Math.max(0, Math.min(100, value))
    this.retarget('master', sliderGain(this.cappedMaster()))
    this.persist()
  }

  snapshot(): EngineSnapshot {
    return {
      voiced: [...this.voiced],
      music: this.plan.state,
      bed: this.plan.bed,
      bpm: this.plan.bpm,
      intensity: this.plan.intensity,
      layers: { ...this.layers },
      cues: this.activeCues(),
      haptics: [...this.haptics],
      master: this.masterLinear(),
      musicGain: this.settings.musicMuted ? 0 : this.applied.music,
      sfxGain: this.settings.sfxMuted ? 0 : this.applied.sfx,
      uiGain: this.applied.ui,
      duckDb: this.duck,
      socialDuckDb: this.socialDuck,
      voices: this.voices.count(),
      headphones: this.settings.headphones,
      fade: this.fade,
      ring: this.ringEnabled(),
      silentNotes: this.silentNotes,
    }
  }

  private setSlider(key: 'master' | 'music' | 'sfx' | 'ui', value: number): Played | null {
    const next = Math.max(0, Math.min(100, value))
    if (this.settings[key] === next) return null
    this.settings[key] = next
    const target = key === 'master' ? sliderGain(this.cappedMaster()) : sliderGain(next)
    this.retarget(key, target)
    this.persist()
    return this.play(AUDIO.uiSlider)
  }

  private retarget(key: 'master' | 'music' | 'sfx' | 'ui', target: number): void {
    this.ramps[key] = { from: this.applied[key], to: target, elapsed: 0 }
  }

  private advanceRamps(dt: number): void {
    for (const key of ['master', 'music', 'sfx', 'ui'] as const) {
      const ramp = this.ramps[key]
      ramp.elapsed += dt
      this.applied[key] = sliderRamp(ramp.from, ramp.to, ramp.elapsed)
    }
  }

  private advanceFade(dt: number): void {
    if (this.background || this.controllerMuted) this.audible = 0
    else if (this.restoring) {
      this.audible = Math.min(1, this.audible + dt / VOLUME.restoreSec)
      if (this.audible >= 1) this.restoring = false
    }
    if (this.fadingIn) {
      this.fade = Math.min(1, this.fade + dt / VOLUME.fadeInSec)
      if (this.fade >= 1) this.fadingIn = false
    }
  }

  private refreshDuck(dt: number): void {
    const sidechain = [...this.live.values()].some((live) => live.ducksMusic)
    const target = this.plan.duckDb + (sidechain ? VOLUME.musicDuckDb : 0)
    if (Math.abs(target - this.duckTarget) > 0.001) {
      this.duckTarget = target
      this.duckFresh = true
    }
    const next = stepDuck(this.duck, this.duckTarget, dt, this.duckFresh)
    this.duck = next.value
    this.duckFresh = next.fresh

    const social = [...this.live.values()].some((live) => live.ducksSocial) ? VOLUME.socialDuckDb : 0
    if (Math.abs(social - this.socialTarget) > 0.001) {
      this.socialTarget = social
      this.socialFresh = true
    }
    const socialNext = stepDuck(this.socialDuck, this.socialTarget, dt, this.socialFresh)
    this.socialDuck = socialNext.value
    this.socialFresh = socialNext.fresh
    this.applyGraph()
  }

  private advanceMusic(): void {
    if (!this.plan.bedAudible) return
    const now = this.clock()
    if (!this.transportReady) {
      this.origin = now
      this.cursor = now
      this.transportReady = true
      this.appliedBar = -1
    }
    const elapsed = now - this.origin
    const bar = barIndex(elapsed, this.plan.bpm)
    if (bar !== this.appliedBar) {
      const commit = commitLayers(this.layers, this.plan.layers, bar, this.lastChangeBar, false)
      this.layers = commit.layers
      this.lastChangeBar = commit.lastChangeBar
      this.appliedBar = bar
    }
    const horizon = now + 0.2
    if (this.cursor < now - 0.05) this.cursor = now
    const notes = scheduleBed(this.plan, this.layers, this.cursor, horizon, this.origin)
    this.cursor = horizon
    for (const note of notes) this.voiceNote(note)
  }

  private voiceNote(note: { freq: number; dur: number; gain: number; noise: boolean; at: number }): void {
    const slot = this.voices.request({
      group: 'music',
      priority: 5,
      distance: 0,
      obstacleId: null,
      music: true,
      now: this.now(),
    })
    if (!slot.ok) return
    if (slot.stole) this.silence(slot.stole)
    const recipe: Recipe = {
      loop: false,
      tones: [
        {
          wave: note.noise ? 'noise' : 'triangle',
          freq: note.noise ? 900 : Math.max(80, note.freq),
          at: 0,
          dur: Math.max(0.04, note.dur),
          gain: note.gain,
          attack: 0.01,
          release: Math.min(0.06, note.dur * 0.35),
          filter: note.noise ? 'highpass' : undefined,
          filterHz: note.noise ? 180 : undefined,
        },
      ],
    }
    const stop = this.ctx && this.graph ? startRecipe(this.ctx, this.graph.bed, recipe, note.at, 1, 0).stop : () => {}
    if (!this.ctx) this.silentNotes += 1
    this.live.set(slot.token, {
      id: this.plan.bed,
      until: note.at + note.dur + 0.05,
      ducksMusic: false,
      ducksSocial: false,
      stop,
    })
  }

  private start(
    def: AudioEventDef,
    recipe: Recipe,
    when: number,
    scale: number,
    variation: number,
    usePanner: boolean,
    opts: PlayOptions,
  ): () => void {
    if (!this.ctx || !this.graph) {
      this.silentNotes += 1
      return () => {}
    }
    let dest: AudioNodeLike = this.busNode(def)
    let panner: AudioNodeLike | null = null
    if (usePanner) {
      const node = this.ctx.createPanner()
      node.panningModel = 'equalpower'
      node.distanceModel = 'linear'
      node.refDistance = def.rolloffMin
      node.maxDistance = def.rolloffMax
      node.rolloffFactor = 1
      node.positionX.value = opts.x ?? 0
      node.positionY.value = opts.y ?? 0
      node.positionZ.value = opts.z ?? 0
      node.connect(dest)
      panner = node
      dest = node
    }
    const playing = startRecipe(this.ctx, dest, recipe, when, scale, variation)
    return () => {
      playing.stop()
      panner?.disconnect?.()
    }
  }

  private busNode(def: AudioEventDef): AudioNodeLike {
    const graph = this.graph
    if (!graph) throw new Error('audio graph missing')
    if (def.bus === 'music') return def.stinger ? graph.stinger : graph.bed
    if (def.bus === 'sfx_char') return graph.char
    if (def.bus === 'sfx_obstacle') return graph.obstacle
    if (def.bus === 'sfx_social') return graph.social
    if (def.bus === 'ambience') return graph.ambience
    if (def.bus === 'ui_gameplay') return graph.uiGameplay
    return graph.uiMenu
  }

  private busMuted(def: AudioEventDef): boolean {
    if (this.settings.master <= 0) return true
    if (this.settings.parentMax !== null && this.settings.parentMax <= 0) return true
    if (this.background || this.controllerMuted) return true
    if (def.bus === 'music') return this.settings.musicMuted || this.settings.music <= 0
    if (def.bus === 'ui_menu' || def.bus === 'ui_gameplay') return this.settings.ui <= 0
    return this.settings.sfxMuted || this.settings.sfx <= 0
  }

  private pushCue(def: AudioEventDef, opts: PlayOptions, spatial: boolean): VisualCue | null {
    if (!def.visualCueId) return null
    const icon = this.settings.soundIcons && def.social
    if (!def.gameplayRelevant && !icon) return null
    const source = opts.x === undefined ? null : { x: opts.x, y: opts.y ?? 0, z: opts.z ?? 0 }
    const edge = spatial && def.gameplayRelevant ? ringAngle(this.listener, source, VOLUME.ringMeters) : null
    const cue: VisualCue = {
      cueId: def.visualCueId,
      eventId: def.id as AudioEventId,
      label: def.visualLabel,
      shape: def.cueShape,
      edgeAngle: edge,
      until: this.now() + cueLife(def),
      pulseHz: this.reduceMotion() ? 0 : VOLUME.cuePulseHz,
    }
    this.cues.push(cue)
    if (this.cues.length > 8) this.cues.shift()
    return cue
  }

  private expire(now: number): void {
    for (const [token, live] of this.live) {
      if (live.until > now) continue
      live.stop()
      this.voices.release(token)
      this.live.delete(token)
    }
  }

  private silence(token: number): void {
    const live = this.live.get(token)
    if (!live) return
    live.stop()
    this.live.delete(token)
  }

  private ringEnabled(): boolean {
    if (this.settings.soundRing === 'on') return true
    if (this.settings.soundRing === 'off') return false
    return this.settings.master <= 0 || this.settings.sfx <= 0 || this.settings.sfxMuted
  }

  private hapticMode(): HapticMode {
    return this.settings.haptics
  }

  private reduceMotion(): boolean {
    if (this.settings.motionComfort) return true
    if (typeof matchMedia !== 'function') return false
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private cappedMaster(): number {
    if (this.settings.parentMax === null) return this.settings.master
    return Math.min(this.settings.master, this.settings.parentMax)
  }

  private masterLinear(): number {
    const phones = this.settings.headphones ? dbToGain(VOLUME.headphonesTrimDb) : 1
    const trim = dbToGain(VOLUME.programmeTrimDb)
    return this.applied.master * phones * trim * this.fade * this.audible
  }

  private applyGraph(): void {
    if (!this.graph) return
    this.graph.master.gain.value = this.masterLinear()
    this.graph.music.gain.value = this.settings.musicMuted ? 0 : this.applied.music
    this.graph.bedDuck.gain.value = dbToGain(this.duck)
    this.graph.socialDuck.gain.value = dbToGain(this.socialDuck)
    this.graph.sfx.gain.value = this.settings.sfxMuted ? 0 : this.applied.sfx
    this.graph.ui.gain.value = this.applied.ui
    this.graph.lowpass.frequency.value = this.plan.lowpassHz
    this.graph.balance.pan.value = this.settings.mono ? 0 : this.settings.balance
    if (this.ctx && this.listener) {
      const ear = this.ctx.listener
      ear.positionX.value = this.listener.x
      ear.positionY.value = this.listener.y
      ear.positionZ.value = this.listener.z
      ear.forwardX.value = this.listener.fx
      ear.forwardY.value = this.listener.fy
      ear.forwardZ.value = this.listener.fz
    }
  }

  private clock(): number {
    if (this.ctx && !this.clockWritable) return this.ctx.currentTime
    return this.time
  }

  private ensureContext(): void {
    if (this.ctx) return
    if (typeof AudioContext === 'undefined') return
    this.useHost(new AudioContext() as unknown as AudioHost)
  }

  private useHost(host: AudioHost): void {
    for (const [token, live] of this.live) {
      live.stop()
      this.voices.release(token)
    }
    this.live.clear()
    this.ctx = host
    this.graph = buildBusGraph(host)
    this.clockWritable = clockIsWritable(host)
    this.transportReady = false
    const ambience = this.ambienceId
    this.ambienceId = null
    this.applyGraph()
    if (ambience) {
      this.ambienceId = ambience
      this.play(ambience)
    }
  }

  private persist(): void {
    saveSettings(this.store, this.settings)
  }

  private finish(
    def: AudioEventDef,
    dropped: boolean,
    reason: DropReason | undefined,
    spatial: boolean,
    visual: VisualCue | null,
    haptic: HapticPulse | null,
  ): Played {
    const played: Played = {
      id: def.id as AudioEventId,
      bus: def.bus,
      dropped,
      spatial,
      visual,
      haptic,
    }
    if (reason) played.reason = reason
    return played
  }
}

function done(value: number): Ramp {
  return { from: value, to: value, elapsed: VOLUME.sliderResponseSec }
}

function cueLife(def: AudioEventDef): number {
  if (def.cueShape === 'shimmer') return 1000
  if (def.cueShape === 'vignette') return 1200
  if (def.stinger) return 3000
  if (def.group === 'ui') return 900
  return 700
}

function clockIsWritable(ctx: AudioHost): boolean {
  let obj: object | null = ctx
  while (obj) {
    const desc = Object.getOwnPropertyDescriptor(obj, 'currentTime')
    if (desc) return Boolean(desc.writable) || Boolean(desc.set)
    obj = Object.getPrototypeOf(obj) as object | null
  }
  return false
}

