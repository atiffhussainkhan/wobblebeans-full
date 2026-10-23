/** Kenney CC0 glyphs are masked and tinted. Other icons are original geometry. */

export type IconId =
  | 'play' | 'home' | 'back' | 'gear' | 'star' | 'coin' | 'trophy' | 'lock'
  | 'check' | 'cross' | 'warn' | 'info' | 'question' | 'pause'
  | 'audioOn' | 'audioOff' | 'musicOn' | 'musicOff' | 'multi' | 'single' | 'medal'
  | 'eye' | 'friends' | 'shirt' | 'flag' | 'dice' | 'shop' | 'cloud' | 'bean'
  | 'chat' | 'stretch' | 'cable' | 'mean' | 'cards' | 'tag' | 'sad'
  | 'prev' | 'next' | 'plus' | 'shield' | 'pattern' | 'face' | 'spark'
  | 'robot' | 'colour' | 'keyboard' | 'gamepad' | 'fall' | 'clock' | 'heart'

export const KENNEY: Partial<Record<IconId, string>> = {
  home: 'home.png',
  back: 'return.png',
  gear: 'gear.png',
  star: 'star.png',
  trophy: 'trophy.png',
  lock: 'locked.png',
  check: 'checkmark.png',
  cross: 'cross.png',
  warn: 'exclamation.png',
  info: 'information.png',
  question: 'question.png',
  pause: 'pause.png',
  audioOn: 'audioOn.png',
  audioOff: 'audioOff.png',
  musicOn: 'musicOn.png',
  musicOff: 'musicOff.png',
  multi: 'multiplayer.png',
  single: 'singleplayer.png',
  medal: 'medal1.png',
}

/** Original sticker shapes. `prev` is mirrored in CSS for RTL. */
export const SVG: Record<string, string> = {
  play: '<path d="M8 5 L26 16 L8 27 Z"/>',
  coin: '<circle cx="16" cy="16" r="10"/><path d="M16 9 V23 M12 13 H18 M12 19 H18" fill="none" stroke="currentColor" stroke-width="2"/>',
  eye: '<path d="M4 16 Q16 6 28 16 Q16 26 4 16 Z"/><circle cx="16" cy="16" r="3"/>',
  friends: '<circle cx="12" cy="12" r="4"/><circle cx="21" cy="13" r="3"/><path d="M5 26 Q12 18 19 26 M16 26 Q21 20 28 26" fill="none" stroke="currentColor" stroke-width="2"/>',
  shirt: '<path d="M8 10 L16 6 L24 10 L22 14 L19 12 V26 H13 V12 L10 14 Z"/>',
  flag: '<path d="M8 4 V28 M8 6 H24 L20 12 L24 18 H8" />',
  dice: '<rect x="6" y="6" width="20" height="20" rx="4"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="20" r="2"/>',
  shop: '<path d="M6 12 H26 L24 26 H8 Z M10 12 V8 H22 V12"/>',
  cloud: '<ellipse cx="16" cy="18" rx="10" ry="6"/><ellipse cx="12" cy="16" rx="5" ry="4"/><ellipse cx="20" cy="15" rx="6" ry="5"/>',
  bean: '<ellipse cx="16" cy="18" rx="8" ry="10"/>',
  chat: '<path d="M6 6 H26 V20 H14 L8 26 V20 H6 Z"/>',
  stretch: '<circle cx="16" cy="8" r="3"/><path d="M16 11 V20 M10 16 H22 M12 26 L16 20 L20 26" fill="none" stroke="currentColor" stroke-width="2"/>',
  cable: '<path d="M6 20 H12 L16 8 H26" fill="none" stroke="currentColor" stroke-width="3"/>',
  mean: '<circle cx="16" cy="16" r="10"/><path d="M10 12 H13 M19 12 H22 M11 21 Q16 16 21 21" fill="none" stroke="currentColor" stroke-width="2"/>',
  cards: '<rect x="8" y="8" width="12" height="16" rx="2"/><rect x="14" y="6" width="12" height="16" rx="2"/>',
  tag: '<path d="M6 8 H18 L26 16 L16 26 L6 16 Z"/>',
  sad: '<circle cx="16" cy="16" r="10"/><circle cx="12" cy="14" r="1.4"/><circle cx="20" cy="14" r="1.4"/><path d="M11 22 Q16 18 21 22" fill="none" stroke="currentColor" stroke-width="2"/>',
  prev: '<path d="M20 6 L8 16 L20 26" fill="none" stroke="currentColor" stroke-width="3"/>',
  next: '<path d="M12 6 L24 16 L12 26" fill="none" stroke="currentColor" stroke-width="3"/>',
  plus: '<path d="M16 6 V26 M6 16 H26" fill="none" stroke="currentColor" stroke-width="3"/>',
  shield: '<path d="M16 4 L26 8 V16 Q26 24 16 28 Q6 24 6 16 V8 Z"/>',
  pattern: '<path d="M6 6 H26 V26 H6 Z M6 16 H26 M16 6 V26" fill="none" stroke="currentColor" stroke-width="2"/>',
  face: '<circle cx="16" cy="16" r="10"/><circle cx="12" cy="14" r="1.5"/><circle cx="20" cy="14" r="1.5"/><path d="M11 20 Q16 24 21 20" fill="none" stroke="currentColor" stroke-width="2"/>',
  spark: '<path d="M16 4 L18 14 L28 16 L18 18 L16 28 L14 18 L4 16 L14 14 Z"/>',
  robot: '<rect x="8" y="10" width="16" height="12" rx="3"/><circle cx="13" cy="16" r="1.5"/><circle cx="19" cy="16" r="1.5"/><path d="M16 6 V10" stroke="currentColor" stroke-width="2"/>',
  colour: '<path d="M16 4 C22 10 24 14 20 20 C18 24 14 24 12 20 C8 14 10 8 16 4 Z"/>',
  keyboard: '<rect x="4" y="8" width="24" height="16" rx="2"/><path d="M8 12 H12 M14 12 H18 M20 12 H24 M8 16 H24 M12 20 H20" stroke="currentColor" stroke-width="1.5"/>',
  gamepad: '<rect x="4" y="10" width="24" height="12" rx="6"/><path d="M10 16 H14 M12 14 V18" stroke="currentColor" stroke-width="1.5"/><circle cx="20" cy="15" r="1.2"/><circle cx="23" cy="17" r="1.2"/>',
  fall: '<path d="M16 4 V22 M8 16 L16 26 L24 16" fill="none" stroke="currentColor" stroke-width="3"/>',
  clock: '<circle cx="16" cy="16" r="10"/><path d="M16 8 V16 L22 18" fill="none" stroke="currentColor" stroke-width="2"/>',
  heart: '<path d="M16 26 L6 14 Q6 6 12 8 Q16 10 16 14 Q16 10 20 8 Q26 6 26 14 Z"/>',
}

export const MIRROR_ICONS = new Set<IconId>(['prev', 'back'])
