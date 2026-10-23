/**
 * Picture report categories. Ids match ModerationService REPORT_CATEGORIES.
 * Labels are the preset copy from doc 09 §7. There is no free-text reason.
 */
export const REPORT_PICTURES = [
  { id: 'unfair', label: 'Cheating' },
  { id: 'mean', label: 'Being mean' },
  { id: 'scary', label: 'Something upset me' },
  { id: 'bug', label: 'Bad name or picture' },
] as const

export type ReportPictureId = (typeof REPORT_PICTURES)[number]['id']

export function reportPictureLabel(id: string): string | null {
  const row = REPORT_PICTURES.find((picture) => picture.id === id)
  return row ? row.label : null
}
