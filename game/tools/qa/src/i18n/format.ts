/**
 * The small subset of ICU MessageFormat the HUD needs (doc 04 L9).
 * One plural (`one` / `other`) or simple `{name}` placeholders. No concatenation in callers.
 */
export function formatMessage(template: string, values: Record<string, string | number> = {}): string {
  const plural = template.match(/^\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}$/)
  if (plural) {
    const key = plural[1]!
    const n = Number(values[key] ?? 0)
    const inner = n === 1 ? plural[2]! : plural[3]!
    return inner.replaceAll('#', String(n))
  }
  return template.replace(/\{(\w+)\}/g, (_whole, key: string) => String(values[key] ?? ''))
}
