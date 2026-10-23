const ACCENTS: Record<string, string> = {
  a: 'à',
  A: 'À',
  e: 'é',
  E: 'É',
  i: 'î',
  I: 'Î',
  o: 'ô',
  O: 'Ô',
  u: 'û',
  U: 'Û',
  y: 'ÿ',
  Y: 'Ý',
  c: 'ç',
  C: 'Ç',
  n: 'ñ',
  N: 'Ñ',
}

function accent(text: string): string {
  let out = ''
  for (const ch of text) out += ACCENTS[ch] ?? ch
  return out
}

/**
 * Pseudo-localisation from doc 04 §7 L3: accents, brackets, and about +40% length.
 * Brackets count toward the length. Very short strings grow by the two brackets
 * when that is already more than 40%.
 */
export function pseudoLocalise(source: string, expansion = 0.4): string {
  if (source.length === 0) return '[]'
  const target = Math.max(Math.ceil(source.length * (1 + expansion)), source.length + 2)
  const accented = accent(source)
  const pad = Math.max(0, target - 2 - accented.length)
  return `[${accented}${'·'.repeat(pad)}]`
}

export function pseudoTargetLength(source: string, expansion = 0.4): number {
  if (source.length === 0) return 2
  return Math.max(Math.ceil(source.length * (1 + expansion)), source.length + 2)
}

/** A string of `maxLength` characters, starting from the pseudo-localised source. */
export function longString(source: string, maxLength: number): string {
  const pseudo = pseudoLocalise(source)
  if (pseudo.length >= maxLength) return pseudo.slice(0, maxLength)
  return pseudo + 'W'.repeat(maxLength - pseudo.length)
}
