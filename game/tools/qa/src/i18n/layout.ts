import type { StringKind } from './catalogue'

/** Conservative average advance for the rounded sans used in the HUD. */
export const CHAR_EM = 0.62
export const LINE_HEIGHT = 1.35

export type Viewport = '1280x720' | '390x844'

export interface LayoutBox {
  viewport: Viewport
  maxWidthPx: number
  maxHeightPx: number
  fontPx: number
  wrap: boolean
  /** Grow toward maxWidth before wrapping. Buttons do this (doc 04 L3). */
  grow: boolean
}

export interface Fit {
  ok: boolean
  lines: number
  widthPx: number
  heightPx: number
}

export function wrapText(text: string, maxChars: number): string[] {
  const limit = Math.max(1, maxChars)
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  const push = (word: string): void => {
    if (word.length > limit) {
      if (line) lines.push(line)
      line = ''
      for (let i = 0; i < word.length; i += limit) lines.push(word.slice(i, i + limit))
      return
    }
    const next = line ? `${line} ${word}` : word
    if (next.length <= limit) line = next
    else {
      if (line) lines.push(line)
      line = word
    }
  }
  for (const word of words) push(word)
  if (line) lines.push(line)
  if (lines.length === 0) lines.push('')
  return lines
}

/**
 * Reference layout that follows doc 04: wrap, then grow, never a fixed box that clips.
 * Widths are the content box at 1280×720 and 390×844 after the HUD padding.
 */
export function referenceBox(kind: StringKind, viewport: Viewport): LayoutBox {
  const mobile = viewport === '390x844'
  if (kind === 'button') {
    return { viewport, maxWidthPx: mobile ? 320 : 420, maxHeightPx: 200, fontPx: 18, wrap: true, grow: true }
  }
  if (kind === 'title') {
    return {
      viewport,
      maxWidthPx: mobile ? 358 : 1100,
      maxHeightPx: 180,
      fontPx: mobile ? 22 : 28,
      wrap: true,
      grow: false,
    }
  }
  if (kind === 'label') {
    return {
      viewport,
      maxWidthPx: mobile ? 358 : 1100,
      maxHeightPx: 140,
      fontPx: mobile ? 16 : 18,
      wrap: true,
      grow: false,
    }
  }
  return {
    viewport,
    maxWidthPx: mobile ? 358 : 1100,
    maxHeightPx: 360,
    fontPx: mobile ? 16 : 18,
    wrap: true,
    grow: false,
  }
}

export function fitText(box: LayoutBox, text: string, scale: number): Fit {
  const font = box.fontPx * scale
  const charW = font * CHAR_EM
  const lineH = font * LINE_HEIGHT
  let width = box.maxWidthPx
  if (box.grow) width = Math.min(box.maxWidthPx, Math.max(96, text.length * charW))
  const chars = Math.max(1, Math.floor(width / Math.max(charW, 0.01)))
  const lines = box.wrap ? wrapText(text, chars) : [text]
  const widest = Math.max(...lines.map((row) => row.length * charW), 0)
  const height = lines.length * lineH
  return {
    ok: widest <= width + 0.51 && height <= box.maxHeightPx + 0.51,
    lines: lines.length,
    widthPx: width,
    heightPx: height,
  }
}
