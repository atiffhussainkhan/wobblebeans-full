# 10 — Builder (Creative Level Editor) & Live Ops Design (Wobblebeans)

Owner: Senior Designer, UGC & Live Ops · Date: 23 Oct 2026 · Audience: kids 6–12
Source of truth: `Wobblebeans_Requirements_v3.docx` (Ch. 9, FR-09-01…26; plus FR-01-03, FR-01-08, FR-06-02, FR-06-13, FR-11-06/08/14/17/18, FR-12-08, NFR-10-12) and `09-creative-liveops.md` (Fall Guys reference research — reference only, not requirements).
Label rule (v3): every number here is a **Design estimate** unless marked **Ref** (Fall Guys community value) or quoted from a requirement.

## 0. Release map (respecting v3 priorities)

| Area | Req IDs | Priority | Release |
|---|---|---|---|
| Season container, News Board, level disable/rotation config, Season Path, Challenges, telemetry | FR-09-19, FR-09-26, FR-01-03 AC5, FR-06-02, FR-06-13, NFR-10-12 | Must/Should | **MVP** |
| XP boost events, limited-time shows/events | FR-09-21 (Could), FR-09-23 (Should) | Could/Should | **R2** |
| Builder editor, publishing, codes, likes, discovery, Level Hop | FR-09-01…17, FR-01-08 | Could | **Later** |
| Builder moderation | FR-09-18 | Must *when Builder ships* | **Later** (gate for Builder launch) |
| Builder SURVIVAL / POINTS modes | FR-09-09 | Could | **Later+1** (after COURSE) |
| Mobile/console play of shared levels (no building) | FR-09-01 AC1 | Could | **Later** |

Retired IDs not reused: FR-09-20→FR-06-02, FR-09-22→FR-06-13, FR-09-24→FR-01-03, FR-09-25→FR-01-07 (Won't).

---

# PART A — BUILDER (Release: Later)

## A1. Design pillars
1. **Build in 60 seconds** — a child places a start, a few platforms and a finish and plays it within one minute (templates, not blank canvas).
2. **Can't make it wrong** — invalid actions are prevented with pictures, not error text (FR-08-19 friendly messages).
3. **Nothing to type** — no free text anywhere (AD-02, FR-09-15); stickers curated (FR-09-07).
4. **Safe by construction** — private by default; sharing is a parent-granted permission (FR-09-01, FR-11-08).
5. **Proud, not pressured** — feedback is likes only, no dislikes, no public counts used as rankings for kids (FR-09-16).

## A2. Access & permissions (FR-09-01, FR-11-08)
- Entry: Main menu tile "Build!" — hidden entirely when parent has Builder off (FR-09-01 AC1). PC/Windows only.
- Permission states per child profile:

| State | Build | Playtest | Share to approved friends by code | Submit for public (Builder Picks/Level Hop) |
|---|---|---|---|---|
| Builder off | – | – | – | – |
| Builder on, sharing off (**default**) | ✔ | ✔ | – | – |
| Builder on, sharing on | ✔ | ✔ | ✔ (after automated checks) | ✔ (goes to human pre-moderation) |

- When a child taps Share with sharing off: friendly card "Ask a grown-up to turn on sharing" → sends parent approval request email (allowed category in FR-11-19). No nag repeat within 7 days.

## A3. Editor UX (kid-friendly)
**Layout (1920×1080 baseline, scales to 1280×720):**
- Left: **Object Drawer** — 7 category tabs as big icons (FR-09-02): Platforms, Blocks, Moving, Obstacles, Decorations, Interactions, Effects. Each tile: picture, cost pip, cap badge ("3/10").
- Top: **Budget Bean Jar** meter (FR-09-03 AC1) — a jar filling with beans + "1,240 / 2,500". Turns amber at 80 %, red at 95 %.
- Right: **Properties panel** (only when an object is selected): colour swatches (curated palette, FR-09-07), material, visible/collide toggles, physics, destructible, speed/direction sliders.
- Bottom bar: Undo / Redo (50 steps, FR-09-05 AC3), **Play ▶** (FR-09-11), Level Settings ⚙, Save, Share.
- Camera: orbit (RMB), pan (MMB / WASD), zoom (wheel); "Bean-eye view" button drops to player height.

**Modes:** *Beginner* (default for profiles aged 6–8 by parent-set age band) hides Logic, numeric entry and physics/destructible toggles; *Builder Pro* reveals all. Same data, filtered UI — no separate requirement needed (Design addition, traces FR-09-05/07/08).

**Tools (FR-09-05/06):**
| Tool | Behaviour | Kid UX |
|---|---|---|
| Move | Gizmo arrows + grid snap (0.5 m default, toggle 0.25/1/off) | Snap on by default |
| Rotate | 15° snap rings | |
| Scale | Uniform or limited; hidden for non-scalable (AC1) | Handles absent, tooltip picture "This one can't stretch" |
| Precise entry | Numeric fields clamped (AC2) | Pro mode only |
| Copy/paste/duplicate | Respects caps (FR-09-04 AC1) and budget | Refused with cap badge shake |
| Overlap check | Red ghost + 🚫 icon; cannot confirm (FR-09-06 AC1) | |
| Link (Logic) | Drag "string" from Button/Plate/Zone to Controller; lines drawn (FR-09-08 AC1) | Pro mode; max 10 controllers |

**Starter templates (Design, Later):** "Straight Dash", "Spinny Island", "Button Bridge", "Blank". Each a valid COURSE with Start + Finish so that publishing gates are met early. Template cost counts toward budget.

**Level settings (FR-09-10):** timer 1–10 whole minutes (default 3), max players up to 32 (AD-05), qualify count, sky, music (licensed library), theme. Out-of-range input rejected (AC1).

**Game modes (FR-09-09):** COURSE only at Builder launch; required objects (Start Point/Line, Finish Line) shown as a checklist "To share you need: ✔ Start ✖ Finish". SURVIVAL/POINTS Later+1.

## A4. Object budget & caps (FR-09-02/03/04/08)
- Budget **2,500 units** (Ref value, configurable server-side). First Start Line and first Finish Line free (Ref).
- Physics/destructible toggles add cost (FR-09-03). Controllers: 5 + 15 per linked object, max 10 (FR-09-08).
- Catalogue is data-driven (FR-09-02 AC1): `object_id, category, cost, max_count, overlappable, scalable(uniform|limited|none), physics_cost, destructible_cost, review_id (FR-12-08), object_version, mode_mask`.

| Example object | Cost (Design) | Cap |
|---|---|---|
| Basic platform 4×4 | 5 | – |
| Tilt Plank | 25 | 10 |
| Spinning plate | 20 | 50 (Ref) |
| Turnstile | 30 | 10 (Ref) |
| Slime floor tile | 4 | 200 (Ref) |
| Start Point | 2 | 40 (Ref) |
| Group Start Zone | 15 | 4 (Ref) |
| Effects (each) | 10 | 50 total (FR-09-04) |
| Controller | 5+15/link | 10 |
| Sticker decal | 3 | 100 |
- Server re-computes cost on publish; tampered files exceeding budget/caps are rejected (FR-09-18 AC1).
- Rebalance policy: published levels grandfathered at published cost; removed objects become inert decorations and trigger re-moderation (Ch.9 §D edge cases). Each level pins `catalogue_version`.
- Performance guard (Design addition → **ISS-10**): server also checks a *perf score* (dynamic objects × players) against a ceiling so levels run on minimum PC spec at 32 players.

## A5. Testing & publishing pipeline
```
Draft (local+cloud save) → Playtest (FR-09-11, <3 s switch)
 → Verification run: creator must qualify/finish on CURRENT version (FR-09-12 AC1)
 → Automated checks (FR-09-18 stage 1): budget, caps, bounds, required objects,
   sticker/arrangement classifier, perf score, schema (no free text — FR-09-15 AC1)
 → [sharing on?] → SHARED-FRIENDS: 4-4-4 code issued (FR-09-13)
 → [creator taps "Ask to be a Builder Pick"] → Human pre-moderation queue (stage 2)
 → APPROVED-PUBLIC: eligible for Builder Picks / Level Hop (FR-09-17, FR-01-08)
 → Reports (stage 3, FR-11-06) → Hidden-pending-review (3 reports/1 h) → Takedown or Restore (stage 4)
```
- **Level states:** Draft · Verified · Shared-Friends · In-Review · Approved-Public · Hidden · Removed. Every transition logged with actor + reason.
- **Republish (FR-09-14):** same code; new version re-runs verification + automated checks; Approved-Public levels drop to In-Review and the *last approved version* stays live until the new one passes (resolves ISS-07). Lobbies keep their loaded version (AC1).
- **Names/tags (FR-09-15):** name picker = 3 wheels (Adjective + Noun + optional Number 1–99), e.g. "Wobbly Pudding 7". Word lists reviewed (FR-12-08); a combination denylist blocks unlucky pairs. Up to 3 tags from fixed list (Easy, Tricky, Spinny, Jumpy, Slimy, Logic, Short, Long, Silly, Team-play).
- **Level codes (FR-09-13):** 12 chars from 30-symbol alphabet without 0/O/1/I/L → 30¹² ≈ 5.3×10¹⁷ ≥ 10¹⁵ ✔. Random, non-sequential; 10 entries/min/profile; friendly error for invalid/removed.

## A6. Safe sharing & moderation of kid-made levels (FR-09-18, FR-11-06, FR-11-17, FR-11-18)
**Threats specific to kid UGC & mitigations**
| Threat | Mitigation | Trace |
|---|---|---|
| Offensive symbols/words built from blocks or stickers | Classifier renders top-down + 4 side + spawn-view captures of whole level (not just stickers) → image classifier + text-OCR; positive → human queue | FR-09-18 stage 1 (ISS-05) |
| Free-text side channels | No text fields; protocol test rejects any | FR-09-15 AC1 |
| Stranger contact via codes posted on YouTube/social | Shared-Friends levels playable only by approved friends of creator; public code play only for Approved-Public | AD-20, ISS-03 |
| Creator identity exposure | Level card shows creator's generated display name only; no profile link for non-friends | FR-11-11 |
| Impossible/troll levels | Mandatory verification run; "Skip" 1 s hold in Level Hop | FR-09-12, FR-01-08 |
| Modded level files | Server-side validation + signature | FR-09-18 AC1 |
| Brute-force code scanning | Rate limit + large space | FR-09-13 AC2 |
| Review-bombing | Likes only | FR-09-16 |
| Upsetting content slipping through | Report in ≤2 taps ("Bad name or picture", "Something upset me"); hide at 3 independent reports within 1 h; human review ≤24 h | FR-11-06, FR-09-18 AC2 |
| Grooming/exploitation signal | Escalation path (NCMEC / CEOP) | FR-11-17 |

**Human pre-moderation checklist (per level):** PEGI 3 / ESRB E + UD-4 tone (FR-11-18); no symbols/words/likeness of real people/brands; no Fall Guys recreations (originality, FR-12-08); playable & fair on fly-through; name combo ok. SLA target (Design): 72 h for submission; reports 24 h (FR-09-18 AC2).
**Moderator console:** queue sorted by report count then age; 3D fly-through, auto-captures, version diff, one-click Approve / Reject (picture-coded reason sent to child: "Not quite right for Builder Picks — try changing your decorations") / Takedown / Escalate. Rejections are kind, never shaming; no strikes visible to children; repeat offence (3 takedowns/30 days) → sharing auto-paused and parent notified.

## A7. Discovery (FR-09-17, FR-01-08)
- **Builder Picks:** curated rows (≤6 rows × 10 levels) — "Staff Favourites", "This Season's Theme", "Great First Levels", "Logic Puzzles". Pinned server-side (AC1). Refresh weekly (Design).
- **Level Hop:** random playlist of Approved-Public levels supporting ≥20 players, lobbies up to 20 (FR-09-17 / FR-01-08 AC2). Selection weighted: 60 % curated pool, 30 % recent approved, 10 % newer creators with <3 approved levels (fairness, no personal profiling — FR-11-14).
- **My Levels / Friends' Levels:** grid of own and approved friends' shared levels.
- **Enter Code:** 4-4-4 entry with large on-screen keypad.
- No leaderboards of creators, no follower counts. Creator sees own likes as a badge tier (10/50/250/1000) rather than raw counts publicly.
- Official playlists (Main Show) use first-party levels only (FR-09-17).

## A8. Builder acceptance (design-level, maps to T-FR-09-xx)
- Child 8–10 builds & plays a template level in ≤60 s (moderated playtest, 80 % success).
- 0 shared levels without verification record; 0 Discovery levels without pre-mod approval (FR-09-17 AC2).

---

# PART B — LIVE OPS

## B1. Cadence (FR-09-19, FR-06-02; AD-11)
- **Season = 8 weeks**, UTC start/end server-configured, no client patch needed (FR-09-19 AC2). Client shows end date, never countdown (AD-15, AC1).
- **Mid-season drop at week 4** (Design): 1–2 new/variant levels, cosmetics, News Board post.
- **Client patch cadence:** every second season, aligned to season start (content otherwise data-driven).
- Annual calendar (6.5 seasons/yr): S1 Launch (MVP) · S2 · S3 · … with themed events slotted in R2+: Autumn egg/leaf-collecting (Oct), Winter (Dec), Spring (Apr), Summer (Jul–Aug). Culturally neutral themes, no religious holidays as themes (UD-4).

## B2. Season content budget (Design per season)
| Item | MVP season | R2+ season |
|---|---|---|
| New rounds/variants | 2 + 2 variants | 3 + 3 variants |
| Season Path | 70 tiers (FR-06-02) | 70 |
| Cosmetics | ~25 | ~30 |
| Challenges | Daily/weekly/season sets (FR-06-13) | + event challenges |
| Limited-time shows | – | 2 (FR-09-23) |
| XP boost windows | – | ≤2 weekends (FR-09-21) |
| Builder Picks themed row | – | Later |

## B3. Event templates (R2; FR-09-21, FR-09-23)
All events: UTC schedule, appear/disappear without patch, no countdown, rewards earnable in ≤4 h total play (FR-09-23) and event window ≥7 days so ≤ ~35 min/day suffices (ISS-08). Missed rewards are never framed as loss.
| Template | Config fields | Example |
|---|---|---|
| **LTS – Limited-time show** | show_id, playlist, slot rules, start/end, reward track (≤6 rewards), min/max players | "Egg Scramble Week" |
| **XP Boost** | multiplier (×2 default; cap ×2 for kids — ISS-06), start/end, scope (all/show) | "Double XP this weekend (Sat 9 – Sun 10 Nov)" |
| **Theme Week** | level pool weight overrides (FR-01-03), skybox skin, News Board post | "Slime Week" |
| **Community Build Challenge** (Later) | theme tag, submission window, Builder Picks row | "Build a Bouncy Castle" — picks, no prizes ranked |
| **Returning Favourite** | re-enable retired LTS from vault | Winter show returns |

Event schema: `event_id, type, title_loc_key, start_utc, end_utc, playlist_ref, reward_table_ref, xp_mult, news_post_ref, review_id, kill_switch`.

## B4. Content pipeline
1. **Plan** (T-12 wk): theme brief, content list, originality brief (FR-12-08).
2. **Build** (T-12→T-5): levels in data (FR-02-01), cosmetics, loc keys.
3. **Review** (T-5): content & originality review records (FR-12-08 AC1), PEGI3/UD-4 (FR-11-18); child playtest for new levels (6–8 & 9–12).
4. **Cert/patch** (T-4) only if client code changes.
5. **Config staging** (T-2): season/event/rotation config in staging env; automated schema + time-zone tests (AD-33).
6. **Soft launch** (T-0): 10 % population canary 24 h for new levels (Design) → full.
7. **Operate**: dashboards, kill switch, News Board (FR-09-26, review record AC2).
8. **Retro** (T+8): KPI review feeds next season.

## B5. Rotation rules (FR-01-03, FR-02-01)
- Selection per FR-01-03: slot-valid, N within min/max, divisible by team divisor; no repeat in a show (AC2); no same type twice in a row (AC3); fallbacks Tile Drop / Tile Return / Bumpy Parade (AC4).
- Live-ops levers: per-level `enabled`, `selection_weight`, schedule windows (AC5; effective for shows starting ≥60 s after change).
- Design rules: new levels get ×1.5 weight for first 2 weeks; levels with qualification rate outside 30–80 % (Design band) or crash/desync spikes are auto-flagged for weight reduction (human-approved, not auto-applied); every level stays in rotation at least 1 season before vaulting; never vault the fallbacks.
- Level Hop rotation: §A7.

## B6. Roadmap
| Phase | Live ops | Builder / UGC |
|---|---|---|
| **MVP** | Season container (FR-09-19), Season Path free track (FR-06-02), Challenges (FR-06-13), News Board (FR-09-26), rotation config + kill switch (FR-01-03 AC5), telemetry & Live-Ops dashboard v1 (NFR-10-12) | Internal-only level authoring tools (data-driven FR-02-01) — groundwork for Builder catalogue |
| **R2** | LTS & events (FR-09-23), XP boost (FR-09-21), event templates, canary rollout, Moderation ops (FR-11-17) scaled up | Builder tech spike + closed creator playtests with children (internal); moderation classifier training |
| **Later** | Community Build Challenges, themed Builder Picks rows | Builder PC COURSE (FR-09-01…18), Level Hop (FR-01-08), mobile/console play-only; then SURVIVAL/POINTS |

Builder launch gate: FR-09-18 stages 1–4 operational, moderator staffing for 72 h/24 h SLAs, parent controls (FR-11-08) live, classifier precision/recall reviewed.

## B7. KPIs & telemetry dashboard (NFR-10-12, FR-11-14)
**Constraints:** first-party, pseudonymous, no PII, no third-party SDKs; KPIs used for content health, **not** individual targeting or monetisation optimisation (FR-11-14). No KPI may reward longer child sessions per se — wellbeing guardrails are primary.

**Dashboards**
1. **Season Health** — DAU/WAU (aggregate), season retention D1/D7/D30, Season Path median tier by segment vs target (casual ≥T35 by wk 8, FR-06-02 AC4), challenge completion %, banked-slot usage.
2. **Round/Level Health** — per level: pick rate, qualification rate, avg duration, quit/disconnect during round, desync/crash rate, skip rate (Level Hop); traffic-light vs bands.
3. **Event Performance** (R2) — participation %, median minutes to full rewards (target ≤4 h, FR-09-23), reward claim %.
4. **Wellbeing & Safety** — median session length, % sessions hitting parent limit, break-reminder acceptance (FR-11-15), reports per 1k matches, report SLA compliance (FR-11-06/17), takedowns.
5. **Builder (Later)** — levels created/verified/shared/submitted, approval rate, time-in-queue, classifier hits & false-positive rate, Level Hop plays & skip rate, % creators with ≥1 approved level.
6. **Ops** — config change log, kill-switch events, canary comparisons.

**Core telemetry events** (all with pseudonymous id, build, platform, UTC ts): `season_start_seen, show_start, round_start{level_id,slot,N}, round_end{result,duration}, show_end, challenge_complete, path_tier_up, event_join, event_reward_claim, news_view, report_submit{type}, builder_open, builder_object_place{object_id}, builder_playtest, builder_verify{pass}, level_share, level_submit, level_moderation{decision}, levelhop_play{level_id,skip}, like_give`.
Retention of raw events 13 months (Design) → aggregates; deletion propagates per FR-11-12.

---

## C. Traceability summary
FR-09-01…18 → Part A §A2–A8; FR-09-19 → B1; FR-09-21/23 → B3; FR-09-26 → B4; FR-01-03 → B5; FR-01-08 → A7; FR-06-02/13 → B1–B2; FR-11-06/08/11/14/17/18 → A2, A6, B7; FR-12-08 → A4–A6, B4; NFR-10-12 → B7; AD-02/05/11/15/20/33 cited inline.

## D. Issues found & resolutions
| ID | Issue | Resolution (design) |
|---|---|---|
| ISS-01 | FR-01-08 says Course/Points levels have a "30-minute limit"; FR-09-10 caps timer at 1–10 min. | Level Hop uses the level's own timer (≤10 min). Propose CR to edit FR-01-08 to "the level timer (FR-09-10)". |
| ISS-02 | FR-01-08 AC2 cites FR-11-12 (data deletion) as a moderation source — wrong ref. | Should cite FR-11-06/FR-11-17. Flag as ID typo CR. |
| ISS-03 | AD-20 "publish to friends by code" vs codes being leakable to strangers (FR-09-13 only rate-limits). | Unmoderated (Shared-Friends) levels playable only by creator's approved friends; any-player code play only for Approved-Public. |
| ISS-04 | FR-01-08 mentions Survival/Points levels, but FR-09-09 launches COURSE only. | Level Hop launches COURSE-only; Survival/Points rules apply Later+1. |
| ISS-05 | FR-09-18 classifier scoped to "sticker arrangement"; offensive shapes can be built from blocks/platforms. | Classify whole-level renders (multi-view + OCR). |
| ISS-06 | FR-09-21 allows ×3/×4 (Ref) boosts — pushes play pressure on kids (UD-1/AD-15 spirit). | Cap at ×2 by config; ×3/×4 disabled. |
| ISS-07 | FR-09-14 republish keeps code and re-moderates, but undefined what plays during review. | Last approved version stays live until new version passes. |
| ISS-08 | FR-09-23 "≤4 h" rewards with no minimum event length → could be short, intense windows. | Events ≥7 days. |
| ISS-09 | FR-09-18 AC2 has 24 h report review but no pre-moderation SLA for submissions. | Design target 72 h; add to FR-11-17 staffing plan (open — needs Ops sign-off). |
| ISS-10 | Budget limits memory but not runtime cost at 32 players (min-spec perf). | Add perf-score check in automated stage; values TBD with engineering. |
| ISS-11 | Likes visible as public counts could create popularity pressure. | Public shows tier badges only; creator sees own count. |
| ISS-12 | FR-09-01 is Could/Later while FR-09-18 is Must-when-shipped — risk of Builder launching with partial moderation. | Explicit launch gate (§B6). |
| ISS-13 | Live-ops KPIs risk conflicting with FR-11-14 (no profiling). | KPIs aggregate/content-level only; no per-child targeting (§B7). |

Open (need decisions): ISS-09 SLA & staffing; ISS-10 perf thresholds; CRs for ISS-01/02/04 to requirements owner.
