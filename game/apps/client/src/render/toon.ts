import * as THREE from 'three'

let gradient: THREE.DataTexture | null = null

/** Three-step toon ramp. Shared so every material uses the same bands. */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient
  const data = new Uint8Array([
    78, 78, 92, 255,
    168, 168, 176, 255,
    255, 255, 255, 255,
  ])
  const tex = new THREE.DataTexture(data, 3, 1)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  gradient = tex
  return tex
}

export function toonMaterial(color: THREE.ColorRepresentation, map?: THREE.Texture | null): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color,
    map: map ?? null,
    gradientMap: toonGradient(),
  })
  mat.shadowSide = THREE.FrontSide
  return mat
}

/** Inverted-hull outline. Call with the mesh's own geometry. */
export function outlineMaterial(ink = '#1f2140'): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: ink,
    side: THREE.BackSide,
  })
}
