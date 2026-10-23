import { afterEach, describe, expect, it } from 'vitest'
import { BeanWorld } from '../physics/world'
import { OBSTACLE_KIT, kitSpec } from '../obstacles/kit'
import {
  launchReach,
  slimeHeight,
  SLIME_RISE_RATE,
  swingSafeWindow,
  throwLandsShort,
  tileDropOffset,
  wallPanelPose,
} from '../obstacles/motion'
import { sampleMoverPose } from '../obstacles/pose'
import { auditLevel } from './audit'
import { beamDriver, forwardJumpDriver, routeDriver, wallDriver } from './drive'
import { directorFor } from './director'
import { buildBumpyParade } from './levels/bumpy-parade'
import { buildSummitGrab } from './levels/summit-grab'
import { buildTileDrop, tileLayerCount } from './levels/tile-drop'
import { qualifyRound, pickTailHolders } from './qualify'
import { registeredLevels } from '../show/round'
import { courseForShow, LEVEL_CODE, SHOW_LEVELS, levelById, levelForPlug } from './registry'
import { qualifyQuota, roundHalfDown } from './schema'
import type { InputFrame, BeanState } from '../physics/types'

const worlds: BeanWorld[] = []

afterEach(() => {
  for (const world of worlds) world.destroy()
  worlds.length = 0
})

async function worldFor(courseId: string): Promise<BeanWorld> {
  const level = SHOW_LEVELS.find((entry) => entry.course.id === courseId)
  if (!level) throw new Error(courseId)
  const world = await BeanWorld.create(level.course)
  worlds.push(world)
  return world
}

describe('obstacle kit', () => {
  it('lists the eleven pieces and refuses a missing ragdoll tag', () => {
    expect(OBSTACLE_KIT).toHaveLength(11)
    for (const spec of OBSTACLE_KIT) {
      expect(spec.ragdoll, spec.id).toBeTruthy()
      expect(spec.telegraphS).toBeGreaterThanOrEqual(0.25)
      expect(kitSpec(spec.id).id).toBe(spec.id)
    }
    expect(kitSpec('bumper').ragdoll).toBe('none')
    expect(kitSpec('conveyor').speed).toBeLessThanOrEqual(3.6)
  })

  it('keeps mover poses a pure function of the tick', () => {
    const level = levelById('bumpy_parade')!
    const box = level.course.boxes.find((entry) => entry.id === 'swing-0')!
    const a = sampleMoverPose(box, 40)
    const b = sampleMoverPose(box, 40)
    const c = sampleMoverPose(box, 41)
    expect(a).toEqual(b)
    expect(a.x === c.x && a.z === c.z).toBe(false)
    expect(wallPanelPose(0, 0, 0, false).y).toBe(-40)
    expect(swingSafeWindow(4, 0.72, 5, 0.9)).toBeGreaterThanOrEqual(1.2)
    expect(tileDropOffset(0.9, 0)).toBe(-40)
    expect(tileDropOffset(0.3, 0)).toBeCloseTo(-0.08, 2)
  })

  it('keeps a launch short of the summit', () => {
    const summit = buildSummitGrab()
    const launch = summit.launches[0]!
    const trophy = summit.trophy!
    expect(throwLandsShort(launch, trophy, 20, launch.floorY)).toBe(true)
    const reach = launchReach(20)
    expect(reach.range).toBeLessThan(40)
    expect(SLIME_RISE_RATE).toBeCloseTo(60 / 135, 5)
    expect(slimeHeight(0, summit.slime ?? { graceS: 3, rate: SLIME_RISE_RATE, maxY: 60, startY: -2, limitS: 140, floodLeadS: 2 })).toBe(-2)
  })
})

describe('qualify rules', () => {
  it('rounds halves down and clamps the quota', () => {
    expect(roundHalfDown(22.4)).toBe(22)
    expect(roundHalfDown(22.5)).toBe(22)
    expect(roundHalfDown(7.8)).toBe(8)
    expect(qualifyQuota(32, 0.7)).toBe(22)
    expect(qualifyQuota(22, 0.6)).toBe(13)
    expect(qualifyQuota(13, 0.6)).toBe(8)
  })

  it('ends a race at the quota and a survival at the timer', () => {
    const actors = [
      { id: 1, eliminated: false, finishTick: 10, elimTick: null, score: 0, trophyTick: null },
      { id: 2, eliminated: false, finishTick: 12, elimTick: null, score: 0, trophyTick: null },
      { id: 3, eliminated: false, finishTick: null, elimTick: null, score: 0, trophyTick: null },
    ]
    const race = qualifyRound(actors, { mode: 'race', final: true, quota: 2, tick: 20, limitTick: 100 })
    expect(race).toMatchObject({ ended: true, reason: 'quota', qualifiedIds: [1, 2] })
    const alive = actors.map((actor) => ({ ...actor, finishTick: null, eliminated: false }))
    const survival = qualifyRound(alive, { mode: 'survival', final: true, quota: 2, tick: 200, limitTick: 100 })
    expect(survival.reason).toBe('timer')
    expect(survival.qualifiedIds.sort()).toEqual([1, 2, 3])
  })

  it('breaks a last-bean tie and lets every finalist win on time', () => {
    const tied = qualifyRound(
      [
        { id: 1, eliminated: true, finishTick: null, elimTick: 8, score: 0, trophyTick: null },
        { id: 2, eliminated: true, finishTick: null, elimTick: 8, score: 0, trophyTick: null },
      ],
      { mode: 'last-standing', final: true, quota: 1, tick: 8, limitTick: 100 },
    )
    expect(tied.reason).toBe('tie')
    expect(tied.qualifiedIds.sort()).toEqual([1, 2])
    const timeout = qualifyRound(
      [
        { id: 4, eliminated: false, finishTick: null, elimTick: null, score: 0, trophyTick: null },
        { id: 5, eliminated: false, finishTick: null, elimTick: null, score: 0, trophyTick: null },
      ],
      { mode: 'trophy', final: true, quota: 1, tick: 100, limitTick: 100 },
    )
    expect(timeout.qualifiedIds.sort()).toEqual([4, 5])
  })

  it('uses the survival quota when tile drop is not a final', () => {
    const actors = [1, 2, 3, 4].map((id) => ({
      id,
      eliminated: id > 2,
      finishTick: null,
      elimTick: id > 2 ? 5 : null,
      score: 0,
      trophyTick: null,
    }))
    const fallback = qualifyRound(actors, { mode: 'last-standing', final: false, quota: 2, tick: 10, limitTick: 100 })
    expect(fallback.reason).toBe('quota')
    expect(fallback.qualifiedIds.sort()).toEqual([1, 2])
  })

  it('seeds an exact tail count', () => {
    const holders = pickTailHolders([1, 2, 3, 4, 5], 3, 7)
    expect(new Set(holders).size).toBe(3)
    expect(pickTailHolders([1, 2, 3, 4, 5], 3, 7)).toEqual(holders)
  })
})

describe('mvp levels', () => {
  it('audits every show level and the disabled named variants', () => {
    expect(SHOW_LEVELS.map((level) => level.record.id)).toEqual([
      'knock_knock_run',
      'bumpy_parade',
      'slime_rise',
      'beam_hop',
      'wall_dodge',
      'tail_chase',
      'tile_drop',
      'summit_grab',
    ])
    for (const level of SHOW_LEVELS) {
      expect(auditLevel(level), level.record.id).toEqual([])
      expect(LEVEL_CODE[level.record.id as keyof typeof LEVEL_CODE]).toBeGreaterThan(0)
    }
    expect(auditLevel(buildBumpyParade({ variant: 'swap' }))).toEqual([])
    expect(auditLevel(buildSummitGrab({ variant: 'windy' }))).toEqual([])
    expect(auditLevel(courseForShow('knock_knock_run', { variant: 'easy' }))).toEqual([])
    expect(tileLayerCount(6)).toBe(2)
    expect(tileLayerCount(10)).toBe(3)
    expect(tileLayerCount(16)).toBe(4)
    const layers = buildTileDrop({ players: 16 })
    expect(layers.course.id).toBe('tile_drop__layers4')
    expect(layers.pieces.length).toBeGreaterThan(SHOW_LEVELS.find((level) => level.record.id === 'tile_drop')!.pieces.length)
    expect(registeredLevels().map((level) => level.id).sort()).toEqual([
      'beam-hop',
      'bumpy-parade',
      'knock-knock-run',
      'slime-rise',
      'summit-grab',
      'tail-chase',
      'tile-drop',
      'wall-dodge',
    ])
    expect(levelForPlug('knock-knock-run')?.course.id).toBe('knock_knock_run')
    expect(levelForPlug('summit-grab')?.record.rule).toBe('trophy')
  })

  it('uses every kit piece and only kit piece ids', () => {
    const used = new Set(SHOW_LEVELS.flatMap((level) => level.pieces.map((piece) => piece.piece)))
    for (const spec of OBSTACLE_KIT) {
      if (spec.id === 'slime') {
        expect(SHOW_LEVELS.some((level) => level.volumes.some((volume) => volume.kind === 'slime'))).toBe(true)
      } else {
        expect(used.has(spec.id), spec.id).toBe(true)
      }
    }
  })

  it('builds a world per level with finite goals and matching mover poses', async () => {
    for (const level of SHOW_LEVELS) {
      const sim = await worldFor(level.course.id)
      expect(Number.isFinite(level.record.killPlaneY)).toBe(true)
      expect(Number.isFinite(level.course.finish.minFeetY)).toBe(true)
      if (level.trophy) {
        expect(Number.isFinite(level.trophy.x + level.trophy.y + level.trophy.z)).toBe(true)
      }
      const other = await BeanWorld.create(level.course)
      worlds.push(other)
      sim.spawn(1, 0)
      other.spawn(1, 0)
      for (let tick = 0; tick < 3; tick++) {
        const frame = new Map<number, InputFrame>([[1, { seq: tick, tick, moveX: 0, moveZ: 1, jump: false, dive: false, camYaw: 0, quickChat: 0, emote: 0 }]])
        sim.step(frame)
        other.step(frame)
      }
      const a = sim.getState(1)!
      const b = other.getState(1)!
      expect(Math.abs(a.px - b.px)).toBeLessThan(1e-4)
      expect(Math.abs(a.py - b.py)).toBeLessThan(1e-4)
      expect(Math.abs(a.pz - b.pz)).toBeLessThan(1e-4)
      const mover = level.course.boxes.find((entry) => entry.mover)
      if (mover) {
        expect(sampleMoverPose(mover, sim.tick)).toEqual(sampleMoverPose(mover, other.tick))
      }
    }
  }, 120000)
})

function driveOf(id: string, levelRoute: { x: number; y: number; z: number; jump?: boolean }[], jumpZs: number[]) {
  const route = routeDriver(levelRoute)
  const forward = forwardJumpDriver(jumpZs, 0)
  const wall = wallDriver(false, 4.5)
  const beam = beamDriver(0, 5.2)
  return (state: BeanState, seq: number, tick: number): InputFrame => {
    if (id === 'knock_knock_run') return forward(state, seq)
    if (id === 'wall_dodge') return wall(state, seq, tick)
    if (id === 'beam_hop') return beam(state, seq, tick)
    return route(state, seq)
  }
}

describe('move and jump lines', () => {
  it('finishes Knock-Knock Run without diving', async () => {
    const level = levelById('knock_knock_run')!
    const sim = await worldFor(level.course.id)
    sim.spawn(1, 0)
    const drive = forwardJumpDriver(level.course.landmarks.stoneJumpZs, 0)
    let finished = false
    let dove = false
    for (let i = 1; i <= 2500 && !finished; i++) {
      const state = sim.getState(1)!
      const frame = drive(state, i)
      if (frame.dive) dove = true
      sim.step(new Map([[1, frame]]))
      finished = sim.getState(1)!.finished
    }
    const end = sim.getState(1)!
    expect(dove).toBe(false)
    expect(finished, `stopped at ${end.px.toFixed(2)}, ${end.py.toFixed(2)}, ${end.pz.toFixed(2)}`).toBe(true)
  }, 90000)

  it('reaches the bumpy parade finish on the shoulder line', async () => {
    const level = levelById('bumpy_parade')!
    const sim = await worldFor(level.course.id)
    sim.spawn(1, 0)
    const drive = routeDriver(level.route)
    let finished = false
    for (let i = 1; i <= 2800 && !finished; i++) {
      const state = sim.getState(1)!
      const frame = drive(state, i)
      expect(frame.dive).toBe(false)
      sim.step(new Map([[1, frame]]))
      finished = sim.getState(1)!.finished
    }
    const end = sim.getState(1)!
    expect(finished, `stopped at ${end.px.toFixed(2)}, ${end.py.toFixed(2)}, ${end.pz.toFixed(2)}`).toBe(true)
  }, 90000)

  it('grabs the summit trophy with move and jump', async () => {
    const level = levelById('summit_grab')!
    const sim = await worldFor(level.course.id)
    sim.spawn(1, 0)
    const drive = routeDriver(level.route)
    let won = false
    for (let i = 1; i <= 2500 && !won; i++) {
      const state = sim.getState(1)!
      const frame = drive(state, i)
      expect(frame.dive).toBe(false)
      sim.step(new Map([[1, frame]]))
      won = directorFor(sim)?.roster().some((actor) => actor.trophyTick != null) ?? false
    }
    const end = sim.getState(1)!
    expect(won, `stopped at ${end.px.toFixed(2)}, ${end.py.toFixed(2)}, ${end.pz.toFixed(2)}`).toBe(true)
  }, 90000)

  it('survives the opening of beam hop and wall dodge', async () => {
    for (const id of ['beam_hop', 'wall_dodge'] as const) {
      const level = levelById(id)!
      const sim = await worldFor(level.course.id)
      sim.spawn(1, 0)
      const drive = driveOf(id, level.route, [])
      for (let i = 1; i <= 600; i++) {
        const state = sim.getState(1)!
        const frame = drive(state, i, sim.tick + 1)
        expect(frame.dive).toBe(false)
        sim.step(new Map([[1, frame]]))
      }
      const actor = directorFor(sim)?.roster().find((entry) => entry.id === 1)
      const end = sim.getState(1)!
      expect(actor?.eliminated, `${id} at ${end.px.toFixed(2)}, ${end.pz.toFixed(2)}`).toBe(false)
    }
  }, 60000)

  it('seeds tail chase and climbs the first slime tier', async () => {
    const tail = levelById('tail_chase')!
    const tailWorld = await worldFor(tail.course.id)
    for (let id = 1; id <= 4; id++) tailWorld.spawn(id, id - 1)
    tailWorld.step(new Map())
    const scores = directorFor(tailWorld)!.roster().map((actor) => actor.score)
    expect(scores.reduce((sum, score) => sum + score, 0)).toBe(qualifyQuota(4, 0.6))

    const slime = levelById('slime_rise')!
    const sim = await worldFor(slime.course.id)
    sim.spawn(1, 0)
    const drive = routeDriver(slime.route)
    let finished = false
    for (let i = 1; i <= 5000 && !finished; i++) {
      const state = sim.getState(1)!
      const frame = drive(state, i)
      expect(frame.dive).toBe(false)
      sim.step(new Map([[1, frame]]))
      finished = sim.getState(1)!.finished
    }
    const actor = directorFor(sim)!.roster()[0]!
    const end = sim.getState(1)!
    expect(actor.eliminated, `slime at ${end.px.toFixed(1)}, ${end.py.toFixed(1)}, ${end.pz.toFixed(1)}`).toBe(false)
    expect(finished, `slime at ${end.px.toFixed(1)}, ${end.py.toFixed(1)}, ${end.pz.toFixed(1)} cp ${directorFor(sim)!.checkpointOf(1)}`).toBe(true)
  }, 60000)
})
