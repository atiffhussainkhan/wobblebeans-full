# Workstreams 2–10

Developer 1 owns the foundation: the monorepo, the binary protocol, the 50 Hz kinematic step, the show server, the gauntlet client, the asset manifest, CI, and this split. The other nine developers can start in parallel. Each section names the directories that developer owns, the shared interfaces they must call, and the acceptance checks that close the stream.

The master design is `docs/design/Wobblebeans_Master_Design_v1.docx`. The markdown in `docs/design/` is the same content split by source doc. Where the GDD's early placeholder names (Wobble Dash, Summit Scramble) differ from the round doc, use the round-doc names: Knock-Knock Run, Bumpy Parade, Slime Rise, Beam Hop, Wall Dodge, Tail Chase, Tile Drop, Summit Grab.

## Rules for every stream

- Import gameplay numbers from `@wobblebeans/shared`. Do not copy `maxSpeed`, gravity, or net rates into a second file.
- Do not change the byte layout of `Hello`, `Welcome`, `Input`, `Snapshot`, `Ping`, `Pong`, `Event`, or `Reject`. New message ids start at 9 and bump `NET.protocolVersion` only with a note in `docs/ADR-001-engine.md`.
- `tools/check-safety.mjs` must stay green. No microphone APIs, no `<input>`, no `<textarea>`, no contenteditable, no gacha, no `email` or `birthYear` outside `ParentAccountStore`.
- Preset ids only on the wire. Never send a display string, a chat string, or a report description.
- Costumes do not change the capsule (FR-03-16).
- Dive and grab are advantage verbs. Every MVP level stays completable with move and jump (doc 01 §3.2, AD-31).
- Original layouts and the CC0 catalogue in `assets/` plus procedural content. No Fall Guys art, no other studio's characters, no unlicensed audio.

## Frozen by the foundation

| Path | Why it stays put |
|---|---|
| `packages/shared/src/protocol/codec.ts` | Wire format. Streams read it; they do not reorder fields |
| `packages/shared/src/net/rates.ts` | Doc 08 rates |
| `packages/shared/src/physics/constants.ts`, `hash.ts` | Tuning baseline. A change must update `physicsHash` on client and server together |
| `packages/shared/src/physics/world.ts` | Rapier world, movers, finish, kill plane |
| `apps/server/src/index.ts` | Listen, hello, welcome, reject, sim loop |
| `apps/server/src/show.ts` | Input queue, snapshot interest, social rate limit |
| `apps/client/src/main.ts` | Prediction, reconciliation, remote interpolation |
| `packages/shared/src/course/foundation-gauntlet.ts` | The integration course. Do not retune it to make a new level pass |
| `tools/check-safety.mjs` | CI gate |

A stream may add a **single call** into a frozen file (for example `director.step(tick)` at the top of `Show.step`, or one import in `main.ts`). Say so in the commit. Do not reformat those files.

## Shared interfaces already in the repo

```ts
stepKinematics(state, input, surface, dt) → MoveResolution
BeanWorld.create(course?) / spawn / step(inputsById) / destroy
SurfaceModifiers, NEUTRAL_SURFACE
CourseDef, CourseBox, SpawnPoint, moverOffset, inFinish
Locomotion, InputFrame, BeanState
NET, isNearSnapshotTick, isFarSnapshotTick, PredictedBean
Msg, encodeHello, encodeInput, encodeSnapshot, decodeClient, decodeServer, SnapBean
SAFETY, QUICK_CHAT, EMOTES, EventKind, isAllowedClientEvent
AUDIO, GAMEPLAY_RELEVANT_AUDIO
nameForSlot, colourForSlot, formatDisplayName
ParentAccountStore, MatchResult, CoinLedger, ShopCatalogue, LiveConfig
TelemetryService, assertTelemetrySafe, ModerationService, REPORT_CATEGORIES
assetUrl, loadGltf, loadTexture, loadManifest   // apps/client
```

`SurfaceModifiers` is the obstacle hook: acceleration, speed, and gravity multipliers, an external acceleration, and a platform velocity. The gauntlet shuttle already sets `platformVelocityX` when the bean is grounded on the mover. New obstacles should feed this struct from server tick, not from `Date.now()` on the client.

---

## 2 — Character physics, controls, animation

**Owns:** `packages/shared/src/physics/integrate.ts`, `packages/shared/src/physics/types.ts` (new locomotion values only), `apps/client/src/render/bean.ts`, `apps/client/src/input.ts`, new `packages/shared/src/character/`.

**Reads:** `PHYSICS`, `BeanWorld`, `AUDIO` ids, clip files under `assets/animations/` (KayKit Idle/Run/Jump/Wave/Cheer/Dance and the rest of that set). `PrototypePete.gltf` is a blockout mannequin, not the shipping skeleton (asset selection, slot 1).

**Does not own:** capsule dimensions, `constants.ts`, the gauntlet, the snapshot byte layout.

The foundation implements Idle, Run, Jump, Fall, Dive, and DiveSlide, plus coyote time, jump buffer, one air dive, dive-over-jump, and slide recovery. Grab, stumble, and ragdoll are specified in doc 03 §1–2 and are this stream.

### Acceptance

- Grab (doc 03 §2.4): toggle or hold, range and break force from the design, not predicted on other beans' knockback (D-04). A grabbed bean's pose still comes from the server snapshot.
- Stumble and ragdoll (doc 03 §2.5): ragdoll replicates as root plus 3–5 key bones, not every bone (doc 08 §3). Getting-up returns to Idle.
- Emotes cancel on any move, jump, or dive, and do not play airborne, grabbing, or ragdolled (AD-34).
- Animation reads `Locomotion` and plays the matching clip. The procedural wobble may remain as a fallback if a clip fails to load. Upper costume stays parented to `spine_02`, lower costume to `pelvis` (doc 03 §3.1). Names of those groups already exist on `BeanView`.
- Keyboard and gamepad mappings from doc 03 §4.1. Touch stick, Jump, and Dive already exist under 820 px; do not add a text field.
- Assist options from doc 03 §5 are settings, default off where the design says so, and they never skip a required jump.
- Tests: a scripted input trace for grab-break, stumble recovery, and "dive beats jump" still holds. `pnpm test` stays green. Two browsers still see each other on the gauntlet.

---

## 3 — Rounds, eight MVP levels, obstacle kit

**Owns:** new files under `packages/shared/src/course/` (one module per level), new `packages/shared/src/obstacles/`, dressing calls that stay inside the course view. Server sampling of movers stays on `moverOffset` or a new pure function of `tick` that both sides import.

**Reads:** `CourseDef`, `SurfaceModifiers`, `BeanWorld.create(course)`, `inFinish` as the pattern for volumes (finish, slime, drop tile, trophy).

**Does not own:** `foundation-gauntlet.ts`, show phase timing (stream 4), bean animation (stream 2).

### The eight levels (doc 02)

| Level | Type | Fall |
|---|---|---|
| Knock-Knock Run | Course, R1–R2 | Respawn |
| Bumpy Parade | Course, R1, also Level Hop fallback | Respawn |
| Slime Rise | Course, rising slime, R2–R3 | Eliminate on slime |
| Beam Hop | Survival, R2–R3 | Eliminate |
| Wall Dodge | Survival, R2–R3 | Eliminate |
| Tail Chase | Points, R2–R3 | Respawn |
| Tile Drop | Final survival, and Main Show fallback | Eliminate |
| Summit Grab | Final trophy grab, max 10 beans | Respawn at checkpoint. No slime |

### Obstacle kit (doc 02 §9)

Swing Ball, Spin Bar, Spin Mallet, Tilt Plank, Conveyor (≤ 3.6 m/s, AD-08), Bumper (no ragdoll tag, AD-07), Pusher Block, Launch Arm, Trick Door, Drop Tile, Slime, plus checkpoint, rail, ramp, spawn pad, kill plane, finish arch. Each piece is data: `period`, `phase`, `speed`, `dv`, `trigger`, and a required `ragdoll` tag. Motion is a function of server tick. Drift target ≤ 50 ms at p95 (FR-03-02).

### Acceptance

- Each level exports a `CourseDef` plus a qualify rule the show director can call: race order, alive set, score map, or trophy grab. The rule is pure. The server is the only caller that counts.
- Gaps ≤ 3 m for jump only and ≤ 5 m for jump plus dive (AD-31). A bot that only holds forward and jumps on a fixed pattern can finish Knock-Knock Run. Dive is never the only way across.
- Spawn pads hold the level's max players at about 1.2 m so capsules do not start interpenetrating. The gauntlet uses 1.7 m because 1.2 m jammed the test.
- Checkpoints follow the 12 s rule (doc 02 §10). No checkpoint immediately before a launcher that can loop a player.
- Slime, tiles, and the trophy are server volumes. A client hiding a tile does it after an `EventKind.TileRemoved` (or a new message id ≥ 9), within 100 ms (FR-03-07).
- Visuals use `assets/obstacles/` and the greybox kit. Recolour to the palette in doc 05 (Berry, Night Ink, Cloud, Oat, Mint, Cyan, Cocoa, Orange, Lime, Plum). Avoid the reference game's pink / blue / yellow costume triad.
- A test loads each `CourseDef`, builds a `BeanWorld`, and asserts the kill plane and the finish or trophy volume are reachable numbers (not NaN) and that the mover function is deterministic across two worlds.

---

## 4 — Show flow, matchmaking, bots

**Owns:** new `apps/server/src/flow/`, new `apps/server/src/bots/`, and the `MatchmakerService` / `FleetService` behaviour in `packages/backend-services` once stream 9's interfaces are stable. One hook in `Show.step`: call the director, do not rewrite the input or snapshot code.

**Reads:** `Show`, `EventKind.RoundState`, `EventKind.Eliminated`, `EventKind.Score`, `MatchResult`, `QueueTicket`, level qualify rules from stream 3.

### Acceptance

- State machine from doc 01 §4.2 and doc 08 §4: Queue, RoundIntro (6 s), spawn hold (2 s), countdown (3 s), Play, Outcome, interstitial, Final, Results. Input is locked until GO. Play again is a manual press (FR-08-18). No auto re-queue.
- Up to 5 rounds, final when `N ≤ 10` or the round index hits the max (AD-29). No repeated level. No same round type twice in a row unless the candidate set is empty.
- Quota `clamp(round_half_down(N × pct), 1, N − 1)`. Disconnects count as eliminated and do not shrink the quota (FR-01-04).
- There is always a champion in a final that still has humans: time-out or an exact tie means everyone still in wins (AD-10). Bots never enter a final. If only bots remain, the show closes with no winner recorded (doc 01 §4.6).
- Bots are in-process, casual, at most 12, about 0.1 ms each per step (D-11). They use the same `InputFrame` path as humans. They do not get a second physics.
- Low population after 120 s offers Practice instead of a dead queue (doc 01 §4.2). Practice grants no XP and no coins (FR-01-12).
- Reconnect: 60 s, max 2 per show, token bound to player id and show id (D-09). Until that exists, dropping the socket removes the bean, which is what the foundation does.
- Matchmaking uses the region from ping beacons, never a precise location (`QueueTicket.region`).
- Tests: a 4-bean scripted show qualifies the right count, sends round-state events, and refuses to start a final of only bots.

---

## 5 — UX, UI screens, HUD

**Owns:** `apps/client/index.html`, `apps/client/src/style.css`, new `apps/client/src/ui/`. One import from `main.ts` to mount the shell. Do not move the canvas sim loop.

**Reads:** `QUICK_CHAT`, `EMOTES`, `formatDisplayName`, `colourForSlot`, `EventKind`, UI images in `assets/ui/`, backdrops in `assets/backgrounds/`. Kenney buttons are recoloured to Berry and Night Ink (doc 05 §6).

### Acceptance

- Screen inventory doc 04 §1: boot, age fork, parent consent handoff, main menu, show picker with a single Main Show card, HUD, qualification slate, spectate, results, dressing room, settings, parental dashboard entry. Empty, waiting, and error states use real sentences. No lorem, no "Welcome to your app".
- HUD (doc 04 §4): beans left or quota, timer in the last 15 s that does not flash above 3 Hz, quick-chat wheel of preset phrases (≤ 2 inputs, doc 09 §6). The bubble already renders catalogue text only. Keep it that way.
- Kid readability doc 04 §5: chunky targets, short labels, no dense paragraphs on the HUD.
- Accessibility doc 04 §6: gameplay-relevant audio has a visual twin (`GAMEPLAY_RELEVANT_AUDIO`), reduced camera motion is a setting, controls are remappable without typing a bind name into a text box (use a button that listens for the next key).
- Localisation doc 04 §7: strings in one catalogue keyed by id, expansion room of about 40%, no text baked into the 3D scene except the generated name sprite.
- First-run copy never asks the child for an email. The age fork sends a grown-up to the parent flow (doc 04 §2.2–2.3). The child path does not collect contact data.
- Layout works at 1280×720 and at 390×844. The touch controls already show under 820 px or a coarse pointer.
- No dark patterns: no countdown on the shop, no "only N left", no pre-ticked extras, no confirm button that buys.

---

## 6 — Audio

**Owns:** new `apps/client/src/audio/`, and it replaces `blip()` in `main.ts` with a call into that bus. Event ids stay in `packages/shared/src/audio/events.ts`. Add ids there when the design lists a sound the sim must fire; do not invent a parallel string union in the client.

**Reads:** doc 06, especially §3 (the event list), §4 buses, §5 loudness, §6 kid-safe volume, §8 no VO.

The asset pack has no scored music bed. Use short procedural tones or silence until a CC0 bed is added under `assets/audio/` with a licence file. Do not drop in commercial or reference-game stems.

### Acceptance

- States from doc 06 §2: menu, round intro, play, last 15 s, qualified, out, results. Intensity follows the round, not a streak.
- Jump, land, dive, slide, fall, respawn, and quick-chat fire the ids already in `AUDIO`. Obstacle ids (swing, spinner, slime, tile, checkpoint) are added next to the obstacle kit, one id per telegraph. Telegraph sounds start with the anticipation pose (≥ 0.25 s, doc 02 §9).
- No voice-over (AD-53). No microphone permission.
- Kid-safe default volume and a hard ceiling (doc 06 §6). Mute music and mute effects are separate (`audioOn` / `musicOn` icons already in `assets/ui/`).
- Every id in `GAMEPLAY_RELEVANT_AUDIO` still has a visual cue owned with stream 5 (FR-08-12).
- No coin-cascade, slot-machine, or near-miss stingers.
- A test lists every `AUDIO` value and fails if the bus map has no entry for it.

---

## 7 — Progression, rewards, economy, cosmetics

**Owns:** extensions of `ProgressionService`, `CoinLedger`, and `ShopCatalogue` in `packages/backend-services`, new `packages/shared/src/cosmetics/`, dressing-room module under `apps/client/src/ui/dressing/` (agree the folder with stream 5 before both edit `ui/`).

**Reads:** `MatchResult`, `PublicProfile`, `ParentControls.coinShopEnabled` (default **false**), palette and pattern images.

### Acceptance

- XP and level curve from doc 07 §1. Season path is free (doc 07 §2). No premium track in the MVP.
- Coins: append-only ledger, idempotency key per show, challenge, and tier (the stub already rejects a second apply of the same key). Earn rates from doc 07 §3: about 10 + 5 per round + 25 for a win, daily soft cap then 25%. Show the server the signed `MatchResult`; the client does not grant coins.
- Shop: fixed coin prices only, the items in `ShopCatalogue` as the pattern. Weekly rotation, no countdown, confirm step, 24 h undo if unused (FR-05-11). Rarity is a label, never a drop rate (FR-05-09). `SAFETY.lootBoxes`, `premiumCurrency`, and `realMoneyInMvp` stay false.
- Slots doc 07 §4: top, bottom, colour, pattern, face, emotes (4), celebration, banner, title. Starter kit can build a look on day one with no play. "How to get it" is a sentence, never a buy button on the dressing room (doc 07 §5). "Surprise me" picks from **owned** items only.
- Equip does not change `PHYSICS` capsule radius or height.
- Parent gate: if `coinShopEnabled` is false, the shop route does not render prices as actionable.
- Tests: double-submit of one `showId` does not double coins; a shop payload has no random weight field.

---

## 8 — Child safety, parent accounts, consent, moderation, privacy

**Owns:** `packages/backend-services/src/parent-account.ts`, `ModerationService`, and the policy constants in `packages/shared/src/safety/rules.ts` (phrase list and `quickChatMinIntervalS` only). Do not set `openChat`, `voiceChat`, `lootBoxes`, `premiumCurrency`, `realMoneyInMvp`, or `darkPatterns` to true.

**Reads:** `isAllowedClientEvent`, `REPORT_CATEGORIES`, `assertTelemetrySafe`, stream 5's shield button.

### Acceptance

- Parent account is the only store for email and birth year. Birth year, not a full date (doc 09 §12). At most 4 children. Verifiable parental consent before any child profile is playable online (doc 04 §2.3, FR-11-02). The stub's `status: 'pending'` must not be treated as verified.
- Defaults: friends off, coin shop off, quick chat on, 60 minutes (already in `addChild`). The parent can turn quick chat off and the server then drops `EventKind.QuickChat` for that child.
- Move `quickChatMinIntervalS` from 1.5 to 2.0 to match doc 09 §6, and extend phrases toward the launch set (≤ 16, positive or neutral, no insults). Update the server test that currently expects the 1.5 s gate.
- Report reasons are the picture categories already in `REPORT_CATEGORIES` (unfair / mean / scary / bug — align labels with doc 09 §7: being mean, cheating, bad name or picture, something upset me). No free-text box. Filing a report auto-blocks for the reporter (FR-07-15).
- Mute and block in two taps (doc 09 §7.1). Block keeps the blocked bean out of future matchmaking once stream 4's queue exists.
- Sanctions follow doc 09 §7.4 and always notify the parent. Escalation for off-platform contact attempts is a human process, not a client feature.
- Data inventory doc 09 §12.2 stays accurate: show servers store pseudonymous ids and poses for the life of the process only.
- Negative tests, run in CI: searching the client bundle source finds no `getUserMedia`, no text input, no custom name field.

---

## 9 — Backend services, persistence, telemetry, live-ops config

**Owns:** `packages/backend-services/src/services.ts` beyond the stubs, a future `packages/backend-services/src/persist/` if a database is introduced, `ConfigService` / `LiveConfig`.

**Reads:** doc 08 §5–7 and §10. Identity, profile, social, matchmaker, fleet, progression, ledger, shop, config, telemetry, moderation, admin.

### Acceptance

- Services other than `ParentAccountStore` accept and return `playerId` only. `assertTelemetrySafe` already rejects payloads whose keys look like email, birth, address, phone, IP, precise location, or free text. Keep that on the ingest path.
- `MatchResult` is applied idempotently. Game servers do not write the ledger themselves (doc 08 §2 principle 4).
- `LiveConfig` is versioned. A show pins the version it was allocated with. A level disabled at least 60 s before start is not chosen (FR-01-03 AC5). Stream 3's level ids are the keys.
- `AdminService.ready` stays false until there is a real audit log. The stub must not grow a `grantCoins` that skips the ledger.
- Persistence, when added, encrypts parent contact data with a key that show servers do not have. Tests use the in-memory stores and must not require a network database.
- Health endpoints report each service's `ready` flag. The show process on port 47221 stays independent so `pnpm dev` still runs with every backend stub unready.
- Telemetry events for the playtest gates in doc 01 §12 use numeric reason codes. No child-typed strings.

---

## 10 — QA, performance, accessibility, localisation, release

**Owns:** `tools/qa/`, extra jobs in `.github/workflows/ci.yml` that do not remove lint, typecheck, test, or safety, and `docs/release/`.

**Reads:** doc 08 §11–12, doc 04 §6–7, doc 06 §5–7, the acceptance lists above.

### Acceptance

- CI on every push runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm safety`. Add a job that boots the show server and runs the two-socket movement test if it is not already in `apps/server/src/show.test.ts` (it is; keep it).
- Performance budgets doc 08 §12, scaled to this runtime: sim step stays inside the 20 ms budget with 32 kinematic beans on the gauntlet; client frame time is measured in a browser note checked in under `docs/release/`. Do not block the suite on a GPU number we cannot reproduce headlessly. Record the number when a browser is available.
- Accessibility pass: keyboard-only gauntlet (already WASD, Space, Shift, Q/E), visible focus on UI stream 5 builds, contrast of HUD text on the Cloud panels, reduced-motion hook.
- Localisation: the string catalogue has no orphan keys, and generated names stay ≤ 16 characters after translation (the English generator is already tested). Names are not translated as free text; the word lists are curated per language (FR-11-05).
- Release checklist: protocol version, physics hash, asset manifest count matches `assets/manifest.json`, licences still in `assets/licenses/`, `SAFETY` flags unchanged, no secret in the client bundle.
- A smoke script documents the two-browser check: `pnpm dev`, open the client twice, move in one tab, see that bean move in the other.

---

## Suggested first commits (so nobody collides on day one)

| Dev | First commit touches only |
|---|---|
| 2 | `packages/shared/src/character/grab.ts` and a test. No edit to `world.ts` yet |
| 3 | `packages/shared/src/obstacles/kit.ts` with the eleven piece ids and default periods, no levels yet |
| 4 | `apps/server/src/flow/director.ts` with the phase enum and a unit test that does not import the socket server |
| 5 | `apps/client/src/ui/shell.ts` mounted with one new import in `main.ts` |
| 6 | `apps/client/src/audio/bus.ts` and the `blip` replacement |
| 7 | `packages/shared/src/cosmetics/slots.ts` plus a ledger test for a second idempotency key |
| 8 | Parent consent state machine in `parent-account.ts`, and the 2.0 s quick-chat constant |
| 9 | `LiveConfig` pin helper and a test that a disabled level id is excluded |
| 10 | `tools/qa/smoke.md` and a CI comment that points at `pnpm check` |

If two streams need the same frozen file, the one whose table above names that file makes the edit. The other consumes the export.
