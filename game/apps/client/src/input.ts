import { clamp } from '@wobblebeans/shared'

export interface SampledInput {
  moveX: number
  moveZ: number
  jump: boolean
  dive: boolean
  camYaw: number
  quickChat: number
  emote: number
}

/**
 * Keyboard, mouse and touch. There is no text field: quick-chat is a preset id.
 */
export class InputDevice {
  camYaw = 0
  camPitch = 0.46
  private readonly keys = new Set<string>()
  private jumpEdge = false
  private diveEdge = false
  private chatEdge = 0
  private emoteEdge = 0
  private stickX = 0
  private stickY = 0
  private dragging = false
  private stickPointer = -1

  attach(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.keys.add(e.code)
      if (e.code === 'Space') {
        this.jumpEdge = true
        e.preventDefault()
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'ControlLeft' || e.code === 'KeyX') {
        this.diveEdge = true
      }
      if (e.code === 'Digit1') this.chatEdge = 1
      if (e.code === 'Digit2') this.chatEdge = 2
      if (e.code === 'Digit3') this.chatEdge = 3
      if (e.code === 'Digit4') this.chatEdge = 4
      if (e.code === 'Digit5') this.chatEdge = 5
      if (e.code === 'Digit6') this.chatEdge = 6
      if (e.code === 'KeyF') this.emoteEdge = 1
      if (e.code === 'KeyC') this.emoteEdge = 2
      if (e.code === 'KeyV') this.emoteEdge = 3
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())

    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        this.diveEdge = true
        return
      }
      if (e.button === 0) this.dragging = true
    })
    window.addEventListener('pointerup', () => {
      this.dragging = false
    })
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return
      this.camYaw -= e.movementX * 0.005
      this.camPitch = clamp(this.camPitch - e.movementY * 0.003, 0.18, 1.05)
    })

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

    document.getElementById('btn-jump')?.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.jumpEdge = true
    })
    document.getElementById('btn-dive')?.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.diveEdge = true
    })
  }

  sample(dt: number): SampledInput {
    if (this.keys.has('KeyQ')) this.camYaw += 1.8 * dt
    if (this.keys.has('KeyE')) this.camYaw -= 1.8 * dt

    let mx = this.stickX
    let mz = this.stickY
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz -= 1

    const jump = this.jumpEdge
    const dive = this.diveEdge
    const quickChat = this.chatEdge
    const emote = this.emoteEdge
    this.jumpEdge = false
    this.diveEdge = false
    this.chatEdge = 0
    this.emoteEdge = 0

    return {
      moveX: clamp(mx, -1, 1),
      moveZ: clamp(mz, -1, 1),
      jump,
      dive,
      camYaw: this.camYaw,
      quickChat,
      emote,
    }
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
