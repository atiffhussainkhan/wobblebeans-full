import { VOLUME } from '@wobblebeans/shared'
import { describe, expect, it } from 'vitest'
import { createFakeHost, type FakeNode } from './fake-host'
import { buildBusGraph } from './graph'
import type { AudioNodeLike } from './host'

function dests(node: AudioNodeLike): AudioNodeLike[] {
  return (node as unknown as FakeNode).dests
}

describe('bus graph', () => {
  it('high-passes at 30 Hz, limits at −1 dBTP, and keeps stingers off the bed duck', () => {
    const { host } = createFakeHost()
    const graph = buildBusGraph(host)
    expect(graph.highpass.frequency.value).toBe(VOLUME.highpassHz)
    expect(graph.limiter.threshold.value).toBe(VOLUME.limiterThresholdDb)
    expect(graph.limiter.ratio.value).toBe(VOLUME.limiterRatio)
    expect(dests(graph.bed)).toContain(graph.lowpass)
    expect(dests(graph.lowpass)).toContain(graph.bedDuck)
    expect(dests(graph.bedDuck)).toContain(graph.music)
    expect(dests(graph.stinger)).toContain(graph.music)
    expect(dests(graph.stinger)).not.toContain(graph.bedDuck)
    expect(dests(graph.social)).toContain(graph.socialDuck)
    expect(dests(graph.ambience)).toContain(graph.sfx)
    expect(dests(graph.highpass)).toContain(graph.limiter)
    expect(dests(graph.limiter)).toContain(host.destination)
  })
})
