# Wobblebeans — full export

## What's in this repo (main branch)
- `game/` — the game code: a tree snapshot of Cursor Origin `atiff-khan/wobblebeans` **main @ 55a1e85**. All 270 files are byte-identical to Origin; every git blob sha was checked.
- `design/` — design docs 01–10 (.md), Wobblebeans_Master_Design_v1.docx/.pdf, sim.py
- `assets-selected/` — 142 selected CC0 assets, ASSET_SELECTION.md, contact_sheet.png. The 819 MB `assets-src` clone is deliberately left out.

## Branches = Origin PR heads
Each branch below is `main` of this repo with `game/` replaced by that PR head's full tree. The tree was verified blob-for-blob against Origin.

| Branch | Origin PR | Title | Origin head |
|---|---|---|---|
| cursor/child-safety-parent-consent-d3fb | #1 | Parent consent, moderation, and privacy retention | b857a7c |
| cursor/show-flow-matchmaking-479d | #2 | Add Main Show flow, matchmaking, and bots | 27bfa15 |
| cursor/character-controls-5590 | #3 | Character controls: grab, stumble, ragdoll, climb, and assists | 585e272 |
| cursor/progression-rewards-aa4a | #4 | Add free progression, coin ledger, and dressing room | 3ff5178 |
| cursor/audio-engine-ac24 | #5 | Add the kid-safe Web Audio bus | 66af812 |
| cursor/ux-ui-screens-7db1 | #6 | Add the kid-facing UI shell (SC-01 to SC-22) | 05b99c8 |
| cursor/backend-services-liveops-a74c | #7 | Add backend services, persistence, and the signed live-config pipeline | ec1c42b |
| cursor/qa-perf-release-63b0 | #8 | Add QA, performance budgets, localisation, and release packaging | d139fb1 |
| cursor/workstream-3-levels-04b9 | #9 | Add the obstacle kit and eight MVP levels | a79f0ef |

PRs 1–5 were opened against an older main (7c68821). PRs 6–9 were opened against 55a1e85. All 9 are still open and unmerged on Origin.

## Git history not carried over
Origin could not be cloned (no git credentials), so every file was read through the Origin API. Each branch is a single snapshot commit. The Origin commit history and PR discussions are **not** included.

## Status
- Dev 1's integration merge of PRs 3–9 is **unfinished**. No branch here is an integrated build.
- The bean body is still an original mesh, not a repo character.
