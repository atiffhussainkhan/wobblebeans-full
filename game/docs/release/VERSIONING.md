# Versioning

Wobblebeans tags a release as `client-{version}-protocol-{protocol}`.

| Piece | Where | Current |
|---|---|---|
| Client version | root `package.json` `version` | `0.1.0` |
| Protocol | `NET.protocolVersion` in `@wobblebeans/shared` | `1` |
| Recorded pair | `docs/release/expected.json` | must match both |

Images use the same pair:

- `wobblebeans-server:0.1.0-protocol-1`
- `wobblebeans-client:0.1.0-protocol-1`

Dockerfiles live in `tools/qa/docker/`. Compose for a local pair is `tools/qa/docker/docker-compose.yml`. The client bundle bakes `VITE_SERVER_URL` at build time. A production host sets that to the public WebSocket URL (`wss://…`).

## Protocol

`Hello` must carry the same `NET.protocolVersion` and `physicsHash()` or the server sends `Reject`. Adding a field inside an existing frame is a breaking change. New message ids start at 9. A bump updates `NET.protocolVersion`, `docs/release/expected.json`, and a note in `docs/ADR-001-engine.md`.

Protocol 1 has no shipped predecessor, so this server accepts version 1 only. The next bump must accept N and N−1 for the rollout window in doc 08 §11. Do not invent an N−1 decoder before that bump.

## Physics

`physicsHash()` is the tuning identity. Changing a constant in `PHYSICS` without both sides rebuilding the hash is a failed join. The release checklist prints the hash. It does not pin a magic number in a second file.

## Ship

1. `pnpm check`
2. `pnpm qa:load` (also part of `pnpm test`)
3. `pnpm qa:e2e`
4. Build images from `tools/qa/docker/`
5. Tag `client-x.y.z-protocol-N`
