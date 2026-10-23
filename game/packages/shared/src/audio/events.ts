/**
 * Audio event ids from docs/design/06-audio.md.
 * Workstream 6 owns playback. The sim and UI reference these ids only.
 * No gambling stingers (no coin-cascade, no slot-machine).
 */
export const AUDIO = {
  jump: 'sfx_char_jump',
  land: 'sfx_char_land_soft',
  dive: 'sfx_char_dive',
  diveSlide: 'sfx_char_dive_slide',
  fallOff: 'sfx_char_fall_offmap',
  respawn: 'sfx_char_respawn',
  quickChat: 'sfx_char_quickchat',
  checkpoint: 'sfx_obs_checkpoint',
  uiConfirm: 'ui_confirm',
  uiBack: 'ui_back',
  qualified: 'stg_qualified',
  greatTry: 'stg_out_greattry',
  rewardCoins: 'sfx_reward_coins',
} as const

export type AudioEventId = (typeof AUDIO)[keyof typeof AUDIO]

/** Gameplay-relevant sounds that need a visual twin (FR-08-12). */
export const GAMEPLAY_RELEVANT_AUDIO: AudioEventId[] = [
  AUDIO.fallOff,
  AUDIO.respawn,
  AUDIO.checkpoint,
  AUDIO.qualified,
  AUDIO.greatTry,
]
