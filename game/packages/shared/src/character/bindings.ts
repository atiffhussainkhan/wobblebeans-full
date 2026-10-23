/** doc 03 §4.1. Preset actions only. There is no text bind field. */
export const KEYBOARD_BINDINGS = {
  move: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
  jump: ['Space'],
  dive: ['ControlLeft', 'ControlRight'],
  grab: ['ShiftLeft', 'ShiftRight'],
  names: ['Tab'],
  emote: ['Digit1', 'Digit2', 'Digit3'],
  quickChat: ['KeyQ'],
  recentre: ['KeyR'],
  settings: ['Escape'],
} as const

/** Standard gamepad layout. PlayStation and Switch prompts follow the pad id. */
export const GAMEPAD_BINDINGS = {
  jump: 0,
  dive: 2,
  grab: 7,
  names: 6,
  quickChat: 4,
  recentre: 11,
  settings: 9,
  emoteUp: 12,
  emoteRight: 15,
  emoteDown: 13,
  emoteLeft: 14,
} as const

export const MOUSE_BINDINGS = {
  dive: 2,
  grab: 0,
  recentre: 1,
} as const
