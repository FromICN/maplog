import { useMemo } from 'react'
import type { World } from '../data/countries'
import type { City } from '../data/cities'
import { makeProjector } from './projection'

const EMPTY = new Float32Array(0)

/** Grid coordinates for every logged city, as flat x/y pairs ready for the canvas. */
export function useCityPins(
  world: World | null,
  cityIds: Set<string>,
  coords: Map<string, City>,
): Float32Array {
  return useMemo(() => {
    if (!world || !cityIds.size || !coords.size) return EMPTY
    const project = makeProjector(world.projection)
    const out = new Float32Array(cityIds.size * 2)
    let n = 0
    for (const id of cityIds) {
      const city = coords.get(id)
      if (!city) continue
      const [x, y] = project(city.lon, city.lat)
      out[n++] = x
      out[n++] = y
    }
    return out.subarray(0, n)
  }, [world, cityIds, coords])
}
