import type { CourseBox } from '../course/foundation-gauntlet'
import { moverOffset } from '../course/foundation-gauntlet'
import { PHYSICS } from '../physics/constants'
import type { BeanState, SurfaceModifiers } from '../physics/types'
import { quatFromXRotation } from '../physics/math'
import {
  DOOR_DESPAWN_S,
  TILE_VANISH_S,
} from './kit'
import {
  pusherExtension,
  spinRadians,
  swingAngle,
  tileDropOffset,
  wallPanelPose,
} from './motion'
import { readKit, type BoxKit, type SampledPose } from './types'

export interface Quat {
  x: number
  y: number
  z: number
  w: number
}

export function quatY(ry: number): Quat {
  const h = ry / 2
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) }
}

export function quatZ(rz: number): Quat {
  const h = rz / 2
  return { x: 0, y: 0, z: Math.sin(h), w: Math.cos(h) }
}

function rest(def: CourseBox): SampledPose {
  return { x: def.x, y: def.y, z: def.z, rx: def.rx, ry: 0, rz: 0 }
}

/**
 * Pose of a kinematic course box at `tick`.
 * Boxes without a kit use `moverOffset`, which is what the gauntlet shuttle does.
 */
export function sampleMoverPose(def: CourseBox, tick: number): SampledPose {
  const kit = readKit(def)
  if (!kit) {
    const motion = def.mover
    if (!motion) return rest(def)
    return {
      x: def.x + moverOffset(tick, motion.amplitude, motion.period),
      y: def.y,
      z: def.z,
      rx: def.rx,
      ry: 0,
      rz: 0,
    }
  }
  return poseFromKit(def, kit, tick)
}

function poseFromKit(def: CourseBox, kit: BoxKit, tick: number): SampledPose {
  const base = rest(def)
  switch (kit.motion) {
    case 'static':
      return base
    case 'sine': {
      const period = kit.period > 1e-4 ? kit.period : def.mover?.period ?? 4
      const amplitude = kit.amplitude || def.mover?.amplitude || 0
      const t = tick / PHYSICS.tickHz
      const offset = Math.sin((t * Math.PI * 2) / period + kit.phase) * amplitude
      if (kit.axis === 'z') return { ...base, z: def.z + offset * kit.dir }
      if (kit.axis === 'y') return { ...base, y: def.y + offset * kit.dir }
      return { ...base, x: def.x + offset * kit.dir }
    }
    case 'pusher': {
      const ext = pusherExtension(tick, kit.period, kit.phase)
      const delta = ext * kit.amplitude * kit.dir
      if (kit.axis === 'z') return { ...base, z: def.z + delta }
      return { ...base, x: def.x + delta }
    }
    case 'spin': {
      const ry = spinRadians(tick, kit)
      // Radial bars orbit the pivot stored on the box. `length` is the centre radius.
      if (kit.piece === 'spin_bar' && kit.length > 1) {
        return {
          ...base,
          x: def.x + Math.cos(ry) * kit.length,
          z: def.z + Math.sin(ry) * kit.length,
          ry,
          rot: quatY(ry),
        }
      }
      return { ...base, ry, rot: quatY(ry) }
    }
    case 'swing': {
      const theta = swingAngle(tick, kit.period, kit.phase, kit.amplitude)
      const along = Math.sin(theta) * kit.length
      const y = def.y + kit.length - Math.cos(theta) * kit.length
      if (kit.axis === 'z') {
        return { ...base, y, z: def.z + along, rx: theta, rot: quatFromXRotation(theta) }
      }
      return { ...base, y, x: def.x + along, rz: theta, rot: quatZ(theta) }
    }
    case 'launch': {
      const t = tick / PHYSICS.tickHz
      const sweep = 0.7
      const ang = Math.sin((kit.speed * kit.speedMult * Math.PI) / 180 * t + kit.phase) * sweep
      const half = kit.length / 2
      return {
        ...base,
        x: def.x + Math.cos(ang) * half * kit.dir,
        z: def.z + Math.sin(ang) * half,
        ry: ang,
        rot: quatY(ang),
      }
    }
    case 'door':
      return doorPose(base, kit, tick)
    case 'tile':
      return tilePose(base, kit, tick)
    case 'travel': {
      const wall = wallPanelPose(tick, kit.slot, kit.panel, kit.phase3)
      return { ...base, x: wall.x, y: wall.y, z: wall.z }
    }
    case 'rise': {
      const t = tick / PHYSICS.tickHz
      if (t < kit.loop) return { ...base, y: def.y - 8 }
      return base
    }
    case 'tilt': {
      const rz = kit.tilt
      return { ...base, rz, rot: quatZ(rz) }
    }
    default:
      return base
  }
}

function doorPose(base: SampledPose, kit: BoxKit, tick: number): SampledPose {
  if (kit.triggeredTick == null) return base
  const age = (tick - kit.triggeredTick) / PHYSICS.tickHz
  if (age < DOOR_DESPAWN_S) return { ...base, y: base.y - Math.min(0.15, age) }
  return { ...base, y: base.y - 40 }
}

function tilePose(base: SampledPose, kit: BoxKit, tick: number): SampledPose {
  if (kit.triggeredTick == null) return base
  const age = (tick - kit.triggeredTick) / PHYSICS.tickHz
  const returnS = kit.loop > TILE_VANISH_S ? kit.loop : 0
  if (returnS > 0 && age >= returnS) {
    kit.triggeredTick = null
    return base
  }
  return { ...base, y: base.y + tileDropOffset(age, returnS) }
}

export interface SurfaceZone {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  vx: number
  vy: number
  vz: number
  speedMult: number
}

const zonesByCourse = new Map<string, SurfaceZone[]>()

export function registerSurfaceZones(courseId: string, zones: SurfaceZone[]): void {
  zonesByCourse.set(courseId, zones)
}

export interface ImpulseHost {
  readonly course: { id: string }
}

const impulses = new WeakMap<ImpulseHost, Map<number, { x: number; y: number; z: number }>>()
const speedLocks = new WeakMap<ImpulseHost, Map<number, number>>()

export function queueImpulse(host: ImpulseHost, beanId: number, x: number, y: number, z: number): void {
  let map = impulses.get(host)
  if (!map) {
    map = new Map()
    impulses.set(host, map)
  }
  const prev = map.get(beanId) ?? { x: 0, y: 0, z: 0 }
  map.set(beanId, { x: prev.x + x, y: prev.y + y, z: prev.z + z })
}

export function queueSpeedMult(host: ImpulseHost, beanId: number, speedMult: number): void {
  let map = speedLocks.get(host)
  if (!map) {
    map = new Map()
    speedLocks.set(host, map)
  }
  map.set(beanId, speedMult)
}

function consumeImpulse(host: ImpulseHost, beanId: number): { x: number; y: number; z: number } | null {
  const map = impulses.get(host)
  if (!map) return null
  const value = map.get(beanId)
  if (!value) return null
  map.delete(beanId)
  return value
}

function consumeSpeed(host: ImpulseHost, beanId: number): number | null {
  const map = speedLocks.get(host)
  if (!map) return null
  const value = map.get(beanId)
  if (value == null) return null
  map.delete(beanId)
  return value
}

/**
 * Conveyors and one-tick impulses feed `SurfaceModifiers` from the server tick.
 * The gauntlet has no zones, so this returns `base` unchanged.
 */
export function applyZoneSurface(host: ImpulseHost, state: BeanState, base: SurfaceModifiers): SurfaceModifiers {
  let surface = base
  const zones = zonesByCourse.get(host.course.id)
  if (zones && state.grounded) {
    for (const zone of zones) {
      if (state.px < zone.minX || state.px > zone.maxX) continue
      if (state.pz < zone.minZ || state.pz > zone.maxZ) continue
      if (state.py < zone.minY || state.py > zone.maxY) continue
      surface = {
        ...surface,
        platformVelocityX: surface.platformVelocityX + zone.vx,
        platformVelocityY: surface.platformVelocityY + zone.vy,
        platformVelocityZ: surface.platformVelocityZ + zone.vz,
        speedMult: surface.speedMult * (zone.speedMult || 1),
      }
      break
    }
  }
  const lock = consumeSpeed(host, state.id)
  if (lock != null) surface = { ...surface, speedMult: lock }
  const impulse = consumeImpulse(host, state.id)
  if (impulse) {
    const dt = PHYSICS.dt
    surface = {
      ...surface,
      externalAccelX: surface.externalAccelX + impulse.x / dt,
      externalAccelY: surface.externalAccelY + impulse.y / dt,
      externalAccelZ: surface.externalAccelZ + impulse.z / dt,
    }
  }
  return surface
}

export function obbOverlap(
  px: number,
  py: number,
  pz: number,
  pose: SampledPose,
  hx: number,
  hy: number,
  hz: number,
  margin: number,
): boolean {
  let x = px - pose.x
  let y = py - pose.y
  let z = pz - pose.z
  if (pose.ry) {
    const c = Math.cos(pose.ry)
    const s = Math.sin(pose.ry)
    const lx = x * c + z * s
    const lz = -x * s + z * c
    x = lx
    z = lz
  }
  if (pose.rx) {
    const c = Math.cos(pose.rx)
    const s = Math.sin(pose.rx)
    const ly = y * c + z * s
    const lz = -y * s + z * c
    y = ly
    z = lz
  }
  if (pose.rz) {
    const c = Math.cos(pose.rz)
    const s = Math.sin(pose.rz)
    const lx = x * c + y * s
    const ly = -x * s + y * c
    x = lx
    y = ly
  }
  return Math.abs(x) <= hx + margin && Math.abs(y) <= hy + margin && Math.abs(z) <= hz + margin
}

/** Kept so a ramp's authored X rotation still round-trips through the quat helper. */
export const rampQuat = quatFromXRotation
