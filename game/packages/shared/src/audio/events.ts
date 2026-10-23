/**
 * Audio event ids from docs/design/06-audio.md §2–§3, plus the eight MVP kit
 * pieces that table never named (doc 02 §9): Swing Ball, Spin Bar, Spin Mallet,
 * Tilt Plank, Conveyor, Bumper, Pusher Block, Launch Arm.
 * Workstream 6 owns playback. The sim and UI fire these ids only.
 * No voice-over, and no coin-cascade or slot-machine stingers.
 */
import { VOLUME, type HapticId } from './policy'

export const AUDIO_BUSES = [
  'music',
  'sfx_char',
  'sfx_obstacle',
  'sfx_social',
  'ambience',
  'ui_menu',
  'ui_gameplay',
] as const

export type AudioBus = (typeof AUDIO_BUSES)[number]

export const VOICE_GROUPS = [
  'footstep',
  'character',
  'obstacle',
  'social',
  'ui',
  'stinger',
  'music',
  'ambience',
] as const

export type VoiceGroup = (typeof VOICE_GROUPS)[number]

export const MUSIC_STATES = [
  'menu',
  'lobby',
  'roundIntro',
  'countdown',
  'play',
  'lastSeconds',
  'qualified',
  'out',
  'spectate',
  'final',
  'victory',
  'results',
  'practice',
  'error',
  'parent',
] as const

export type MusicStateId = (typeof MUSIC_STATES)[number]

export const ROUND_TYPES = ['race', 'survival', 'team', 'hunt', 'final'] as const
export type RoundType = (typeof ROUND_TYPES)[number]

export const WORLD_THEMES = ['meadow', 'candy', 'frost', 'starlight', 'splash'] as const
export type WorldTheme = (typeof WORLD_THEMES)[number]

export const FOOTSTEP_SURFACES = ['default', 'metal', 'wood', 'slime', 'ice', 'water'] as const
export type FootstepSurface = (typeof FOOTSTEP_SURFACES)[number]

export type CueShape = 'icon' | 'banner' | 'vignette' | 'shimmer'

export interface AudioEventDef {
  id: string
  bus: AudioBus
  spatial: '2d' | '3d'
  /** Fall-off is 2D for the bean who fell and 3D for everyone else. */
  ownSpatial: '2d' | '3d'
  variations: number
  loop: boolean
  gameplayRelevant: boolean
  visualCueId: string | null
  visualLabel: string
  cueShape: CueShape
  telegraph: boolean
  priority: number
  group: VoiceGroup
  throttleSec: number
  haptic: HapticId | null
  /** Stingers sit on the music slider but do not duck themselves. */
  stinger: boolean
  /** Suppressed for a player the listener has blocked or muted. */
  social: boolean
  rolloffMin: number
  rolloffMax: number
}

interface RowExtra {
  spatial?: '2d' | '3d'
  ownSpatial?: '2d' | '3d'
  variations?: number
  loop?: boolean
  gr?: boolean
  cue: string | null
  label: string
  cueShape?: CueShape
  telegraph?: boolean
  priority?: number
  group: VoiceGroup
  throttle?: number
  haptic?: HapticId | null
  stinger?: boolean
  social?: boolean
}

const seenIds = new Set<string>()

function row<const I extends string, const B extends AudioBus>(
  id: I,
  bus: B,
  extra: RowExtra,
): AudioEventDef & { id: I; bus: B } {
  if (seenIds.has(id)) throw new Error(`duplicate audio id ${id}`)
  seenIds.add(id)
  const spatial = extra.spatial ?? (bus === 'sfx_char' || bus === 'sfx_obstacle' ? '3d' : '2d')
  const telegraph = extra.telegraph ?? false
  const group = extra.group
  const priority =
    extra.priority ??
    (telegraph ? 80 : extra.stinger ? 75 : extra.gr && bus === 'ui_gameplay' ? 70 : defaultPriority(group))
  const rolloffMin = spatial === '2d' ? 1 : telegraph ? VOLUME.tellRolloffMin : VOLUME.characterRolloffMin
  const rolloffMax = spatial === '2d' ? 1 : telegraph ? VOLUME.tellRolloffMax : VOLUME.characterRolloffMax
  return {
    id,
    bus,
    spatial,
    ownSpatial: extra.ownSpatial ?? spatial,
    variations: extra.variations ?? 1,
    loop: extra.loop ?? false,
    gameplayRelevant: extra.gr ?? false,
    visualCueId: extra.cue,
    visualLabel: extra.label,
    cueShape: extra.cueShape ?? (extra.gr ? 'banner' : 'icon'),
    telegraph,
    priority,
    group,
    throttleSec: extra.throttle ?? 0,
    haptic: extra.haptic ?? null,
    stinger: extra.stinger ?? false,
    social: extra.social ?? false,
    rolloffMin,
    rolloffMax,
  }
}

function defaultPriority(group: VoiceGroup): number {
  switch (group) {
    case 'footstep':
      return 25
    case 'character':
      return 55
    case 'obstacle':
      return 50
    case 'social':
      return 30
    case 'ui':
      return 40
    case 'stinger':
      return 75
    case 'music':
      return 5
    case 'ambience':
      return 10
  }
}

const char = (cue: string, label: string, extra: Partial<RowExtra> = {}): RowExtra => ({
  group: 'character',
  cue,
  label,
  ...extra,
})

const tell = (cue: string, label: string, extra: Omit<RowExtra, 'group' | 'cue' | 'label' | 'telegraph' | 'gr'> = {}): RowExtra => ({
  group: 'obstacle',
  cue,
  label,
  telegraph: true,
  gr: true,
  cueShape: 'icon',
  ...extra,
})

const bed = (label: string): RowExtra => ({
  group: 'music',
  cue: null,
  label,
  loop: true,
  spatial: '2d',
})

const ROWS = {
  footstepDefault: row('sfx_char_footstep_default', 'sfx_char', char('cue_anim_foot', 'Step', { group: 'footstep', variations: 6 })),
  footstepMetal: row('sfx_char_footstep_metal', 'sfx_char', char('cue_anim_foot', 'Step', { group: 'footstep', variations: 6 })),
  footstepWood: row('sfx_char_footstep_wood', 'sfx_char', char('cue_anim_foot', 'Step', { group: 'footstep', variations: 6 })),
  footstepSlime: row('sfx_char_footstep_slime', 'sfx_char', char('cue_anim_foot', 'Step', { group: 'footstep', variations: 6 })),
  footstepIce: row('sfx_char_footstep_ice', 'sfx_char', char('cue_anim_foot', 'Step', { group: 'footstep', variations: 6 })),
  footstepWater: row('sfx_char_footstep_water', 'sfx_char', char('cue_anim_foot', 'Step', { group: 'footstep', variations: 6 })),
  jump: row('sfx_char_jump', 'sfx_char', char('cue_anim_jump', 'Jump', { variations: 4 })),
  land: row('sfx_char_land_soft', 'sfx_char', char('cue_anim_land', 'Land', { variations: 4 })),
  landHard: row('sfx_char_land_hard', 'sfx_char', char('cue_anim_land', 'Land', { variations: 4 })),
  dive: row('sfx_char_dive', 'sfx_char', char('cue_anim_dive', 'Dive', { variations: 3 })),
  diveSlide: row('sfx_char_dive_slide', 'sfx_char', char('cue_anim_slide', 'Slide', { loop: true })),
  grabStart: row('sfx_char_grab_start', 'sfx_char', char('cue_grab_link', 'Grabbed', { gr: true, variations: 3, haptic: 'grab' })),
  grabHold: row('sfx_char_grab_hold', 'sfx_char', char('cue_grab_link', 'Grabbed', { gr: true, loop: true, variations: 3 })),
  grabRelease: row('sfx_char_grab_release', 'sfx_char', char('cue_grab_link', 'Grabbed', { gr: true, variations: 3 })),
  breakFree: row('sfx_char_breakfree', 'sfx_char', char('cue_pop', 'Pop', { variations: 2 })),
  bump: row('sfx_char_bump', 'sfx_char', char('cue_anim_bump', 'Bump', { variations: 5 })),
  stumble: row('sfx_char_stumble', 'sfx_char', char('cue_stars', 'Stumble', { variations: 3 })),
  ragdoll: row('sfx_char_ragdoll', 'sfx_char', char('cue_anim_ragdoll', 'Tumble', { variations: 4 })),
  recover: row('sfx_char_recover', 'sfx_char', char('cue_anim_recover', 'Up', { variations: 2 })),
  fallOff: row(
    'sfx_char_fall_offmap',
    'sfx_char',
    char('cue_fall_vignette', 'Falling', { gr: true, variations: 3, ownSpatial: '2d', cueShape: 'vignette' }),
  ),
  respawn: row(
    'sfx_char_respawn',
    'sfx_char',
    char('cue_respawn_shimmer', 'Back', { gr: true, cueShape: 'shimmer' }),
  ),
  oobWarn: row('sfx_char_oob_warn', 'ui_gameplay', {
    group: 'ui',
    cue: 'cue_oob_banner',
    label: 'Come back!',
    gr: true,
    spatial: '2d',
    cueShape: 'banner',
  }),
  slimeOut: row('sfx_char_slime_out', 'sfx_char', char('cue_slime_splash', 'Slime', { gr: true, variations: 2, cueShape: 'banner' })),
  emoteWave: row('sfx_char_emote_wave', 'sfx_social', { group: 'social', cue: 'cue_emote_wave', label: 'Wave', social: true, variations: 2 }),
  emoteCheer: row('sfx_char_emote_cheer', 'sfx_social', { group: 'social', cue: 'cue_emote_cheer', label: 'Cheer', social: true, variations: 2 }),
  emoteDance: row('sfx_char_emote_dance', 'sfx_social', { group: 'social', cue: 'cue_emote_dance', label: 'Dance', social: true, variations: 3 }),
  quickChat: row('sfx_char_quickchat', 'sfx_social', {
    group: 'social',
    cue: 'cue_quickchat_bubble',
    label: 'Chat',
    social: true,
    spatial: '2d',
  }),
  celebWave: row('sfx_char_celeb_wave', 'sfx_social', { group: 'social', cue: 'cue_celeb_wave', label: 'Cheer', social: true, spatial: '2d' }),
  celebCheer: row('sfx_char_celeb_cheer', 'sfx_social', { group: 'social', cue: 'cue_celeb_cheer', label: 'Cheer', social: true, spatial: '2d' }),
  celebDance: row('sfx_char_celeb_dance', 'sfx_social', { group: 'social', cue: 'cue_celeb_dance', label: 'Cheer', social: true, spatial: '2d' }),

  turngate: row('sfx_obs_turngate', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_turngate', label: 'Gate', loop: true }),
  windmill: row('sfx_obs_windmill', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_windmill', label: 'Mill', loop: true }),
  swinglog: row('sfx_obs_swinglog', 'sfx_obstacle', tell('cue_swinglog_windup', 'Log')),
  rolyroller: row('sfx_obs_rolyroller', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_rolyroller', label: 'Roller', loop: true }),
  boingglove: row('sfx_obs_boingglove', 'sfx_obstacle', tell('cue_boingglove', 'Boing')),
  flippad: row('sfx_obs_flippad', 'sfx_obstacle', tell('cue_flippad', 'Flip')),
  button: row('sfx_obs_button', 'sfx_obstacle', tell('cue_button', 'Button')),
  balllauncher: row('sfx_obs_balllauncher', 'sfx_obstacle', tell('cue_balllauncher', 'Ball')),
  fruit: row('sfx_obs_fruit', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_fruit_splat', label: 'Splat' }),
  bouncepad: row('sfx_obs_bouncepad', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_bouncepad', label: 'Bounce' }),
  zoomarch: row('sfx_obs_zoomarch', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_zoomarch', label: 'Zoom' }),
  faketile: row('sfx_obs_faketile_reveal', 'sfx_obstacle', tell('cue_faketile', 'Poof')),
  trickdoor: row('sfx_obs_trickdoor', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_trickdoor', label: 'Door', variations: 2 }),
  dropTileWarn: row('sfx_obs_droptile_warn', 'sfx_obstacle', tell('cue_droptile', 'Tile')),
  dropTileDrop: row('sfx_obs_droptile_drop', 'sfx_obstacle', tell('cue_droptile', 'Tile')),
  fallingPlatform: row('sfx_obs_fallingplatform', 'sfx_obstacle', tell('cue_fallingplatform', 'Platform')),
  spinplate: row('sfx_obs_spinplate', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_spinplate', label: 'Plate', loop: true }),
  hover: row('sfx_obs_hover', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_hover', label: 'Hover', loop: true }),
  bubblewall: row('sfx_obs_bubblewall', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_bubblewall', label: 'Bubble' }),
  puffballoon: row('sfx_obs_puffballoon', 'sfx_obstacle', tell('cue_puffballoon', 'Balloon')),
  pinball: row('sfx_obs_pinball', 'sfx_obstacle', tell('cue_pinball', 'Paddle')),
  lightbar: row('sfx_obs_lightbar', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_lightbar', label: 'Bar', loop: true }),
  windfan: row('sfx_obs_windfan', 'sfx_obstacle', tell('cue_windfan', 'Wind', { loop: true })),
  whooshtube: row('sfx_obs_whooshtube', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_whooshtube', label: 'Whoosh' }),
  portal: row('sfx_obs_portal', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_portal', label: 'Portal' }),
  gatesLogs: row('sfx_obs_gates_logs', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_gates_logs', label: 'Clonk' }),
  aiPenguin: row('sfx_obs_ai_penguin', 'sfx_obstacle', tell('cue_penguin', 'Penguin')),
  aiRhino: row('sfx_obs_ai_rhino', 'sfx_obstacle', tell('cue_rhino', 'Rhino')),
  checkpoint: row('sfx_obs_checkpoint', 'sfx_obstacle', {
    group: 'obstacle',
    cue: 'cue_checkpoint_flag',
    label: 'Checkpoint',
    gr: true,
    cueShape: 'icon',
  }),
  slimeRise: row('sfx_obs_slime_rise', 'sfx_obstacle', tell('cue_slime_line', 'Slime', { loop: true })),

  // Doc 02 §9 kit pieces that §3 of the audio doc did not name.
  swingBall: row('sfx_obs_swingball', 'sfx_obstacle', tell('cue_swingball_windup', 'Swing')),
  spinBar: row('sfx_obs_spinbar', 'sfx_obstacle', tell('cue_spinbar', 'Bar', { loop: true })),
  spinMallet: row('sfx_obs_spinmallet', 'sfx_obstacle', tell('cue_spinmallet', 'Mallet')),
  tiltPlank: row('sfx_obs_tiltplank', 'sfx_obstacle', tell('cue_tiltplank', 'Plank')),
  conveyor: row('sfx_obs_conveyor', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_conveyor_belt', label: 'Belt', loop: true }),
  bumper: row('sfx_obs_bumper', 'sfx_obstacle', { group: 'obstacle', cue: 'cue_bumper_squash', label: 'Bump', variations: 3 }),
  pusher: row('sfx_obs_pusher', 'sfx_obstacle', tell('cue_pusher_windup', 'Pusher')),
  launchArm: row('sfx_obs_launcharm', 'sfx_obstacle', tell('cue_launcharm_windup', 'Launch')),

  ambMeadow: row('amb_meadow', 'ambience', { group: 'ambience', cue: 'cue_world_meadow', label: 'Meadow', loop: true }),
  ambCandy: row('amb_candy', 'ambience', { group: 'ambience', cue: 'cue_world_candy', label: 'Candy', loop: true }),
  ambFrost: row('amb_frost', 'ambience', { group: 'ambience', cue: 'cue_world_frost', label: 'Frost', loop: true }),
  ambStarlight: row('amb_starlight', 'ambience', { group: 'ambience', cue: 'cue_world_starlight', label: 'Starlight', loop: true }),
  ambSplash: row('amb_splash', 'ambience', { group: 'ambience', cue: 'cue_world_splash', label: 'Splash', loop: true }),

  introRace: row('stg_roundintro_race', 'music', { group: 'stinger', cue: 'cue_roundtype_race', label: 'Race', gr: true, stinger: true }),
  introSurvival: row('stg_roundintro_survival', 'music', { group: 'stinger', cue: 'cue_roundtype_survival', label: 'Survive', gr: true, stinger: true }),
  introTeam: row('stg_roundintro_team', 'music', { group: 'stinger', cue: 'cue_roundtype_team', label: 'Team', gr: true, stinger: true }),
  introHunt: row('stg_roundintro_hunt', 'music', { group: 'stinger', cue: 'cue_roundtype_hunt', label: 'Hunt', gr: true, stinger: true }),
  introFinal: row('stg_roundintro_final', 'music', { group: 'stinger', cue: 'cue_roundtype_final', label: 'Final', gr: true, stinger: true }),
  count3: row('sfx_round_count_3', 'ui_gameplay', { group: 'ui', cue: 'cue_count_3', label: '3', gr: true }),
  count2: row('sfx_round_count_2', 'ui_gameplay', { group: 'ui', cue: 'cue_count_2', label: '2', gr: true }),
  count1: row('sfx_round_count_1', 'ui_gameplay', { group: 'ui', cue: 'cue_count_1', label: '1', gr: true }),
  countGo: row('sfx_round_count_go', 'ui_gameplay', { group: 'ui', cue: 'cue_count_go', label: 'GO', gr: true, haptic: 'go' }),
  lastSecondsTick: row('sfx_round_lastseconds_tick', 'ui_gameplay', { group: 'ui', cue: 'cue_lastseconds', label: 'Hurry', gr: true }),
  qualifiedOther: row('sfx_round_qualified_other', 'ui_gameplay', {
    group: 'ui',
    cue: 'cue_qualified_count',
    label: 'Qualified',
    gr: true,
    throttle: VOLUME.qualifyOtherThrottleSec,
  }),
  endWhistle: row('sfx_round_end_whistle', 'ui_gameplay', { group: 'ui', cue: 'cue_round_over', label: 'Round over', gr: true }),
  teamScoreOwn: row('sfx_team_score_own', 'ui_gameplay', { group: 'ui', cue: 'cue_score_own', label: 'Score', gr: true }),
  teamScoreOther: row('sfx_team_score_other', 'ui_gameplay', { group: 'ui', cue: 'cue_score_other', label: 'Score', gr: true }),
  huntTailLost: row('sfx_hunt_tail_lost', 'ui_gameplay', { group: 'ui', cue: 'cue_tail_lost', label: 'Tail', gr: true }),
  uiWarning: row('sfx_ui_warning', 'ui_gameplay', {
    group: 'ui',
    cue: 'cue_warning',
    label: '!',
    gr: true,
    throttle: VOLUME.warningThrottleSec,
  }),

  qualified: row('stg_qualified', 'music', {
    group: 'stinger',
    cue: 'cue_qualified',
    label: 'You made it!',
    gr: true,
    stinger: true,
    haptic: 'qualified',
  }),
  greatTry: row('stg_out_greattry', 'music', {
    group: 'stinger',
    cue: 'cue_out_greattry',
    label: 'Great try!',
    gr: true,
    stinger: true,
  }),
  finalStinger: row('stg_final', 'music', { group: 'stinger', cue: 'cue_final', label: 'Final', gr: true, stinger: true }),
  musVictory: row('mus_victory', 'music', bed('Victory')),
  musResults: row('mus_results', 'music', bed('Results')),
  rewardXp: row('sfx_reward_xp', 'music', { group: 'stinger', cue: 'cue_reward_xp', label: 'XP', stinger: true }),
  rewardCoins: row('sfx_reward_coins', 'music', { group: 'stinger', cue: 'cue_reward_coins', label: 'Coins', stinger: true }),
  rewardItem: row('sfx_reward_item', 'music', { group: 'stinger', cue: 'cue_reward_item', label: 'Item', stinger: true }),

  uiNav: row('ui_nav_move', 'ui_menu', { group: 'ui', cue: null, label: 'Move' }),
  uiConfirm: row('ui_confirm', 'ui_menu', { group: 'ui', cue: null, label: 'OK' }),
  uiBack: row('ui_back', 'ui_menu', { group: 'ui', cue: null, label: 'Back' }),
  uiToggle: row('ui_toggle', 'ui_menu', { group: 'ui', cue: null, label: 'Toggle' }),
  uiSlider: row('ui_slider_tick', 'ui_menu', { group: 'ui', cue: null, label: 'Slider' }),
  uiTab: row('ui_tab', 'ui_menu', { group: 'ui', cue: null, label: 'Tab' }),
  uiError: row('ui_error', 'ui_menu', { group: 'ui', cue: null, label: 'Error' }),
  uiPurchase: row('ui_purchase_confirm', 'ui_menu', { group: 'ui', cue: null, label: 'Confirm' }),
  uiParentGate: row('ui_parentgate_open', 'ui_menu', { group: 'ui', cue: null, label: 'Grown-ups' }),
  uiReport: row('ui_report_sent', 'ui_menu', { group: 'ui', cue: null, label: 'Sent' }),
  uiMute: row('ui_mute_player', 'ui_menu', { group: 'ui', cue: null, label: 'Muted' }),

  musMenu: row('mus_menu', 'music', bed('Menu')),
  musLobby: row('mus_lobby', 'music', bed('Lobby')),
  musPractice: row('mus_practice', 'music', bed('Practice')),
  musRoundMeadow: row('mus_round_meadow', 'music', bed('Meadow')),
  musRoundCandy: row('mus_round_candy', 'music', bed('Candy')),
  musRoundFrost: row('mus_round_frost', 'music', bed('Frost')),
  musRoundStarlight: row('mus_round_starlight', 'music', bed('Starlight')),
  musRoundSplash: row('mus_round_splash', 'music', bed('Splash')),
  musFinalMeadow: row('mus_final_meadow', 'music', bed('Final')),
  musFinalCandy: row('mus_final_candy', 'music', bed('Final')),
  musFinalFrost: row('mus_final_frost', 'music', bed('Final')),
  musFinalStarlight: row('mus_final_starlight', 'music', bed('Final')),
  musFinalSplash: row('mus_final_splash', 'music', bed('Final')),
  fxLastSeconds: row('fx_lastseconds', 'music', bed('Last seconds')),
}

type Rows = typeof ROWS

export const AUDIO = Object.fromEntries(Object.entries(ROWS).map(([key, def]) => [key, def.id])) as {
  [K in keyof Rows]: Rows[K]['id']
}

export type AudioEventId = Rows[keyof Rows]['id']

const BY_ID = new Map<AudioEventId, AudioEventDef>(Object.values(ROWS).map((def) => [def.id as AudioEventId, def]))

export function audioDef(id: AudioEventId): AudioEventDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`unknown audio id ${id}`)
  return def
}

export const AUDIO_CATALOGUE: Readonly<Record<AudioEventId, AudioEventDef>> = Object.fromEntries(BY_ID) as Record<
  AudioEventId,
  AudioEventDef
>

export function listAudioIds(): AudioEventId[] {
  return Object.values(ROWS).map((def) => def.id as AudioEventId)
}

export const GAMEPLAY_RELEVANT_AUDIO: AudioEventId[] = Object.values(ROWS)
  .filter((def) => def.gameplayRelevant)
  .map((def) => def.id as AudioEventId)

/** One telegraph (or loop) id per MVP kit piece, doc 02 §9. */
export const KIT_AUDIO = {
  swingBall: AUDIO.swingBall,
  spinBar: AUDIO.spinBar,
  spinMallet: AUDIO.spinMallet,
  tiltPlank: AUDIO.tiltPlank,
  conveyor: AUDIO.conveyor,
  bumper: AUDIO.bumper,
  pusher: AUDIO.pusher,
  launchArm: AUDIO.launchArm,
  trickDoor: AUDIO.trickdoor,
  dropTile: AUDIO.dropTileWarn,
  slime: AUDIO.slimeRise,
} as const

/** The eight kit ids that docs/design/06-audio.md §3.2 did not list. */
export const KIT_AUDIO_ADDED: AudioEventId[] = [
  AUDIO.swingBall,
  AUDIO.spinBar,
  AUDIO.spinMallet,
  AUDIO.tiltPlank,
  AUDIO.conveyor,
  AUDIO.bumper,
  AUDIO.pusher,
  AUDIO.launchArm,
]

export function emoteAudioId(emoteId: number): AudioEventId | null {
  if (emoteId === 1) return AUDIO.emoteWave
  if (emoteId === 2) return AUDIO.emoteCheer
  if (emoteId === 3) return AUDIO.emoteDance
  return null
}

export function celebrationAudioId(emoteId: number): AudioEventId | null {
  if (emoteId === 1) return AUDIO.celebWave
  if (emoteId === 2) return AUDIO.celebCheer
  if (emoteId === 3) return AUDIO.celebDance
  return null
}

export function footstepAudioId(surface: FootstepSurface): AudioEventId {
  switch (surface) {
    case 'default':
      return AUDIO.footstepDefault
    case 'metal':
      return AUDIO.footstepMetal
    case 'wood':
      return AUDIO.footstepWood
    case 'slime':
      return AUDIO.footstepSlime
    case 'ice':
      return AUDIO.footstepIce
    case 'water':
      return AUDIO.footstepWater
  }
}

export function roundIntroAudioId(type: RoundType): AudioEventId {
  switch (type) {
    case 'race':
      return AUDIO.introRace
    case 'survival':
      return AUDIO.introSurvival
    case 'team':
      return AUDIO.introTeam
    case 'hunt':
      return AUDIO.introHunt
    case 'final':
      return AUDIO.introFinal
  }
}

export function roundMusicAudioId(theme: WorldTheme): AudioEventId {
  switch (theme) {
    case 'meadow':
      return AUDIO.musRoundMeadow
    case 'candy':
      return AUDIO.musRoundCandy
    case 'frost':
      return AUDIO.musRoundFrost
    case 'starlight':
      return AUDIO.musRoundStarlight
    case 'splash':
      return AUDIO.musRoundSplash
  }
}

export function finalMusicAudioId(theme: WorldTheme): AudioEventId {
  switch (theme) {
    case 'meadow':
      return AUDIO.musFinalMeadow
    case 'candy':
      return AUDIO.musFinalCandy
    case 'frost':
      return AUDIO.musFinalFrost
    case 'starlight':
      return AUDIO.musFinalStarlight
    case 'splash':
      return AUDIO.musFinalSplash
  }
}

export function ambienceAudioId(theme: WorldTheme): AudioEventId {
  switch (theme) {
    case 'meadow':
      return AUDIO.ambMeadow
    case 'candy':
      return AUDIO.ambCandy
    case 'frost':
      return AUDIO.ambFrost
    case 'starlight':
      return AUDIO.ambStarlight
    case 'splash':
      return AUDIO.ambSplash
  }
}
