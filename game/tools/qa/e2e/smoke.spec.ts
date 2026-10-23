import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { contrastRatio, requiredContrast } from '../src/a11y/contrast.ts'
import { decodeServer } from '../../../packages/shared/src/protocol/codec.ts'
import { NET } from '../../../packages/shared/src/net/rates.ts'
import { pseudoLocalise } from '../src/i18n/pseudo.ts'
import { CLIENT_FRAME_STALL_P95_MS } from '../src/perf/budgets.ts'
import { percentile } from '../src/perf/stats.ts'

const EXPANSION = [
  { id: 'brand.name', text: 'Wobblebeans' },
  { id: 'status.friend', text: 'Gauntlet is live. Open another tab to bring a friend.' },
  { id: 'error.offline', text: 'Could not reach the show server. Is `pnpm dev` running?' },
  { id: 'banner.finish', text: 'You made it!' },
  { id: 'controls.jump', text: 'Jump' },
  { id: 'controls.dive', text: 'Dive' },
] as const

interface Tap {
  frames: Uint8Array[]
}

function bytesOf(payload: string | Buffer): Uint8Array {
  const buf = typeof payload === 'string' ? Buffer.from(payload, 'base64') : payload
  return new Uint8Array(buf)
}

/** Server frames, captured outside the page so the game's own socket stays untouched. */
function watchServer(page: Page): Tap {
  const tap: Tap = { frames: [] }
  page.on('websocket', (ws) => {
    if (!ws.url().includes(`:${NET.devServerPort}`)) return
    ws.on('framereceived', (frame) => {
      tap.frames.push(bytesOf(frame.payload))
    })
  })
  return tap
}

function playerId(tap: Tap): number {
  for (const frame of tap.frames) {
    const msg = decodeServer(frame)
    if (msg.type === 'welcome') return msg.playerId
  }
  throw new Error('no welcome')
}

function pose(tap: Tap, id: number): { pz: number; py: number; locomotion: number } {
  let latest: { pz: number; py: number; locomotion: number } | null = null
  for (const frame of tap.frames) {
    const msg = decodeServer(frame)
    if (msg.type !== 'snapshot') continue
    const bean = msg.beans.find((item) => item.id === id)
    if (bean) latest = { pz: bean.pz, py: bean.py, locomotion: bean.locomotion }
  }
  if (!latest) throw new Error(`bean ${id} missing from snapshots`)
  return latest
}

async function holdForward(page: Page): Promise<void> {
  await page.bringToFront()
  await page.locator('#view').click()
  await page.keyboard.down('KeyW')
}

test('two browsers see one bean move', async ({ browser }) => {
  const left = await browser.newContext()
  const right = await browser.newContext()
  const pageA = await left.newPage()
  const pageB = await right.newPage()
  const tapA = watchServer(pageA)
  const tapB = watchServer(pageB)
  await pageA.goto('/')
  await pageB.goto('/')
  await expect(pageA.locator('#status')).toContainText('same server')
  await expect(pageB.locator('#roster')).toContainText('2 beans')
  const idA = playerId(tapA)
  const before = pose(tapB, idA)
  await holdForward(pageA)
  await expect.poll(() => pose(tapB, idA).pz, { timeout: 10_000 }).toBeGreaterThan(before.pz + 2)
  await pageA.keyboard.up('KeyW')
  await left.close()
  await right.close()
})

test('keyboard-only gauntlet can run, jump, and dive', async ({ page }) => {
  const tap = watchServer(page)
  await page.goto('/')
  await expect(page.locator('#me')).not.toHaveText('')
  const id = playerId(tap)
  const start = pose(tap, id)
  await holdForward(page)
  await expect.poll(() => pose(tap, id).pz, { timeout: 8_000 }).toBeGreaterThan(start.pz + 1)
  const beforeJump = pose(tap, id)
  await page.keyboard.down('Space')
  await page.keyboard.up('Space')
  await expect
    .poll(() => {
      const now = pose(tap, id)
      return now.py > beforeJump.py + 0.15 || now.locomotion === 2 || now.locomotion === 3
    })
    .toBe(true)
  await page.keyboard.down('ShiftLeft')
  await expect
    .poll(() => {
      const loco = pose(tap, id).locomotion
      return loco === 4 || loco === 5
    })
    .toBe(true)
  await page.keyboard.up('ShiftLeft')
  await page.keyboard.up('KeyW')
  const end = pose(tap, id)
  expect(Number.isFinite(end.pz)).toBe(true)
})

test('HUD text on the Cloud panel meets contrast, and focus is visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#status')).not.toHaveText('')
  const sample = await page.locator('#status').evaluate((el) => {
    const panel = el.closest('.panel')
    if (!panel) throw new Error('status is not on a panel')
    const text = getComputedStyle(el)
    const paper = getComputedStyle(panel)
    return {
      fg: text.color,
      bg: paper.backgroundColor,
      fontPx: Number.parseFloat(text.fontSize),
      weight: Number.parseInt(text.fontWeight, 10),
    }
  })
  expect(contrastRatio(sample.fg, sample.bg)).toBeGreaterThanOrEqual(requiredContrast(sample.fontPx, sample.weight))

  await page.setViewportSize({ width: 390, height: 844 })
  const jump = page.locator('#btn-jump')
  await jump.focus()
  const outline = await jump.evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).not.toBe('none')
})

test('reduced motion leaves no long-running animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const long = await page.evaluate(() =>
    document.getAnimations().filter((anim) => {
      const effect = anim.effect
      if (!effect || !('getTiming' in effect)) return false
      const timing = effect.getTiming()
      return Number(timing.duration) > 150
    }).length,
  )
  expect(long).toBe(0)
})

test('150% text plus long strings does not clip the expansion fixture', async ({ page }) => {
  const html = readFileSync(new URL('../fixtures/expansion.html', import.meta.url), 'utf8')
  await page.setContent(html)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate((rows) => {
    document.documentElement.style.fontSize = '150%'
    for (const row of rows) {
      const el = document.querySelector(`[data-i18n="${row.id}"]`)
      if (el) el.textContent = row.text
    }
  }, EXPANSION.map((row) => ({ id: row.id, text: pseudoLocalise(row.text) })))
  const clipped = await page.evaluate(() => {
    const hits: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
      const id = el.dataset.i18n ?? 'unknown'
      const style = getComputedStyle(el)
      if ((style.overflowX === 'hidden' || style.overflowY === 'hidden') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
        hits.push(id)
      }
      const rect = el.getBoundingClientRect()
      if (rect.width > window.innerWidth + 1) hits.push(`${id}:wide`)
    }
    return hits
  })
  expect(clipped).toEqual([])

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const running = await page.evaluate(() => document.getAnimations().filter((anim) => anim.playState === 'running').length)
  expect(running).toBe(0)
})

test('headless frame time stays under the stall gate', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#me')).not.toHaveText('', { timeout: 20_000 })
  const samples = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const frames: number[] = []
        let last = performance.now()
        let count = 0
        const loop = (now: number) => {
          frames.push(now - last)
          last = now
          count += 1
          if (count < 90) requestAnimationFrame(loop)
          else resolve(frames.slice(5))
        }
        requestAnimationFrame(loop)
      }),
  )
  const p95 = percentile(samples, 95)
  console.log(`headless frame p95 ${p95.toFixed(2)} ms over ${samples.length} frames`)
  expect(p95).toBeLessThan(CLIENT_FRAME_STALL_P95_MS)
})
