/** Doc 04 §6 and doc 08 NFR-10-19. Reduced motion shortens tweens to a fade. */
export const MOTION = {
  fastMs: 150,
  baseMs: 250,
  reducedMaxMs: 150,
  flashMaxHz: 3,
} as const

export function uiMotionMs(requestedMs: number, prefersReduced: boolean): number {
  if (!prefersReduced) return requestedMs
  return Math.min(requestedMs, MOTION.reducedMaxMs)
}

export function allowsDisplacement(prefersReduced: boolean, setting: 'on' | 'low' | 'off'): boolean {
  if (prefersReduced || setting === 'off') return false
  return setting === 'on' || setting === 'low'
}

export function flashHz(pulses: number, windowMs: number): number {
  if (windowMs <= 0) throw new Error('window must be positive')
  return pulses / (windowMs / 1000)
}

export function flashWithinBudget(pulses: number, windowMs: number): boolean {
  return flashHz(pulses, windowMs) <= MOTION.flashMaxHz
}

/** Animations need a reduced-motion override. A stylesheet with no animation passes. */
export function motionProblems(css: string): string[] {
  const animated = /@keyframes|\banimation\s*:/.test(css)
  if (!animated) return []
  const reduced = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/.test(css)
  if (!reduced) return ['animated CSS has no prefers-reduced-motion override']
  return []
}
