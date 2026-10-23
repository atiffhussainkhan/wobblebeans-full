# ADR-001 — Engine and netcode runtime

- Status: accepted
- Date: 2026-10-23
- Deciders: foundation (developer 1), for the whole team

## Context

`docs/design/08-technical-architecture.md` §1 recommends **Unity 6 LTS** (URP, Linux dedicated server) and a netcode spike between NGO and Photon Fusion 2. That recommendation still stands for a future native port. This repository cannot build or run Unity headless, so the playable foundation has to be something we can compile, test, and open in a browser on the machines we actually have.

The rest of doc 08 does not depend on Unity. The load-bearing decisions are: one dedicated process per show, server authority for qualification and obstacles, prediction of the player's own bean only, fixed 50 Hz simulation, and child personal data kept out of the show server.

Q-A1 ("MiniMax") is still unanswered. Whatever it turns out to be, it must not receive child data (doc 08 §1, FR-11-14, NFR-10-12).

## Decision

Wobblebeans MVP is a TypeScript monorepo:

| Concern | Choice |
|---|---|
| Simulation | Shared module `@wobblebeans/shared`, fixed `dt = 1/50` |
| Physics | Rapier WASM via `@dimforge/rapier3d-compat` (ES build `rapier.es.js`; the package main is CJS and breaks under `"type": "module"`) |
| Character | Kinematic capsule + `KinematicCharacterController`. Gravity and locomotion are integrated in `stepKinematics`, not by the rigid-body solver, so client and server share one function |
| Rendering | Three.js in `apps/client` (Vite). Procedural split capsule until workstream 2 retargets clips |
| Show server | Node.js `apps/server`, one in-process show, WebSocket, binary frames |
| Services | `packages/backend-services` in-memory stubs. A modular monolith is allowed by doc 08 §2 |

Transport for this slice is **WebSocket on TCP**, not UDP/DTLS. Encryption, connect tokens, and the allocator (doc 08 §3) belong to workstreams 4 and 9. The message layout is already binary and versioned so that swap does not change gameplay code.

### Rates (doc 08 §3)

| Topic | Value | Where |
|---|---|---|
| Simulation | 50 Hz | `PHYSICS.tickHz`, `NET.tickHz` |
| Input packets | 25 Hz, last 6 steps | `NET.inputPacketHz`, `NET.inputRedundancy` |
| Snapshots | 20 Hz within 40 m, 10 Hz beyond | `isNearSnapshotTick` (tick % 5 is 0 or 2), `isFarSnapshotTick` (tick % 5 is 0) |
| Remote interpolation | 100 ms, clamp 80–200 ms | `NET.interpDelayMs` |
| Extrapolation | ≤ 150 ms, then freeze | `NET.extrapolateMaxMs` |
| Correction | &lt; 0.05 m ignored, 0.05–0.3 m smoothed ~150 ms, &gt; 0.3 m hard snap | `PredictedBean.reconcile` |
| Position quantum | int16 × 256 (±128 m, ~3.9 mm) | `NET.posScale` |
| Yaw | uint16 over one turn | codec |
| Movers | `moverOffset(serverTick)` | same function on both sides |

Snapshots in this slice are **full poses**, not delta-compressed against the last ack (D-07). Delta compression is a later bandwidth task. It must not change the logical `SnapBean` fields.

If the input queue underruns, the server repeats the last stick and clears buttons, so a held direction does not drop to zero on the ticks between 25 Hz packets.

### Authority

The server owns poses, finish, respawn, and the shuttle. The client runs a second `BeanWorld` with only its own bean and reconciles from snapshots. Remotes are interpolated. Grabs, knockback, and ragdoll are not predicted (D-04) and are not implemented yet.

`physicsHash()` is FNV-1a over `PHYSICS` plus the course collider hash. `Hello` must match or the server sends `Reject` reason `Physics` (2), `Version` (1), or `Full` (3). Changing a constant without bumping the hash on both sides is a failed join, by design (doc 08 §10, I-09).

### What this slice deliberately leaves out

- The eight MVP levels and the obstacle kit (workstream 3). The foundation course is `foundation-gauntlet`, a movement test, not a show level.
- Show phases, matchmaking, bots, reconnect tokens (60 s, max 2, D-09) (workstream 4).
- Screens SC-01…SC-15 (workstream 5). The gauntlet HUD is a placeholder.
- Audio playback (workstream 6). Event ids live in `packages/shared/src/audio/events.ts`. `blip()` is a no-op.
- Persistence, the real gateway, and telemetry shipping (workstream 9).

### Child safety (not optional)

From `SAFETY` and `tools/check-safety.mjs`, which CI runs:

- No open chat, no voice, no text fields, no microphone APIs.
- Quick-chat and emotes are preset numeric ids. The server drops anything else. Phrases are rendered from the shared catalogue, never from the wire.
- No loot boxes, no premium currency, no real-money purchase in the MVP. The coin shop, when it exists, is fixed prices only.
- `email` and `birthYear` may appear only in `ParentAccountStore` (`packages/backend-services/src/parent-account.ts`). Show servers, profiles, telemetry, and moderation use a pseudonymous `playerId`.
- Display names are Adjective + Noun + two digits from `nameForSlot`. No free-text name.
- No dark-pattern flags. Play again is a button the player presses (doc 01 §4.2).

`SAFETY.quickChatMinIntervalS` is 1.5. Doc 09 §6 specifies 1 message / 2 s. Workstream 8 owns moving the constant to 2.0 and extending the phrase list toward the launch set. Do not fork a second rate.

## Consequences

- Developers work in this repo, not a Unity project. A later native port would re-implement rendering and transport behind the same `stepKinematics` and codec, or replace them under a new ADR.
- Rapier is initialized with `init()` from the ES entry. The library prints a deprecation warning about init parameters; behaviour is the supported WASM startup.
- `pnpm.onlyBuiltDependencies` must keep `esbuild`, or pnpm 10 will skip the install script and `tsx` / Vite will not run.
- Protocol version is `NET.protocolVersion` (1). Adding a field inside an existing frame is a breaking change. New message ids start at 9.

### Character controls (workstream 2)

The locomotion enum grew in place (`Grab` 6 through `Recover` 13). Existing frames did not change size:

- Input is still 13 bytes. Button bit 2 is **grab** (bit 0 jump, bit 1 dive). Older frames leave the bit clear, which decodes as not grabbing.
- A snapshot bean is still 28 bytes. Flag bit 4 is **getUpBack**. Bits 0–3 are unchanged.
- `coyote` carries the ragdoll settle clock while a bean is tumbling, so the 0.2 s settle survives a snapshot without a new field.

Grabs, player bumps, and ragdoll are server-owned (D-04). `BeanWorld.authoritative` is false on the predicting client. `resolveBumps` runs once at the top of `BeanWorld.step`, and a fall below the kill plane calls `clearForRespawn` so a tumble does not continue on the pad. Those are the only edits in that frozen file.

Key-bone poses (root, pelvis, spine_02, head) are a pure function of the replicated root in `keyBonePose`. Limb motion is local. New tuning lives in `CHARACTER`, not in `PHYSICS`, so `physicsHash()` is unchanged. Fixed jump stays at `PHYSICS.releaseCutMult` (1); assists cannot shorten a jump.
