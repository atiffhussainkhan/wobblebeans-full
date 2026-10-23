import {
  BeanWorld,
  NET,
  PHYSICS,
  beanToSnap,
  centerYFromFeet,
  encodeSnapshot,
  isFarSnapshotTick,
  isNearSnapshotTick,
  makeBean,
  nameForSlot,
  type InputFrame,
} from '@wobblebeans/shared'
import { Show } from '../../../../apps/server/src/show.ts'
import { SERVER_TICK_P99_MS, SERVER_TICK_REFERENCE_MS } from '../perf/budgets'
import { mean, percentile, roundMs } from '../perf/stats'

export const LOAD_COUNTS = [32, 40, 60] as const
export type LoadCount = (typeof LOAD_COUNTS)[number]

const WARMUP_TICKS = 30
/** Ticks while the crowd is still spread on the opening straight. */
const CRUISE_TICKS = 70
/** Later ticks: jumps, falls, and respawn onto the eight gauntlet pads. */
const LAP_TICKS = 180

export interface TickReport {
  kind: 'spread-cruise' | 'spread-lap' | 'show-cruise' | 'show-lap'
  count: number
  ticks: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  maxMs: number
  meanMs: number
  physicsP99Ms: number
  budgetMs: number
  referenceMs: number
  withinBudget: boolean
  withinReference: boolean
  nanBeans: number
  meanSnapshotBytes: number
}

interface Cosmetic {
  colourIndex: number
  adj: number
  noun: number
  num: number
}

function botFrame(id: number, seq: number, tick: number): InputFrame {
  return {
    seq,
    tick,
    moveX: 0,
    moveZ: 1,
    jump: seq % 50 === id % 17,
    dive: false,
    camYaw: 0,
    quickChat: 0,
    emote: 0,
  }
}

function budgetFor(count: number): number {
  if (count <= 32) return SERVER_TICK_P99_MS[32]
  if (count <= 40) return SERVER_TICK_P99_MS[40]
  return SERVER_TICK_P99_MS[60]
}

function referenceFor(count: number): number {
  if (count <= 32) return SERVER_TICK_REFERENCE_MS[32]
  if (count <= 40) return SERVER_TICK_REFERENCE_MS[40]
  return SERVER_TICK_REFERENCE_MS[60]
}

/**
 * Beans sit on the start pad at capsule diameter + 0.2 m.
 * The gauntlet only has eight spawn points, so `Show.addPlayer` stacks bodies.
 * The spread layout is the 1.2 m spacing the levels use, and it is what the
 * 32 / 40 / 60 budgets are measured on.
 */
function placeBeans(world: BeanWorld, count: number): Map<number, Cosmetic> {
  const start = world.course.boxes.find((box) => box.id === 'start')
  if (!start) throw new Error('gauntlet has no start pad')
  const spacing = PHYSICS.capsuleRadius * 2 + 0.2
  const minX = start.x - start.hx + spacing
  const maxX = start.x + start.hx - spacing
  const minZ = start.z - start.hz + spacing
  const maxZ = start.z + start.hz - spacing
  const cols = Math.max(1, Math.floor((maxX - minX) / spacing) + 1)
  const feet = start.y + start.hy
  const cosmetics = new Map<number, Cosmetic>()
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = minX + col * spacing
    const z = minZ + row * spacing
    if (x > maxX + 1e-6 || z > maxZ + 1e-6) {
      throw new Error(`bean ${i + 1} does not fit on the start pad`)
    }
    const id = i + 1
    world.addBean(makeBean(id, x, centerYFromFeet(feet), z, i))
    const name = nameForSlot(id)
    cosmetics.set(id, { colourIndex: i % 8, adj: name.adj, noun: name.noun, num: name.num })
  }
  return cosmetics
}

function encodePersonalised(world: BeanWorld, cosmetics: Map<number, Cosmetic>, seq: number): number {
  const states = []
  for (const id of world.ids()) {
    const state = world.getState(id)
    if (state) states.push(state)
  }
  let bytes = 0
  for (const viewer of states) {
    const beans = []
    for (const state of states) {
      const dist = Math.hypot(state.px - viewer.px, state.pz - viewer.pz)
      if (dist > NET.interestNearM && !isFarSnapshotTick(world.tick)) continue
      const cosmetic = cosmetics.get(state.id) ?? { colourIndex: 0, adj: 0, noun: 0, num: 0 }
      beans.push(beanToSnap(state, cosmetic))
    }
    bytes += encodeSnapshot({ serverTick: world.tick, ackSeq: seq & 0xffff, beans }).byteLength
  }
  return bytes
}

function nanCount(world: BeanWorld): number {
  let nan = 0
  for (const id of world.ids()) {
    const state = world.getState(id)
    if (!state || !Number.isFinite(state.px) || !Number.isFinite(state.py) || !Number.isFinite(state.pz)) nan += 1
  }
  return nan
}

function sliceReport(
  kind: TickReport['kind'],
  count: number,
  full: number[],
  physics: number[],
  bytes: number[],
  nanBeans: number,
): TickReport {
  return report({ kind, count, full, physics, bytes, nanBeans })
}

function report(partial: {
  kind: TickReport['kind']
  count: number
  full: number[]
  physics: number[]
  bytes: number[]
  nanBeans: number
}): TickReport {
  const budgetMs = budgetFor(partial.count)
  const referenceMs = referenceFor(partial.count)
  const p99Ms = percentile(partial.full, 99)
  return {
    kind: partial.kind,
    count: partial.count,
    ticks: partial.full.length,
    p50Ms: roundMs(percentile(partial.full, 50)),
    p95Ms: roundMs(percentile(partial.full, 95)),
    p99Ms: roundMs(p99Ms),
    maxMs: roundMs(Math.max(...partial.full)),
    meanMs: roundMs(mean(partial.full)),
    physicsP99Ms: roundMs(percentile(partial.physics, 99)),
    budgetMs,
    referenceMs,
    withinBudget: p99Ms <= budgetMs && partial.nanBeans === 0,
    withinReference: p99Ms <= referenceMs,
    nanBeans: partial.nanBeans,
    meanSnapshotBytes: partial.bytes.length === 0 ? 0 : Math.round(mean(partial.bytes)),
  }
}

interface TimedTick {
  full: number
  physics: number
  bytes: number
}

function timeSpreadTick(world: BeanWorld, cosmetics: Map<number, Cosmetic>, count: number, seq: number): TimedTick {
  const inputs = new Map<number, InputFrame>()
  for (let id = 1; id <= count; id++) inputs.set(id, botFrame(id, seq, world.tick + 1))
  const t0 = performance.now()
  world.step(inputs)
  const t1 = performance.now()
  let bytes = 0
  if (isNearSnapshotTick(world.tick)) bytes = encodePersonalised(world, cosmetics, seq)
  const t2 = performance.now()
  return { full: t2 - t0, physics: t1 - t0, bytes }
}

/** Headless bots on the gauntlet. One full tick is physics plus personalised snapshots. */
export async function measureSpread(count: LoadCount): Promise<{ cruise: TickReport; lap: TickReport }> {
  const world = await BeanWorld.create()
  try {
    const cosmetics = placeBeans(world, count)
    const cruise: TimedTick[] = []
    const lap: TimedTick[] = []
    const total = WARMUP_TICKS + CRUISE_TICKS + LAP_TICKS
    for (let seq = 1; seq <= total; seq++) {
      const timed = timeSpreadTick(world, cosmetics, count, seq)
      if (seq <= WARMUP_TICKS) continue
      if (seq <= WARMUP_TICKS + CRUISE_TICKS) cruise.push(timed)
      else lap.push(timed)
    }
    const nanBeans = nanCount(world)
    const pack = (kind: TickReport['kind'], rows: TimedTick[]) =>
      sliceReport(
        kind,
        count,
        rows.map((row) => row.full),
        rows.map((row) => row.physics),
        rows.filter((row) => row.bytes > 0).map((row) => row.bytes),
        nanBeans,
      )
    return { cruise: pack('spread-cruise', cruise), lap: pack('spread-lap', lap) }
  } finally {
    world.destroy()
  }
}

/**
 * The real `Show` tick at the lobby cap. Spawn pads are the gauntlet's eight
 * points, so capsules overlap. That number is reported beside the spread run.
 */
export async function measureShow(count: number = NET.maxPlayers): Promise<{ cruise: TickReport; lap: TickReport }> {
  if (count > NET.maxPlayers) throw new Error(`show cap is ${NET.maxPlayers}`)
  const world = await BeanWorld.create()
  try {
    const show = new Show(world)
    const players = []
    for (let i = 0; i < count; i++) players.push(show.addPlayer())
    const cruise: number[] = []
    const lap: number[] = []
    const total = WARMUP_TICKS + CRUISE_TICKS + LAP_TICKS
    for (let seq = 1; seq <= total; seq++) {
      const t0 = performance.now()
      for (const player of players) show.pushInputs(player.id, [botFrame(player.id, seq, show.tick)])
      show.step()
      const dt = performance.now() - t0
      if (seq <= WARMUP_TICKS) continue
      if (seq <= WARMUP_TICKS + CRUISE_TICKS) cruise.push(dt)
      else lap.push(dt)
    }
    let nanBeans = 0
    for (const player of players) {
      const state = show.state(player.id)
      if (!state || !Number.isFinite(state.px) || !Number.isFinite(state.py) || !Number.isFinite(state.pz)) nanBeans += 1
    }
    return {
      cruise: sliceReport('show-cruise', count, cruise, cruise, [], nanBeans),
      lap: sliceReport('show-lap', count, lap, lap, [], nanBeans),
    }
  } finally {
    world.destroy()
  }
}

export function formatTickReport(rows: readonly TickReport[]): string {
  const header = 'kind   beans   p50 ms   p95 ms   p99 ms   max ms   physics p99   budget   reference   nan   snap bytes'
  const lines = rows.map((row) => {
    const cols = [
      row.kind.padEnd(13, ' '),
      String(row.count).padStart(5, ' '),
      row.p50Ms.toFixed(3).padStart(8, ' '),
      row.p95Ms.toFixed(3).padStart(8, ' '),
      row.p99Ms.toFixed(3).padStart(8, ' '),
      row.maxMs.toFixed(3).padStart(8, ' '),
      row.physicsP99Ms.toFixed(3).padStart(12, ' '),
      String(row.budgetMs).padStart(8, ' '),
      String(row.referenceMs).padStart(11, ' '),
      String(row.nanBeans).padStart(5, ' '),
      String(row.meanSnapshotBytes).padStart(12, ' '),
    ]
    return cols.join('  ')
  })
  return [header, ...lines].join('\n')
}
