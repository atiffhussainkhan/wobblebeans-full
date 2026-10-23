import {
  FOUNDATION_COURSE,
  GAMEPAD_BINDINGS,
  KEYBOARD_BINDINGS,
  Locomotion,
  breakHoldPulse,
  clampAssists,
  locomotionName,
  resolveGrabButton,
  type AssistSettings,
  type GrabButtonState,
} from '@wobblebeans/shared'
import { setComfort, setHaptic, takeShake } from './render/feel'
import type { PerspectiveCamera } from 'three'

export interface SampledInput {
  moveX: number
  moveZ: number
  jump: boolean
  dive: boolean
  grab: boolean
  camYaw: number
  quickChat: number
  emote: number
}

const STORE = 'wb-assists-v1'
const SESSIONS = 'wb-play-sessions'
const DEG = Math.PI / 180

/**
 * Keyboard, mouse, touch, and gamepad. There is no text field:
 * quick-chat and emotes are preset ids, and settings are buttons.
 */
export class InputDevice {
  camYaw = 0
  camPitch = 15 * DEG
  namesHeld = false
  private readonly keys = new Set<string>()
  private jumpEdge = false
  private diveEdge = false
  private chatEdge = 0
  private emoteEdge = 0
  private recentreEdge = false
  private grabPointer = false
  private stickX = 0
  private stickY = 0
  private dragging = false
  private dragMoved = 0
  private stickPointer = -1
  private assists: AssistSettings = clampAssists(readStore())
  private grabButton: GrabButtonState = { latched: false, whiff: 0 }
  private breakSince = 0
  private chatCursor = 0
  private locomotion = Locomotion.Idle
  private cameraIdle = 0
  private manualLook = false
  private padIndex = -1
  private device: 'key' | 'pad' = 'key'
  private settingsOpen = false
  private locoEl: HTMLElement | null = null
  private hintEl: HTMLElement | null = null
  private sessions = 0

  constructor() {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    if (coarse && !readStore()) this.assists = clampAssists({ ...this.assists, grabToggle: true })
    this.sessions = bumpSessions()
    this.pushComfort()
  }

  attach(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.keys.add(e.code)
      this.device = 'key'
      if (matches(e.code, KEYBOARD_BINDINGS.jump)) {
        this.jumpEdge = true
        e.preventDefault()
      }
      if (matches(e.code, KEYBOARD_BINDINGS.dive)) this.diveEdge = true
      if (e.code === 'Digit1' || e.code === 'KeyF') this.emoteEdge = 1
      if (e.code === 'Digit2' || e.code === 'KeyC') this.emoteEdge = 2
      if (e.code === 'Digit3' || e.code === 'KeyV') this.emoteEdge = 3
      if (e.code === 'Digit5') this.chatEdge = 5
      if (e.code === 'Digit6') this.chatEdge = 6
      if (matches(e.code, KEYBOARD_BINDINGS.quickChat)) {
        this.chatCursor = (this.chatCursor % 6) + 1
        this.chatEdge = this.chatCursor
      }
      if (matches(e.code, KEYBOARD_BINDINGS.recentre)) this.recentreEdge = true
      if (matches(e.code, KEYBOARD_BINDINGS.settings)) {
        this.settingsOpen = !this.settingsOpen
        this.paintSettings()
        e.preventDefault()
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())

    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        this.diveEdge = true
        return
      }
      if (e.button === 1) {
        this.recentreEdge = true
        return
      }
      if (e.button === 0) {
        this.dragging = true
        this.dragMoved = 0
        this.grabPointer = true
      }
    })
    window.addEventListener('pointerup', () => {
      this.dragging = false
      this.grabPointer = false
    })
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return
      this.dragMoved += Math.hypot(e.movementX, e.movementY)
      if (this.dragMoved > 6) {
        this.grabPointer = false
        this.manualLook = true
        const sens = this.assists.sensitivity
        const yawSign = this.assists.invertX ? -1 : 1
        const pitchSign = this.assists.invertY ? -1 : 1
        this.camYaw -= e.movementX * (0.12 * DEG) * sens * yawSign
        this.camPitch = clamp(this.camPitch + e.movementY * (0.1 * DEG) * sens * pitchSign, -30 * DEG, 60 * DEG)
      }
    })

    this.bindStick()
    this.bindTouchButtons()
    this.buildChrome()
    setHaptic((ms, magnitude) => this.pulse(ms, magnitude))
  }

  noteLocomotion(locomotion: Locomotion): void {
    this.locomotion = locomotion
    if (this.locoEl) this.locoEl.textContent = locomotionName(locomotion)
  }

  sample(dt: number): SampledInput {
    this.namesHeld = this.keys.has('Tab')
    this.pollPad(dt)
    const lookLeft = this.keys.has('KeyQ')
    const lookRight = this.keys.has('KeyE')
    if (lookLeft || lookRight) this.manualLook = true
    if (lookLeft) this.camYaw += 1.8 * dt
    if (lookRight) this.camYaw -= 1.8 * dt

    let mx = this.stickX
    let mz = this.stickY
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz -= 1
    const shaped = shapeStick(mx, mz, Math.max(0.15, this.assists.deadzone))

    const shiftGrab = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    const connected =
      this.locomotion === Locomotion.Grab ||
      this.locomotion === Locomotion.Climb ||
      this.locomotion === Locomotion.Grabbed
    if (this.assists.grabToggle) {
      this.grabButton = resolveGrabButton(false, false, true, connected, this.grabButton, dt).button
    }
    const grab = shiftGrab || this.grabPointer || (this.assists.grabToggle && this.grabButton.latched)

    const grabbed = this.locomotion === Locomotion.Grabbed
    const brk = breakHoldPulse(
      this.assists.breakFreeHold && (this.keys.has('Space') || grab || this.diveEdge),
      grabbed,
      this.breakSince,
      dt,
    )
    this.breakSince = brk.since
    if (brk.pulse) this.jumpEdge = true

    if (this.recentreEdge) {
      this.manualLook = false
      this.cameraIdle = 99
      this.recentreEdge = false
    }

    const jump = this.jumpEdge
    const dive = this.diveEdge
    const quickChat = this.chatEdge
    const emote = this.emoteEdge
    this.jumpEdge = false
    this.diveEdge = false
    this.chatEdge = 0
    this.emoteEdge = 0

    if (this.manualLook) this.cameraIdle = 0
    else this.cameraIdle += dt

    return {
      moveX: clamp(shaped.x, -1, 1),
      moveZ: clamp(shaped.z, -1, 1),
      jump,
      dive,
      grab,
      camYaw: this.camYaw,
      quickChat,
      emote,
    }
  }

  aim(
    camera: PerspectiveCamera,
    feetX: number,
    feetY: number,
    feetZ: number,
    vx: number,
    vz: number,
    dt: number,
  ): void {
    const moving = Math.hypot(vx, vz) > 1.2
    if (this.assists.autoRecentre && !this.manualLook && this.cameraIdle > 2 && moving) {
      const target = Math.atan2(vx, vz)
      const maxStep = 90 * DEG * dt
      this.camYaw = approach(this.camYaw, target, maxStep)
    }
    const shake = takeShake(dt)
    const yaw = this.camYaw + Math.sin(performance.now() * 0.04) * shake
    const pitch = this.camPitch
    const dist = 6
    const ahead = Math.min(0.8, Math.hypot(vx, vz) * 0.08)
    const lookX = feetX + (Math.hypot(vx, vz) > 0.2 ? (vx / Math.hypot(vx, vz)) * ahead : 0)
    const lookZ = feetZ + (Math.hypot(vx, vz) > 0.2 ? (vz / Math.hypot(vx, vz)) * ahead : 0)
    const lookY = feetY + 1.2
    const horiz = dist * Math.cos(pitch)
    let cx = lookX - Math.sin(yaw) * horiz
    let cy = lookY + dist * Math.sin(pitch)
    let cz = lookZ - Math.cos(yaw) * horiz
    const pulled = pullOutOfBoxes(cx, cy, cz, lookX, lookY, lookZ)
    cx = pulled.x
    cy = pulled.y
    cz = pulled.z
    camera.position.set(cx, cy, cz)
    camera.lookAt(lookX, lookY, lookZ)
    const fov = this.assists.fov
    if (Math.abs(camera.fov - fov) > 0.1) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }

  private pollPad(dt: number): void {
    const pads = navigator.getGamepads?.() ?? []
    let pad = this.padIndex >= 0 ? pads[this.padIndex] : null
    if (!pad) {
      pad = pads.find((item) => item && item.connected) ?? null
      this.padIndex = pad ? pad.index : -1
    }
    if (!pad) return
    const lx = curve(pad.axes[0] ?? 0)
    const ly = curve(pad.axes[1] ?? 0)
    if (Math.hypot(lx, ly) > 0.2) this.device = 'pad'
    if (Math.hypot(lx, ly) > 0.05) {
      this.stickX = lx
      this.stickY = -ly
    } else if (this.stickPointer < 0) {
      this.stickX = 0
      this.stickY = 0
    }
    const rx = curve(pad.axes[2] ?? 0)
    const ry = curve(pad.axes[3] ?? 0)
    if (rx !== 0 || ry !== 0) {
      this.manualLook = true
      this.device = 'pad'
      const sens = this.assists.sensitivity
      const yawSign = this.assists.invertX ? -1 : 1
      const pitchSign = this.assists.invertY ? -1 : 1
      this.camYaw -= rx * (180 * DEG) * dt * sens * yawSign
      this.camPitch = clamp(this.camPitch + ry * (120 * DEG) * dt * sens * pitchSign, -30 * DEG, 60 * DEG)
    }
    const b = pad.buttons
    if (pressed(b[GAMEPAD_BINDINGS.jump])) this.jumpEdge = true
    if (pressed(b[GAMEPAD_BINDINGS.dive])) this.diveEdge = true
    if (b[GAMEPAD_BINDINGS.grab]?.pressed) this.grabPointer = true
    else if (this.device === 'pad') this.grabPointer = false
    if (b[GAMEPAD_BINDINGS.names]?.pressed) this.namesHeld = true
    if (pressed(b[GAMEPAD_BINDINGS.quickChat])) {
      this.chatCursor = (this.chatCursor % 6) + 1
      this.chatEdge = this.chatCursor
    }
    if (pressed(b[GAMEPAD_BINDINGS.recentre])) this.recentreEdge = true
    if (pressed(b[GAMEPAD_BINDINGS.settings])) {
      this.settingsOpen = !this.settingsOpen
      this.paintSettings()
    }
    if (pressed(b[GAMEPAD_BINDINGS.emoteUp])) this.emoteEdge = 1
    if (pressed(b[GAMEPAD_BINDINGS.emoteRight])) this.emoteEdge = 2
    if (pressed(b[GAMEPAD_BINDINGS.emoteDown])) this.emoteEdge = 3
    if (pressed(b[GAMEPAD_BINDINGS.emoteLeft])) this.emoteEdge = 1
    this.paintHint()
  }

  private pulse(ms: number, magnitude: number): void {
    const pads = navigator.getGamepads?.() ?? []
    const pad = this.padIndex >= 0 ? pads[this.padIndex] : null
    const actuator = pad?.vibrationActuator
    if (!actuator || magnitude <= 0) return
    void actuator.playEffect('dual-rumble', {
      duration: ms,
      strongMagnitude: magnitude,
      weakMagnitude: magnitude * 0.6,
    })
  }

  private bindStick(): void {
    const stick = document.getElementById('stick')
    const knob = document.getElementById('knob')
    stick?.addEventListener('pointerdown', (e) => {
      this.stickPointer = e.pointerId
      stick.setPointerCapture(e.pointerId)
      this.moveStick(e, stick, knob)
    })
    stick?.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointer) return
      this.moveStick(e, stick, knob)
    })
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return
      this.stickPointer = -1
      this.stickX = 0
      this.stickY = 0
      if (knob) {
        knob.style.left = '34px'
        knob.style.top = '34px'
      }
    }
    stick?.addEventListener('pointerup', endStick)
    stick?.addEventListener('pointercancel', endStick)
  }

  private bindTouchButtons(): void {
    document.getElementById('btn-jump')?.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.jumpEdge = true
    })
    document.getElementById('btn-dive')?.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.diveEdge = true
    })
    const actions = document.getElementById('touch-actions')
    if (actions && !document.getElementById('btn-grab')) {
      const grab = document.createElement('button')
      grab.type = 'button'
      grab.id = 'btn-grab'
      grab.textContent = 'Grab'
      grab.style.background = '#7fd1ff'
      grab.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        if (this.assists.grabToggle) {
          this.grabButton = { latched: !this.grabButton.latched, whiff: 0 }
        } else {
          this.grabPointer = true
        }
      })
      grab.addEventListener('pointerup', () => {
        if (!this.assists.grabToggle) this.grabPointer = false
      })
      grab.addEventListener('pointercancel', () => {
        if (!this.assists.grabToggle) this.grabPointer = false
      })
      actions.append(grab)
    }
  }

  private buildChrome(): void {
    const header = document.querySelector('.brand-bar')
    const chip = document.createElement('p')
    chip.id = 'loco'
    chip.textContent = 'Standing'
    chip.style.margin = '0'
    chip.style.fontWeight = '800'
    chip.style.background = '#fffdf7'
    chip.style.border = '3px solid #1f2140'
    chip.style.borderRadius = '999px'
    chip.style.padding = '4px 12px'
    header?.append(chip)
    this.locoEl = chip

    this.hintEl = document.querySelector('.controls p')
    this.paintHint()
    if (this.sessions > 0 && this.sessions <= 3 && this.hintEl) {
      this.hintEl.textContent = 'Hold Shift to grab! ' + (this.hintEl.textContent ?? '')
    }

    const panel = document.createElement('div')
    panel.id = 'assist-panel'
    panel.hidden = true
    panel.style.position = 'fixed'
    panel.style.right = '16px'
    panel.style.bottom = '96px'
    panel.style.zIndex = '5'
    panel.style.width = '280px'
    panel.style.padding = '14px'
    panel.style.background = '#fffdf7'
    panel.style.border = '3px solid #1f2140'
    panel.style.borderRadius = '18px'
    panel.style.boxShadow = '0 5px 0 #1f2140'
    panel.style.pointerEvents = 'auto'
    panel.style.display = 'flex'
    panel.style.flexDirection = 'column'
    panel.style.gap = '8px'
    document.body.append(panel)
    this.paintSettings()
  }

  private paintHint(): void {
    if (!this.hintEl || (this.sessions > 0 && this.sessions <= 3)) return
    this.hintEl.textContent =
      this.device === 'pad'
        ? 'Move stick · Jump A · Dive X · Grab RT · Emote D-pad · Hello LB'
        : 'Move WASD · Jump Space · Dive Ctrl · Grab Shift · Look drag or Q E · Emote 1 2 3 · Hello Q'
  }

  private paintSettings(): void {
    const panel = document.getElementById('assist-panel')
    if (!panel) return
    panel.hidden = !this.settingsOpen
    panel.replaceChildren()
    const title = document.createElement('strong')
    title.textContent = 'Comfort'
    panel.append(title)
    const note = document.createElement('p')
    note.style.margin = '0'
    note.textContent = 'Jumps stay full height so every gap is fair. The show does not pause.'
    panel.append(note)
    panel.append(
      toggle('Grab', this.assists.grabToggle ? 'Toggle' : 'Hold', () => {
        this.assists.grabToggle = !this.assists.grabToggle
        this.save()
      }),
    )
    panel.append(
      toggle('Break free', this.assists.breakFreeHold ? 'Hold' : 'Mash', () => {
        this.assists.breakFreeHold = !this.assists.breakFreeHold
        this.save()
      }),
    )
    panel.append(
      toggle('Camera follow', this.assists.autoRecentre ? 'On' : 'Off', () => {
        this.assists.autoRecentre = !this.assists.autoRecentre
        this.save()
      }),
    )
    panel.append(
      toggle('Shake', this.assists.shake, () => {
        this.assists.shake = this.assists.shake === 'reduced' ? 'off' : this.assists.shake === 'off' ? 'full' : 'reduced'
        this.save()
      }),
    )
    panel.append(
      toggle('Flashes', this.assists.flashes, () => {
        this.assists.flashes = this.assists.flashes === 'on' ? 'reduced' : this.assists.flashes === 'reduced' ? 'off' : 'on'
        this.save()
      }),
    )
    panel.append(
      toggle('Vibration', `${Math.round(this.assists.vibration * 100)}%`, () => {
        this.assists.vibration = this.assists.vibration > 0.8 ? 0 : this.assists.vibration === 0 ? 0.7 : 1
        this.save()
      }),
    )
    panel.append(
      toggle('Invert look sideways', this.assists.invertX ? 'On' : 'Off', () => {
        this.assists.invertX = !this.assists.invertX
        this.save()
      }),
    )
    panel.append(
      toggle('Invert look up', this.assists.invertY ? 'On' : 'Off', () => {
        this.assists.invertY = !this.assists.invertY
        this.save()
      }),
    )
  }

  private save(): void {
    this.pushComfort()
    try {
      localStorage.setItem(STORE, JSON.stringify(this.assists))
    } catch {
      // Private mode can refuse storage. The current show still keeps the choice.
    }
    this.paintSettings()
  }

  private pushComfort(): void {
    setComfort({
      flashes: this.assists.flashes,
      vibration: this.assists.vibration,
      shake: this.assists.shake,
    })
  }

  private moveStick(e: PointerEvent, stick: HTMLElement, knob: HTMLElement | null): void {
    const rect = stick.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const max = rect.width * 0.38
    const mag = Math.hypot(dx, dy) || 1
    const clamped = Math.min(max, mag)
    const nx = (dx / mag) * clamped
    const ny = (dy / mag) * clamped
    if (knob) {
      knob.style.left = `${rect.width / 2 + nx - 26}px`
      knob.style.top = `${rect.height / 2 + ny - 26}px`
    }
    this.stickX = nx / max
    this.stickY = -ny / max
  }
}

function toggle(label: string, value: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = `${label}: ${value}`
  button.style.font = '800 16px Trebuchet MS, Segoe UI, sans-serif'
  button.style.padding = '10px 12px'
  button.style.borderRadius = '14px'
  button.style.border = '3px solid #1f2140'
  button.style.background = '#ffd1e2'
  button.style.color = '#1f2140'
  button.style.textAlign = 'left'
  button.addEventListener('click', onClick)
  return button
}

function matches(code: string, list: readonly string[]): boolean {
  return list.includes(code)
}

function pressed(button: GamepadButton | undefined): boolean {
  return button?.pressed === true
}

function curve(v: number): number {
  const dead = 0.12
  const mag = Math.abs(v)
  if (mag < dead) return 0
  const shaped = Math.pow((mag - dead) / (1 - dead), 2)
  return Math.sign(v) * Math.min(1, shaped)
}

function shapeStick(x: number, z: number, dead: number): { x: number; z: number } {
  const mag = Math.hypot(x, z)
  if (mag <= dead || mag < 1e-5) return { x: 0, z: 0 }
  const out = Math.min(1, (mag - dead) / (1 - dead))
  const keep = Math.max(out, 0.35)
  return { x: (x / mag) * keep, z: (z / mag) * keep }
}

function approach(current: number, target: number, maxStep: number): number {
  let delta = target - current
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  if (Math.abs(delta) <= maxStep) return target
  return current + Math.sign(delta) * maxStep
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function readStore(): Partial<AssistSettings> | null {
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return null
    return JSON.parse(raw) as Partial<AssistSettings>
  } catch {
    return null
  }
}

function bumpSessions(): number {
  try {
    const next = Number(localStorage.getItem(SESSIONS) ?? '0') + 1
    localStorage.setItem(SESSIONS, String(next))
    return next
  } catch {
    return 1
  }
}

function pullOutOfBoxes(
  x: number,
  y: number,
  z: number,
  lookX: number,
  lookY: number,
  lookZ: number,
): { x: number; y: number; z: number } {
  let cx = x
  let cy = y
  let cz = z
  for (const box of FOUNDATION_COURSE.boxes) {
    if (Math.abs(box.rx) > 0.2) continue
    const pad = 0.3
    const inside =
      Math.abs(cx - box.x) < box.hx + pad &&
      Math.abs(cy - box.y) < box.hy + pad &&
      Math.abs(cz - box.z) < box.hz + pad
    if (!inside) continue
    cx = lookX + (cx - lookX) * 0.45
    cy = lookY + (cy - lookY) * 0.45
    cz = lookZ + (cz - lookZ) * 0.45
  }
  return { x: cx, y: cy, z: cz }
}
