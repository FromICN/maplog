/**
 * Builds the per-country city chunks the picker loads on demand.
 *
 *   public/data/cities/index.json   { iso2: cityCount }
 *   public/data/cities/<ISO2>.json  { admins: [...], cities: [[id,name,ko,lat,lon,pop,adminIdx]] }
 *
 * Korean names come from GeoNames' language-tagged alternate names, not from
 * guessing at the alternatenames column — that column has no language tags, so
 * Seoul comes out as its colonial-era name and Shanghai as the Sino-Korean
 * reading. The tagged dump carries isPreferredName / isHistoric, which settles it.
 *
 * Usage: node scripts/build-city-data.mjs [--refresh]
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { openZipEntry, lines } from './lib/zip.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = resolve(ROOT, 'scripts', '.cache')
const OUT = resolve(ROOT, 'public', 'data', 'cities')

const SOURCES = {
  cities: 'https://download.geonames.org/export/dump/cities15000.zip',
  admin1: 'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
  altNames: 'https://download.geonames.org/export/dump/alternateNamesV2.zip',
}

const refresh = process.argv.includes('--refresh')

async function download(url, file) {
  const path = resolve(CACHE, file)
  if (existsSync(path) && !refresh) return path
  process.stdout.write(`  downloading ${file} … `)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  await pipeline(res.body, createWriteStream(path))
  console.log('done')
  return path
}

mkdirSync(CACHE, { recursive: true })

// ------------------------------------------------------------------ cities

const citiesZip = await download(SOURCES.cities, 'cities15000.zip')
const admin1Path = await download(SOURCES.admin1, 'admin1.txt')

/** code "KR.11" -> "Seoul" */
const adminNames = new Map()
for (const line of readFileSync(admin1Path, 'utf8').split('\n')) {
  const f = line.split('\t')
  if (f.length > 1) adminNames.set(f[0], f[1])
}

const cities = []
const wanted = new Set()
for await (const line of lines(openZipEntry(citiesZip, (n) => n.endsWith('cities15000.txt')))) {
  const f = line.split('\t')
  if (f.length < 15) continue
  const id = Number(f[0])
  cities.push({
    id,
    name: f[1],
    lat: Math.round(Number(f[4]) * 1e4) / 1e4,
    lon: Math.round(Number(f[5]) * 1e4) / 1e4,
    cc: f[8],
    admin: adminNames.get(`${f[8]}.${f[10]}`) ?? null,
    pop: Number(f[14]) || 0,
  })
  wanted.add(id)
}
console.log(`  ${cities.length.toLocaleString()} cities in ${new Set(cities.map((c) => c.cc)).size} countries`)

// ------------------------------------------------------------- korean names

const koCache = resolve(CACHE, 'ko-names.tsv')
if (!existsSync(koCache) || refresh) {
  const zip = await download(SOURCES.altNames, 'alternateNamesV2.zip')
  process.stdout.write('  filtering Korean names … ')
  const out = []
  let scanned = 0
  for await (const line of lines(openZipEntry(zip, (n) => n.endsWith('alternateNamesV2.txt')))) {
    scanned++
    // isolanguage sits in column 2; cheap reject before splitting the row.
    if (!line.includes('\tko\t')) continue
    const f = line.split('\t')
    if (f[2] !== 'ko') continue
    const geonameId = Number(f[1])
    if (!wanted.has(geonameId)) continue
    // geonameid, name, preferred, short, colloquial, historic
    out.push([geonameId, f[3], f[4] || '', f[5] || '', f[6] || '', f[7] || ''].join('\t'))
  }
  writeFileSync(koCache, out.join('\n'))
  console.log(`kept ${out.length} of ${scanned.toLocaleString()} rows`)
  // 200 MB is not worth keeping around once it has been distilled.
  if (!process.argv.includes('--keep-dump')) rmSync(resolve(CACHE, 'alternateNamesV2.zip'), { force: true })
}

/** Best Korean name per city: preferred wins, historic and colloquial lose. */
const koByCity = new Map()
for (const line of readFileSync(koCache, 'utf8').split('\n')) {
  if (!line) continue
  const [idText, name, preferred, short, colloquial, historic] = line.split('\t')
  const id = Number(idText)
  const score =
    (preferred === '1' ? 100 : 0) +
    (short === '1' ? 10 : 0) -
    (colloquial === '1' ? 50 : 0) -
    (historic === '1' ? 200 : 0)
  const current = koByCity.get(id)
  // Ties break toward the shorter name, which is the everyday form.
  if (!current || score > current.score || (score === current.score && name.length < current.name.length)) {
    koByCity.set(id, { name, score })
  }
}
console.log(`  Korean names for ${koByCity.size.toLocaleString()} cities`)

/**
 * GeoNames gives the official administrative form — 서울특별시, 요코하마 시.
 * People say 서울 and 요코하마. Only suffixes that are unambiguously
 * administrative are trimmed: a space before 시, and Korean forms inside Korea
 * (elsewhere a trailing 시 can belong to the name itself, as in 바라나시).
 */
function tidyKorean(name, cc) {
  let out = name.trim().replace(/\s+시$/, '')
  if (cc === 'KR') {
    const trimmed = out.replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구)$/, '')
    if (trimmed.length >= 2) out = trimmed
  }
  return out || name
}

// ------------------------------------------------------------------ output

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const byCountry = new Map()
for (const c of cities) {
  const list = byCountry.get(c.cc)
  if (list) list.push(c)
  else byCountry.set(c.cc, [c])
}

const index = {}
let bytes = 0
for (const [cc, list] of [...byCountry].sort()) {
  list.sort((a, b) => b.pop - a.pop)
  const admins = [...new Set(list.map((c) => c.admin).filter(Boolean))]
  const adminIndex = new Map(admins.map((a, i) => [a, i]))
  const rows = list.map((c) => [
    c.id,
    c.name,
    koByCity.has(c.id) ? tidyKorean(koByCity.get(c.id).name, cc) : '',
    c.lat,
    c.lon,
    c.pop,
    c.admin ? adminIndex.get(c.admin) : -1,
  ])
  const json = JSON.stringify({ admins, cities: rows })
  writeFileSync(resolve(OUT, `${cc}.json`), json)
  index[cc] = list.length
  bytes += json.length
}

writeFileSync(resolve(OUT, 'index.json'), JSON.stringify(index))

const biggest = Object.entries(index).sort((a, b) => b[1] - a[1]).slice(0, 5)
console.log(`\nwrote ${byCountry.size} chunks, ${(bytes / 1024 / 1024).toFixed(1)} MB total`)
console.log(`largest: ${biggest.map(([cc, n]) => `${cc} ${n}`).join(', ')}`)
