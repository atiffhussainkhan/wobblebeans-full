import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const gltfLoader = new GLTFLoader()
const textureLoader = new THREE.TextureLoader()

/** Public URL for a file under assets/. The dev server serves that tree at /assets. */
export function assetUrl(rel: string): string {
  const clean = rel.replace(/^\/+/, '').replace(/^assets\//, '')
  return `/assets/${clean}`
}

export function loadGltf(rel: string): Promise<{ scene: THREE.Group }> {
  return gltfLoader.loadAsync(assetUrl(rel))
}

export function loadTexture(rel: string): Promise<THREE.Texture> {
  return textureLoader.loadAsync(assetUrl(rel))
}

export interface AssetRecord {
  path: string
  bytes: number
  category: string
  license: string
}

export interface AssetManifest {
  version: number
  count: number
  assets: AssetRecord[]
}

/** Reads the generated catalogue. Missing file is a pipeline error, not a silent fallback. */
export async function loadManifest(): Promise<AssetManifest> {
  const res = await fetch(assetUrl('manifest.json'))
  if (!res.ok) throw new Error(`asset manifest missing (${res.status})`)
  return (await res.json()) as AssetManifest
}
