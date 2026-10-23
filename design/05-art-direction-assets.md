# 05 — Art Direction Framework & Asset Pipeline (Wobblebeans)

Status: **Proposal v0 (framework only)** · 23 Oct 2026 · Owner: Art Direction
Sources: `Wobblebeans_Requirements_v3.docx`, `12-assets-art-direction.md`.
Scope rule (UD-3): **no specific characters are designed here.** All character/costume imagery comes from the user's GitHub asset repository. This doc defines the *frame* those assets must fit: pillars, rules, slots, names, budgets, rig and import checks. Final values are ratified at M2 against the delivered repository (FR-12-10 AC1).

Key trace: UD-1/AD-24 (PEGI 3 / ESRB E), UD-2 (original IP), UD-3 (assets from user repo), UD-4 (bright, friendly, inclusive, non-violent slapstick), AD-05 (32 players), AD-26 (original UI palette), FR-05-01/02/04/05, FR-08-11/12, NFR-10-04, NFR-10-19, FR-12-01…10.

---

## 1. Visual pillars
| # | Pillar | Meaning | Trace |
|---|---|---|---|
| P1 | **Soft & safe** | Everything round, squishy, bouncy; nothing sharp, bloody or threatening. Failure = comic, never pain. | UD-4, AD-24 |
| P2 | **Read in 0.5 s** | A 6-year-old must tell safe / hazard / goal at a glance, at 720p, in a 32-bean crowd. | FR-08-11, AD-05 |
| P3 | **Toybox physical** | Worlds look like giant play-sets: plastic, foam, rubber, felt. Materials explain physics (bouncy looks bouncy). | FR-05-01 |
| P4 | **Characters own the colour** | Environments are calmer than beans so repository costumes always pop. | UD-3 |
| P5 | **Distinctly ours** | No tracing, recolouring or layout-copying of the reference game; own palette, shapes, UI. | UD-2, AD-26, FR-12-08 |

## 2. Colour palette rules (hex = proposals)
**Value hierarchy (hard rule):** goal/UI > hazards > beans > interactive safe surfaces > background. Background saturation ≤ 40%, beans/hazards ≥ 60% (HSV).

| Role | Name | Hex | Notes |
|---|---|---|---|
| Safe surface base | Oat | `#F2E6C9` | Warm, low-sat walkable |
| Safe surface alt | Mint Foam | `#BFE8D2` | Tiles / platforms |
| Safe edge trim | Cocoa | `#6B4A3A` | Platform edge outline band |
| Hazard primary | Zing Orange | `#FF7A1A` | Always + stripe pattern |
| Hazard secondary | Plum Pop | `#7A2E8E` | Always + dot pattern (CVD-safe vs orange) |
| Warning / about-to-drop | Lemon | `#FFD93B` | + "!" icon / wobble anim |
| Goal / finish / checkpoint | Sky Cyan | `#22C3E6` | + chevron/flag icon |
| Bouncy / helpful | Bubblegum Lime | `#9BE15D` | Jump pads, boosts |
| Slime / out-of-bounds | Goo Teal | `#2F8F8A` | Low value, glossy |
| UI ink | Night Ink | `#1F2140` | Text & outlines (never pure black) |
| UI paper | Cloud | `#FFFDF7` | Panels |
| UI accent | Berry | `#E8336B` | Primary buttons |
| UI accent 2 | Sun | `#FFB627` | Rewards/coins |
| Team A–D | Coral / Ocean / Leaf / Gold | `#FF6B5B` `#2D7DD2` `#3DBB6B` `#F4C430` | Each paired with pattern + icon (FR-08-11) |

Rules:
1. **Never hue alone** — every hazard, team, tile state and rarity has colour + pattern + icon/shape (FR-08-11). CVD presets (protan/deutan/tritan) remap these roles only.
2. Reserve Zing Orange + stripes **exclusively** for hazards; no costume-trim of environment may use hazard stripe pattern.
3. Contrast: UI text ≥ 4.5:1; hazard vs adjacent safe surface ΔL* ≥ 30.
4. Rarity labels use text + frame shape, colours: Common `#B8C0CC`, Uncommon `#3DBB6B`, Rare `#2D7DD2`, Epic `#9B5DE5`, Legendary `#FFB627`.
5. AD-26: palette deliberately avoids the reference game's signature pink/blue/yellow UI combo; Berry+Night Ink+Cloud is the brand trio.

## 3. Shape language
| Shape | Meaning | Use |
|---|---|---|
| Circle / pill / blob | Friendly, safe, player | Beans, platforms, UI buttons, bumpers |
| Rounded square | Stable, standable | Floors, tiles, crates |
| Rounded triangle / wedge | Motion, direction, caution | Ramps, chevrons, spinners, hazard flags |
| Wavy line | Slippery / slime / water | Goo, ice, conveyors |
Rules: min bevel radius 5 cm (no hard corners in collision-visible geometry); spikes forbidden — "threat" shown via rotating/punching foam shapes; silhouettes testable as black fills (hazards identifiable by silhouette + motion alone).

## 4. Lighting & mood per world theme (original themes — not reference seasons)
| World theme | Key light | Ambient / fog | Mood | Hazard read note |
|---|---|---|---|---|
| **Toybox Meadow** (default/MVP) | Warm sun 5500K, 40° | Sky blue `#BFE6FF`, light fog | Sunny Saturday | Baseline palette |
| **Candy Workshop** | Soft 4500K + pastel rim | Peach `#FFE1CC` | Sweet, busy | Keep hazards orange; candy props pastel only |
| **Frosty Fun-Park** | Cool 7000K, low sun | Lavender-white `#E9ECFF` | Crisp, sparkly | Ice = Goo Teal sheen + wavy decal |
| **Starlight Playground** (night) | Moon 8000K + emissive props | Deep `#2A2F5C` | Cosy glow, never scary | Hazards emissive; min scene exposure EV kept ≥ day −1.5 |
| **Splash Jungle** | 5000K dappled | Green-blue `#CDEFE3` | Lively | Foliage desaturated ≤ 35% |
Rules: one key + sky ambient + baked GI; no horror lighting, no red full-screen tints; light flicker/flash ≤ 3/s (NFR-10-19); bean rim light always on for crowd separation.

## 5. Readability rules (hazards vs safe)
1. Safe = matte, low-sat, rounded-square, edge trim band in Cocoa.
2. Hazard = saturated Zing/Plum + stripe/dot pattern + motion tell (wind-up ≥ 0.4 s).
3. Warning state (tile about to drop) = Lemon + "!" decal + wobble, ≤ 3 flashes/s (NFR-10-19, FR-08-11).
4. Goal = Sky Cyan + chevrons pointing direction of travel.
5. Out-of-bounds = Goo Teal, low value, soft caustics.
6. Beans must never be shaded like a hazard; repository costume review rejects hazard-stripe dominant designs (FR-12-08).
7. Test: greyscale + 3 CVD sims at 720p, 32 beans — testers ID safe/hazard 100% of 20 screenshots (mirrors FR-08-11 AC1).
8. Camera accessibility: shake/flash/speed-lines toggleable; motion blur off by default (FR-08-12).

## 6. UI art style
- Chunky, rounded "sticker" panels: Cloud fill, 4 px Night Ink outline @1080p, 6 px soft drop shadow.
- Typeface: rounded geometric sans, open licence (e.g. Nunito/Baloo family — final pick pending licence check, FR-12-07); min 28 px body @1080p for 6-year-olds; icon+text for all critical actions (pre-readers).
- Icons: 2-tone flat, 128 px grid, 8 px corner radius, Night Ink outline.
- Motion: squash/stretch on press (100–150 ms), no fast flashing.
- Source PNG/SVG at 2× 1080p (FR-12-03).

## 7. VFX style
- Stylised, chunky, hand-shaped particles (stars, puffs, confetti, bubbles); no blood, smoke-as-fire, or explosions with debris (AD-24).
- Elimination = "poof" cloud + confetti; impact = cartoon star ring.
- Max 3 flashes/s (NFR-10-19); full-screen effects ≤ 20% coverage; reduce-effects toggle (FR-08-12).
- Budget: ≤ 64 particles per effect, ≤ 2,000 live particles per scene, ≤ 1 overdraw layer >50% screen.

## 8. Asset manifest / slot list
All entries live in `assets/manifest.json` (FR-12-01). Placeholders = grey bean + "PH" texture (FR-12-06).

| Category (FR-12-02) | Slot | Part(s) | Count MVP (proposal) | Source | Notes |
|---|---|---|---|---|---|
| `body` | Base bean | `full` | 1 | Pipeline | Shared rig owner |
| `upper` | Costume top | `top`,`thumb` | 20 | **User repo** | Pelvis & above |
| `lower` | Costume bottom | `bottom`,`thumb` | 20 | **User repo** | Pelvis & below |
| `face` | Faceplate | `mask`,`thumb` | 10 | User repo | `hidesFace` from upper (FR-05-05) |
| `pattern` | Body pattern | `mask`,`thumb` | 15 | User repo (2D OK) | Tileable |
| `colour` | Colour swatch | `thumb` | 24 | Data + icon | |
| `emote`/`celeb` | Animations | `full` | 8 / 4 | Anim on base rig | |
| `banner` | Nameplate art | `full` | 10 | User repo (2D OK) | |
| `obstacle` | Spinner, bumper, door, tile, pad, conveyor… | `full`,`lod` | ~25 | Pipeline | Hazard palette rules |
| `level` | Env kits per theme | `full` | 5 themes | Pipeline | |
| `icon`/`ui` | HUD, menus, rarity, team | `full` | ~120 | Pipeline | |
| `vfx` | Effects | `full` | ~30 | Pipeline | |
| `sfx`/`music` | Audio | — | (see ch.08) | — | |

### Naming (FR-12-02 + proposed extensions)
`wb_<category>_<setid>_<part>_<variant>_v<nn>.<ext>` — lowercase ASCII, `[a-z0-9]`, `setid` = `[a-z]+[0-9]{2}`.
Proposed suffix extensions (Issue I-2): textures `…_v03_alb.png` / `_nrm` / `_msk` (R=AO, G=rough, B=pattern mask, A=emissive); LODs `…_v03_lod1.glb`.
Examples: `wb_upper_set01_top_a_v01.glb`, `wb_lower_set01_bottom_a_v01.glb`, `wb_upper_set01_thumb_a_v01.png`, `wb_obstacle_spin01_full_std_v02.glb`.

### Formats (FR-12-03)
3D `.glb` (FBX source OK); textures PNG (sRGB albedo, linear data); UI PNG-alpha/SVG at 2×; anim glTF/FBX on base rig; audio WAV 48k/24 → OGG q6. 2D-only repo images: direct use for UI/banners/patterns/icons; costumes require 3D modelling with the 2D as reference sheet (Q-D2, DEP-11).

### Budgets
| Asset | LOD0 / LOD1 / LOD2 tris | Textures | Bones | Trace |
|---|---|---|---|---|
| Costume part (upper or lower) | 6,000 / 2,500 / 800 | 1× 1024² set (alb, nrm, msk) | ≤ 8 accessory leaf | FR-12-05 |
| Base bean | 4,000 / 1,800 / 600 | 1024² | base rig | proposal |
| Faceplate | 500 | 512² | 0 (blend shapes) | proposal |
| Obstacle (large) | 15,000 / 6,000 / 2,000 | 2048² source, 1024² runtime | ≤ 16 | proposal |
| Obstacle (small) | 3,000 / 1,200 / 400 | 512² | ≤ 4 | proposal |
| Level scene total | ≤ 1.5 M visible tris incl. 32 beans | streaming ≤ 600 MB VRAM | — | NFR-10-04 |
| UI icon | — | 256² source (2×) | — | FR-12-03 |
Worst case beans: 32 × 2 parts × 6k = 384k tris → must pass 32-bean test at 60 fps 1080p on GTX 960 class (FR-12-05 AC2, NFR-10-04). Distance LODs: LOD1 > 8 m, LOD2 > 20 m (proposal).

### Rig / skeleton requirements (FR-12-04)
- Units metres, Y-up, +Z forward, bean height 1.00 m (proposal — Issue I-4), pivot at feet centre.
- Bones: `root > pelvis > spine_01 > spine_02 > head`; arms `clavicle/upperarm/lowerarm/hand_{l,r}`; legs `thigh/calf/foot_{l,r}`. Names fixed, case-exact.
- Face: blend shapes `eye_blink_l/r`, `eye_happy`, `eye_sad`, `mouth_open`, `mouth_smile` (decision for Issue I-5).
- Waist seam: fixed edge loop from `seam_template.glb`; seam verts match position & weights exactly; ≤ 2 mm gap in 5 test poses.
- Upper skinned pelvis+above; lower pelvis+below; ≤ 4 influences/vertex; accessory bones prefixed `acc_`, leaf only, ≤ 8/part.
- No change to collision capsule (FR-05-01, FR-12-04 AC3).

## 9. Import checklist for the user's GitHub repo
1. [ ] Answer Q-D2: repo is 2D-only, 3D, or mixed? (drives modelling schedule, DEP-11)
2. [ ] Folder per category mirroring FR-12-02; files renamed to pattern; lint = 0 errors.
3. [ ] Manifest entry per asset with `id, category, set_id, part, variant, version, files[] (+sha256), rarity_label, hidesFace, traits, budget, provenance, review, placeholder_of`.
4. [ ] Provenance: source path/commit SHA, author, licence/ownership, AI tool use + which, date (FR-12-07). Unclear rights → blocked.
5. [ ] Formats valid (FR-12-03); textures power-of-two, correct colour space.
6. [ ] Budgets pass (tris per LOD, texture size, bones) (FR-12-05).
7. [ ] Rig: base skeleton unchanged, seam test passes all upper×lower pairs (FR-12-04).
8. [ ] Every top has a compatible bottom (full outfits delivered as pairs).
9. [ ] Readability: no hazard stripe/orange dominance; greyscale & CVD check (FR-08-11).
10. [ ] Content review: PEGI 3/ESRB E, UD-4 tone & inclusivity, originality vs reference game (FR-12-08); AI assets carry no-likeness note.
11. [ ] Thumbnails generated (`thumb` part, 512² PNG alpha).
12. [ ] Run `wb-asset-validate` (FR-12-09): 100 assets < 5 min, report with rule IDs; fix and re-run.
13. [ ] Release gate: no shipped slot has `placeholder_of` (FR-12-06 AC2).
Suggested repo layout: `/characters/{upper,lower,face,pattern}/`, `/banners/`, `/icons/`, `/source/` (FBX/PSD refs), `LICENSE_ASSETS.md`.

## 10. Requirement issues & resolutions
| ID | Issue | Resolution (proposed) |
|---|---|---|
| I-1 | FR-12-10 says art direction is *derived from* the repo and pending; work can't wait to M2. | This doc = provisional framework (environment, UI, VFX, readability, pipeline); character-dependent values (accent palette tuning, final themes) ratified at M2. Request owner amend FR-12-10 to "framework v0 at M0, final at M2". |
| I-2 | FR-12-02 has no token for texture maps or LODs; `part` list lacks `lod`; `category`+`part` redundant (`upper…top`). | Add suffixes `_alb/_nrm/_msk`, `_lod<n>`; keep redundancy (cheap lint check). Needs FR-12-02 amendment. |
| I-3 | Budgets exist only for costume parts; none for obstacles, levels, VFX, UI. | Proposed budgets in §8/§7; validate in NFR-10-04 prototype (NFR-10-02 AC2). |
| I-4 | Seam tolerance 2 mm has no defined unit/scale for the bean. | Fix units = metres, bean height 1.00 m, Y-up. Add to `rig_spec.md`. |
| I-5 | FR-12-04 allows face bones **or** blend shapes — two pipelines. | Choose blend shapes (cheaper, easier for repo contributors); face bones disallowed. |
| I-6 | FR-12-03: 2048² max source vs FR-12-05 1024² per part — ambiguous. | 2048² allowed as source only; runtime downscaled to 1024²; validator warns not fails. |
| I-7 | Chapter 3 "Themes and seasons" lists reference-game legacy themes (medieval, neon 4041, etc.). Risk to UD-2/FR-12-08 originality. | Treat as research only; use original world themes in §4. |
| I-8 | FR-08-11 covers hazards/teams/rarity but not art-side rule for costumes resembling hazards. | Added readability rule 6 + checklist item 9; propose adding to FR-12-08 criteria. |
| I-9 | 32 × 3 × 1024² costume textures risk VRAM on GTX 960 (≈ 2 GB). | BC7/BC5 compression, mip streaming, LOD2 uses 256² mip; verify in FR-12-05 AC2 test. |
| I-10 | Q-D2 unresolved: 2D-only repo means ~40 costume parts need modelling (DEP-11 schedule risk). | Default assumption: mixed; plan modelling capacity; escalate Q-D2 to owner now. |
| I-11 | No typeface/licence requirement for UI fonts. | Open-licence rounded sans; record in provenance (FR-12-07). |
