import type { ContinentCode, World } from '../data/countries'
import { makeProjector } from './projection'

/**
 * Small dot portraits of each continent, cut straight out of the world raster —
 * the badge cards use the same material as the map instead of drawn artwork.
 */

export type GlyphCell = { c: number; r: number; iso: string }
export type Glyph = { cols: number; rows: number; cells: GlyphCell[] }

/**
 * Framing boxes in lon/lat. A continent's own extent will not do: countries-list
 * files Russia under Europe, so Europe's true bounds reach Kamchatka and the
 * card would show Eurasia. These are the views a person expects to see.
 */
const FRAME: Record<Exclude<ContinentCode, 'AN'>, [number, number, number, number]> = {
  // [west, south, east, north]
  EU: [-25, 34, 45, 71],
  AS: [25, -11, 150, 55],
  AF: [-19, -35, 52, 38],
  NA: [-170, 7, -52, 72],
  SA: [-82, -56, -34, 13],
  OC: [110, -48, 180, -8],
}

/** Longest side of a glyph, in dots. */
const SPAN = 26

export function buildContinentGlyphs(world: World): Map<ContinentCode, Glyph> {
  const project = makeProjector(world.projection)
  const out = new Map<ContinentCode, Glyph>()

  for (const [code, [west, south, east, north]] of Object.entries(FRAME)) {
    // Equal Earth's x shifts with latitude, so sample the edges rather than
    // trusting the four corners.
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = 0; i <= 16; i++) {
      const lon = west + ((east - west) * i) / 16
      for (let j = 0; j <= 16; j++) {
        const [px, py] = project(lon, south + ((north - south) * j) / 16)
        if (px < x0) x0 = px
        if (px > x1) x1 = px
        if (py < y0) y0 = py
        if (py > y1) y1 = py
      }
    }

    const gx0 = Math.max(0, Math.floor(x0))
    const gy0 = Math.max(0, Math.floor(y0))
    const gx1 = Math.min(world.width - 1, Math.ceil(x1))
    const gy1 = Math.min(world.height - 1, Math.ceil(y1))
    const stride = Math.max(1, Math.ceil(Math.max(gx1 - gx0, gy1 - gy0) / SPAN))

    const cells: GlyphCell[] = []
    let cols = 0
    let rows = 0
    for (let gy = gy0, r = 0; gy <= gy1; gy += stride, r++) {
      for (let gx = gx0, c = 0; gx <= gx1; gx += stride, c++) {
        if (r === 0) cols = c + 1
        const index = world.grid[gy * world.width + gx]
        if (!index) continue
        const country = world.byIndex[index]
        if (!country || country.continent !== code) continue
        cells.push({ c, r, iso: country.iso2 })
        rows = Math.max(rows, r + 1)
      }
    }

    out.set(code as ContinentCode, { cols, rows, cells })
  }

  return out
}
