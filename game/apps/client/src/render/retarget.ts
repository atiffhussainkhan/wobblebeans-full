import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KAYKIT_PACK, QUATERNIUS_PACK, clipById, type ClipPack } from '@wobblebeans/shared'
import { assetUrl } from '../assets/load'

export interface RigPose {
  pelvis: THREE.Quaternion
  spine: THREE.Quaternion
  head: THREE.Quaternion
  armL: THREE.Quaternion
  armR: THREE.Quaternion
  legL: THREE.Quaternion
  legR: THREE.Quaternion
  legs: boolean
  bob: number
}

interface Track {
  node: string
  path: 'quaternion' | 'position'
  times: Float32Array
  values: Float32Array
}

interface PackedClip {
  duration: number
  tracks: Track[]
}

interface Pack {
  clips: Map<string, PackedClip>
  rest: Map<string, THREE.Quaternion>
  restPos: Map<string, THREE.Vector3>
}

const packs = new Map<ClipPack, Pack>()
let started = false
let ready = false

const loader = new GLTFLoader()

/** Starts the CC0 clip load. Safe to call more than once. */
export function warmupClips(): void {
  if (started) return
  started = true
  void Promise.all([
    loadPack('kaykit', assetUrl(KAYKIT_PACK)),
    loadPack('quaternius', assetUrl(QUATERNIUS_PACK)),
  ])
    .then(() => {
      ready = packs.has('kaykit')
    })
    .catch((err) => {
      console.warn('clip retarget unavailable, using procedural wobble', err)
    })
}

export function clipsReady(): boolean {
  return ready
}

export function sampleSlot(slotId: string, time: number): RigPose | null {
  const slot = clipById(slotId)
  if (!slot || slot.pack === 'procedural') return null
  const pack = packs.get(slot.pack)
  const clip = pack?.clips.get(slot.clip)
  if (!pack || !clip) return null
  const local = phaseTime(slot.phase, slot.loop, time, clip.duration)
  const map = slot.pack === 'quaternius' ? QUAT_MAP : KAY_MAP
  const pose = identityPose(slot.pack === 'quaternius')
  pose.pelvis.copy(deltaQuat(pack, clip, map.pelvis, local))
  if (map.spine) pose.spine.copy(deltaQuat(pack, clip, map.spine, local))
  pose.head.copy(deltaQuat(pack, clip, map.head, local))
  pose.armL.copy(deltaQuat(pack, clip, map.armL, local))
  pose.armR.copy(deltaQuat(pack, clip, map.armR, local))
  if (map.legL && map.legR) {
    pose.legL.copy(deltaQuat(pack, clip, map.legL, local))
    pose.legR.copy(deltaQuat(pack, clip, map.legR, local))
    pose.legs = true
  }
  const bob = deltaBob(pack, clip, map.pelvis, local)
  pose.bob = Math.max(-0.08, Math.min(0.08, bob))
  return pose
}

const KAY_MAP = {
  pelvis: 'Body',
  spine: '',
  head: 'Head',
  armL: 'armLeft',
  armR: 'armRight',
  legL: '',
  legR: '',
}

const QUAT_MAP = {
  pelvis: 'Hips',
  spine: 'Torso',
  head: 'Head',
  armL: 'UpperArm.L',
  armR: 'UpperArm.R',
  legL: 'UpperLeg.L',
  legR: 'UpperLeg.R',
}

async function loadPack(id: ClipPack, url: string): Promise<void> {
  const gltf = await loader.loadAsync(url)
  const clips = new Map<string, PackedClip>()
  for (const clip of gltf.animations) {
    const tracks: Track[] = []
    for (const track of clip.tracks) {
      const split = track.name.lastIndexOf('.')
      if (split < 0) continue
      const path = track.name.slice(split + 1)
      if (path !== 'quaternion' && path !== 'position') continue
      tracks.push({
        node: track.name.slice(0, split),
        path,
        times: track.times as Float32Array,
        values: track.values as Float32Array,
      })
    }
    clips.set(clip.name, { duration: clip.duration || 0, tracks })
  }
  const pack: Pack = { clips, rest: new Map(), restPos: new Map() }
  const idle = clips.get('Idle')
  if (idle) {
    const nodes = new Set(idle.tracks.map((track) => track.node))
    for (const node of nodes) {
      const q = readQuat(idle, node, 0)
      if (q) pack.rest.set(node, q)
      const p = readPos(idle, node, 0)
      if (p) pack.restPos.set(node, p)
    }
  }
  packs.set(id, pack)
}

function phaseTime(
  phase: readonly [number, number] | undefined,
  loop: boolean,
  time: number,
  duration: number,
): number {
  if (!phase) {
    if (duration <= 0) return 0
    if (loop) return time % duration
    return Math.min(time, duration)
  }
  const [a, b] = phase
  const span = Math.max(0.001, b - a)
  if (loop) return a + (time % span)
  return a + Math.min(Math.max(0, time), span)
}

function identityPose(legs: boolean): RigPose {
  return {
    pelvis: new THREE.Quaternion(),
    spine: new THREE.Quaternion(),
    head: new THREE.Quaternion(),
    armL: new THREE.Quaternion(),
    armR: new THREE.Quaternion(),
    legL: new THREE.Quaternion(),
    legR: new THREE.Quaternion(),
    legs,
    bob: 0,
  }
}

function deltaQuat(pack: Pack, clip: PackedClip, node: string, time: number): THREE.Quaternion {
  const anim = readQuat(clip, node, time)
  if (!anim) return new THREE.Quaternion()
  const rest = restQuat(pack, node)
  if (!rest) return anim
  return rest.clone().invert().multiply(anim)
}

function deltaBob(pack: Pack, clip: PackedClip, node: string, time: number): number {
  const pos = readPos(clip, node, time)
  if (!pos) return 0
  const rest = restPos(pack, node)
  return pos.y - (rest?.y ?? 0)
}

function restQuat(pack: Pack, node: string): THREE.Quaternion | undefined {
  const exact = pack.rest.get(node)
  if (exact) return exact
  for (const [name, quat] of pack.rest) {
    if (name === node || name.endsWith(`/${node}`) || name.endsWith(`.${node}`)) return quat
  }
  return undefined
}

function restPos(pack: Pack, node: string): THREE.Vector3 | undefined {
  const exact = pack.restPos.get(node)
  if (exact) return exact
  for (const [name, pos] of pack.restPos) {
    if (name === node || name.endsWith(`.${node}`)) return pos
  }
  return undefined
}

function findTrack(clip: PackedClip, node: string, path: 'quaternion' | 'position'): Track | undefined {
  let best: Track | undefined
  for (const track of clip.tracks) {
    if (track.path !== path) continue
    if (track.node !== node && !track.node.endsWith(`.${node}`) && !track.node.endsWith(`/${node}`)) continue
    if (!best || track.node.length > best.node.length) best = track
  }
  return best
}

function readQuat(clip: PackedClip, node: string, time: number): THREE.Quaternion | null {
  const track = findTrack(clip, node, 'quaternion')
  if (!track) return null
  const { i, u } = span(track.times, time)
  const q0 = quatAt(track.values, i)
  const q1 = quatAt(track.values, Math.min(i + 1, track.times.length - 1))
  return q0.slerp(q1, u)
}

function readPos(clip: PackedClip, node: string, time: number): THREE.Vector3 | null {
  const track = findTrack(clip, node, 'position')
  if (!track) return null
  const { i, u } = span(track.times, time)
  const a = i * 3
  const b = Math.min(i + 1, track.times.length - 1) * 3
  return new THREE.Vector3(
    track.values[a]! + (track.values[b]! - track.values[a]!) * u,
    track.values[a + 1]! + (track.values[b + 1]! - track.values[a + 1]!) * u,
    track.values[a + 2]! + (track.values[b + 2]! - track.values[a + 2]!) * u,
  )
}

function quatAt(values: Float32Array, index: number): THREE.Quaternion {
  const o = index * 4
  return new THREE.Quaternion(values[o], values[o + 1], values[o + 2], values[o + 3]).normalize()
}

function span(times: Float32Array, time: number): { i: number; u: number } {
  if (times.length === 0) return { i: 0, u: 0 }
  let i = 0
  const last = times.length - 1
  const t = Math.max(times[0] ?? 0, Math.min(time, times[last] ?? time))
  while (i < last - 1 && (times[i + 1] ?? 0) < t) i += 1
  const t0 = times[i] ?? 0
  const t1 = times[Math.min(i + 1, last)] ?? t0
  const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0
  return { i, u }
}
