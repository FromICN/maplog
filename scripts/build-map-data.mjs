/**
 * Turns Natural Earth borders into the two files the app ships:
 *
 *   public/data/world-grid.bin   a W x H raster of country indices (Uint8)
 *   public/data/countries.json   the index -> country registry
 *
 * The raster is the whole trick. Rendering samples it with a stride that grows
 * as you zoom out, so the number of dots drawn stays flat at every zoom level,
 * and a tap maps to a country with one array lookup.
 *
 * Usage: node scripts/build-map-data.mjs [--width 1200]
 */
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import { geoEqualEarth, geoContains, geoBounds, geoCentroid, geoArea } from 'd3-geo'
import {
  UN_MEMBERS,
  UN_OBSERVERS,
  PARENT_OF,
  NAME_OVERRIDES_KO,
} from './data/regions.mjs'

const require = createRequire(import.meta.url)
const iso = require('i18n-iso-countries')
const { countries: COUNTRY_META } = require('countries-list')

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public', 'data')

const widthArg = process.argv.indexOf('--width')
const WIDTH = widthArg > -1 ? Number(process.argv[widthArg + 1]) : 1200

/** Land that belongs to no ISO country: rendered, but not something you can visit. */
const LAND_OTHER = 255

/** Natural Earth names for features with no ISO code that we still want claimable. */
const NAME_TO_ISO = { Kosovo: 'XK' }

const nameKo = new Intl.DisplayNames(['ko'], { type: 'region' })
const nameEn = new Intl.DisplayNames(['en'], { type: 'region' })

function flagOf(a2) {
  return String.fromCodePoint(...[...a2].map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

function isoOf(f) {
  if (f.id) return iso.numericToAlpha2(String(f.id)) ?? null
  return NAME_TO_ISO[f.properties?.name] ?? null
}

function loadFeatures(res) {
  const topo = require(`world-atlas/countries-${res}.json`)
  return feature(topo, topo.objects.countries).features
}

// ---------------------------------------------------------------- registry

const detailed = loadFeatures('10m')

const isoSet = new Set([...UN_MEMBERS, ...UN_OBSERVERS])
for (const f of detailed) {
  const a2 = isoOf(f)
  if (a2) isoSet.add(a2)
}

// Centroids come from the detailed set so island nations land in the right place.
const centroids = new Map()
for (const f of detailed) {
  const a2 = isoOf(f)
  if (!a2 || centroids.has(a2)) continue
  const c = geoCentroid(f)
  if (Number.isFinite(c[0]) && Number.isFinite(c[1])) centroids.set(a2, c)
}

const codes = [...isoSet].sort()
if (codes.length > 254) throw new Error(`${codes.length} countries will not fit in a Uint8 raster`)

const indexOf = new Map(codes.map((a2, i) => [a2, i + 1]))

// ------------------------------------------------------------- rasterizing

// 50m carries plenty of shape for a 1200px-wide raster and rasterizes far faster.
const coarse = loadFeatures('50m')

// Equal Earth: honest country areas, which is the whole point when the map is
// scored by how much of it you have lit up.
const projection = geoEqualEarth()
projection.fitWidth(WIDTH, { type: 'Sphere' })
const HEIGHT = Math.round(Math.abs(projection([0, -90])[1] - projection([0, 90])[1]))
projection.fitExtent(
  [
    [0, 0],
    [WIDTH, HEIGHT],
  ],
  { type: 'Sphere' },
)

console.log(`raster ${WIDTH} x ${HEIGHT} (${(WIDTH * HEIGHT).toLocaleString()} cells)`)

// 5-degree buckets so each cell only tests the handful of countries near it.
const BUCKET = 5
const BX = 360 / BUCKET
const BY = 180 / BUCKET
const buckets = Array.from({ length: BX * BY }, () => [])

function bucketPut(f, index) {
  const [[lon0, lat0], [lon1, lat1]] = geoBounds(f)
  const yr = [
    Math.floor((lat0 + 90) / BUCKET),
    Math.floor((lat1 + 90) / BUCKET),
  ]
  // Bounds that wrap the antimeridian come back with lon0 > lon1.
  const spans = lon0 <= lon1 ? [[lon0, lon1]] : [[lon0, 180], [-180, lon1]]
  for (const [a, b] of spans) {
    const xa = Math.floor((a + 180) / BUCKET)
    const xb = Math.floor((b + 180) / BUCKET)
    for (let by = Math.max(0, yr[0]); by <= Math.min(BY - 1, yr[1]); by++) {
      for (let bx = Math.max(0, xa); bx <= Math.min(BX - 1, xb); bx++) {
        buckets[by * BX + bx].push({ f, index })
      }
    }
  }
}

for (const f of coarse) {
  const a2 = isoOf(f)
  bucketPut(f, a2 ? indexOf.get(a2) : LAND_OTHER)
}

const grid = new Uint8Array(WIDTH * HEIGHT)
const counts = new Map()
let land = 0
const started = Date.now()

for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const px = x + 0.5
    const py = y + 0.5
    const ll = projection.invert([px, py])
    if (!ll) continue
    const [lon, lat] = ll
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) continue
    // Equal Earth inverts points outside the map to nonsense; round-trip to reject them.
    const back = projection([lon, lat])
    if (!back || Math.abs(back[0] - px) > 0.5 || Math.abs(back[1] - py) > 0.5) continue

    const bx = Math.min(BX - 1, Math.floor((lon + 180) / BUCKET))
    const by = Math.min(BY - 1, Math.floor((lat + 90) / BUCKET))
    const candidates = buckets[by * BX + bx]
    for (let i = 0; i < candidates.length; i++) {
      const { f, index } = candidates[i]
      if (!geoContains(f, ll)) continue
      grid[y * WIDTH + x] = index
      counts.set(index, (counts.get(index) ?? 0) + 1)
      land++
      break
    }
  }
  if (y % 50 === 0) process.stdout.write(`\r  row ${y}/${HEIGHT}  land ${land}`)
}
process.stdout.write(`\r  done in ${((Date.now() - started) / 1000).toFixed(1)}s — ${land} land cells\n`)

// ----------------------------------------------------------------- anchors

/**
 * Every country gets one guaranteed dot, so a visited country never disappears
 * when the renderer strides past its cells at low zoom.
 */
const cellsByIndex = new Map()
for (let i = 0; i < grid.length; i++) {
  const v = grid[i]
  if (!v || v === LAND_OTHER) continue
  let list = cellsByIndex.get(v)
  if (!list) cellsByIndex.set(v, (list = []))
  list.push(i)
}

/**
 * The anchor has to sit somewhere a person would point at. A plain centroid does
 * not: France's borders include French Guiana and Réunion, so its centroid lands
 * in the Atlantic and the nearest French cell ends up on the Spanish border.
 * So: take the country's largest connected blob of cells and anchor inside that.
 */
function mainlandAnchor(cells) {
  const own = new Set(cells)
  const seen = new Set()
  let best = null
  for (const start of cells) {
    if (seen.has(start)) continue
    const blob = []
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const i = stack.pop()
      blob.push(i)
      const x = i % WIDTH
      const neighbours = [i - WIDTH, i + WIDTH, x > 0 ? i - 1 : -1, x < WIDTH - 1 ? i + 1 : -1]
      for (const n of neighbours) {
        if (n < 0 || !own.has(n) || seen.has(n)) continue
        seen.add(n)
        stack.push(n)
      }
    }
    if (!best || blob.length > best.length) best = blob
  }
  let sx = 0
  let sy = 0
  for (const i of best) {
    sx += i % WIDTH
    sy += Math.floor(i / WIDTH)
  }
  const mx = sx / best.length
  const my = sy / best.length
  let pick = best[0]
  let pickD = Infinity
  for (const i of best) {
    const d = ((i % WIDTH) - mx) ** 2 + (Math.floor(i / WIDTH) - my) ** 2
    if (d < pickD) {
      pickD = d
      pick = i
    }
  }
  return [pick % WIDTH, Math.floor(pick / WIDTH)]
}

/** Same problem for countries too small to hold a cell: use their biggest island. */
function largestPartCentroid(a2) {
  const parts = []
  for (const f of detailed) {
    if (isoOf(f) !== a2) continue
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Polygon') parts.push({ type: 'Polygon', coordinates: g.coordinates })
    else if (g.type === 'MultiPolygon')
      for (const c of g.coordinates) parts.push({ type: 'Polygon', coordinates: c })
  }
  if (!parts.length) return centroids.get(a2) ?? null
  let best = parts[0]
  let bestArea = -1
  for (const p of parts) {
    const a = geoArea(p)
    if (a > bestArea) {
      bestArea = a
      best = p
    }
  }
  return geoCentroid(best)
}

const anchors = new Map()
let claimed = 0
let displaced = 0
for (const a2 of codes) {
  const index = indexOf.get(a2)
  const cells = cellsByIndex.get(index)

  if (cells?.length) {
    anchors.set(a2, mainlandAnchor(cells))
    continue
  }

  const centroid = largestPartCentroid(a2)
  if (!centroid || !Number.isFinite(centroid[0])) {
    console.warn(`  ! no geometry for ${a2}`)
    continue
  }
  const target = projection(centroid)
  const cx = Math.max(0, Math.min(WIDTH - 1, Math.round(target[0])))
  const cy = Math.max(0, Math.min(HEIGHT - 1, Math.round(target[1])))

  // Give microstates a cell of their own — otherwise they are invisible on the
  // map and a tap on them just selects whichever neighbour owns the pixel.
  let spot = null
  for (let r = 0; r <= 4 && !spot; r++) {
    for (let dy = -r; dy <= r && !spot; dy++) {
      for (let dx = -r; dx <= r && !spot; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) continue
        if (grid[y * WIDTH + x] === 0) spot = [x, y]
      }
    }
  }
  if (spot) {
    grid[spot[1] * WIDTH + spot[0]] = index
    cellsByIndex.set(index, [spot[1] * WIDTH + spot[0]])
    claimed++
    if (spot[0] !== cx || spot[1] !== cy) displaced++
    anchors.set(a2, spot)
  } else {
    anchors.set(a2, [cx, cy])
  }
}
console.log(`  ${anchors.size} anchors — ${claimed} microstates given a cell (${displaced} nudged aside)`)

// ------------------------------------------------------------------ output

const unSet = new Set([...UN_MEMBERS, ...UN_OBSERVERS])
const registry = codes.map((a2) => {
  const meta = COUNTRY_META[a2]
  return {
    i: indexOf.get(a2),
    iso2: a2,
    iso3: iso.alpha2ToAlpha3(a2) ?? a2,
    ko: NAME_OVERRIDES_KO[a2] ?? safeName(nameKo, a2),
    en: meta?.name ?? safeName(nameEn, a2),
    flag: flagOf(a2),
    continent: meta?.continent ?? 'AN',
    un: unSet.has(a2),
    parent: PARENT_OF[a2] ?? null,
    anchor: anchors.get(a2) ?? null,
    cells: cellsByIndex.get(indexOf.get(a2))?.length ?? 0,
  }
})

function safeName(dn, a2) {
  try {
    const n = dn.of(a2)
    return n === a2 ? a2 : n
  } catch {
    return a2
  }
}

const noAnchor = registry.filter((c) => !c.anchor)
if (noAnchor.length) console.warn('  ! missing anchors:', noAnchor.map((c) => c.iso2).join(', '))

mkdirSync(OUT, { recursive: true })

const header = Buffer.alloc(8)
header.write('MLG1', 0, 'ascii')
header.writeUInt16LE(WIDTH, 4)
header.writeUInt16LE(HEIGHT, 6)
writeFileSync(resolve(OUT, 'world-grid.bin'), Buffer.concat([header, Buffer.from(grid)]))

/**
 * The client needs to place city pins in the same space as the raster. Shipping
 * the fitted scale and translate lets it apply the Equal Earth formula directly
 * instead of pulling d3-geo into the bundle. Checked against d3 before writing.
 */
const k = projection.scale()
const [dx, dy] = projection.translate()
const equalEarth = (lon, lat) => {
  const A1 = 1.340264
  const A2 = -0.081106
  const A3 = 0.000893
  const A4 = 0.003796
  const M = Math.sqrt(3) / 2
  const l = (lon * Math.PI) / 180
  const p = (lat * Math.PI) / 180
  const t = Math.asin(M * Math.sin(p))
  const t2 = t * t
  const t6 = t2 * t2 * t2
  return [
    (l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))),
    t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)),
  ]
}
let worst = 0
for (let lon = -180; lon <= 180; lon += 7) {
  for (let lat = -85; lat <= 85; lat += 7) {
    const [ex, ey] = equalEarth(lon, lat)
    const [px, py] = projection([lon, lat])
    worst = Math.max(worst, Math.abs(k * ex + dx - px), Math.abs(dy - k * ey - py))
  }
}
if (worst > 1e-6) throw new Error(`projection parameters disagree with d3 by ${worst}px`)
console.log(`  projection check: max error ${worst.toExponential(1)}px`)

writeFileSync(
  resolve(OUT, 'countries.json'),
  JSON.stringify({
    width: WIDTH,
    height: HEIGHT,
    landOther: LAND_OTHER,
    projection: { kind: 'equalEarth', scale: k, translate: [dx, dy] },
    countries: registry,
  }),
)

const un = registry.filter((c) => c.un).length
console.log(`\nwrote ${registry.length} countries (${un} UN) -> public/data/`)
console.log(`grid ${(grid.length / 1024).toFixed(0)} KB raw`)
