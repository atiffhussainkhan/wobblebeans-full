export interface Comfort {
  flashes: 'off' | 'reduced' | 'on'
  vibration: number
  shake: 'off' | 'reduced' | 'full'
}

let comfort: Comfort = { flashes: 'on', vibration: 0.7, shake: 'reduced' }
let shake = 0
let haptic: (ms: number, magnitude: number) => void = () => {}

export function setComfort(next: Comfort): void {
  comfort = next
}

export function comfortNow(): Comfort {
  return comfort
}

/** Capped at 0.15 m. The camera scales it by the shake setting. */
export function addShake(amount: number): void {
  shake = Math.min(0.15, Math.max(shake, amount))
}

export function takeShake(dt: number): number {
  const scale = comfort.shake === 'off' ? 0 : comfort.shake === 'full' ? 1 : 0.5
  const mag = shake * scale
  const fade = 0.15 / 0.25
  shake = Math.max(0, shake - fade * dt)
  return mag
}

export function setHaptic(fn: (ms: number, magnitude: number) => void): void {
  haptic = fn
}

/** Short pulses only. Never a continuous rumble. */
export function cueHaptic(kind: 'light' | 'medium' | 'strong'): void {
  if (comfort.vibration <= 0) return
  const ms = kind === 'strong' ? 150 : kind === 'medium' ? 70 : 30
  const mag = (kind === 'strong' ? 0.85 : kind === 'medium' ? 0.5 : 0.25) * comfort.vibration
  haptic(ms, mag)
}

export function flashesOn(): boolean {
  return comfort.flashes !== 'off'
}
