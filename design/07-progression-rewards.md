# 07 – Progression, Rewards & Customisation Systems (Wobblebeans)

Status: Systems/economy design, 23 Oct 2026. Audience 6–12 (UD-1). **MVP is fully free:** one earned currency (Coins), no real money, no premium currency, no loot boxes or chance rewards, no FOMO (AD-12…AD-16, FR-08-18, FR-11-09).
Sources of truth: `Wobblebeans_Requirements_v3.docx` (Ch. 5, 6, 8, 9, 11), `gapfill-C-progression-economy.md` (v3), `05-customization.md`. Every number here is a **Design estimate (not confirmed from Fall Guys)** and lives in config. Art for cosmetic slots comes from the user's asset repo later (FR-12-01/FR-12-04); this doc only defines slots and data.

## 0. Design pillars
| # | Pillar | Trace |
|---|---|---|
| P1 | Everyone progresses: playing (not winning) moves you forward; quitting gives 0 | FR-06-01, FR-01-09, FR-06-13 AC2 |
| P2 | Nothing is ever lost by not playing: banked dailies, rested XP, auto-granted season rewards | AD-15, FR-06-02 AC2, FR-06-13 AC3 |
| P3 | Deterministic & transparent: no chance anywhere, every item shows "How to get it" | AD-12, FR-05-09, FR-05-10, FR-05-17 AC1 |
| P4 | Cosmetic only, zero gameplay effect | FR-05-01 |
| P5 | No pressure UI: no countdowns, streaks, loss framing, push/marketing notifications | FR-08-18, FR-11-19, gapfill-C §13 |
| P6 | Healthy play: break reminders and parent limits end at show boundaries | FR-11-15, AD-23 |

## 1. XP & player level (FR-06-01, gapfill-C §1)
| Source | Default XP | Range | Note |
|---|---|---|---|
| Show participation (not quit) | 100 | 50–150 | Eliminated players keep it (FR-01-09 AC1) |
| Per round qualified | 150 | 100–250 | |
| Reached Final | +200 | 100–300 | |
| Win (Trophy) | +500 | 300–800 | Never required by any challenge |
| Team-round win (R2) | +50 | 0–100 | |
| Rested XP | +1,000 banked per full UTC day away, cap 3,000; doubles show XP until used | 0–1,500/day | Welcome-back, not a streak (AD-15) |
| Daily / weekly / season challenges | 1,500 / 4,000 / 10,000 | see §6 | 50–65% of path XP |
| Private Shows / Practice Playground | 0 | — | Anti-boost (AD-19, FR-01 offline AC2) |
| Level Hop (Could, Later) | 80/level, soft cap 2,400/day then 50% | | ≤35% of total XP |
| XP boost event (Could, R2) | ×2 announced with dates, no countdown | | FR-09-21 |

**Player level** (account, non-seasonal, purely a badge): level = floor(lifetime XP / 25,000) + 1, uncapped; every 5 levels grants a banner/title from the "level" source (FR-05-10). Never resets, never decays.

## 2. Free Season Path (FR-06-02, AD-11, AD-14, gapfill-C §2)
- 8-week season, **70 tiers**, all free. Curve: T1–T10 ramp 1,500→5,000 XP (cum. 32,500), T11–70 flat 5,000 (cum. **332,500**). Flat cost tunable 4,000–6,500.
- Overflow after T70: +100 Coins per 10,000 XP, max 20 per season.
- Rewards auto-claim at earn time (claim button optional); anything unclaimed is granted at season end with neutral copy ("Your Season Path rewards are in your wardrobe!").
- UI shows **estimated playtime to next reward** (AC3) and never a % "behind" indicator.

### 2.1 Reward table (cadence: a reward every tier; a "big" reward every 5 tiers)
| Tiers | Every tier (small) | Every 5th tier (big) |
|---|---|---|
| 1–10 | alternating: colour, pattern, banner, 100 Coins | T5 emote #1, T10 upper costume A |
| 11–20 | title / faceplate / 100 Coins / pattern | T15 lower costume A, T20 **500 Coins** |
| 21–35 | as above | T25 celebration, T30 upper B, T35 emote #2 |
| 36–50 | as above | T40 lower B, T45 **500 Coins**, T50 banner (animated) |
| 51–70 | as above | T55 title, T60 faceplate set, T65 banner, T70 **500 Coins** + season title |
Free-track minimums met: 3×500 Coins, 4 costume halves (A/B upper+lower), 2 emotes, 1 celebration, ≥2 banners, ≥2 titles (gapfill-C §2). Costume halves land by T40 so a **casual player (≈T51) gets both full season costumes**.
Small-tier Coins: 100 × ~14 tiers ≈ 1,400 Coins across the path.

## 3. Coins: earn, sinks, shop (FR-06-05, FR-06-06, FR-05-11, gapfill-C §6–8)
**Resolved retune (see ISS-01):** gapfill-C §6 rates over-pay ≈2× its own §12 targets. Proposed defaults:
| Source | gapfill-C v3 | **This doc** | Range |
|---|---|---|---|
| End of show | 20 + 10/round + 50/win (≈35) | **10 + 5/round + 25/win (≈18)** | config |
| Daily challenge | 50 | **25** | 25–50 |
| Show-Coin soft cap | 600/day then 25% | **300/day then 25%** | 200–600 |
| Season Path | 3×500 | 3×500 + small-tier 100s | |
| Trophy Rank, overflow | unchanged | unchanged | |
- Wallet = append-only ledger, idempotency key per grant (show ID / challenge ID / tier ID) (FR-06-05 AC2, FR-01-09 AC2).
- Sinks: Coin Shop only, prices per gapfill-C §7 (Common full costume 2,000 … Special 5,000). Weekly rotation Mon 10:00 UTC, 12 items + 2 sets, **no countdown**, every item returns ≤12 weeks; confirm + 24 h undo if unused (FR-05-11 AC3). Coins never shown next to a real-money value.
- Rarity is a label only, never a drop rate (FR-05-09).

## 4. Cosmetic slot system (FR-05-01…08, FR-05-02, FR-05-03)
User-facing names map to v3 categories:
| Slot (brief) | v3 category | Equip count | Default owned | Rule |
|---|---|---|---|---|
| Top | Upper costume | 1 | 1 basic | Any top + any bottom (FR-05-02); waist seam ≤2 mm (FR-12-04) |
| Bottom | Lower costume | 1 | 1 basic | Missing half → default part shown |
| Colour | Colour | 1 | 12 | Colour Copy costumes recolour (FR-05-04) |
| Pattern | Pattern | 1 | 6 | |
| Face | Faceplate | 1 | 6 | Hidden if costume `hidesFace=full` (FR-05-05) |
| Emote | Emote | 4 (wheel) | 4 (Wave, Thumbs Up, Happy Dance, Cheer) | Friendly only, FR-12-08 review (FR-05-06) |
| (also) Celebration | Celebration | 1 | 1 | FR-05-07 |
| (also) Banner / Title | Banner, Title | 1 each | 1 each | Titles from curated list only (FR-11-05) |
**Layer order (render):** colour → pattern → faceplate → lower → upper → effects. Occlusion flags per item: `hidesFace (none|eyes|full)`, `hidesPattern (bool)`.
**Starter kit:** every new profile can build ≥ 12×6×6 = 432 looks on day 1 with no play.

## 5. Dressing room logic (FR-05-17)
1. Tabs: Top, Bottom, Colour, Pattern, Face, Emotes, Celebration, Banner, Title (+ "Outfits" presets: 3 saved slots, Should).
2. Each tab lists owned first, then unowned greyed with **"How to get it"**: "Season Path tier 30", "Coin Shop (when it returns)", "Weekly challenge" — never a buy button or shop link (AC5).
3. Equip = instant live preview ≤100 ms (FR-05-03 AC1); 360° rotate; emote/celebration previews play (AC2).
4. Validation on equip: item owned (server check), slot matches, occlusion rules applied; unowned items can be *previewed* but not saved.
5. Save: signed-in child → server, follows across devices; guest → device; guest-to-child migration once (AD-22, gapfill-C §11).
6. "New" badge clears on first view (AC4); no badge counts on main menu buttons beyond a single dot (avoid nagging).
7. "Surprise me" randomises from **owned** items only (no chance reward—purely a styling helper).

## 6. Challenge design (FR-06-13, gapfill-C §9, AD-33)
| Type | Slots | Reward | Refresh | Banking |
|---|---|---|---|---|
| Daily | 3 | 1,500 XP + 25 Coins | 10:00 UTC | Up to 7 days (21 slots); 1 free swap/day |
| Weekly | 5 | 4,000 XP | Mon 10:00 UTC | Stay open all season |
| Season goals | 5 stages | 10,000 XP; cosmetic at stage 5 | Season | Play-count based |
| Event (R2) | 5–8 | Event cosmetic track | 7–14 days | All reachable ≤4 h play (FR-09-23) |
**Rules:** ≤40 chars en-GB, one icon, literal (AC1); 0 require a win; 0 reward grabbing/knocking players (AC2); no "only N hours left".
**Template pool (examples):** Play 3 shows · Qualify from 4 rounds · Finish 2 races · Reach 1 Final · Collect 10 fruit in Fruit Count · Try a team round · Do an emote in the lobby 3 times · Play with a friend's party (R2).
Difficulty mix per day: 1 "play" (any outcome), 1 "do" (action), 1 "qualify" (achievable by ~70% of players in ≤3 shows).

## 7. Unlock cadence (what a child sees)
| Moment | Unlock |
|---|---|
| First show | XP bar fills, 1–3 Season Path tiers (T1 = 1,500 XP ≈ 1 show + 1 daily) |
| Session 1 (≈1 h) | ~4–6 tiers, emote #1 at T5 |
| Week 1 casual | ~T8, top costume A at T10 next session |
| Every ~1 h of play mid-season | ~3–5 tiers ≈ 1 big reward per 1–1.5 h |
| Each week | enough Coins for ≥1 small shop item (regular) |
| Each season (regular) | full path + 2–3 shop costumes |

## 8. Healthy play (FR-11-15, AD-23, FR-11-08, FR-11-19)
- Break reminder after 60 min continuous play (parent can set 30–120; only parent can disable). Shown at **next show end** (AC1), friendly copy + "Stretch break!" art, single "OK" button.
- Optional parent daily limit (off by default); when reached, play ends after the current show (AC2); remaining rewards are banked, not lost.
- No streaks, no daily-login rewards, rested XP rewards *absence*. No push/marketing notifications. Results screen (SC-08) never prompts purchase or "one more game" autoplay (FR-08-18: no auto re-queue).
- Progression telemetry (pseudonymous, aggregate, AD-21) flags if >10% of p90 sessions exceed 2 h → design review, not engagement push.

## 9. Data model (spreadsheet-style; tables = sheets)
**items**
| item_id | slot | name_key | rarity_label | acquisition_source[] | season_id | coin_price | hides_face | hides_pattern | traits[] | asset_ref | review_status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| top_choc_01 | upper | item.top.choc | common | [seasonpath_free] | S1 | null | none | false | [colour_copy] | repo:/costumes/choc_top | approved |
| face_star_02 | faceplate | item.face.star | uncommon | [coins] | null | 1000 | none | false | [] | repo:/faces/star | approved |

**season_path_tiers**: season_id | tier | xp_to_next | cum_xp | reward_type (item/coins) | reward_ref | reward_qty | is_big
**challenges_def**: challenge_id | type (daily/weekly/season/event) | text_key | icon | metric (shows_played, rounds_qualified, …) | target | xp | coins | item_ref | enabled | min_age_ok
**challenge_state**: profile_id | challenge_id | slot_date | progress | completed_at | swapped
**ledger** (append-only): entry_id | profile_id | ts_utc | kind (grant/spend/undo) | currency (coins/xp) | amount | source (show/challenge/tier/trophy/overflow/admin) | idempotency_key | balance_after
**inventory**: profile_id | item_id | acquired_ts | source | seen (bool) | used_in_match (bool, for 24 h undo)
**loadout**: profile_id | preset_no | upper | lower | colour | pattern | faceplate | emote_1..4 | celebration | banner | title | updated_ts
**shop_rotation**: week_start_utc | slot_no | item_id/set_id | price
**wellbeing_settings**: profile_id | break_min (30–120) | break_enabled (parent-only) | daily_limit_min (null) | set_by_parent_id
**economy_config**: key | value | min | max | owner  (all §1–3 numbers)
**(Later) entitlements**: profile_id | sku | platform_txn_id | parent_approval_id | price_minor | currency_iso | ts | refunded

## 10. Progression simulation (8 weeks; `sim.py` in this folder reproduces it)
Weekly XP = show XP + daily slots×1,500 + weeklies×4,000 + rested.
| Segment | Pattern | XP/week | Tier wk2 | wk4 | wk6 | wk8 | Shows | Wins | Coins/season v3 rates | **Coins/season retuned** |
|---|---|---|---|---|---|---|---|---|---|---|
| Casual | 3 d × 1 h @2,000/h; 6 dailies, 3 weeklies, 3k rested | 30,000 | 15 | 27 | 39 | **51 (73%)** | 120 | 4 | ~8,000 | **~4,800** |
| Regular | 5 d × 1.2 h @2,400/h; 15 dailies, 5 weeklies, 2k rested | 58,900 | 27 | 50 | 70 (wk 5.7) | 70 + 13 overflow | 240 | 8 | ~18,000 | **~10,900** |
| Hardcore* | 7 d × 3 h @2,800/h; 21 dailies, 5 weeklies | 110,300 | 47 | 70 (wk 3.1) | 70+ | 70 + 20 overflow | 840 | 30 | ~43,800 | **~25,300** |
*Above the 60-min break default; not a design target. Retuned regular = 10.9k matches gapfill-C target 9–11k (≈2–3 costumes + small items). Tier values reproduce gapfill-C §12 exactly. Telemetry gate: regular cohort >10 tiers off at week 4 → retune flat tier cost first, then challenge XP.

## 11. Later: paid cosmetics with parent approval (Q-B1; Could, post-MVP only)
Only if the user approves monetisation. Constraints (FR-11-09, FR-05-16, FR-06-02, AD-12):
- **Direct real-money SKUs** via platform store (e.g. a cosmetic set or an optional premium Season Path track), price shown in £/$; **never currency, never chance, never tier skips/XP boosts**.
- Each purchase routes to the Parent Account for per-transaction approval; spending defaults to £0; parent dashboard shows history (FR-11-10); refund per platform policy.
- Fits the model via `acquisition_source = seasonpath_premium | paid_sku` and the `entitlements` sheet; dressing-room "How to get it" would say "Ask a grown-up in the Parent Account" — still no buy button inside the child dressing room (FR-05-17 AC5 stays). Premium track unlocks retroactively and shows estimated playtime to complete; free track remains complete and unchanged.
- Gameplay parity unaffected (FR-05-01 AC1 bit-exact test).

## 12. Traceability
| Design section | Requirement IDs |
|---|---|
| §1 XP | FR-06-01, FR-01-09, FR-09-21, AD-15, AD-19 |
| §2 Season Path | FR-06-02, FR-06-03/04 (Won't), AD-11, AD-14 |
| §3 Coins/shop | FR-06-05, FR-06-06, FR-05-09, FR-05-11, FR-05-12 (Won't), FR-06-08 (Won't), AD-12, AD-13 |
| §4 Slots | FR-05-01…08, FR-12-01, FR-12-04, FR-12-08, FR-11-05 |
| §5 Dressing room | FR-05-10, FR-05-17, AD-22 |
| §6 Challenges | FR-06-13, FR-09-23, AD-33 |
| §8 Healthy play | FR-11-15, FR-11-08, FR-11-19, FR-08-18, AD-23 |
| §9 Data | FR-06-05, FR-06-19, FR-05-10 AC1 |
| §11 Later paid | FR-11-09, FR-11-10, FR-05-14/16, FR-06-02 premium, Q-B1 |

## 13. Issues & resolutions
| ID | Issue | Resolution |
|---|---|---|
| ISS-01 | gapfill-C §6 earn rates (≈35 Coins/show, 50/daily, 600 cap) yield ~18k (regular) / ~44k (hardcore) per season, contradicting §12 table (~9.5k / ~18k) and the 9–11k target | Retune to 10+5/round+25/win, 25/daily, 300/day cap → 4.8k/10.9k/25.3k. Update gapfill-C §6/§12 and FR-06-06 text |
| ISS-02 | Brief's slot names (top/bottom/face) differ from v3 (Upper/Lower/Faceplate) | Map 1:1 (§4); keep v3 IDs in data, kid-friendly labels in UI |
| ISS-03 | Brief lists 6 slots; v3 also has Celebration, Banner, Title | Keep all v3 slots (Must per FR-05-07/08) |
| ISS-04 | "Random Style" costume trait (FR-05-04) could read as chance | It's a visual variant of an owned item, not a reward; allowed. Never used for acquisition |
| ISS-05 | "New" badges could become nagging/FOMO | Badge in dressing room only; one dot on menu, no counts, no expiring badges |
| ISS-06 | Small-tier Coins on path (≈1,400) not in gapfill-C | Small addition; included in retuned sim; within source/sink 1.0–1.2 if shop grows by ~2 items/season |
| ISS-07 | No account-level "player level" defined (FR-06-01 title mentions it) | Defined in §1 as non-decaying badge level |
| ISS-08 | Hardcore cap: XP keeps flowing post-T70 with no wellbeing hook | Overflow capped at 20 tiers; break reminder default on; p90 >2 h telemetry review |
| ISS-09 | FR-11-15 is Should, but healthy-play is core to brief | Recommend raising to Must for MVP (user decision) |
| ISS-10 | Paid future items must not add purchase entry in dressing room | Purchases only via Parent Account flow (§11) |
| Open | Q-B1 (any paid items post-MVP) — user decision; child-panel playtest of XP/hour and copy (gapfill-C §14) | — |
