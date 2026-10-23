import type { AudioBufferLike, AudioHost, AudioNodeLike } from './host'
import { paramAt, rampTo } from './host'
import type { Recipe, Tone } from './recipes'

export interface Playing {
  stop: () => void
}

let noiseBuffer: AudioBufferLike | null = null
let noiseHost: AudioHost | null = null

/** Start a recipe at `when` (context time). `gainScale` is distance, own-bean trim, and variation level. */
export function startRecipe(
  ctx: AudioHost,
  destination: AudioNodeLike,
  recipe: Recipe,
  when: number,
  gainScale: number,
  variation: number,
): Playing {
  const chosen = recipe.alts ? recipe.alts[Math.abs(variation) % recipe.alts.length]! : recipe.tones
  const shift = recipe.alts ? 1 : 1 + ((Math.abs(variation) % 7) - 3) * 0.018
  const stops: Array<() => void> = []
  for (const src of chosen) {
    const tone: Tone = {
      ...src,
      freq: src.freq * shift,
      freqEnd: src.freqEnd === undefined ? undefined : src.freqEnd * shift,
    }
    stops.push(startTone(ctx, destination, tone, when, gainScale, recipe.loop))
  }
  return {
    stop: () => {
      for (const stop of stops) stop()
    },
  }
}

function startTone(
  ctx: AudioHost,
  destination: AudioNodeLike,
  tone: Tone,
  when: number,
  gainScale: number,
  loop: boolean,
): () => void {
  const gain = ctx.createGain()
  const peak = Math.max(0.0001, tone.gain * gainScale)
  const start = when + tone.at
  const end = start + tone.dur
  gain.gain.value = 0
  paramAt(gain.gain, 0.0001, start)
  rampTo(gain.gain, peak, start + tone.attack)
  let tail: AudioNodeLike = gain
  if (tone.filter && tone.filterHz) {
    const filter = ctx.createBiquadFilter()
    filter.type = tone.filter
    filter.frequency.value = tone.filterHz
    filter.Q.value = tone.filterQ ?? 0.7
    gain.connect(filter)
    tail = filter
  }
  tail.connect(destination)

  let rawStop: (at: number) => void = () => {}
  if (tone.wave === 'noise') {
    const source = ctx.createBufferSource()
    source.buffer = sharedNoise(ctx)
    source.loop = loop
    source.connect(gain)
    source.start(start)
    rawStop = (at) => source.stop(at)
  } else {
    const osc = ctx.createOscillator()
    osc.type = tone.wave
    paramAt(osc.frequency, Math.max(40, tone.freq), start)
    if (tone.freqEnd !== undefined && osc.frequency.linearRampToValueAtTime) {
      osc.frequency.linearRampToValueAtTime(Math.max(40, tone.freqEnd), end)
    }
    osc.connect(gain)
    osc.start(start)
    rawStop = (at) => osc.stop(at)
  }

  let halted = false
  const halt = (at: number) => {
    if (halted) return
    halted = true
    rawStop(at)
  }

  if (!loop) {
    const releaseAt = Math.max(start + tone.attack, end - tone.release)
    paramAt(gain.gain, peak, releaseAt)
    rampTo(gain.gain, 0.0001, end)
    halt(end + 0.02)
  }

  return () => {
    const now = ctx.currentTime
    rampTo(gain.gain, 0.0001, now + 0.04)
    halt(now + 0.05)
    gain.disconnect?.()
  }
}

function sharedNoise(ctx: AudioHost): AudioBufferLike {
  if (noiseBuffer && noiseHost === ctx) return noiseBuffer
  const length = Math.max(1, Math.floor(ctx.sampleRate))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let state = 0x6d2b79f5
  for (let i = 0; i < data.length; i++) {
    state = Math.imul(state ^ (state >>> 15), 1 | state)
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state)
    const unit = ((state ^ (state >>> 14)) >>> 0) / 4294967296
    data[i] = unit * 2 - 1
  }
  noiseBuffer = buffer
  noiseHost = ctx
  return buffer
}
