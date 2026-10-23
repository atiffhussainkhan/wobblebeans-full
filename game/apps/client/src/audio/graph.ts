import { VOLUME } from '@wobblebeans/shared'
import type { AudioHost, AudioNodeLike, CompressorLike, FilterLike, GainLike, StereoPannerLike } from './host'

export interface BusGraph {
  master: GainLike
  music: GainLike
  bedDuck: GainLike
  lowpass: FilterLike
  bed: GainLike
  stinger: GainLike
  sfx: GainLike
  char: GainLike
  obstacle: GainLike
  socialDuck: GainLike
  social: GainLike
  ambience: GainLike
  ui: GainLike
  uiMenu: GainLike
  uiGameplay: GainLike
  highpass: FilterLike
  limiter: CompressorLike
  balance: StereoPannerLike
}

/**
 * Master limiter at −1 dBTP, high-pass at 30 Hz.
 * Stingers share the music slider and do not pass through the bed duck.
 * Ambience sits under SFX, which is the slider the design gives it.
 */
export function buildBusGraph(ctx: AudioHost): BusGraph {
  const master = ctx.createGain()
  const music = ctx.createGain()
  const bedDuck = ctx.createGain()
  const lowpass = ctx.createBiquadFilter()
  const bed = ctx.createGain()
  const stinger = ctx.createGain()
  const sfx = ctx.createGain()
  const char = ctx.createGain()
  const obstacle = ctx.createGain()
  const socialDuck = ctx.createGain()
  const social = ctx.createGain()
  const ambience = ctx.createGain()
  const ui = ctx.createGain()
  const uiMenu = ctx.createGain()
  const uiGameplay = ctx.createGain()
  const highpass = ctx.createBiquadFilter()
  const limiter = ctx.createDynamicsCompressor()
  const balance = ctx.createStereoPanner()

  lowpass.type = 'lowpass'
  lowpass.frequency.value = VOLUME.lowpassOpenHz
  lowpass.Q.value = 0.7

  highpass.type = 'highpass'
  highpass.frequency.value = VOLUME.highpassHz
  highpass.Q.value = 0.7

  limiter.threshold.value = VOLUME.limiterThresholdDb
  limiter.knee.value = 0
  limiter.ratio.value = VOLUME.limiterRatio
  limiter.attack.value = VOLUME.limiterAttackSec
  limiter.release.value = VOLUME.limiterReleaseSec

  connect(bed, lowpass)
  connect(lowpass, bedDuck)
  connect(bedDuck, music)
  connect(stinger, music)
  connect(char, sfx)
  connect(obstacle, sfx)
  connect(social, socialDuck)
  connect(socialDuck, sfx)
  connect(ambience, sfx)
  connect(uiMenu, ui)
  connect(uiGameplay, ui)
  connect(music, balance)
  connect(sfx, balance)
  connect(ui, balance)
  connect(balance, master)
  connect(master, highpass)
  connect(highpass, limiter)
  connect(limiter, ctx.destination)

  return {
    master,
    music,
    bedDuck,
    lowpass,
    bed,
    stinger,
    sfx,
    char,
    obstacle,
    socialDuck,
    social,
    ambience,
    ui,
    uiMenu,
    uiGameplay,
    highpass,
    limiter,
    balance,
  }
}

function connect(node: AudioNodeLike, dest: AudioNodeLike): void {
  node.connect(dest)
}
