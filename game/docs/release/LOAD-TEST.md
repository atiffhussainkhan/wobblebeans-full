# Load test

Recorded from `pnpm check` on Node v22.23.4, Linux 6.12.94+ x86_64. CI runs the same assertion inside `pnpm test`.

A tick is physics plus, on near-snapshot ticks, one personalised snapshot per bean. Bots hold forward and jump on a staggered cadence. Warmup is 30 ticks and is not sampled.

**Cruise** is the next 70 ticks, while the crowd is still spread on the opening straight (capsule diameter + 0.2 m). That window is the 9 ms and 12 ms measurement.

**Lap** is the following 180 ticks: jumps, falls, and respawn back onto the gauntlet's eight pads. The workstream scales that full step to 20 ms on this runtime. Sixty beans are stress only.

| Phase | Beans | p50 | p95 | p99 | max | Physics p99 | Gate | Result |
|---|---|---|---|---|---|---|---|---|
| spread cruise | 32 | 1.389 | 2.784 | 3.859 | 3.859 | 2.345 | ≤ 9 ms | pass |
| spread lap | 32 | 1.251 | 7.110 | 11.310 | 13.416 | 11.309 | ≤ 20 ms (9 ms design line missed) | pass scaled |
| spread cruise | 40 | 1.619 | 2.647 | 3.331 | 3.331 | 2.254 | ≤ 12 ms | pass |
| spread lap | 40 | 3.588 | 11.329 | 17.154 | 19.359 | 17.151 | ≤ 20 ms (12 ms design line missed) | pass scaled |
| spread cruise | 60 | 2.654 | 4.272 | 5.210 | 5.210 | 4.175 | ≤ 12 ms reference, ≤ 20 ms stress | pass |
| spread lap | 60 | 4.504 | 19.029 | 24.415 | 25.957 | 23.374 | ≤ 40 ms runaway guard | above 12 ms and above 20 ms |
| show cruise | 32 | 6.466 | 11.640 | 12.915 | 12.915 | full step | ≤ 20 ms | above the 9 ms lobby line |
| show lap | 32 | 1.060 | 8.188 | 10.136 | 11.243 | full step | ≤ 20 ms | above the 9 ms lobby line |

NaN beans: 0 in every row.

Mean personalised snapshot bytes (spread only; one encode per viewer): cruise 32 = 28,928, lap 32 = 28,815, cruise 40 = 45,120, lap 40 = 44,886, cruise 60 = 101,280, lap 60 = 100,383. `Show.step` includes fan-out inside the timed window, so the show rows do not split snapshot bytes out. The show "physics" column is that full step.

Two earlier runs on the same machine stayed inside the cruise gates as well. Spread-cruise p99 ranged 3.9–4.9 ms (32), 3.0–3.3 ms (40), and 5.0–7.5 ms (60). The 60-bean lap p99 ranged 24.4–29.0 ms. Show cruise p99 ranged 12.9–14.9 ms.

`Show` cannot host 40 or 60 players (`NET.maxPlayers` is 32) and stacks the 32 it does accept on eight pads. The spread layout is the fair spacing for the 9 ms and 12 ms lines.
