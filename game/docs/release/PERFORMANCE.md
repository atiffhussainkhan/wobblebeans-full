# Performance budgets

Source: doc 08 §12 and risk R-01. Gameplay numbers stay in `@wobblebeans/shared`. These gates live in `tools/qa/src/perf/budgets.ts`.

## Server

A tick is the kinematic step plus, on snapshot ticks, a personalised snapshot per bean. Bots are headless `InputFrame`s, the same path as a player. Beans are spaced at capsule diameter + 0.2 m on the gauntlet start pad.

The sampler splits each run. Cruise is 70 ticks after a 30-tick warmup, while the crowd is still on the opening straight. Lap is the next 180 ticks, when beans jump, fall, and respawn onto the eight pads.

| Beans | Cruise gate | Lap gate | Role |
|---|---|---|---|
| 32 | p99 ≤ 9 ms | p99 ≤ 20 ms | Supported lobby. Two shows per vCPU (AD-32). The lap uses the workstream's scaled runtime budget |
| 40 | p99 ≤ 12 ms | p99 ≤ 20 ms | Heavier config |
| 60 | p99 ≤ 12 ms | no NaN, p99 ≤ 40 ms | Stress only. Compared with 12 ms and with the 20 ms stability line. `NET.maxPlayers` is 32, so this run uses `BeanWorld` directly. The 40 ms figure is a runaway guard, not a pass of 20 ms |

`pnpm test` includes `tools/qa/src/load/tick-cost.test.ts`. The latest numbers are in `LOAD-TEST.md`.

The foundation `Show` only accepts 32 players and spawns them on the gauntlet's eight pads, so capsules overlap. That tick is measured too. Stacked contacts miss 9 ms; CI holds it to the 20 ms scaled cap and the load-test log records the miss.

Sub-budgets from doc 08 (physics ≤ 5 ms, gameplay ≤ 1.5 ms, bots ≤ 1.2 ms, serialisation ≤ 1.3 ms) are reported as the physics-only p99 and the mean snapshot size. They are not separate fail lines. The fail line is the full tick.

## Client

| Budget | Gate in CI | Notes |
|---|---|---|
| Sim step p99 ≤ 2.5 ms | Yes, one local bean | Doc 08 sim line. The client predicts only its own bean |
| 10-step replay | Recorded | Design target is +2.0 ms. CI fails the batch only if it exceeds 10 × 2.5 ms |
| Frame p95 ≤ 16.7 ms | Recorded, not a headless fail | Min spec is a GTX 960. Headless Chromium is a stall gate at 100 ms. See `client-frame-time.md` |
| Gzipped JS | Yes, after `vite build` | Measured 1,052,020 bytes (Three.js chunk plus Rapier). Budget is 1,200,000 bytes in `budgets.ts` |
| Draw calls, GPU, 3.5 GB RAM | No | Needs the min-spec machine |

## Loudness

Doc 06 §5–6 is locked in `LOUDNESS` for the audio bus: music −16 LUFS ±1, true peak ≤ −1 dBTP, full-mix short-term max −10 LUFS, defaults Master 70 / Music 60 / SFX 80 / UI 70, no jump above 6 LU except GO. There is no scored bed in the asset pack, so CI does not meter a file.
