/**
 * The slice of Web Audio the bus actually touches.
 * Tests pass a fake. The browser passes AudioContext, which has these methods.
 */

export interface AudioParamLike {
  value: number
  setValueAtTime?(value: number, time: number): void
  linearRampToValueAtTime?(value: number, time: number): void
  exponentialRampToValueAtTime?(value: number, time: number): void
  setTargetAtTime?(value: number, time: number, timeConstant: number): void
}

export interface AudioNodeLike {
  connect(dest: AudioNodeLike): AudioNodeLike
  disconnect?(): void
}

export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike
}

export interface OscillatorLike extends AudioNodeLike {
  type: OscillatorType
  frequency: AudioParamLike
  start(when?: number): void
  stop(when?: number): void
}

export interface FilterLike extends AudioNodeLike {
  type: BiquadFilterType
  frequency: AudioParamLike
  Q: AudioParamLike
}

export interface CompressorLike extends AudioNodeLike {
  threshold: AudioParamLike
  knee: AudioParamLike
  ratio: AudioParamLike
  attack: AudioParamLike
  release: AudioParamLike
}

export interface StereoPannerLike extends AudioNodeLike {
  pan: AudioParamLike
}

export interface PannerLike extends AudioNodeLike {
  panningModel: PanningModelType
  distanceModel: DistanceModelType
  refDistance: number
  maxDistance: number
  rolloffFactor: number
  positionX: AudioParamLike
  positionY: AudioParamLike
  positionZ: AudioParamLike
}

export interface AudioBufferLike {
  getChannelData(channel: number): Float32Array
  length: number
}

export interface BufferSourceLike extends AudioNodeLike {
  buffer: AudioBufferLike | null
  loop: boolean
  start(when?: number): void
  stop(when?: number): void
}

export interface ListenerLike {
  positionX: AudioParamLike
  positionY: AudioParamLike
  positionZ: AudioParamLike
  forwardX: AudioParamLike
  forwardY: AudioParamLike
  forwardZ: AudioParamLike
}

export interface AudioHost {
  currentTime: number
  sampleRate: number
  destination: AudioNodeLike
  listener: ListenerLike
  state?: string
  resume?(): Promise<void> | void
  createGain(): GainLike
  createOscillator(): OscillatorLike
  createBiquadFilter(): FilterLike
  createDynamicsCompressor(): CompressorLike
  createStereoPanner(): StereoPannerLike
  createPanner(): PannerLike
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike
  createBufferSource(): BufferSourceLike
}

export function paramAt(param: AudioParamLike, value: number, time: number): void {
  if (param.setValueAtTime) param.setValueAtTime(value, time)
  else param.value = value
}

export function rampTo(param: AudioParamLike, value: number, time: number): void {
  if (value > 0 && param.exponentialRampToValueAtTime) param.exponentialRampToValueAtTime(value, time)
  else if (param.linearRampToValueAtTime) param.linearRampToValueAtTime(value, time)
  else param.value = value
}
