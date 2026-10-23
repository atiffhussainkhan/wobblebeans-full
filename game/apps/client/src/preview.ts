import * as THREE from 'three'
import {
  BeanWorld,
  SHOW_LEVELS,
  beamDriver,
  forwardJumpDriver,
  routeDriver,
  wallDriver,
  type BeanState,
  type InputFrame,
  type LevelDef,
} from '@wobblebeans/shared'
import { loadGltf } from './assets/load'
import { CourseView, loadSky } from './render/course'

const params = new URLSearchParams(location.search)
const requested = params.get('level') ?? 'knock_knock_run'
const level = SHOW_LEVELS.find((entry) => entry.record.id === requested) ?? SHOW_LEVELS[0]!

const canvas = document.querySelector<HTMLCanvasElement>('#view')!
const title = document.querySelector<HTMLElement>('#title')!
const card = document.querySelector<HTMLElement>('#card')!
title.textContent = label(level.record.id)
card.textContent = level.record.goalCard

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
scene.background = new THREE.Color('#BFE6FF')
scene.fog = new THREE.Fog('#BFE6FF', 40, 180)
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400)
scene.add(new THREE.HemisphereLight('#fff4dd', '#6B4A3A', 1.15))
const sun = new THREE.DirectionalLight('#fff7e8', 1.8)
sun.position.set(18, 28, 12)
scene.add(sun)

const bean = new THREE.Group()
scene.add(bean)
void loadGltf('/assets/characters/character-oobi.glb').then((gltf) => {
  const model = gltf.scene
  const bounds = new THREE.Box3().setFromObject(model)
  const height = bounds.max.y - bounds.min.y
  const scale = height > 1e-4 ? 1.6 / height : 1
  model.scale.multiplyScalar(scale)
  // Bean position is the capsule centre, 0.8 m above the feet.
  model.position.y = -bounds.min.y * scale - 0.8
  bean.add(model)
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

void boot(level)

function label(id: string): string {
  return id
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

async function boot(current: LevelDef): Promise<void> {
  const sim = await BeanWorld.create(current.course)
  const view = new CourseView(sim.course)
  scene.add(view.group)
  void loadSky(scene)
  void view.addDressing()
  if (current.trophy) {
    const trophy = current.trophy
    void loadGltf('/assets/obstacles/star.glb').then((gltf) => {
      const model = gltf.scene
      const bounds = new THREE.Box3().setFromObject(model)
      const height = bounds.max.y - bounds.min.y
      if (height > 1e-4) model.scale.multiplyScalar(1.4 / height)
      model.position.set(trophy.x, trophy.y, trophy.z)
      view.group.add(model)
    })
  }
  sim.spawn(1, 0)
  const drive = driver(current)
  let last = performance.now()
  let acc = 0
  const frame = (now: number) => {
    acc += Math.min(50, now - last)
    last = now
    let steps = 0
    while (acc >= 20 && steps < 3) {
      acc -= 20
      steps += 1
      const state = sim.getState(1)
      if (!state) break
      const input = drive(state, sim.tick + 1)
      sim.step(new Map([[1, input]]))
    }
    const state = sim.getState(1)
    if (state) {
      bean.position.set(state.px, state.py, state.pz)
      bean.rotation.y = state.yaw
      camera.position.set(state.px - 9, state.py + 7, state.pz - 12)
      camera.lookAt(state.px, state.py + 1, state.pz + 6)
    }
    view.update(sim.tick)
    renderer.render(scene, camera)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

function driver(current: LevelDef): (state: BeanState, seq: number) => InputFrame {
  if (current.record.id === 'knock_knock_run') {
    const forward = forwardJumpDriver(current.course.landmarks.stoneJumpZs, 0)
    return (state, seq) => forward(state, seq)
  }
  if (current.record.id === 'wall_dodge') {
    const wall = wallDriver(false, 4.5)
    return (state, seq) => wall(state, seq, seq)
  }
  if (current.record.id === 'beam_hop') {
    const beam = beamDriver(0, 5.2)
    return (state, seq) => beam(state, seq, seq)
  }
  const route = routeDriver(current.route)
  return (state, seq) => route(state, seq)
}
