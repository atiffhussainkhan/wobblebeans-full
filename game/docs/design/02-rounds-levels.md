# Wobblebeans – 02 Round & Level Design (MVP round set)

| | |
|---|---|
| Owner | Senior Level Design |
| Status | Draft v1.0 (23 Oct 2026) |
| Sources | `Wobblebeans_Requirements_v3.docx` (v3), `fallguys/*.md` (01–12), `gapfill-B-rounds-obstacles.md` (B), `gapfill-A-physics-controls.md` (A) |
| Scope | 8 MVP levels (FR-02-11, AD-40), the MVP obstacle kit (FR-03-01), and level-building guidelines |

All numbers are **v3 tuning-baseline design estimates** (Chapter 13, gapfill-A/B). None of them is a confirmed Fall Guys fact. They stay data, not code (NFR-10-20), and they lock only after movement gate M0 (DEP-02). Only Wobblebeans placeholder names are used (AD-25). No layout copies a reference map (AD-38, FR-02-11 AC2). Every blockout below is an original design.

---

## 0. Shared rules for every round

### 0.1 Show flow and slots (FR-01-03, AD-29, B §3, §9)

Lobby of 32 (AD-05). Quota = `clamp(round_half_down(N × pct), 1, N − 1)` (FR-01-04, AD-28; rounding is to the nearest whole number, and .5 goes down).

| Round | Slot | N in | Pct | Quota out | MVP candidates (type) | Target elim (B §9) | speed_mult |
|---|---|---|---|---|---|---|---|
| 1 | R1 | 32 | 70% | 22 | Knock-Knock Run (Course), Bumpy Parade (Course) | 30% | 1.0 |
| 2 | R2 | 22 | 60% | 13 | Knock-Knock Run, Slime Rise, Beam Hop, Wall Dodge, Tail Chase | 40% | 1.0–1.15 |
| 3 | R3 | 13 | 60% | 8 | Slime Rise, Beam Hop, Wall Dodge, Tail Chase | 40% | 1.1–1.25 |
| 4 | F (N ≤ 10) | 8 | — | ≥ 1 winner | Tile Drop, Summit Grab | 1 winner | escalates (B §5) |

At 32 players this gives 4 rounds and about 12–16 min (US-01-1, B §9). Every round has 22 s of fixed overhead: 6 s intro with a picture "how to play" card, 2 s spawn hold, 3 s of 3-2-1-GO, a 3 s Qualified/Out slate, and 8 s of results (B §1.1).

### 0.2 Common fall and respawn rules (FR-03-12, FR-03-13, B §6)
- **Course:** a fall respawns you at your furthest checkpoint after 1.5 s, with 1.0 s of protection. Respawn points are spread at least 1.2 m apart.
- **Survival, Final and slime contact:** you are out. Slate copy: "Out this time – great try!" (FR-08-03).
- **Kill plane** at level_min − 10 m. **Soft out-of-bounds:** a warning at 3 s and the fall rule at 5 s.
- **Chain-hit guard:** 0.5 s of knockdown protection after getting up, and a 3.0 s ragdoll cap (A §5.3).

### 0.3 Kid-readability rules used on every page (FR-03-17, FR-08-19, FR-08-20, NFR-10-19)
- Rules fit on one picture card: 1 icon goal plus at most 8 words.
- Every hazard telegraphs before it can hit: a wind-up, a glow, or a visible arc.
- Hazard outlines and walkable edges have a contrast of at least 3:1.
- Colour is never the only cue (FR-08-11). The player always gets shape plus motion plus sound.
- Nothing flashes more than 3 times per second. Camera shake respects the comfort setting.
- No weapon imagery: mallets are foam and the ball is soft (AD-24).

---

## 1. Knock-Knock Run — COURSE (R1, R2)
**Trace:** FR-02-02, FR-03-06, FR-03-12, FR-02-11 · B §1.3 (3:00) · Obstacles: Trick Door, Bumper, Pusher Block

**Goal (card):** 🚪 "Bump doors. Find the open ones!"

**Blockout** (about 230 m, original 5-row layout; widths in metres):
```
 START (32 spawns, 24 m wide pad)
   │ ramp 20 m
 [ROW A] 8 doors / 5 break  ── CP1
   │ Bumper meadow 30 m (6 moving bumpers, 1.5 m/s)
 [ROW B] 7 doors / 3 break  ── CP2
   │ Pusher lane 35 m (3 lanes × 4 Pusher Blocks, staggered phase)
 [ROW C] 6 doors / 3 break  ── CP3
   │ Bridge 25 m (side rails, 2 static bumpers)
 [ROW D] 5 doors / 2 break  ── CP4
   │ Uphill 30 m
 [ROW E] 4 doors / 1 break  ── CP5
   │ sprint 20 m
 FINISH (arch, 18 m wide)
```
```mermaid
flowchart LR
S[Start pad] --> A[Row A 8/5] --> CP1((CP1)) --> B1[Bumper meadow] --> B[Row B 7/3] --> CP2((CP2)) --> P[Pusher lanes] --> C[Row C 6/3] --> CP3((CP3)) --> BR[Railed bridge] --> D[Row D 5/2] --> CP4((CP4)) --> U[Uphill] --> E[Row E 4/1] --> CP5((CP5)) --> F[Finish]
```

**Obstacle placement and timings**

| Element | Count | Params (source) |
|---|---|---|
| Trick Door | 30 in 5 rows | Real/fake randomised per match on the server; identical meshes; breaks on a hit at ≥ 3 m/s; despawns after 0.3 s (FR-03-06, B §4.2) |
| Bumper (moving) | 6 | Reflect + 10 m/s, ragdoll:none (AD-07), travel 1.5 m/s |
| Pusher Block | 12 | Stroke 3.0 s (out 1.0, hold 0.5, in 1.0, hold 0.5), Δv 10 m/s, extend 4 m/s; phases staggered by 0.75 s per lane |

Each door row is the checkpoint area: the checkpoint sits behind it, so passing a row is banked progress.

**Qualification:** first to finish. R1 70% (22 of 32), R2 60%. Limit 3:00 (B §1.3). The round ends at the quota, the timer, or when the quota becomes impossible (FR-01-04).
**Difficulty variants** (FR-03-04 in MVP; named sets FR-03-15 in R2): *Easy R1* uses 2 extra real doors per row and slower pushers (×0.8). *R2* uses the base layout. *Faster* (R2 only, weight 20%) runs pushers at ×1.25.
**Failure states and mitigations**
- Fake-door jam: the crowd piles at a solid door. Mitigation: at least 1 real door per row and a 2 m door spacing so the crowd spreads.
- Spawn fling: avoided with the 24 m pad and 1.2 m spawn spacing.
- Pusher shoves a player off the bridge: avoided by side rails on the bridge.
- A door left unbroken with no players nearby: the server despawns it at the quota or timer.

---

## 2. Bumpy Parade — COURSE (R1; also the Level Hop fallback)
**Trace:** FR-02-02, FR-03-05, FR-03-12, FR-01-03 AC4 · Obstacles: Swing Ball, Tilt Plank, Bumper, Conveyor

**Goal:** 🏁 "Run, hop, reach the finish!"

**Blockout** (about 250 m; A §1.1 skilled run 45–70 s):
```
START ─ 25m warm-up (2 static bumpers) ─ CP1
 ─ SWING ALLEY 40m: 4 Swing Balls across a 6 m path (period 4.0 s) ─ CP2
 ─ TILT GARDEN 40m: 3 rows × 3 Tilt Planks over a soft-respawn pit ─ CP3
 ─ CONVEYOR HILL 45m: uphill belt at 3.5 m/s with 2 side rails ─ CP4
 ─ BUMPER BALL-PIT 40m: 8 moving bumpers ─ CP5
 ─ FINAL DASH 30m (wide; 2 Swing Balls, offset phase) ─ FINISH
```
**Timings:** Swing Ball period 4.0 s, Δv 14 + 5 up, safe window ≥ 1.2 s, phase randomised. Tilt Plank max 25°; 3 beans tip it in about 1.0 s. Conveyor 3.5 m/s (the 3.6 m/s cap, AD-08), which still nets at least 5 m/s uphill (A §5.5). Bumpers as in §1. Five checkpoints (12 s rule, B §6.2).
**Qualification:** first to finish, R1 70%. Limit 3:00 (B §1.2). In Level Hop (Later) everyone qualifies with a 30-minute limit (FR-01-08).
**Kid-readability:** swing arcs are shown with a dotted floor shadow, and tilt planks have a pivot stripe.
**Variants:** *Easy* runs Swing Balls at period 5.0 s. *Base.* *Swap* (R2+, FR-03-15) replaces Swing Alley with a Spin Mallet row.
**Failure states:** a 32-bean pile-up on Tilt Garden holds the planks flat or tipped. Mitigation: 3 parallel planks per row, and the pit respawns at CP2 with a fall cost of 12 s or less.

---

## 3. Slime Rise — COURSE, rising slime (R2, R3)
**Trace:** FR-02-02 AC2, FR-03-14, FR-03-13, B §4.5 · Obstacles: Conveyor, Swing Ball, Spin Mallet, Launch Arm, Slime

**Goal:** ⬆️🟢 "Climb up! Stay above the slime!"

**Blockout** (original switchback climb, 60 m of height, about 260 m of path):
```
 y=60  FINISH ════  (end flood here at T−2 s)
 y=50  ← SLIME-SIDE STRETCH: 3 Swing Balls + 2 Spin Mallets ←   CP4
 y=38  → LAUNCH ARM DECK (1 arm, edge rails; launch fwd or back) → CP3
 y=24  ← CONVEYOR SWITCHBACK (2 belts against travel, 3.5 m/s) ←  CP2
 y=10  → MALLET RAMP (4 Spin Mallets, 90 °/s) →                   CP1
 y=0   START ▓▓▓▓ slime starts after 3 s grace ▓▓▓▓
```
**Timings:** limit 2:20, 15 s countdown banner, end flood at T−2 s, 3 s grace. Rise rate = 60 / (140 − 3 − 2) ≈ **0.44 m/s** (B §4.5). Spin Mallet 90 °/s, Δv 12 + 4 up; the overclocked variant runs at ×1.4. Launch Arm 120 °/s, tip 20 m/s, with a 1,000-launch bounds test (FR-03-10 AC2).
**Fall rule:** a fall that lands on a lower tier respawns at the checkpoint, but only if that checkpoint is still above the slime. If the slime has already covered your checkpoint, you are out. Slime contact always puts you out.
**Qualification:** finishers qualify. The quota is 60% for R2–R3, so the round ends at the quota (13 of 22, or 8 of 13). Acceptance: when no quota is set, 50–70% of players finish, and a skilled run beats the slime by at least 25 s.
**Readability:** the slime line has a bubbling edge, and a ground arrow shows the climb direction. The countdown banner is an icon plus a number.
**Variants:** *R2 base*, then *R3 Faster* (mallets ×1.4, weight 20%). *Easy* adds a 6 s grace (config).
**Failure states:**
- Standing on a side wall at the end flood is allowed (`allow_wall_stand`, B §6.3).
- A Launch Arm that throws a player back 3 or more times in a row breaks the B §6.2 placement rule. Mitigation: CP3 sits after the arm, not before it.

---

## 4. Beam Hop — SURVIVAL (R2, R3)
**Trace:** FR-02-03, B §1.3 (1:30), §5 · Obstacles: Spin Bar, Slime

**Goal:** 🔄 "Jump the spinning bar!"

**Blockout:**
```
         ┌─────────── circular platform r = 9 m, raised 0.3 m ───────────┐
         │   lower Spin Bar r = 8 m, 0.7 m high  →  clockwise             │
         │   upper Spin Bar r = 8 m, 1.9 m high  ←  counter (duck-only)  │
         │   spawn ring: 22 slots at r = 6 m, 1.6 m apart                 │
         └───────────────── slime moat below (out on touch) ─────────────┘
```
**Timings:** the lower bar starts at 40 °/s (rim ≈ 5.6 m/s) and escalates by smoothstep from 10 s to 85 s up to ×2.6 (104 °/s). The upper bar runs at 25 °/s, counter-rotating with a ±10% sine. Spin Bar Δv is 9 tangential: a hit while grounded is a stumble, a hit in mid-air is a knockdown (A §5.4).
**Qualification:** quota 60% (13 of 22, or 8 of 13). The round ends when players still in ≤ quota, or at 1:30, when everyone still in qualifies (FR-02-03 AC1).
**Acceptance:** fewer than 25% of eliminations happen in the first third, and every third has at least one; the quota is met at 70–100% of the limit in at least 60% of runs (B §5).
**Readability:** the bar casts a bright sweep shadow, and a "whoosh" pitch rises with speed. The upper bar is clearly higher and coloured differently, and the "duck" icon only appears in R3.
**Variants:** *R2 single bar* (upper bar off) and *R3 double bar*.
**Failure states:** a player stands on the bar's pivot hub, which is a safe-spot exploit. Mitigation: the hub is a slippery dome that counts as soft out-of-bounds after 3 s.

---

## 5. Wall Dodge — SURVIVAL (R2, R3)
**Trace:** FR-02-03, B §1.3, §5 · Obstacle: Pusher Block (wall variant, see Issue I-4)

**Goal:** 🧱 "Find the gap in the wall!"

**Blockout:**
```
 wall source ▌▌▌▌▌▌  → walls travel +X across a 20 × 28 m platform →  slime edge
 each wall = 5 Pusher-Block panels, 1–2 panels missing = gap; jump beams from phase 2
 ┌──────────────────────────────┐
 │  spawn grid 4.5 m from back  │  ← back edge has no rail (pushed off = out)
 └──────────────────────────────┘
```
**Timings** (B §5, total 1:45): Phase 1 runs 0–45 s with walls 6.0 → 5.0 s apart at 3.0 m/s. Phase 2 runs 45–87 s at 4.5 s spacing and adds 0.6 m jump beams. Phase 3 runs 87–105 s: side blocks close 30% of the platform, spacing tightens 4.5 → 3.0 s, and speed rises to 5.0 m/s. Push Δv is 10 m/s.
**Qualification:** quota 60%. The round ends at the quota, or at 1:45 when everyone still in qualifies.
**Readability:** each gap is lit 2 s before its wall moves, with a floor arrow. The walls are tall and solid, with a striped leading edge.
**Variants:** *R2* runs phases 1–2 only, holding phase 2 to time. *R3* runs the full three phases.
**Failure states:** a crowd blocks a gap and pushes players into the wall. This is intended chaos, but player bumps are capped at 5 m/s. Two gaps per wall from phase 2 make sure a gap always exists.

---

## 6. Tail Chase — POINTS (R2, R3)
**Trace:** FR-02-04 AC3, FR-04 (grab), FR-08-02 · Obstacles: Bumper (grab is a player verb, not an obstacle; see Issue I-6)

**Goal:** 🎀 "Hold a tail when time's up!"

**Blockout** (original "picnic hill" arena, 40 × 40 m):
```
 ┌───────────────────────────────────────┐
 │  ○ bumper   ▲ ramp     ○ bumper        │
 │      ┌───── central mound ─────┐       │  edges railed (no fall-out)
 │  ○   │  2 tunnels underneath   │   ○   │
 │      └─────────────────────────┘       │
 │  ▲ ramp     ○ bumper   ▲ ramp          │
 └───────────────────────────────────────┘
```
**Timings:** limit 2:00. The final-seconds banner shows at 15 s. Six bumpers (reflect + 10 m/s, ragdoll:none) act as escape tools. There are no falls: the arena is fully railed, and the respawn is 1.0 s if someone cheeses out (B §6.1).
**Qualification:** at the start, tails are given to `quota` random players (13 of 22, or 8 of 13). A grab steals a tail, confirmed by the server. At 0:00, the holder on the server's last tick qualifies (FR-02-04 AC3). The quota is exact, so no tie rule is needed.
**Readability:** a tail-holder has a glowing tail and a ring icon over their head. A "!" warning plus a pulse of 3 Hz or less shows when someone is within 2 m (FR-08-02).
**Variants:** *R2* starts tails at 50% of players, then they are redistributed at GO. *R3* adds 2 extra bumpers.
**Failure states:** grab spam, handled by the grab cooldown (A, FR-04). A player who never moves (AFK) gets the standard idle kick. A stolen tail always gives 1.0 s of grab immunity, so a tail cannot be snatched straight back.

---

## 7. Tile Drop — FINAL (survival) and Main Show fallback
**Trace:** FR-01-05 AC2/AC3, FR-03-07, B §4.3, FR-01-03 AC4 · Obstacles: Drop Tile, Slime

**Goal:** ⬡ "Tiles drop! Be last on top!"

**Blockout** (original circular stack, layers 8 m apart; hex tiles 1.6 m across):
```
 L1 (top)   ⬡⬡⬡⬡⬡⬡⬡  radius 14 m, spawn ring
 L2         ⬡⬡⬡⬡⬡⬡⬡⬡  radius 16 m
 L3         ⬡⬡⬡⬡⬡⬡⬡⬡⬡ radius 18 m
 L4 (13–20 players only)
 ▓▓▓▓▓▓▓▓▓ slime (out) ▓▓▓▓▓▓▓▓▓
```
**Timings:** a tile vanishes 0.8 s after the first touch: dip 0–0.12 s, white 0.12–0.56 s, bounce-back 0.56–0.72 s, gone at 0.8 s. The first contact is authoritative. The client hides the tile within 100 ms of the server's removal event (FR-03-07 AC2). Layers: 3 for 8–12 players and 2 for 7 or fewer (B §4.3). Limit 5:00.
**Winner:** the last bean standing. Simultaneous final eliminations resolve by sub-tick timestamp, and an exact tie means all win (AD-10). At the 5:00 time-out, everyone still in wins.
**Acceptance:** with 12 players the median round lasts 2:00–3:30, and fewer than 5% of rounds time out.
**Readability:** the bounce-back "last call" is also a sound tick. Lower layers glow so they stay readable from above.
**Variants:** the layer count follows N. *Tile Return* (tiles come back after 6 s) is the team-show fallback in R2.
**Failure states:** a perfectly synced slow-jump stalemate is answered by the 5:00 all-win time-out. A desync where a tile has already gone on the server is handled by the server's authority (03 §4).

---

## 8. Summit Grab — FINAL (trophy grab)
**Trace:** FR-01-05 AC1/AC3, FR-03-10, FR-03-12 · Obstacles: Swing Ball, Spin Bar, Launch Arm

**Goal:** 🏆 "Climb up! Grab the trophy!"

**Blockout** (original spiral hill, about 140 m of path, 30 m rise):
```
          🏆 trophy on 3 m plinth (grab volume)          CP3
        / Spin Bar ring (2 bars, 45 °/s) on summit plateau
      / LAUNCH ARM BEND (1 arm, rails; lands fwd or back)  CP2
    / SWING BALL STAIRS (3 balls, period 3.5 s offset 1.2 s)  CP1
  START: 10 spawns, staggered 1.2 m
```
**Timings:** Swing Ball period 3.5 s (range 3–6), Δv 14 + 5. Spin Bar 45 °/s. Launch Arm 120 °/s with a 20 m/s tip. Limit 5:00.
**Fall rule:** there is no slime. A fall respawns you at your checkpoint after 1.5 s (fall rule per level, FR-03-13 AC1; see Issue I-3).
**Winner:** the first server-confirmed grab of the trophy wins. At the 5:00 time-out, all remaining finalists win (AD-10).
**Readability:** a light beam rises from the trophy so it can be seen from the start, and a path arrow is painted on the ground.
**Variants:** *Base*, and *Windy* (R2, FR-03-15 Swap: Spin Mallets instead of Swing Balls).
**Failure states:**
- A Launch Arm puts someone on top of the summit and skips the climb. The bounds test makes sure no launch reaches the plateau unless that path is marked as intended.
- Plinth camping: the plinth's grab volume is 360°, and bumping a player off it is allowed.

---

## 9. MVP Modular Obstacle Kit (FR-03-01 – FR-03-17, A §5.4–5.5, B §4)

Every piece is a data-driven prefab with `period`, `phase`, `speed`, `dv`, `trigger` and a **required** `ragdoll` tag (CI fails if the tag is missing, FR-03-01 AC2). Motion runs on the server time base, with drift of 50 ms or less at p95 (FR-03-02). Every piece has a `speed_mult` (FR-03-04).

| # | Piece | Ragdoll tag | Key defaults (range) | Footprint / snap | Used in |
|---|---|---|---|---|---|
| K1 | Swing Ball | knockdown | period 4.0 s (3–6); Δv 14 + 5 up (10–18) | 6 m path module; pivot height 7 m | Bumpy Parade, Slime Rise, Summit Grab |
| K2 | Spin Bar | stumble (grounded) / knockdown (air) | 40 °/s (30–60), Δv 9 (7–12); escalation per B §5 | r 4–9 m; heights 0.7 m low, 1.9 m high | Beam Hop, Summit Grab |
| K3 | Spin Mallet (foam) | knockdown | 90 °/s (60–150), Δv 12 + 4; overclock ×1.4 | 4 m disc | Slime Rise |
| K4 | Tilt Plank | none (physics) | max 25° (15–35); 3 beans tip it in ≈ 1.0 s | 3 × 8 m | Bumpy Parade |
| K5 | Conveyor | none (floor) | 3.5 m/s, **≤ 3.6 cap** (AD-08) | 2 m tiles | Bumpy Parade, Slime Rise |
| K6 | Bumper | **none** (AD-07) | reflect + 10 (7–14); travel 1.5 m/s | 1.5 m round | Knock-Knock Run, Bumpy Parade, Tail Chase |
| K7 | Pusher Block (+ wall variant) | stumble | stroke 3.0 s (2–4.5), Δv 10 (7–14), extend 4 m/s; wall 3→5 m/s | 2 × 2 m panel | Knock-Knock Run, Wall Dodge |
| K8 | Launch Arm | knockdown | 120 °/s (90–180), tip 20 m/s (15–26) | 6 m arm, must pass bounds test | Slime Rise, Summit Grab |
| K9 | Trick Door | none | break at ≥ 3 m/s; despawn 0.3 s; identical meshes | 2 m door; rows of 2–10 | Knock-Knock Run |
| K10 | Drop Tile | none | vanish 0.8 s (0.5–1.5), white 0.5 s; layers 8 m apart | 1.6 m hex | Tile Drop |
| K11 | Slime (out / slippery) | none | out on contact; rising rate per B §4.5 | plane | Slime Rise, Beam Hop, Wall Dodge, Tile Drop |
| support | Checkpoint, rail, ramp, spawn pad, kill plane, soft out-of-bounds volume, finish arch | — | B §6 | 1 m grid | all |

**Kit conventions**
- 1 m grid. Path modules are 6, 12 or 24 m wide; R1 uses lanes at least 6 m wide ("wide lanes", B §9).
- Every hazard has a telegraph state and a cue: an anticipation pose of at least 0.25 s, plus a sound.
- Collision never changes with skin (FR-03-16).

---

## 10. Level-building guidelines

1. **Movement budget (A §1–3):** run 9.0 m/s, jump apex 1.5 m, air time ≈ 0.73 s. Gaps are at most **3 m for jump only** and at most **5 m for jump plus dive** (AD-31). Ledges taller than 1.5 m need a ramp or bounce.
2. **Course length:** about 250 m, which is 45–70 s for a skilled player and fits a 3:00 limit (B §1.2).
3. **Checkpoints:** the **12 s rule** governs (B §6.2). Place one after each high-variance section, typically 4–6 per course. Never place one right before a launcher that can loop a player back.
4. **Difficulty by slot (B §9):** fail risk per obstacle is 5–10% in R1, 10–15% in R2 and 15–20% in R3. "Faster" variants appear only in R2 and later, at weight 20%.
5. **Crowd design:** the spawn pad holds max players at 1.2 m spacing. Make a choke point no narrower than 1/3 of the start width, and avoid choke points in the first 20 m.
6. **Safe windows:** each periodic hazard leaves a window of at least 1.2 s. Neighbouring hazards on the same path use different phases.
7. **Readability:** contrast of at least 3:1 on edges and hazards. In a child first-encounter test, at least 80% must describe the hazard correctly. No flashing above 3 Hz.
8. **Tone:** slapstick only, with no blades or injury (AD-24). Out-copy is positive (FR-08-03).
9. **Originality:** a legal and design sign-off confirms the layout is not a 1:1 copy of any reference map (AD-38).
10. **Data:** each level record follows the FR-02-01 schema (id, name key, type, min/max players, rule, pct, slots, divisor, weight, limit, variants, enabled flags). It must pass the name lint and the schema check in CI.
11. **Exit tests per level:** the B §1.2 or §5 timing test, the 1,000-respawn overlap test, a wall-hug soft-lock pass (0 soft-locks), the launch bounds test, flash analysis, and the client perf capture on min-spec (NFR-10-04).
12. **Practice Playground (FR-01-12):** this offline space includes one station per kit piece, K1–K11.

**Registry sketch (FR-02-01)**

| id | type | slots | minP–maxP | pct / rule | limit | weight |
|---|---|---|---|---|---|---|
| knock_knock_run | COURSE | R1,R2 | 8–40 | 70 / 60 | 3:00 | 1.0 |
| bumpy_parade | COURSE | R1 | 8–40 | 70 | 3:00 | 1.0 |
| slime_rise | COURSE_SLIME | R2,R3 | 6–32 | 60 | 2:20 | 1.0 |
| beam_hop | SURVIVAL | R2,R3 | 6–32 | 60 / timer | 1:30 | 1.0 |
| wall_dodge | SURVIVAL | R2,R3 | 6–32 | 60 / timer | 1:45 | 1.0 |
| tail_chase | POINTS | R2,R3 | 6–32 | 60 (tails = quota) | 2:00 | 1.0 |
| tile_drop | FINAL | F (+ fallback) | 2–20 | last standing | 5:00 | 1.0 |
| summit_grab | FINAL | F | 2–**10** | trophy grab | 5:00 | 1.0 |

---

## 11. Requirement issues found and how they were resolved

| # | Issue | Requirements | Resolution (design default; owner may override) |
|---|---|---|---|
| I-1 | R1 type weights are Course 80 / Survival 10 / Points 10, but no MVP Survival or Points level is tagged R1. | B §3.2, FR-02-11 | Weights renormalise over the valid candidates, so R1 is 100% Course from 2 candidates. This meets the FR-02-11 AC3 minimum of 2. Logged for R2 content. |
| I-2 | Summit Grab uses the reference player range of 2–9, but the Final slot fires at N ≤ 10. At N = 10 only Tile Drop would be valid, which breaks FR-02-11 AC3 ("final slot has 2"). | FR-02-11 AC3, AD-29 | Summit Grab maxP is set to **10**, and its spawn plaza is sized for 10. |
| I-3 | FR-03-13 says "Finals eliminate a player who falls into slime", but a trophy-grab climb with launch arms needs respawn. | FR-03-13, FR-01-05 AC1 | Summit Grab has no slime. Falls use kill-plane respawn at a checkpoint (FR-03-13 AC1 allows a fall rule per level). FR-03-13 wording should be amended. |
| I-4 | Wall Dodge needs moving walls (B §4.1 "Sweeper/moving wall"), but that is not in the MVP subset of 11 obstacles. The MVP table lists Pusher Block. | FR-03-01, FR-02-11 | Walls are built as a **Pusher Block wall variant** (K7): linear travel of 3→5 m/s, Δv 10. No new obstacle type is added. |
| I-5 | Tile Drop is the Main Show fallback for *any* slot (`FALLBACK[mode][slot]`), but as a last-standing Final it would end the show early in a non-final slot. | FR-01-03 AC4, FR-01-05 | In a non-final slot the fallback runs Tile Drop under a **survival-quota rule** (it ends at the quota) with the same layer table. **Owner confirmation needed.** |
| I-6 | The MVP table lists "grab" as a Tail Chase obstacle. Grab is a player verb, and Tail Chase is POINTS with a 60% quota, while a tail is held or not held. | FR-02-04, FR-03-01 | Tails are seeded so that the number of tails = quota, making qualification exact. Bumper is the only kit obstacle. A 1.0 s re-grab immunity was added. |
| I-7 | Checkpoint spacing conflicts: "25–45 m" against "43–67 m" after re-basing on gapfill-A. | FR-03-12, B §6.2 | The **12 s fall-cost rule governs**, and spacing is set per course in playtest (4–5 checkpoints in this set). |
| I-8 | FR-01-05 AC5 says "2–10 left **before round 4** → Final", but the slot rule makes any round a Final when N ≤ 10. | FR-01-05 AC5, AD-29 | The AD-29 slot rule is followed (Final whenever N ≤ 10). AC5 should be reworded. |
| I-9 | The brief asks for difficulty variants, but named variant sets (FR-03-15) are R2. Only speed_mult (FR-03-04, Should) is MVP. | FR-03-04, FR-03-15 | The MVP ships with speed_mult and layer-count variants only. Named swap variants are designed here but disabled until R2. |
| I-10 | Spin Bar Δv is 9 m/s, above the 8 m/s knockdown threshold, yet A §5.4 says "stumble if low beam". | FR-03-03, A §5.4 | Ragdoll is tagged per contact state: stumble when grounded, knockdown in the air. The grounded hit is capped at Δv 7.9 so it stays a stumble. |
| I-11 | Survival rounds can be "survive the timer" or a quota, and the catalogue marks Wall Dodge as "survivors of timer". | FR-02-03 AC1, 02 catalogue | Both survival levels use **quota 60% plus a timer fallback** (everyone still in qualifies at time-out), matching B §1.2's "ends early when quota reached". |
| I-12 | Tile Drop's 4-layer band (13–20 players) can never occur in the Main Show, because Finals run at N ≤ 10. | B §4.3, AD-29 | The band is kept for fallback and R2 or config use. Main Show Finals use 3 layers for 8–10 players and 2 for 7 or fewer. |
| I-13 | Slime Rise is typed COURSE, which normally means respawn, but slime contact puts the player out. Checkpoints under the slime are ambiguous. | FR-02-02 AC2, FR-03-13 | Falls respawn only if the checkpoint is above the slime; otherwise the player is out. Slime contact always puts the player out. |
