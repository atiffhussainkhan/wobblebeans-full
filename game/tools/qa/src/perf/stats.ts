/** Nearest-rank percentile. `p` is 0–100. */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) throw new Error('no samples')
  const sorted = [...samples].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1))
  return sorted[index]!
}

export function mean(samples: readonly number[]): number {
  if (samples.length === 0) throw new Error('no samples')
  let sum = 0
  for (const sample of samples) sum += sample
  return sum / samples.length
}

export function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000
}
