# Two-browser smoke

The gauntlet is one show. Two clients are two beans. Moving in one window has to show up in the other.

## By hand

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:47220 in two tabs. Wait until both status lines say everyone is on the same server. In the first tab, hold W. The second tab's view of that bean moves forward. WASD moves, Space jumps, Shift dives, Q and E look. Keys 1–6 send a preset hello. There is no text box.

The show server is `ws://127.0.0.1:47221` (health at http://127.0.0.1:47221/health).

## Playwright

`pnpm qa:e2e` boots the same two processes and runs `tools/qa/e2e/smoke.spec.ts`:

- two browser contexts, one holds W, the other sees that bean's snapshot move more than 2 m
- keyboard-only run, jump, and dive
- HUD contrast on the Cloud panel, and a visible focus ring on the touch Jump button
- reduced motion
- 150% text combined with pseudo-localised (40% longer) strings on the expansion fixture
- a headless frame-time sample, gated only as a stall check

Install the browser once:

```bash
pnpm --filter @wobblebeans/qa exec playwright install chromium
```

The socket-level twin of the two-browser check already lives in `apps/server/src/show.test.ts` and runs under `pnpm test`.
