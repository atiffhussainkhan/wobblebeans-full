# Release checklist

`pnpm test` runs `tools/qa/src/release/checklist.ts`. A release is ready when every line is ok.

| Check | Pass |
|---|---|
| Client version | root `package.json` matches `docs/release/expected.json` |
| Protocol version | `NET.protocolVersion` matches `expected.json` |
| Physics hash | `physicsHash()` is stable and non-zero. Printed, not copied |
| Asset manifest | `count` equals `assets.length`, every path exists under `assets/`, and the client copy matches |
| Licences | Kenney, KayKit animations, KayKit prototype bits, and Quaternius provenance are non-empty in `assets/licenses/` |
| Safety flags | open chat, voice, loot boxes, premium currency, real-money, and dark patterns stay off. Quick chat stays preset ids. The interval may be 1.5 s or 2.0 s |
| Secrets | no cloud access key, private key block, live token, or forge token in `apps/`, `packages/`, or the built client bundle |
| Analytics SDKs | none of the ad or product-analytics packages in any `package.json` |
| Docker | `tools/qa/docker/Dockerfile.server` and `Dockerfile.client` expose health checks |
| Client bundle | gzipped JavaScript at or under the budget in `tools/qa/src/perf/budgets.ts` |
| Server tick | 32 beans ≤ 9 ms p99, 40 ≤ 12 ms, 60 stable and ≤ 20 ms. See `LOAD-TEST.md` |
| Two browsers | `pnpm qa:e2e` or the hand steps in `tools/qa/smoke.md` |

Tag and image names are in `VERSIONING.md`.
