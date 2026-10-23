# Known gaps

These are outside the files this workstream can change. The checks record them so they do not look like a silent pass.

1. **150% text does not scale the gauntlet HUD.** `apps/client/src/style.css` sets type in `px`, and `.brand-bar` does not wrap. A root text-size setting has nothing to multiply, and a 40% longer wordmark crowds a 390 px row. The expansion fixture in `tools/qa/fixtures/expansion.html` is the layout that does scale (rem, wrap, growing buttons). Stream 5 owns the HUD.

2. **Berry on Cloud is 4.03:1.** That passes for the 28 px bold wordmark (large text, 3:1) and fails if that word is ever set at body size. Ink on Cloud is about 15:1.

3. **Some foundation sentences are longer than eight words.** The locked list is `status.friend`, `error.offline`, `error.physics`, `error.full`, and `error.stale`. Buttons stay at one word. Stream 5 owns the copy.

4. **Gameplay-relevant sounds do not yet have on-screen cue ids.** `tools/qa/src/a11y/cues.ts` maps every `GAMEPLAY_RELEVANT_AUDIO` id to a `vis.*` cue. The gauntlet does not render those ids yet (streams 5 and 6).

5. **Protocol N−1.** Version 1 has no predecessor. The next protocol bump has to accept N and N−1. See `VERSIONING.md`.

6. **Headless frame time is not the GTX 960 budget.** `client-frame-time.md` is the browser note. CI only fails a stalled renderer.

7. **60 beans are not a lobby.** `NET.maxPlayers` is 32. The 40 and 60 runs step `BeanWorld` on the gauntlet. They do not go through `Show.addPlayer`.

8. **Respawn piles miss the cruise budgets.** Spread cruise at 32 / 40 / 60 stays inside 9 ms and 12 ms (p99 about 3.9 ms, 3.3 ms, and 5.2 ms on the recorded run). The later lap, when beans fall and respawn onto eight pads, measured about 11.3 ms, 17.2 ms, and 24.4 ms. Thirty-two and forty stay inside the 20 ms scaled cap. Sixty does not, and it is not a supported lobby. CI fails that row only above 40 ms. The 40-bean lap max sample was 19.4 ms, close to that cap.

9. **`Show` stacks 32 beans on eight pads.** Cruise p99 was 12.9 ms, above the 9 ms lobby line and inside 20 ms. Spacing them on the start pad (the spread cruise) is the run that meets 9 ms. Spawn layout belongs to the frozen gauntlet and `Show`.
