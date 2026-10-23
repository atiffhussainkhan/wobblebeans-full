/**
 * Kid assists from docs/design/03-character-controls.md §5.
 * Fixed jump stays full even if a profile asks otherwise: a short hop
 * would skip the jumps the levels require (AD-31).
 */
export interface AssistSettings {
  fixedJump: boolean
  grabToggle: boolean
  breakFreeHold: boolean
  autoRecentre: boolean
  /** off, reduced (default), full. */
  shake: 'off' | 'reduced' | 'full'
  flashes: 'off' | 'reduced' | 'on'
  motionBlur: boolean
  fov: number
  sensitivity: number
  invertX: boolean
  invertY: boolean
  deadzone: number
  /** 0–1. Default 0.7. */
  vibration: number
  audioCues: boolean
}

export const DEFAULT_ASSISTS: AssistSettings = {
  fixedJump: true,
  grabToggle: false,
  breakFreeHold: false,
  autoRecentre: true,
  shake: 'reduced',
  flashes: 'on',
  motionBlur: false,
  fov: 70,
  sensitivity: 1,
  invertX: false,
  invertY: false,
  deadzone: 0.15,
  vibration: 0.7,
  audioCues: true,
}

export function clampAssists(partial: Partial<AssistSettings> | null | undefined): AssistSettings {
  const d = DEFAULT_ASSISTS
  const src = partial ?? {}
  const shake = src.shake === 'off' || src.shake === 'full' || src.shake === 'reduced' ? src.shake : d.shake
  const flashes = src.flashes === 'off' || src.flashes === 'reduced' || src.flashes === 'on' ? src.flashes : d.flashes
  return {
    fixedJump: true,
    grabToggle: src.grabToggle === true,
    breakFreeHold: src.breakFreeHold === true,
    autoRecentre: src.autoRecentre !== false,
    shake,
    flashes,
    motionBlur: false,
    fov: clampNum(src.fov, 60, 85, d.fov),
    sensitivity: clampNum(src.sensitivity, 0.1, 3, d.sensitivity),
    invertX: src.invertX === true,
    invertY: src.invertY === true,
    deadzone: clampNum(src.deadzone, 0.1, 0.25, d.deadzone),
    vibration: clampNum(src.vibration, 0, 1, d.vibration),
    audioCues: src.audioCues !== false,
  }
}

/** Always 1. Profiles cannot shorten a required jump. */
export function jumpReleaseCut(_assists: AssistSettings): number {
  return 1
}

export interface GrabButtonState {
  latched: boolean
  whiff: number
}

/**
 * Hold on keyboard, toggle on touch. Toggle drops after 1 s with no grab
 * so the bean is not stuck at 0.6 speed (I-04).
 */
export function resolveGrabButton(
  pressedEdge: boolean,
  held: boolean,
  toggle: boolean,
  grabbedOrClimbing: boolean,
  button: GrabButtonState,
  dt: number,
): { grab: boolean; button: GrabButtonState } {
  if (!toggle) return { grab: held, button: { latched: false, whiff: 0 } }
  let latched = button.latched
  let whiff = button.whiff
  if (pressedEdge) latched = !latched
  if (latched && !grabbedOrClimbing) whiff += dt
  else whiff = 0
  if (whiff >= 1) {
    latched = false
    whiff = 0
  }
  return { grab: latched, button: { latched, whiff } }
}

/** Hold-to-break emits one pulse each 0.25 s, matching mash credit (I-11). */
export function breakHoldPulse(holding: boolean, grabbed: boolean, since: number, dt: number): { pulse: boolean; since: number } {
  if (!holding || !grabbed) return { pulse: false, since: 0 }
  const next = since + dt
  if (next >= 0.25) return { pulse: true, since: next - 0.25 }
  return { pulse: false, since: next }
}

function clampNum(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(min, Math.min(max, value))
}
