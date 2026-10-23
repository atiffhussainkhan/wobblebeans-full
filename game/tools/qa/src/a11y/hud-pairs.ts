import { readFileSync } from 'node:fs'
import { contrastFailures, type ContrastPair } from './contrast'

export interface CssDecl {
  color?: string
  background?: string
  fontSize?: number
  fontWeight?: number
}

/** Reads a flat rule block. Enough for the foundation stylesheet, not a full CSS parser. */
export function ruleBlock(css: string, selector: string): CssDecl {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  if (!match?.[1]) return {}
  const body = match[1]
  const color = body.match(/(?:^|[^-])color\s*:\s*(#[0-9a-fA-F]{3,8})/)
  const background = body.match(/background\s*:\s*(#[0-9a-fA-F]{3,8})/)
  const fontSize = body.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/)
  const fontWeight = body.match(/font-weight\s*:\s*(\d+)/)
  const fontShorthand = body.match(/font\s*:\s*(\d+)\s+(\d+(?:\.\d+)?)px/)
  const decl: CssDecl = {}
  if (color?.[1]) decl.color = color[1]
  if (background?.[1]) decl.background = background[1]
  if (fontSize?.[1]) decl.fontSize = Number(fontSize[1])
  if (fontWeight?.[1]) decl.fontWeight = Number(fontWeight[1])
  if (fontShorthand?.[1] && decl.fontWeight === undefined) decl.fontWeight = Number(fontShorthand[1])
  if (fontShorthand?.[2] && decl.fontSize === undefined) decl.fontSize = Number(fontShorthand[2])
  return decl
}

/**
 * HUD text on the Cloud panels, plus the cyan banner and the touch buttons.
 * Colours come from the client stylesheet so a palette edit is re-checked.
 */
export function foundationHudPairs(css: string): ContrastPair[] {
  const root = ruleBlock(css, ':root')
  const panel = ruleBlock(css, '.panel')
  const brand = ruleBlock(css, '.brand')
  const status = ruleBlock(css, '#status')
  const banner = ruleBlock(css, '.banner')
  const bubble = ruleBlock(css, '.bubble')
  const button = ruleBlock(css, '#touch-actions button')
  const dive = ruleBlock(css, '#btn-dive')
  const ink = root.color
  const cloud = panel.background
  if (!ink || !cloud) throw new Error('HUD ink or Cloud panel colour is missing from the stylesheet')
  const statusSize = status.fontSize ?? 18
  const statusWeight = status.fontWeight ?? 700
  const pairs: ContrastPair[] = [
    { name: 'status on Cloud', foreground: ink, background: cloud, fontPx: statusSize, fontWeight: statusWeight },
    {
      name: 'controls on Cloud',
      foreground: ink,
      background: cloud,
      fontPx: 16,
      fontWeight: 400,
    },
  ]
  if (brand.color) {
    pairs.push({
      name: 'brand on Cloud',
      foreground: brand.color,
      background: cloud,
      fontPx: brand.fontSize ?? 28,
      fontWeight: brand.fontWeight ?? 800,
    })
  }
  if (banner.background) {
    pairs.push({
      name: 'banner on cyan',
      foreground: banner.color ?? ink,
      background: banner.background,
      fontPx: banner.fontSize ?? 28,
      fontWeight: banner.fontWeight ?? 800,
    })
  }
  if (bubble.background) {
    pairs.push({
      name: 'quick-chat bubble',
      foreground: ink,
      background: bubble.background,
      fontPx: 16,
      fontWeight: 800,
    })
  }
  if (button.background) {
    pairs.push({
      name: 'Jump button',
      foreground: button.color ?? ink,
      background: button.background,
      fontPx: button.fontSize ?? 18,
      fontWeight: button.fontWeight ?? 800,
    })
  }
  if (dive.background) {
    pairs.push({
      name: 'Dive button',
      foreground: button.color ?? ink,
      background: dive.background,
      fontPx: button.fontSize ?? 18,
      fontWeight: button.fontWeight ?? 800,
    })
  }
  return pairs
}

export function readClientCss(): string {
  return readFileSync(new URL('../../../../apps/client/src/style.css', import.meta.url), 'utf8')
}

export function readClientHtml(): string {
  return readFileSync(new URL('../../../../apps/client/index.html', import.meta.url), 'utf8')
}

export function foundationContrastFailures(css = readClientCss()): string[] {
  return contrastFailures(foundationHudPairs(css))
}
