import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AUDIO, GAMEPLAY_RELEVANT_AUDIO } from '@wobblebeans/shared'
import { contrastRatio } from './contrast'
import { missingVisualCues, VISUAL_CUES } from './cues'
import { focusableTags, focusProblems } from './focus'
import { foundationContrastFailures, readClientCss, readClientHtml } from './hud-pairs'
import { allowsDisplacement, flashHz, flashWithinBudget, motionProblems, uiMotionMs } from './motion'
import { TEAM_MARKS } from './teams'

function foundationExpansionGaps(css: string): string[] {
  const gaps: string[] = []
  const brandBar = css.match(/\.brand-bar\s*\{[^}]*\}/)?.[0] ?? ''
  if (!/flex-wrap\s*:\s*wrap/.test(brandBar)) gaps.push('brand-bar does not wrap')
  if (/font-size\s*:\s*\d+px/.test(css) && !/font-size\s*:\s*[\d.]+rem/.test(css)) gaps.push('HUD type is px')
  return gaps
}

describe('accessibility', () => {
  it('keeps HUD text on Cloud panels inside the contrast budget', () => {
    expect(foundationContrastFailures()).toEqual([])
  })

  it('treats the Berry brand as large text and still above 3:1 on Cloud', () => {
    const ratio = contrastRatio('#E8336B', '#FFFDF7')
    expect(ratio).toBeGreaterThanOrEqual(3)
    expect(ratio).toBeLessThan(4.5)
  })

  it('does not drop the focus ring in the gauntlet stylesheet', () => {
    const css = readClientCss()
    const html = readClientHtml()
    expect(focusProblems(css)).toEqual([])
    expect(focusableTags(html).some((tag) => tag.startsWith('<button'))).toBe(true)
  })

  it('caps UI motion and flashing', () => {
    expect(uiMotionMs(250, false)).toBe(250)
    expect(uiMotionMs(250, true)).toBe(150)
    expect(uiMotionMs(80, true)).toBe(80)
    expect(allowsDisplacement(true, 'on')).toBe(false)
    expect(allowsDisplacement(false, 'off')).toBe(false)
    expect(allowsDisplacement(false, 'low')).toBe(true)
    expect(flashWithinBudget(3, 1000)).toBe(true)
    expect(flashWithinBudget(4, 1000)).toBe(false)
    expect(flashHz(3, 1000)).toBe(3)
  })

  it('requires a reduced-motion override only when CSS animates', () => {
    expect(motionProblems(readClientCss())).toEqual([])
    const fixture = readFileSync(new URL('../../fixtures/expansion.html', import.meta.url), 'utf8')
    expect(motionProblems(fixture)).toEqual([])
    expect(motionProblems('@keyframes spin { to { transform: rotate(1turn); } } .x { animation: spin 1s infinite; }')).toEqual([
      'animated CSS has no prefers-reduced-motion override',
    ])
  })

  it('maps every gameplay-relevant sound to a visual cue', () => {
    expect(missingVisualCues(GAMEPLAY_RELEVANT_AUDIO)).toEqual([])
    expect(Object.keys(VISUAL_CUES).sort()).toEqual([...GAMEPLAY_RELEVANT_AUDIO].sort())
    expect(VISUAL_CUES[AUDIO.fallOff].cueId).toBe('vis.fall')
  })

  it('gives every team a colour, a shape, and a pattern', () => {
    expect(new Set(TEAM_MARKS.map((mark) => mark.colour)).size).toBe(TEAM_MARKS.length)
    expect(new Set(TEAM_MARKS.map((mark) => mark.shape)).size).toBe(TEAM_MARKS.length)
    expect(new Set(TEAM_MARKS.map((mark) => mark.pattern)).size).toBe(TEAM_MARKS.length)
  })

  it('records HUD expansion gaps for the foundation stylesheet', () => {
    const known = new Set(['brand-bar does not wrap', 'HUD type is px'])
    const gaps = foundationExpansionGaps(readClientCss())
    expect(gaps.length).toBeGreaterThan(0)
    for (const gap of gaps) expect(known.has(gap)).toBe(true)
  })
})
