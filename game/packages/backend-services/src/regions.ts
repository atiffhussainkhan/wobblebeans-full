/** Ping-beacon region ids (doc 08 §8). Never a coordinate pair. */
export const SHOW_REGIONS = ['eu-w', 'eu-c', 'na-e', 'na-w'] as const

export type ShowRegion = (typeof SHOW_REGIONS)[number]

const COORDINATES = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/

export function assertRegion(region: string | null | undefined): ShowRegion | null {
  if (region === null || region === undefined || region === '') return null
  if (COORDINATES.test(region.trim())) throw new Error('region must be a beacon id')
  if (!SHOW_REGIONS.includes(region as ShowRegion)) throw new Error('unknown region')
  return region as ShowRegion
}
