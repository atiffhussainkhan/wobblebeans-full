import { describe, expect, it } from 'vitest'
import {
  AUDIO,
  AUDIO_CATALOGUE,
  GAMEPLAY_RELEVANT_AUDIO,
  KIT_AUDIO,
  KIT_AUDIO_ADDED,
  MUSIC_STATES,
  ROUND_TYPES,
  WORLD_THEMES,
  ambienceAudioId,
  audioDef,
  celebrationAudioId,
  emoteAudioId,
  finalMusicAudioId,
  footstepAudioId,
  listAudioIds,
  roundIntroAudioId,
  roundMusicAudioId,
} from './events'

/**
 * Expanded from docs/design/06-audio.md §3. Template ids (`<surface>`, `<type>`,
 * `<theme>`, soft/hard, start/hold/release) are listed as the concrete ids the
 * sim is allowed to fire. The eight kit pieces missing from that table are at
 * the bottom.
 */
const DESIGN_IDS = [
  'sfx_char_footstep_default',
  'sfx_char_footstep_metal',
  'sfx_char_footstep_wood',
  'sfx_char_footstep_slime',
  'sfx_char_footstep_ice',
  'sfx_char_footstep_water',
  'sfx_char_jump',
  'sfx_char_land_soft',
  'sfx_char_land_hard',
  'sfx_char_dive',
  'sfx_char_dive_slide',
  'sfx_char_grab_start',
  'sfx_char_grab_hold',
  'sfx_char_grab_release',
  'sfx_char_breakfree',
  'sfx_char_bump',
  'sfx_char_stumble',
  'sfx_char_ragdoll',
  'sfx_char_recover',
  'sfx_char_fall_offmap',
  'sfx_char_respawn',
  'sfx_char_oob_warn',
  'sfx_char_slime_out',
  'sfx_char_emote_wave',
  'sfx_char_emote_cheer',
  'sfx_char_emote_dance',
  'sfx_char_quickchat',
  'sfx_char_celeb_wave',
  'sfx_char_celeb_cheer',
  'sfx_char_celeb_dance',
  'sfx_obs_turngate',
  'sfx_obs_windmill',
  'sfx_obs_swinglog',
  'sfx_obs_rolyroller',
  'sfx_obs_boingglove',
  'sfx_obs_flippad',
  'sfx_obs_button',
  'sfx_obs_balllauncher',
  'sfx_obs_fruit',
  'sfx_obs_bouncepad',
  'sfx_obs_zoomarch',
  'sfx_obs_faketile_reveal',
  'sfx_obs_trickdoor',
  'sfx_obs_droptile_warn',
  'sfx_obs_droptile_drop',
  'sfx_obs_fallingplatform',
  'sfx_obs_spinplate',
  'sfx_obs_hover',
  'sfx_obs_bubblewall',
  'sfx_obs_puffballoon',
  'sfx_obs_pinball',
  'sfx_obs_lightbar',
  'sfx_obs_windfan',
  'sfx_obs_whooshtube',
  'sfx_obs_portal',
  'sfx_obs_gates_logs',
  'sfx_obs_ai_penguin',
  'sfx_obs_ai_rhino',
  'sfx_obs_checkpoint',
  'sfx_obs_slime_rise',
  'amb_meadow',
  'amb_candy',
  'amb_frost',
  'amb_starlight',
  'amb_splash',
  'stg_roundintro_race',
  'stg_roundintro_survival',
  'stg_roundintro_team',
  'stg_roundintro_hunt',
  'stg_roundintro_final',
  'sfx_round_count_3',
  'sfx_round_count_2',
  'sfx_round_count_1',
  'sfx_round_count_go',
  'sfx_round_lastseconds_tick',
  'sfx_round_qualified_other',
  'sfx_round_end_whistle',
  'sfx_team_score_own',
  'sfx_team_score_other',
  'sfx_hunt_tail_lost',
  'sfx_ui_warning',
  'stg_qualified',
  'stg_out_greattry',
  'stg_final',
  'mus_victory',
  'mus_results',
  'sfx_reward_xp',
  'sfx_reward_coins',
  'sfx_reward_item',
  'ui_nav_move',
  'ui_confirm',
  'ui_back',
  'ui_toggle',
  'ui_slider_tick',
  'ui_tab',
  'ui_error',
  'ui_purchase_confirm',
  'ui_parentgate_open',
  'ui_report_sent',
  'ui_mute_player',
  'mus_menu',
  'mus_lobby',
  'mus_practice',
  'fx_lastseconds',
] as const

const ROUND_BEDS = WORLD_THEMES.flatMap((theme) => [`mus_round_${theme}`, `mus_final_${theme}`])

describe('audio event catalogue', () => {
  it('keeps the foundation ids the sim already fires', () => {
    expect(AUDIO.jump).toBe('sfx_char_jump')
    expect(AUDIO.land).toBe('sfx_char_land_soft')
    expect(AUDIO.dive).toBe('sfx_char_dive')
    expect(AUDIO.diveSlide).toBe('sfx_char_dive_slide')
    expect(AUDIO.fallOff).toBe('sfx_char_fall_offmap')
    expect(AUDIO.respawn).toBe('sfx_char_respawn')
    expect(AUDIO.quickChat).toBe('sfx_char_quickchat')
    expect(AUDIO.checkpoint).toBe('sfx_obs_checkpoint')
    expect(AUDIO.uiConfirm).toBe('ui_confirm')
    expect(AUDIO.uiBack).toBe('ui_back')
    expect(AUDIO.qualified).toBe('stg_qualified')
    expect(AUDIO.greatTry).toBe('stg_out_greattry')
    expect(AUDIO.rewardCoins).toBe('sfx_reward_coins')
  })

  it('lists every design event id', () => {
    const have = new Set(listAudioIds())
    const missing = DESIGN_IDS.filter((id) => !have.has(id))
    expect(missing).toEqual([])
  })

  it('lists a round bed and a distinct final bed for every world theme', () => {
    const have = new Set<string>(listAudioIds())
    expect(ROUND_BEDS.filter((id) => !have.has(id))).toEqual([])
    for (const theme of WORLD_THEMES) {
      expect(roundMusicAudioId(theme)).toBe(`mus_round_${theme}`)
      expect(finalMusicAudioId(theme)).toBe(`mus_final_${theme}`)
      expect(ambienceAudioId(theme)).toBe(`amb_${theme}`)
      expect(roundMusicAudioId(theme)).not.toBe(finalMusicAudioId(theme))
    }
  })

  it('gives every one of the 11 kit pieces a sound, including the 8 the design table missed', () => {
    expect(Object.keys(KIT_AUDIO)).toHaveLength(11)
    expect(KIT_AUDIO_ADDED).toHaveLength(8)
    const have = new Set(listAudioIds())
    for (const id of Object.values(KIT_AUDIO)) expect(have.has(id)).toBe(true)
    expect(KIT_AUDIO_ADDED).toEqual([
      'sfx_obs_swingball',
      'sfx_obs_spinbar',
      'sfx_obs_spinmallet',
      'sfx_obs_tiltplank',
      'sfx_obs_conveyor',
      'sfx_obs_bumper',
      'sfx_obs_pusher',
      'sfx_obs_launcharm',
    ])
    for (const id of KIT_AUDIO_ADDED) expect(audioDef(id).telegraph || id === 'sfx_obs_bumper' || id === 'sfx_obs_conveyor').toBe(true)
  })

  it('fails if any AUDIO value has no bus entry', () => {
    const buses = new Set([
      'music',
      'sfx_char',
      'sfx_obstacle',
      'sfx_social',
      'ambience',
      'ui_menu',
      'ui_gameplay',
    ])
    for (const id of listAudioIds()) {
      const def = audioDef(id)
      expect(def, id).toBeTruthy()
      expect(buses.has(def.bus), `${id} bus ${def.bus}`).toBe(true)
      expect(def.id).toBe(id)
    }
    expect(Object.keys(AUDIO_CATALOGUE)).toHaveLength(listAudioIds().length)
  })

  it('marks every gameplay-relevant sound and gives it a visual twin', () => {
    const gr = new Set<string>(GAMEPLAY_RELEVANT_AUDIO)
    expect(gr.has(AUDIO.fallOff)).toBe(true)
    expect(gr.has(AUDIO.respawn)).toBe(true)
    expect(gr.has(AUDIO.checkpoint)).toBe(true)
    expect(gr.has(AUDIO.qualified)).toBe(true)
    expect(gr.has(AUDIO.greatTry)).toBe(true)
    for (const id of listAudioIds()) {
      const def = audioDef(id)
      expect(def.gameplayRelevant).toBe(gr.has(id))
      if (def.gameplayRelevant) {
        expect(def.visualCueId, id).toBeTruthy()
        expect(def.visualLabel.length).toBeGreaterThan(0)
      }
    }
  })

  it('gives every gameplay sound a visual twin, including ones that are not threats', () => {
    for (const id of listAudioIds()) {
      const def = audioDef(id)
      const gameplay = def.group !== 'ui' && def.group !== 'music'
      if (gameplay) expect(def.visualCueId, id).toBeTruthy()
    }
  })

  it('has no voice-over, gambling stingers, or duplicate ids', () => {
    const ids = listAudioIds()
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).not.toMatch(/voice|vo_|lyric|speech|slot|jackpot|cascade|near-?miss|boo|wah/i)
    }
    expect(MUSIC_STATES).toContain('menu')
    expect(MUSIC_STATES).toContain('play')
    expect(MUSIC_STATES).toContain('lastSeconds')
    expect(MUSIC_STATES).toContain('qualified')
    expect(MUSIC_STATES).toContain('out')
    expect(MUSIC_STATES).toContain('results')
    expect(ROUND_TYPES).toEqual(['race', 'survival', 'team', 'hunt', 'final'])
  })

  it('resolves emotes, celebrations, footsteps, and round intros', () => {
    expect(emoteAudioId(1)).toBe(AUDIO.emoteWave)
    expect(emoteAudioId(2)).toBe(AUDIO.emoteCheer)
    expect(emoteAudioId(3)).toBe(AUDIO.emoteDance)
    expect(emoteAudioId(9)).toBeNull()
    expect(celebrationAudioId(2)).toBe(AUDIO.celebCheer)
    expect(footstepAudioId('ice')).toBe('sfx_char_footstep_ice')
    expect(roundIntroAudioId('hunt')).toBe('stg_roundintro_hunt')
    expect(audioDef(AUDIO.quickChat).social).toBe(true)
    expect(audioDef(AUDIO.emoteWave).social).toBe(true)
    expect(audioDef(AUDIO.rewardCoins).id).toBe('sfx_reward_coins')
  })
})
