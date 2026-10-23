export interface Vec3 {
  x: number
  y: number
  z: number
}

export const V3 = {
  zero(): Vec3 {
    return { x: 0, y: 0, z: 0 }
  },
  dist(a: Vec3, b: Vec3): number {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
  },
  distXZ(ax: number, az: number, bx: number, bz: number): number {
    return Math.hypot(ax - bx, az - bz)
  },
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function wrapAngle(rad: number): number {
  const tau = Math.PI * 2
  let a = rad % tau
  if (a > Math.PI) a -= tau
  if (a < -Math.PI) a += tau
  return a
}

export function approachAngle(current: number, target: number, maxDelta: number): number {
  const delta = clamp(wrapAngle(target - current), -maxDelta, maxDelta)
  return current + delta
}

export function quatFromXRotation(rx: number): { x: number; y: number; z: number; w: number } {
  const h = rx / 2
  return { x: Math.sin(h), y: 0, z: 0, w: Math.cos(h) }
}

/** Camera-space stick (moveX right, moveZ forward) into world XZ. Yaw 0 looks along +Z. */
export function wishDirection(
  moveX: number,
  moveZ: number,
  camYaw: number,
): { x: number; z: number; mag: number } {
  let mx = moveX
  let mz = moveZ
  const mag0 = Math.hypot(mx, mz)
  if (mag0 > 1) {
    mx /= mag0
    mz /= mag0
  }
  const mag = Math.min(1, mag0)
  const sin = Math.sin(camYaw)
  const cos = Math.cos(camYaw)
  return {
    x: mx * cos + mz * sin,
    z: -mx * sin + mz * cos,
    mag,
  }
}

export function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
