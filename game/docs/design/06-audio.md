# 06 — Audio Design (Wobblebeans)

Owner: Audio Director · Date: 2026-10-23 · Status: Draft v1
Sources: `Wobblebeans_Requirements_v3.docx` (Ch. 8, 10, 11, 12, App. C) and `08-ui-ux-audio.md`.
Fall Guys is a genre reference only (UD-2, AD-25, AD-38). No reference music, SFX, stems or melodies are used, imitated or sampled.

## 0. Requirement trace (summary)

| Req | What it asks | Where this doc meets it |
|---|---|---|
| UD-1 | Child-directed, no voice, no countdown pressure | §5, §6, §8 |
| UD-4 / AD-24 / FR-11-18 | Bright, non-violent slapstick; PEGI 3 / ESRB E | §1, §3 (sound-design rules) |
| AD-53 | No spoken presenter | §8 |
| AD-02 / FR-11-03 / FR-07-09 | No voice for players | §8 |
| FR-08-07 | Original, toy-like electro-pop, no lyrics; menu/round/Final/victory cues; −16 LUFS ±1 | §1, §2, §5 |
| FR-08-08 | SFX for jump, dive, grab, fall, bounce, qualify, eliminate; event list; visual equivalents | §3 (audio event list) |
| FR-08-09 | Master/Music/SFX/UI sliders 0–100, ≤100 ms, persisted | §4, §6 |
| FR-08-12 AC4 / AD-45 | Visual indicator for every gameplay-relevant audio cue | §7 |
| FR-08-02 / NFR-10-19 | Warning cue; ≤3 flashes/s | §3.4, §7 |
| FR-08-03 / FR-08-19 | Kind outcome tone | §3.5 (Out stinger rules) |
| FR-08-17 | Tutorial has no voice-over | §8 |
| FR-07-15 | Block and mute | §3.6 |
| FR-03-01…17, FR-04-01…08 | Obstacles, movement, physics | §3.1–3.3 |
| FR-01-02…09 | Show phases | §2 |
| FR-12-01/02/03/07/08 | Manifest, naming, formats, provenance, review | §9 |
| FR-09 (Builder level settings) | Level music track choice | §2.3, Issue A-03 |

## 1. Music direction (FR-08-07, UD-4)

- **Genre:** original, upbeat, toy-like electro-pop. **No lyrics, no sung words, no vocal chops that sound like words.**
- **Palette:** toy xylophone, kazoo, ukulele, squeaky synth leads, bouncy sub bass, hand-claps, slide whistle, boing springs, toy-box and household percussion (recorded new by us). Major and Mixolydian keys; 120–140 BPM for rounds, 95–110 BPM for menus.
- **Never:** minor-key tension horror, dissonant stingers, sirens, alarms, gun/explosion hits, war drums, laughter aimed at a player, anything "scary" (AD-24).
- **Originality guardrails:** no reference tracks in briefs except as written genre words; composers sign an originality statement; every track gets a melody-similarity check against the reference OST before sign-off (Issue A-09). Every cue has a provenance record (FR-12-07) and content review (FR-12-08). AI-assisted music is allowed only with the AI-use flag and full rights.
- **Structure:** every round track is built from **horizontal sections + vertical stems** (drums, bass, harmony, lead, fun-layer) so the adaptive system in §2 can add or strip layers without hard cuts.

## 2. Adaptive music states per show phase (FR-01, FR-08-04, FR-08-07 AC1)

### 2.1 State machine

| State | Screen | Music | Transition in | Notes |
|---|---|---|---|---|
| M0 Menu | SC-01, SC-02, SC-09, SC-10 | `mus_menu` loop, light (drums+bass+harmony) | 2 s crossfade | Dressing Room adds "fun-layer". Settings ducks music −6 dB. No urgency, no countdown music in the shop (UD-1 no-dark-patterns). |
| M1 Lobby | SC-03 | `mus_lobby` loop, 100 BPM | on Play pressed, bar-synced | Layers add as lobby fills (25/50/75/100%). Never speeds up to pressure the child. |
| M2 Round intro | SC-04 | `stg_roundintro_<type>` (Race/Survival/Team/Hunt/Final) ≤4 s | hard on bar 1 | Type stinger = auditory twin of the round-type icon. |
| M3 Countdown | SC-05 pre-start | 3-2-1-GO beats locked to the 1.0 s beat | music on downbeat of GO | Audio sync per countdown table (3.0 s). |
| M4 Round – play | SC-05 | `mus_round_<theme>` intensity **L1** | on GO | Layers L1→L3 driven by intensity params below. |
| M5 Round – final seconds | SC-05 | intensity **L3** + `fx_lastseconds` layer | at 15 s solo / 30 s team | Tempo is **not** raised; urgency comes from extra percussion only. |
| M6 Player Qualified | SC-06 | `stg_qualified` (≤3 s), round music ducks −9 dB | instant | Player then hears round music filtered (low-pass 2 kHz) while others play. |
| M7 Player Out | SC-06 → SC-07 | `stg_out_greattry` (≤3 s, gentle, major) | instant | Then M8. |
| M8 Spectate | SC-07 | round music, low-pass + −6 dB | 1 s | Follows spectate target's round; no "sad" music. |
| M9 Final | SC-05 (Final round) | `mus_final_<theme>`, distinct track | stinger `stg_final` | FR-08-07 AC1 "Final" cue. |
| M10 Victory / results | SC-08 | `mus_victory` (winner) or `mus_results` (everyone else, equally cheerful) | 0.5 s | Rewards jingles layer over (§3.5). Returns to M0 only when player presses "Play again" or Back (FR-08-04 AC2). |
| M11 Tutorial / Practice | SC-12, SC-15 | `mus_practice` loop, calm | 2 s | Offline; all assets local. |
| M12 Error / offline | SC-14 | music continues at −6 dB, one soft `ui_error` | — | Never a harsh buzzer. |
| M13 Parent area | SC-11 | music −12 dB | — | Adult area; neutral. |

### 2.2 Intensity parameters (round tracks)

| Param | Source | Effect |
|---|---|---|
| `round_progress` 0–1 | timer or qualified count | L1 → L2 at 0.5 |
| `qualify_pressure` | slots left ≤ 20% | L2 → L3 |
| `last_seconds` | FR-08 final-seconds banner | L3 + `fx_lastseconds` |
| `slime_height` | FR-03-14 | adds bubbly bass layer (fun, not scary) |
| `team_lead` | FR-01-06 (R2) | adds team-colour motif on own team lead |

Rules: stems change only on bar lines; max one layer change per 2 bars; no tempo change mid-round.

### 2.3 Builder music (FR-09 level settings)
Builder levels choose a track from the **Wobblebeans original music library** (all FR-08-07 compliant). See Issue A-03.

## 3. Audio event list (FR-08-08 AC1 — this is the authoritative list)

Columns: **ID** · trigger · sound brief · bus · 3D? · variations · **GR** = gameplay-relevant (needs visual indicator, FR-08-12 AC4) · visual indicator.

### 3.1 Character states (FR-04-01…08, FR-03-03, FR-03-13)

| ID | Trigger | Brief | Bus | 3D | Var | GR | Visual |
|---|---|---|---|---|---|---|---|
| `sfx_char_footstep_<surface>` | foot contact (default, metal, wood, slime, ice R2, water R2) | soft squishy toe-taps | SFX_Char | 3D | 6 | – | – |
| `sfx_char_jump` | FR-04-02 take-off | rubbery "bwip" | SFX_Char | 3D | 4 | – | animation |
| `sfx_char_land_soft/hard` | landing by fall speed | squash "pomf" | SFX_Char | 3D | 4 | – | squash VFX |
| `sfx_char_dive` | FR-04-03 | whoosh + belly slide | SFX_Char | 3D | 3 | – | – |
| `sfx_char_dive_slide` | ground slide loop | rubber squeak loop | SFX_Char | 3D | 1 loop | – | – |
| `sfx_char_grab_start/hold/release` | FR-04-04 | stretchy "gloop" / grip squeak | SFX_Char | 3D | 3 | Y (being grabbed) | grab-link VFX + "hold" icon on grabbed player |
| `sfx_char_breakfree` | escape grab (incl. hold-to-mash alt) | pop | SFX_Char | 3D | 2 | – | pop VFX |
| `sfx_char_bump` | FR-04-07 player collision | bonk on beanbag | SFX_Char | 3D | 5 | – | – |
| `sfx_char_stumble` | FR-04-05 stumble | wobble-wobble | SFX_Char | 3D | 3 | – | stars over head |
| `sfx_char_ragdoll` | ragdoll enter | jelly flop (no pain sounds) | SFX_Char | 3D | 4 | – | animation |
| `sfx_char_recover` | get-up | "boing-up" | SFX_Char | 3D | 2 | – | – |
| `sfx_char_fall_offmap` | FR-03-13 fall-off | descending slide whistle | SFX_Char | 2D own / 3D others | 3 | Y | fall vignette + respawn ring |
| `sfx_char_respawn` | respawn + 1.0 s protection | sparkly "pop-in" | SFX_Char | 3D | 1 | Y | shimmer outline during protection |
| `sfx_char_oob_warn` | soft OOB 3 s warning | gentle double-chime | UI_Gameplay | 2D | 1 | Y | "!" banner (FR-08-02) |
| `sfx_char_slime_out` | slime elimination | bubbly "blub" | SFX_Char | 3D | 2 | Y | slime splash + SC-06 |
| `sfx_char_emote_<id>` | FR-05-06 emote | non-verbal toy sound per emote | SFX_Social | 3D | 1–3 | – | emote animation |
| `sfx_char_quickchat` | FR-07-14 | soft "pip"; no voice | SFX_Social | 2D | 1 | – | quick-chat bubble |
| `sfx_char_celeb_<id>` | victory celebration (AD-35) | jingle | SFX_Social | 2D | 1 | – | animation |

### 3.2 Obstacles (FR-03; names from Appendix C)

All obstacles: periodic hazards emit a **tell** sound ≥0.5 s before impact phase (FR-03-17 telegraphing), audible within 25 m, rolloff linear 5–25 m. Every tell is GR and has its visual twin (wind-up animation/glow).

| ID | Obstacle (Req) | Sounds | GR / Visual |
|---|---|---|---|
| `sfx_obs_turngate` | Turn Gate (FR-03-02) | creaky toy-turnstile loop | – |
| `sfx_obs_windmill` | Windmill Paddles (FR-03-02) | whirring loop, paddle swoosh | – |
| `sfx_obs_swinglog` | Swinging Log (FR-03-02) | rope creak tell + whoomph (soft) | Y / wind-up highlight |
| `sfx_obs_rolyroller` | Roly Roller | rumble loop + bonk on hit | – |
| `sfx_obs_boingglove` | Boing Glove (FR-03-03) | spring-wind tell, "BOING" hit | Y / glove wobble 0.5 s |
| `sfx_obs_flippad` | Flip Pad (FR-03-08, R2) | click arm 0.25 s, fling | Y / pad glow |
| `sfx_obs_button` | Button (FR-03-08) | big toy click | Y / button light |
| `sfx_obs_balllauncher` | Ball Launcher (FR-03-09, R2) | "fwump" soft-ball pop (no cannon) | Y / muzzle puff + ground target ring |
| `sfx_obs_fruit` | Fruit projectile | squishy splat | – |
| `sfx_obs_bouncepad` | Bounce Pad (FR-03-10) | drum "bwoing" (pitch by force) | – |
| `sfx_obs_zoomarch` | Zoom Arch (FR-03-04) | rising sparkle | – |
| `sfx_obs_faketile_reveal` | Fake Tile (FR-03-06) | harmless "poof" | Y / tile puff |
| `sfx_obs_trickdoor` | Trick doors (FR-03-06) | real: "thunk"; fake: rubbery boing | – |
| `sfx_obs_droptile_warn/drop` | Drop tiles (FR-03-07) | wobble-rattle warn, "plop" drop | Y / tile shake + colour **and pattern** change (FR-08-11) |
| `sfx_obs_fallingplatform` | Falling Platform | creak warn, whoosh | Y / shake |
| `sfx_obs_spinplate` | Spin Plate | turntable hum loop | – |
| `sfx_obs_hover` | Hover Platform | soft hover hum | – |
| `sfx_obs_bubblewall` | Bubble Wall | bubble boop on contact | – |
| `sfx_obs_puffballoon` | Puff Balloon | inflate squeak tell, deflate | Y / inflate anim |
| `sfx_obs_pinball` | Pinball Paddles | flipper clack | Y / paddle glow |
| `sfx_obs_lightbar` | Light Bar | soft hum (no laser zap) | – |
| `sfx_obs_windfan` | Wind Fan / Floaty Zone (FR-03-11, R2) | breeze loop / dreamy pad | Y / wind particles |
| `sfx_obs_whooshtube` / `sfx_obs_portal` | Whoosh Tube / Portal | suck-whoosh / warble | – |
| `sfx_obs_gates_logs` | Gates and Logs | wooden clonk | – |
| `sfx_obs_ai_penguin/rhino` | AI hazards | cute waddle / snort (no roar) | Y / footprints near player |
| `sfx_obs_checkpoint` | Checkpoint (FR-03-12 — sound cue required) | bright two-note chime | Y / flag flip + glow (already required) |
| `sfx_obs_slime_rise` | Rising slime (FR-03-14) | bubbly loop, step-up gurgle each rise | Y / slime line marker on HUD |
| `amb_<theme>` | Themes (FR-03-16) | crowd-free cheerful ambience beds | – |

### 3.3 Round & show events (FR-01)

| ID | Trigger | GR / Visual |
|---|---|---|
| `stg_roundintro_<type>` | SC-04 | Y / type icon |
| `sfx_round_count_3/2/1/go` | 3-2-1-GO | Y / on-screen numerals |
| `sfx_round_lastseconds_tick` | final 15/30 s, soft tick on each 5 s | Y / final-seconds banner |
| `sfx_round_qualified_other` | someone qualifies (quiet, throttled 1 per 0.5 s) | Y / qualified counter tick |
| `sfx_round_end_whistle` | round end | Y / "Round over" banner |
| `sfx_team_score_<own/other>` | team point (R2) | Y / score pop |
| `sfx_hunt_tail_lost` | tail taken (warning, FR-08-02) | Y / "!" icon |

### 3.4 Warnings (FR-08-02)
`sfx_ui_warning` — friendly two-note "uh-oh" (pitched toy), max 1 per 1.5 s; paired visual "!" which never flashes >3/s (NFR-10-19).

### 3.5 Outcomes and rewards (FR-01-04, FR-01-09, FR-08-03)

| ID | Rule |
|---|---|
| `stg_qualified` | bright fanfare ≤3 s |
| `stg_out_greattry` | **warm, major-key**, ≤3 s; no "wah-wah" trombone, no crowd boo or laugh; pairs with "Out this time – great try!" |
| `stg_final`, `mus_victory`, `mus_results` | results music is cheerful for every player |
| `sfx_reward_xp/coins/item` | sparkle jingles; **no slot-machine, coin-cascade or gambling sounds** (FR-11-18) |

### 3.6 UI (SC-01…SC-15)

`ui_nav_move`, `ui_confirm`, `ui_back`, `ui_toggle`, `ui_slider_tick` (plays at new level so the child hears the change), `ui_tab`, `ui_error` (soft), `ui_purchase_confirm` (neutral, not celebratory — no reward-loop audio in the shop), `ui_parentgate_open`, `ui_report_sent` (reassuring), `ui_mute_player`. All UI sounds are 2D on the UI bus.
**Block/mute (FR-07-15):** a blocked or muted player's emote, quick-chat and celebration sounds are not played for the blocker.

## 4. Mixing buses

```
Master (limiter -1 dBTP, kid-safe cap §6)
├── Music        (slider: Music)   ── stems, stingers
├── SFX          (slider: SFX)
│   ├── SFX_Char      own bean +2 dB priority
│   ├── SFX_Obstacle  tells never ducked
│   ├── SFX_Social    emotes/quick-chat, -3 dB, voice-limit 4
│   └── Ambience
└── UI           (slider: UI)
    ├── UI_Menu
    └── UI_Gameplay   countdown, warnings, qualified (never ducked)
```

Sidechain/ducking: UI_Gameplay and stingers duck Music −6 dB (attack 20 ms, release 400 ms). SFX_Obstacle tells duck SFX_Social −4 dB. Voice limits: 32 total real voices; per-obstacle-type 4; footsteps 8 (nearest). Priority: own bean > tells > UI_Gameplay > others. Ambience follows the SFX slider (FR-08-09 lists only 4 sliders; Issue A-05).

## 5. Loudness targets

| Item | Target | Req |
|---|---|---|
| Music tracks (mastered) | **−16 LUFS ±1 integrated**, ≤ −1 dBTP | FR-08-07 AC3 |
| Full in-game mix (all sliders 100) | −16 LUFS ±2 integrated over a 3-min round capture; short-term max −10 LUFS | added (A-02) |
| Stingers | −14 LUFS short-term peak, ≤ −1 dBTP | added |
| SFX one-shots (source) | peak −3 dBFS, normalised by category table in middleware | added |
| UI | −20 to −18 LUFS short-term | added |
| Dynamic range | loudness range (LRA) ≤ 10 LU for the full mix (TV + handheld friendly) | added |
| Low frequency | high-pass 30 Hz on master; no sub-bass hits > −12 dBFS | added |

Measured with ITU-R BS.1770-4 / EBU R128 meter (T-FR-08-07).

## 6. Kid-safe volume (UD-1, FR-08-09)

- **Defaults:** Master 70, Music 60, SFX 80, UI 70 (persisted per profile; FR-08-09 AC1).
- **Hard cap:** master limiter at −1 dBTP and no single event over −10 LUFS short-term; no sudden level jumps >6 LU between consecutive 400 ms windows except the GO beat.
- **No startle:** no sounds louder than the music bed on fade-in of any screen; first launch fades audio in over 2 s.
- **Headphones mode (Settings toggle, default ON on handheld):** additional −6 dB master trim and gentle compressor (target ≤ 80 dB SPL guidance per WHO/ITU-T H.870 safe listening for children). See Issue A-06.
- **Sliders:** 0–100, perceptual (dB) curve, 0 = full mute, effect ≤100 ms; slider tick sound plays at the new level.
- **Background/focus loss:** mute all on app background or controller disconnect (FR-04-15 pause screen).
- **Parent area (SC-11):** optional "max volume" setting that clamps Master (R2, Issue A-06).

## 7. Accessibility — visual cues for audio (FR-08-12 AC4, AD-45, FR-08-08 AC2)

- **Definition of gameplay-relevant (GR):** any sound that tells the player about a threat, a timer, their own state, or a round outcome. All rows marked **Y** in §3 are GR (Issue A-04).
- **Rule:** every GR sound has a visual twin that exists **whether or not** audio is on (not only at slider 0). An automated check in CI cross-references event IDs marked GR with a `visual_cue_id` in the manifest.
- **Directional indicator:** "Sound Ring" option (default off, on automatically when Master or SFX = 0, per §4 edge case of Ch. 8): an arc at screen edge points to off-screen GR sounds (tells, projectiles, AI hazards) within 25 m. Icons + shape, never colour alone (FR-08-11). Pulses ≤3 Hz (NFR-10-19).
- **No captions needed for speech** (there is none, §8); a "sound icons" option shows small icons for emote sounds from others.
- **Haptics (where platform allows):** rumble on countdown GO, grab, qualified; reduce/off with motion-comfort settings (FR-08-20).
- **Mono audio** toggle and L/R balance for single-sided hearing.

## 8. VO policy — none / sound-only (AD-53, AD-02, FR-11-03, FR-08-17)

- **No voice-over anywhere:** no presenter, no narrator, no tutorial VO, no announcer, no spoken countdown.
- **No player voice** (chat or recorded) anywhere.
- **Bean vocalisations:** allowed only as **non-lexical toy sounds** (squeaks, hums, "hup!", giggles made with instruments or heavily processed so they carry no words in any language). Reviewed for accidental words in en-GB/en-US and target-launch languages (FR-08-14).
- No lyrics in music (FR-08-07). Licensed or UGC audio is not allowed in Builder levels (players pick from the library only).
- Benefit: no voice localisation cost (AD-53) and no voice moderation (AD-02).

## 9. Asset naming and format spec (FR-12-01/02/03/07/08)

### 9.1 Naming (FR-12-02 pattern, audio parts extension — Issue A-07)
`wb_<category>_<setid>_<part>_<variant>_v<nn>.<ext>`

- `category`: `sfx` or `music` (existing FR-12-02 categories). Stingers and ambience use `music` and `sfx` respectively.
- `setid`: event group + index, e.g. `charjump01`, `obsboingglove01`, `roundforest01`.
- `part` (audio): `full` (one-shot / whole track, existing), plus proposed audio parts `loop`, `intro`, `outro`, `stem`.
- `variant`: `a`…`f` for random variations; for stems `drums|bass|harm|lead|fun`; for surfaces `default|metal|wood|slime|ice|water`.
- Examples: `wb_sfx_charjump01_full_a_v01.wav`, `wb_sfx_charfootstep01_full_slime_v02.wav`, `wb_music_roundforest01_stem_drums_v03.wav`, `wb_music_menu01_loop_main_v01.wav`.
- Runtime event IDs (middleware) use the short form in §3 (`sfx_char_jump`) mapped to files in the manifest.

### 9.2 Format (FR-12-03)

| Item | Source | Runtime |
|---|---|---|
| All audio | WAV 48 kHz, 24-bit PCM | OGG Vorbis q6 (FR-12-03); platform-native codec allowed if the platform requires it (Issue A-08) |
| Channels | SFX 3D: mono; UI/stingers: stereo; music: stereo stems | — |
| Loops | sample-accurate loop points, 10 ms zero-cross; BPM + bars in manifest | — |
| Head/tail | ≤10 ms silence head; tails ≥ natural decay | — |
| Length caps | SFX ≤3 s (loops excepted), stingers ≤4 s, music loops 60–180 s | — |
| Memory | SFX bank ≤ 40 MB resident; music streamed | — |

### 9.3 Manifest fields (FR-12-01 + audio)
`id, file, category, bus, is3d, rolloff_min/max, variations, loop, bpm, bars, lufs_measured, truepeak, gameplay_relevant, visual_cue_id, provenance (FR-12-07: author, licence, AI-use flag), review (FR-12-08), placeholder_of`.
CI: name lint (FR-12-02 AC1), manifest schema (FR-12-01 AC1), loudness check (FR-08-07 AC3), event coverage (FR-08-08 AC1), GR→visual (FR-08-12 AC4).

## 10. Verification

| Test | Covers |
|---|---|
| T-FR-08-07 | loudness meter on all music; provenance audit; similarity check |
| T-FR-08-08 | every event in §3 resolves to an asset; every GR has `visual_cue_id` |
| T-FR-08-09 | slider range, ≤100 ms, persistence |
| T-FR-08-12 | play a show with Master 0: all GR cues visible |
| T-AUD-01 (new) | full-mix capture −16 LUFS ±2, no window jump >6 LU |
| T-AUD-02 (new) | child-panel (6–8, n≥12): no sound rated "scary" or "sad" by >10% |
| T-AUD-03 (new) | vocalisation word-check across launch languages |

## 11. Requirement issues and resolutions

| ID | Issue | Resolution (proposed) |
|---|---|---|
| A-01 | FR-08-07 Music is **Should**, yet it holds Must-grade obligations (original-only/IP risk, provenance) and FR-12/Ch.16 rely on it. | Raise FR-08-07 to **Must**, or split: originality/provenance AC2 = Must; distinct cues AC1 = Should. |
| A-02 | Only music has a loudness target (−16 LUFS); no full-mix, true-peak, SFX/UI or LRA targets. | Adopt §5 table; add T-AUD-01. |
| A-03 | Builder level settings say "music track (from the **licensed** library)", conflicting with "Original music only" (Ch.12) and FR-08-07. | Reword to "from the Wobblebeans original music library"; no UGC audio. |
| A-04 | "Gameplay-relevant" (FR-08-12 AC4) and "audio event list" (FR-08-08 AC1) are referenced but undefined. | §3 is the event list; GR defined in §7; flag stored in manifest. |
| A-05 | FR-08-09 has 4 sliders; ambience and social (emote) sounds have no home. | Ambience and Social sit under SFX; optional "Other players' sounds" toggle (R2). |
| A-06 | UD-1 kid-safety has no volume/hearing-safety requirement. | Add NFR: defaults, limiter cap, headphones mode, startle rule (§6); parent max-volume R2. |
| A-07 | FR-12-02 parts (full, top, bottom, mask, thumb) do not fit audio (loops, stems). | Extend parts with `loop, intro, outro, stem` for `sfx`/`music` only. |
| A-08 | FR-12-03 fixes runtime OGG q6; some consoles prefer native codecs; mono/stereo unspecified. | Allow platform-native runtime codec; channel rules in §9.2. |
| A-09 | No check that "original" music is not derivative of the reference OST. | Composer originality statement + similarity check in T-FR-08-07. |
| A-10 | UD-1 bans "countdowns", but 3-2-1-GO and final-seconds countdowns are gameplay. | Clarify: ban applies to commercial/shop pressure; gameplay timers allowed; no countdown audio in SC-09. |
| A-11 | FR-08-08 bans violent/scary sounds but says nothing on sad/mocking outcome sounds, against FR-08-03 tone. | Add AC: elimination audio is major-key, no mocking/laughter/boos (§3.5). |
| A-12 | Reward audio could create gambling feel (FR-11-18 bans gambling imagery but not sound). | Extend FR-11-18 to sound: no slot/coin-cascade/jackpot sounds. |
| A-13 | AD-53/AD-02 forbid voice but do not say if non-verbal bean vocals are allowed. | Allow non-lexical toy vocals only, with word-check (§8, T-AUD-03). |
| A-14 | FR-07-15 block/mute does not mention emote/quick-chat sounds. | Muted/blocked players' social sounds are suppressed (§3.6). |
| A-15 | FR-08-12 AC4 edge case only covers "sliders at 0"; deaf/hard-of-hearing players may keep audio on. | Visual twins always shown; Sound Ring optional (§7). |
