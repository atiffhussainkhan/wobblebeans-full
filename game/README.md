# Wobblebeans

Wobblebeans is an original online party game for kids aged 6–12: wobbly beans, elimination shows, and obstacle courses. This repository is the production foundation. It is a server-authoritative browser game, not a throwaway prototype and not a Unity project.

The engine decision is recorded in [docs/ADR-001-engine.md](docs/ADR-001-engine.md). The master design is [docs/design/Wobblebeans_Master_Design_v1.docx](docs/design/Wobblebeans_Master_Design_v1.docx). How the other nine developers split the rest of that design is [docs/WORKSTREAMS.md](docs/WORKSTREAMS.md).

## Run it

Requires Node 22 and pnpm 10.

```bash
pnpm install
pnpm dev
```

- Game: http://127.0.0.1:47220
- Show server (HTTP health and WebSocket): http://127.0.0.1:47221 and `ws://127.0.0.1:47221`

Open the game in two browser tabs. Each tab is a bean on the same server. Move in one tab and the other tab shows that bean move. WASD moves, Space jumps, Shift dives, drag or Q and E looks around. Keys 1–6 send a preset hello. There is no text box.

`pnpm dev` starts the show server and the Vite client together. The client port is 47220 and the server port is 47221 so they stay off the usual dev ports.

## Checks

```bash
pnpm check
```

That runs lint, typecheck, unit tests, and the child-safety scan. CI does the same on every push (`.github/workflows/ci.yml`).

## What the foundation includes

- `packages/shared` — physics constants, the kinematic step, Rapier world, the gauntlet course, binary protocol, net rates, prediction helper, generated names, safety flags, audio event ids.
- `apps/server` — one authoritative show. Clients send inputs at 25 Hz. The server simulates at 50 Hz and broadcasts snapshots at 20 Hz nearby and 10 Hz far.
- `apps/client` — Three.js view, prediction of your own bean, interpolation of everyone else. The bean is a procedural capsule on the split top/bottom rig until character animation lands.
- `packages/backend-services` — in-memory stubs. Parent contact data and birth year live only in `ParentAccountStore`.
- `assets/` — the CC0 Kenney, KayKit, and Quaternius picks, plus `assets/licenses/` and `assets/manifest.json`.
- `tools/generate-manifest.mjs` — rebuilds the manifest and checks the local files named in `docs/design/ASSET_SELECTION.md`.
- `tools/check-safety.mjs` — fails the build on voice capture, text entry, paid random rewards, or child contact fields outside the parent store.

## Controls and the test course

The course id is `foundation-gauntlet`: a step, a jump gap, a block to steer around, a ramp, a moving shuttle, and a finish line. It is a movement test. The eight show levels are workstream 3.

Falling below the course respawns you on your pad. Crossing the cyan finish shows "You made it!" on your own client.

## Child safety

These are product rules, enforced in `packages/shared/src/safety/rules.ts` and in CI:

- No open chat and no voice. Quick chat and emotes are preset ids.
- No loot boxes, no premium currency, and no real-money purchases in the MVP.
- No dark patterns. Nothing auto-queues the player back into a show.
- A child's email or birth year is stored only on the parent account. Everyone else sees a generated name (Adjective, Noun, and two digits, 16 characters or fewer).

## Assets

Art is CC0 from Kenney, KayKit, and Quaternius. Licences are in `assets/licenses/`. The client serves the tree at `/assets` through `apps/client/public/assets`. Load models with `loadGltf`, `loadTexture`, and `loadManifest` in `apps/client/src/assets/load.ts`. Do not add third-party IP. Procedural meshes and colours from the art doc are fine.

## Layout

```
apps/client          Vite + Three.js
apps/server          Show server
packages/shared      Sim, protocol, course, safety
packages/backend-services
assets               CC0 catalogue
docs/design          Master design and source docs
tools                Manifest and safety scan
```

## Tests that describe the slice

- Shared locomotion: speed, jump height, coyote time, a single air dive, names within 16 characters.
- Rapier: standing, running, two worlds agreeing, the shuttle carrying a bean, a bot finishing the gauntlet.
- Server: two players in one show, a rejected quick-chat id, and two real WebSockets where one bean runs and the other sees it.
