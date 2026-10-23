import { AUDIO, type AudioEventId } from '@wobblebeans/shared'

export interface VisualCue {
  cueId: string
  /** What the player sees with the sound muted. */
  description: string
}

/**
 * Every gameplay-relevant audio id has a visual twin (FR-08-12, doc 06 §7).
 * Streams 5 and 6 render these ids. This map is the CI cross-reference.
 */
export const VISUAL_CUES = {
  [AUDIO.fallOff]: {
    cueId: 'vis.fall',
    description: 'The bean drops below the course and a respawn mark appears.',
  },
  [AUDIO.respawn]: {
    cueId: 'vis.respawn',
    description: 'The bean pops back onto its pad.',
  },
  [AUDIO.checkpoint]: {
    cueId: 'vis.checkpoint',
    description: 'The checkpoint marker pulses once, never faster than 3 Hz.',
  },
  [AUDIO.qualified]: {
    cueId: 'vis.qualified',
    description: 'The qualification slate shows a check.',
  },
  [AUDIO.greatTry]: {
    cueId: 'vis.out',
    description: 'The out slate shows.',
  },
} as const satisfies Record<string, VisualCue>

export function missingVisualCues(ids: readonly AudioEventId[]): AudioEventId[] {
  const known: Record<string, VisualCue> = VISUAL_CUES
  return ids.filter((id) => !Object.prototype.hasOwnProperty.call(known, id))
}
