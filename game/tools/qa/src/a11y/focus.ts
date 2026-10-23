/**
 * Visible focus for keyboard and controller (doc 04 §6, focus ring ≥ 4px, 3:1).
 * Removing the outline is only OK when a :focus-visible rule paints a ring.
 */
export function focusProblems(css: string): string[] {
  const problems: string[] = []
  const killsOutline = /outline\s*:\s*(none|0)\b/.test(css)
  const paintsRing = /:focus-visible[\s\S]*?(outline|box-shadow)\s*:/.test(css)
  if (killsOutline && !paintsRing) {
    problems.push('outline is removed and :focus-visible does not paint a ring')
  }
  return problems
}

export function focusableTags(html: string): string[] {
  const tags = html.match(/<(button|a|select|textarea)\b|tabindex\s*=/gi) ?? []
  return tags.map((tag) => tag.toLowerCase())
}
