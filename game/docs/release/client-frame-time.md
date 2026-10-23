# Client frame time

Doc 08 asks for 60 fps at 1080p low on a GTX 960 / i5-4590: frame p95 ≤ 16.7 ms.

This repository's CI is headless. A headless Chromium sample is not that machine, so the suite does not fail the build on 16.7 ms. It does fail if the page stalls (p95 ≥ 100 ms) and it does fail the 2.5 ms local-bean sim budget, which is headless and repeatable.

## How to record a real number

```bash
pnpm dev
```

Open http://127.0.0.1:47220, join the gauntlet, and in the console:

```js
const samples = []
let last = performance.now()
let n = 0
function loop(now) {
  samples.push(now - last)
  last = now
  if (++n < 300) requestAnimationFrame(loop)
  else {
    samples.sort((a, b) => a - b)
    const p95 = samples[Math.ceil(0.95 * samples.length) - 1]
    console.log('frames', samples.length, 'p95', p95.toFixed(2))
  }
}
requestAnimationFrame(loop)
```

Write the machine, the resolution, and the p95 under the log below.

## Log

| When | Machine | Viewport | p95 | Notes |
|---|---|---|---|---|
| 2026-10-23 | Headless Chromium (Playwright) on Linux 6.12 x86_64 | 1280×720 | 83.40 ms | 85 frames after warmup. Under the 100 ms stall gate. Not a GTX 960 result. |
