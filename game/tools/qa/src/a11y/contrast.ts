export interface Rgb {
  r: number
  g: number
  b: number
}

/** Accepts `#RGB`, `#RRGGBB`, `rgb()`, and `rgba()`. */
export function parseColor(input: string): Rgb {
  const value = input.trim()
  if (value.startsWith('#')) {
    const hex = value.slice(1)
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
    if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`bad colour ${input}`)
    const n = Number.parseInt(full, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  }
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (!match) throw new Error(`bad colour ${input}`)
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(input: string): number {
  const { r, g, b } = parseColor(input)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2 contrast ratio, 1–21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * WCAG 2.2 large text is 18pt (24px) or 14pt bold (18.67px at 96dpi).
 * Large text and UI graphics need 3:1. Body text needs 4.5:1.
 */
export function requiredContrast(fontPx: number, fontWeight: number): number {
  const bold = fontWeight >= 700
  const large = fontPx >= 24 || (bold && fontPx >= 18.67)
  return large ? 3 : 4.5
}

export interface ContrastPair {
  name: string
  foreground: string
  background: string
  fontPx: number
  fontWeight: number
}

export function contrastFailures(pairs: readonly ContrastPair[]): string[] {
  const failures: string[] = []
  for (const pair of pairs) {
    const ratio = contrastRatio(pair.foreground, pair.background)
    const need = requiredContrast(pair.fontPx, pair.fontWeight)
    if (ratio + 1e-6 < need) {
      failures.push(
        `${pair.name}: ${ratio.toFixed(2)}:1 is below ${need}:1 (${pair.foreground} on ${pair.background}, ${pair.fontPx}px/${pair.fontWeight})`,
      )
    }
  }
  return failures
}
