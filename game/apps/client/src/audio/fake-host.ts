import type {
  AudioBufferLike,
  AudioHost,
  AudioNodeLike,
  AudioParamLike,
  BufferSourceLike,
  CompressorLike,
  FilterLike,
  GainLike,
  OscillatorLike,
  PannerLike,
  StereoPannerLike,
} from './host'

/** A node the tests can inspect. The browser graph uses the real Web Audio nodes. */
export interface FakeNode extends AudioNodeLike {
  dests: AudioNodeLike[]
}

export interface FakeAudio {
  host: AudioHost
  starts: () => number
}

/**
 * In-memory Web Audio host. Oscillators and buffer sources count as started
 * so a test can tell that a recipe actually reached the graph.
 */
export function createFakeHost(): FakeAudio {
  let starts = 0
  const host: AudioHost = {
    currentTime: 0,
    sampleRate: 48_000,
    destination: node(),
    listener: {
      positionX: param(),
      positionY: param(),
      positionZ: param(),
      forwardX: param(),
      forwardY: param(),
      forwardZ: param(),
    },
    createGain(): GainLike {
      return Object.assign(node(), { gain: param() })
    },
    createOscillator(): OscillatorLike {
      return Object.assign(node(), {
        type: 'sine' as OscillatorType,
        frequency: param(),
        start() {
          starts += 1
        },
        stop() {},
      })
    },
    createBiquadFilter(): FilterLike {
      return Object.assign(node(), {
        type: 'lowpass' as BiquadFilterType,
        frequency: param(),
        Q: param(),
      })
    },
    createDynamicsCompressor(): CompressorLike {
      return Object.assign(node(), {
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
      })
    },
    createStereoPanner(): StereoPannerLike {
      return Object.assign(node(), { pan: param() })
    },
    createPanner(): PannerLike {
      return Object.assign(node(), {
        panningModel: 'equalpower' as PanningModelType,
        distanceModel: 'linear' as DistanceModelType,
        refDistance: 1,
        maxDistance: 10_000,
        rolloffFactor: 1,
        positionX: param(),
        positionY: param(),
        positionZ: param(),
      })
    },
    createBuffer(_channels: number, length: number): AudioBufferLike {
      const data = new Float32Array(length)
      return {
        length,
        getChannelData() {
          return data
        },
      }
    },
    createBufferSource(): BufferSourceLike {
      return Object.assign(node(), {
        buffer: null,
        loop: false,
        start() {
          starts += 1
        },
        stop() {},
      })
    },
  }
  return { host, starts: () => starts }
}

function param(): AudioParamLike {
  return {
    value: 0,
    setValueAtTime(value: number) {
      this.value = value
    },
    linearRampToValueAtTime(value: number) {
      this.value = value
    },
    exponentialRampToValueAtTime(value: number) {
      this.value = value
    },
    setTargetAtTime(value: number) {
      this.value = value
    },
  }
}

function node(): FakeNode {
  const self: FakeNode = {
    dests: [],
    connect(dest: AudioNodeLike) {
      self.dests.push(dest)
      return dest
    },
    disconnect() {
      self.dests = []
    },
  }
  return self
}
